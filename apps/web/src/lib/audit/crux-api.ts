import pLimit from "p-limit";

import type { CruxData, CruxHistoryRecord } from "./types";

const CRUX_API_ENDPOINT =
	"https://chromeuxreport.googleapis.com/v1/records:queryRecord";
const CRUX_HISTORY_API_ENDPOINT =
	"https://chromeuxreport.googleapis.com/v1/records:queryHistoryRecord";

type CruxApiOptions = {
	apiKey: string;
	timeoutMs?: number;
	retry: {
		maxRetries: number;
		initialDelayMs: number;
		maxDelayMs: number;
	};
};

type CruxQueryRecordRequest = {
	url?: string;
	origin?: string;
	formFactor?: "DESKTOP" | "PHONE" | "TABLET";
};

type CruxQueryHistoryRequest = {
	origin: string;
	formFactor?: "DESKTOP" | "PHONE" | "TABLET";
};

type CruxApiResponse = {
	record?: CruxData;
	error?: {
		code?: number;
		message?: string;
		status?: string;
	};
};

type CruxHistoryApiResponse = {
	record?: CruxHistoryRecord;
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
 * Call CrUX API with retry logic and exponential backoff.
 * Returns null on 404 (no data available) - this is expected for low-traffic pages.
 */
async function callCruxApi(
	requestBody: CruxQueryRecordRequest,
	options: CruxApiOptions,
): Promise<CruxData | null> {
	const { apiKey, timeoutMs = 30_000, retry: retryConfig } = options;
	const apiUrl = new URL(CRUX_API_ENDPOINT);
	apiUrl.searchParams.set("key", apiKey);

	let lastError: unknown;
	let delay = retryConfig.initialDelayMs;

	for (let attempt = 0; attempt <= retryConfig.maxRetries; attempt++) {
		try {
			const controller = new AbortController();
			const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

			const response = await fetch(apiUrl.toString(), {
				method: "POST",
				headers: {
					"Content-Type": "application/json",
					Accept: "application/json",
				},
				body: JSON.stringify(requestBody),
				signal: controller.signal,
			});

			clearTimeout(timeoutId);
			const statusCode = response.status;

			// 404 means no CrUX data available (expected for low-traffic pages)
			if (statusCode === 404) {
				return null;
			}

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

				if (
					attempt === retryConfig.maxRetries ||
					!isRetryableError(error, statusCode)
				) {
					throw error;
				}

				const identifier = requestBody.url || requestBody.origin || "unknown";
				console.log(
					`[CrUX API] ${identifier} – attempt ${attempt + 1}/${retryConfig.maxRetries + 1} failed (${statusCode}), retrying in ${delay}ms …`,
				);

				await sleep(delay);
				delay = Math.min(delay * 2, retryConfig.maxDelayMs);
				lastError = error;
				continue;
			}

			const data = (await response.json()) as CruxApiResponse;
			if (data.error) {
				throw new Error(
					data.error.message || `CrUX API error: ${data.error.status}`,
				);
			}

			if (!data.record) {
				return null;
			}

			return data.record;
		} catch (error) {
			lastError = error;

			// 404 is expected - return null instead of retrying
			if (
				error instanceof Error &&
				(error.message.includes("404") ||
					error.message.includes("NOT_FOUND") ||
					error.message.includes("chrome ux report data not found"))
			) {
				return null;
			}

			if (attempt === retryConfig.maxRetries || !isRetryableError(error)) {
				throw error;
			}

			const identifier = requestBody.url || requestBody.origin || "unknown";
			const errorMsg =
				error instanceof Error ? error.message : String(error);
			console.log(
				`[CrUX API] ${identifier} – attempt ${attempt + 1}/${retryConfig.maxRetries + 1} failed, retrying in ${delay}ms … (${errorMsg.slice(0, 120)})`,
			);

			await sleep(delay);
			delay = Math.min(delay * 2, retryConfig.maxDelayMs);
		}
	}

	throw lastError;
}

