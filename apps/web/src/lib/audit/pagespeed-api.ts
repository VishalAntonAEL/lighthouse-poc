import { promises as fs } from "node:fs";
import path from "node:path";

import pLimit from "p-limit";

import { extractSlimLhr } from "./lhr-extractor";
import { createUrlSlug } from "./normalize-url";
import type { DeviceResult } from "./types";

const API_ENDPOINT =
	"https://pagespeedonline.googleapis.com/pagespeedonline/v5/runPagespeed";

type PageSpeedApiOptions = {
	url: string;
	strategy: "desktop" | "mobile";
	apiKey: string;
	timeoutMs?: number;
};

type PageSpeedApiResponse = {
	lighthouseResult?: {
		requestedUrl?: string;
		finalUrl?: string;
		fetchTime?: string;
		categories?: Record<string, { score?: number | null }>;
		audits?: Record<string, unknown>;
	};
	error?: {
		code?: number;
		message?: string;
		status?: string;
	};
};

async function sleep(ms: number): Promise<void> {
	return new Promise((resolve) => setTimeout(resolve, ms));
}

function isRetryableError(error: unknown, statusCode?: number): boolean {
	// 429 Too Many Requests - retry with backoff
	if (statusCode === 429) {
		return true;
	}
	// 5xx server errors - retry
	if (statusCode && statusCode >= 500 && statusCode < 600) {
		return true;
	}
	// Network/timeout errors
	if (error instanceof Error) {
		const msg = error.message.toLowerCase();
		return (
			msg.includes("timeout") ||
			msg.includes("econnrefused") ||
			msg.includes("econnreset") ||
			msg.includes("network") ||
			msg.includes("fetch failed")
		);
	}
	return false;
}

/**
 * Call PageSpeed Insights API with retry logic and exponential backoff.
 */
async function callPageSpeedApi(
	options: PageSpeedApiOptions,
	retryConfig: { maxRetries: number; initialDelayMs: number; maxDelayMs: number },
): Promise<PageSpeedApiResponse> {
	const { url, strategy, apiKey, timeoutMs = 90_000 } = options;
	const apiUrl = new URL(API_ENDPOINT);
	apiUrl.searchParams.set("url", url);
	apiUrl.searchParams.set("strategy", strategy);
	apiUrl.searchParams.set("key", apiKey);
	// Request all categories; default is performance-only
	["PERFORMANCE", "ACCESSIBILITY", "BEST_PRACTICES", "SEO"].forEach(
		(cat) => apiUrl.searchParams.append("category", cat),
	);

	let lastError: unknown;
	let delay = retryConfig.initialDelayMs;

	for (let attempt = 0; attempt <= retryConfig.maxRetries; attempt++) {
		try {
			const controller = new AbortController();
			const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

			const response = await fetch(apiUrl.toString(), {
				signal: controller.signal,
				headers: {
					"Accept": "application/json",
				},
			});

			clearTimeout(timeoutId);
			const statusCode = response.status;

			if (!response.ok) {
				let errorMessage = `HTTP ${statusCode}`;
				try {
					const errorData = await response.json();
					errorMessage = errorData.error?.message || errorMessage;
				} catch {
					// Ignore JSON parse errors
				}

				const error = new Error(errorMessage);
				(error as { statusCode?: number }).statusCode = statusCode;

				if (attempt === retryConfig.maxRetries || !isRetryableError(error, statusCode)) {
					throw error;
				}

				console.log(
					`[PageSpeed API] ${url} (${strategy}) – attempt ${attempt + 1}/${retryConfig.maxRetries + 1} failed (${statusCode}), retrying in ${delay}ms …`,
				);

				await sleep(delay);
				delay = Math.min(delay * 2, retryConfig.maxDelayMs);
				lastError = error;
				continue;
			}

			const data = (await response.json()) as PageSpeedApiResponse;
			return data;
		} catch (error) {
			lastError = error;

			if (attempt === retryConfig.maxRetries || !isRetryableError(error)) {
				throw error;
			}

			const errorMsg =
				error instanceof Error ? error.message : String(error);
			console.log(
				`[PageSpeed API] ${url} (${strategy}) – attempt ${attempt + 1}/${retryConfig.maxRetries + 1} failed, retrying in ${delay}ms … (${errorMsg.slice(0, 120)})`,
			);

			await sleep(delay);
			delay = Math.min(delay * 2, retryConfig.maxDelayMs);
		}
	}

	throw lastError;
}

/**
 * Run PageSpeed Insights API audit for a single URL and strategy.
 * Returns DeviceResult compatible with existing batch processor.
 */
export async function runPageSpeedApiAudit(
	options: {
		url: string;
		device: "desktop" | "mobile";
		outputDir: string;
		apiKey: string;
		timeoutMs?: number;
		retry: {
			maxRetries: number;
			initialDelayMs: number;
			maxDelayMs: number;
		};
	},
): Promise<DeviceResult> {
	const { url, device, outputDir, apiKey, timeoutMs, retry } = options;
	const strategy = device === "desktop" ? "desktop" : "mobile";

	try {
		const response = await callPageSpeedApi(
			{
				url,
				strategy,
				apiKey,
				timeoutMs,
			},
			retry,
		);

		if (response.error) {
			throw new Error(
				response.error.message || `PageSpeed API error: ${response.error.status}`,
			);
		}

		if (!response.lighthouseResult) {
			throw new Error("PageSpeed API response missing lighthouseResult");
		}

		// Extract slim LHR using existing extractor
		const slimLhr = extractSlimLhr(response.lighthouseResult, device);

		// Save slim JSON
		const slug = createUrlSlug(url);
		const slimJsonPath = path.join(outputDir, `${device}.slim.json`);
		await fs.writeFile(
			slimJsonPath,
			JSON.stringify(slimLhr, null, 2),
			"utf8",
		);

		return {
			device,
			status: "success",
			scores: slimLhr.categories,
			opportunities: slimLhr.opportunities,
			metrics: slimLhr.metrics,
			slimLhrPath: path
				.join("pages", slug, `${device}.slim.json`)
				.replaceAll(path.sep, "/"),
		};
	} catch (error) {
		return {
			device,
			status: "error",
			scores: null,
			opportunities: [],
			slimLhrPath: null,
			errorMessage:
				error instanceof Error ? error.message : "Unknown error",
		};
	}
}

/**
 * Throttled batch processor for PageSpeed API calls.
 * Uses p-limit for concurrency control and adds delay between requests.
 */
export function createThrottledPageSpeedClient(
	concurrency: number,
	delayBetweenRequestsMs: number = 500,
) {
	const limit = pLimit(concurrency);
	let lastRequestTime = 0;

	return {
		async runAudit(
			options: Parameters<typeof runPageSpeedApiAudit>[0],
		): Promise<DeviceResult> {
			return limit(async () => {
				// Throttle: ensure minimum delay between requests
				const now = Date.now();
				const timeSinceLastRequest = now - lastRequestTime;
				if (timeSinceLastRequest < delayBetweenRequestsMs) {
					await sleep(delayBetweenRequestsMs - timeSinceLastRequest);
				}
				lastRequestTime = Date.now();

				return runPageSpeedApiAudit(options);
			});
		},
	};
}