/**
 * Query CrUX API for a specific URL.
 * Returns null if no data is available (404).
 */
export async function queryCruxRecord(
	request: CruxQueryRecordRequest,
	options: CruxApiOptions,
): Promise<CruxData | null> {
	return callCruxApi(request, options);
}

/**
 * Query CrUX API for an origin (site-wide data).
 */
export async function queryCruxOrigin(
	origin: string,
	formFactor: "DESKTOP" | "PHONE" | undefined,
	options: CruxApiOptions,
): Promise<CruxData | null> {
	return callCruxApi({ origin, formFactor }, options);
}

/**
 * Query CrUX History API for historical origin data (40 weeks).
 */
export async function queryCruxHistory(
	request: CruxQueryHistoryRequest,
	options: CruxApiOptions,
): Promise<CruxHistoryRecord | null> {
	const { apiKey, timeoutMs = 30_000, retry: retryConfig } = options;
	const apiUrl = new URL(CRUX_HISTORY_API_ENDPOINT);
	apiUrl.searchParams.set("key", apiKey);

	let lastError: unknown;
	let delay = retryConfig.initialDelayMs;

	for (let attempt = 0; attempt <= retryConfig.maxRetries; attempt++) {
		try {
			const controller = new AbortController();
			const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

			const response = await fetch(apiUrl.toString(), {
				method: "POST",
				headers: {
					"Content-Type": "application/json",
					Accept: "application/json",
				},
				body: JSON.stringify(request),
				signal: controller.signal,
			});

			clearTimeout(timeoutId);
			const statusCode = response.status;

			if (statusCode === 404) {
				return null;
			}

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

				if (
					attempt === retryConfig.maxRetries ||
					!isRetryableError(error, statusCode)
				) {
					throw error;
				}

				console.log(
					`[CrUX History API] ${request.origin} – attempt ${attempt + 1}/${retryConfig.maxRetries + 1} failed (${statusCode}), retrying in ${delay}ms …`,
				);

				await sleep(delay);
				delay = Math.min(delay * 2, retryConfig.maxDelayMs);
				lastError = error;
				continue;
			}

			const data = (await response.json()) as CruxHistoryApiResponse;
			if (data.error) {
				throw new Error(
					data.error.message || `CrUX History API error: ${data.error.status}`,
				);
			}

			if (!data.record) {
				return null;
			}

			return data.record;
		} catch (error) {
			lastError = error;

			if (
				error instanceof Error &&
				(error.message.includes("404") ||
					error.message.includes("NOT_FOUND"))
			) {
				return null;
			}

			if (attempt === retryConfig.maxRetries || !isRetryableError(error)) {
				throw error;
			}

			const errorMsg =
				error instanceof Error ? error.message : String(error);
			console.log(
				`[CrUX History API] ${request.origin} – attempt ${attempt + 1}/${retryConfig.maxRetries + 1} failed, retrying in ${delay}ms … (${errorMsg.slice(0, 120)})`,
			);

			await sleep(delay);
			delay = Math.min(delay * 2, retryConfig.maxDelayMs);
		}
	}

	throw lastError;
}

/**
 * Throttled batch processor for CrUX API calls.
 * Uses p-limit for concurrency control and adds delay between requests.
 */
export function createThrottledCruxClient(
	concurrency: number,
	delayBetweenRequestsMs: number = 500,
) {
	const limit = pLimit(concurrency);
	let lastRequestTime = 0;

	return {
		async queryRecord(
			request: CruxQueryRecordRequest,
			options: CruxApiOptions,
		): Promise<CruxData | null> {
			return limit(async () => {
				// Throttle: ensure minimum delay between requests
				const now = Date.now();
				const timeSinceLastRequest = now - lastRequestTime;
				if (timeSinceLastRequest < delayBetweenRequestsMs) {
					await sleep(delayBetweenRequestsMs - timeSinceLastRequest);
				}
				lastRequestTime = Date.now();

				return queryCruxRecord(request, options);
			});
		},
	};
}
