import { promises as fs } from "node:fs";
import path from "node:path";

import pLimit from "p-limit";

import { BrowserPool } from "./browser-pool";
import { createUrlSlug } from "./normalize-url";
import type {
	AuditPageResult,
	CategoryScores,
	DeviceResult,
	OpportunitySummary,
	RetryConfig,
	TimeoutConfig,
} from "./types";

// ---------------------------------------------------------------------------
// Defaults
// ---------------------------------------------------------------------------

const DEFAULT_TIMEOUTS = {
	chromeLaunch: 45_000,
	pageNavigation: 60_000,
	lighthouseAudit: 90_000,
} as const;

const DEFAULT_RETRY_CONFIG = {
	maxRetries: 3,
	initialDelayMs: 1_000,
	maxDelayMs: 8_000,
} as const;

// ---------------------------------------------------------------------------
// Public options
// ---------------------------------------------------------------------------

type AuditRunnerOptions = {
	outputRoot: string;
	concurrency: number;
	timeoutMs?: number;
	timeouts?: TimeoutConfig;
	retry?: RetryConfig;
	browserPoolSize?: number;
	onProgress?: (auditedCount: number) => void;
};

// ---------------------------------------------------------------------------
// Lighthouse loader (lazy, singleton)
// ---------------------------------------------------------------------------

type LighthouseLikeResult = {
	lhr: Record<string, unknown>;
	report: string | string[];
};

let lighthouseLoader: Promise<
	(
		url: string,
		flags?: Record<string, unknown>,
		config?: Record<string, unknown>,
	) => Promise<LighthouseLikeResult | undefined>
> | null = null;

async function getLighthouse() {
	if (!lighthouseLoader) {
		lighthouseLoader = import("lighthouse").then((module) => {
			return module.default as (
				url: string,
				flags?: Record<string, unknown>,
				config?: Record<string, unknown>,
			) => Promise<LighthouseLikeResult | undefined>;
		});
	}
	return lighthouseLoader;
}

// ---------------------------------------------------------------------------
// LHR helpers
// ---------------------------------------------------------------------------

function getScores(lhr: Record<string, unknown>): CategoryScores | null {
	const categories = lhr.categories;
	if (!categories || typeof categories !== "object") {
		return null;
	}

	function scoreFor(key: string) {
		const value = (categories as Record<string, { score?: unknown }>)[key]
			?.score;
		if (typeof value !== "number") {
			return null;
		}
		return Math.round(value * 100);
	}

	return {
		performance: scoreFor("performance"),
		accessibility: scoreFor("accessibility"),
		bestPractices: scoreFor("best-practices"),
		seo: scoreFor("seo"),
	};
}

function getOpportunities(lhr: Record<string, unknown>): OpportunitySummary[] {
	const audits = lhr.audits;
	if (!audits || typeof audits !== "object") {
		return [];
	}

	return Object.entries(audits)
		.map(([id, entry]) => {
			if (!entry || typeof entry !== "object") {
				return null;
			}

			const audit = entry as {
				title?: unknown;
				description?: unknown;
				displayValue?: unknown;
				score?: unknown;
				scoreDisplayMode?: unknown;
			};
			if (typeof audit.title !== "string") {
				return null;
			}
			if (
				audit.scoreDisplayMode !== "binary" &&
				audit.scoreDisplayMode !== "numeric"
			) {
				return null;
			}
			if (typeof audit.score !== "number" || audit.score >= 0.9) {
				return null;
			}

			return {
				id,
				title: audit.title,
				description:
					typeof audit.description === "string" ? audit.description : "",
				displayValue:
					typeof audit.displayValue === "string" ? audit.displayValue : null,
				score: Math.round(audit.score * 100),
			} satisfies OpportunitySummary;
		})
		.filter((entry): entry is NonNullable<typeof entry> => Boolean(entry))
		.sort(
			(left: OpportunitySummary, right: OpportunitySummary) =>
				(left.score ?? 100) - (right.score ?? 100),
		)
		.slice(0, 8);
}

/**
 * Extract the final screenshot from a Lighthouse result (base64 data-URI).
 * Lighthouse already captures a screenshot during every run.
 */
function extractScreenshotFromLhr(lhr: Record<string, unknown>): Buffer | null {
	const audits = lhr.audits as Record<string, unknown> | undefined;
	if (!audits) {
		return null;
	}

	// Try "final-screenshot" first (always present)
	const finalScreenshot = audits["final-screenshot"] as
		| {
				details?: { data?: string };
		  }
		| undefined;
	const dataUri = finalScreenshot?.details?.data;

	if (typeof dataUri === "string" && dataUri.startsWith("data:image/")) {
		const base64 = dataUri.replace(/^data:image\/\w+;base64,/, "");
		return Buffer.from(base64, "base64");
	}

	// Try "full-page-screenshot"
	const fullPage = audits["full-page-screenshot"] as
		| {
				details?: { screenshot?: { data?: string } };
		  }
		| undefined;
	const fullUri = fullPage?.details?.screenshot?.data;

	if (typeof fullUri === "string" && fullUri.startsWith("data:image/")) {
		const base64 = fullUri.replace(/^data:image\/\w+;base64,/, "");
		return Buffer.from(base64, "base64");
	}

	return null;
}

function combinedPerformance(result: {
	desktop: DeviceResult;
	mobile: DeviceResult;
}) {
	const scores: number[] = [];
	for (const device of [result.desktop, result.mobile]) {
		if (device.scores?.performance != null) {
			scores.push(device.scores.performance);
		}
	}
	if (scores.length === 0) {
		return null;
	}
	return Math.round(
		scores.reduce((sum, item) => sum + item, 0) / scores.length,
	);
}

// ---------------------------------------------------------------------------
// Retry helpers
// ---------------------------------------------------------------------------

function isRetryableError(error: unknown): boolean {
	if (!(error instanceof Error)) {
		return false;
	}
	const msg = error.message.toLowerCase();
	return (
		msg.includes("timeout") ||
		msg.includes("connection") ||
		msg.includes("econnrefused") ||
		msg.includes("econnreset") ||
		msg.includes("websocket") ||
		msg.includes("target closed") ||
		msg.includes("session closed") ||
		msg.includes("protocol error") ||
		msg.includes("navigation failed")
	);
}

async function sleep(ms: number): Promise<void> {
	return new Promise((resolve) => setTimeout(resolve, ms));
}

async function withRetry<T>(
	fn: () => Promise<T>,
	config: Required<RetryConfig>,
	context: string,
): Promise<T> {
	let lastError: unknown;
	let delay = config.initialDelayMs;

	for (let attempt = 0; attempt <= config.maxRetries; attempt++) {
		try {
			return await fn();
		} catch (error) {
			lastError = error;

			if (attempt === config.maxRetries || !isRetryableError(error)) {
				throw error;
			}

			console.log(
				`[Retry] ${context} – attempt ${attempt + 1}/${config.maxRetries + 1} failed, retrying in ${delay}ms … (${error instanceof Error ? error.message.slice(0, 120) : error})`,
			);

			await sleep(delay);
			delay = Math.min(delay * 2, config.maxDelayMs);
		}
	}

	throw lastError;
}

// ---------------------------------------------------------------------------
// Lighthouse config
// ---------------------------------------------------------------------------

function lighthouseConfigFor(device: "desktop" | "mobile") {
	if (device === "desktop") {
		return {
			extends: "lighthouse:default",
			settings: {
				onlyCategories: [
					"performance",
					"accessibility",
					"best-practices",
					"seo",
				],
				formFactor: "desktop",
				screenEmulation: {
					mobile: false,
					width: 1440,
					height: 900,
					deviceScaleFactor: 1,
					disabled: false,
				},
			},
		};
	}

	return {
		extends: "lighthouse:default",
		settings: {
			onlyCategories: ["performance", "accessibility", "best-practices", "seo"],
			formFactor: "mobile",
		},
	};
}

// ---------------------------------------------------------------------------
// Single-device audit (no Playwright – Lighthouse uses its own CDP client)
// ---------------------------------------------------------------------------

async function runDeviceAudit(params: {
	url: string;
	port: number;
	device: "desktop" | "mobile";
	pageDir: string;
	auditTimeout: number;
}): Promise<DeviceResult & { lhr?: Record<string, unknown> }> {
	const lighthouse = await getLighthouse();
	const flags = {
		port: params.port,
		output: "html",
		logLevel: "error",
		maxWaitForLoad: params.auditTimeout,
	};

	try {
		const result = await lighthouse(
			params.url,
			flags,
			lighthouseConfigFor(params.device),
		);
		if (!result) {
			throw new Error("Lighthouse returned empty result.");
		}

		const html = Array.isArray(result.report)
			? result.report.join("\n")
			: result.report;

		const reportFile = `${params.device}.report.html`;
		const lhrFile = `${params.device}.lhr.json`;
		await fs.writeFile(path.join(params.pageDir, reportFile), html, "utf8");
		await fs.writeFile(
			path.join(params.pageDir, lhrFile),
			JSON.stringify(result.lhr, null, 2),
			"utf8",
		);

		return {
			device: params.device,
			status: "success",
			scores: getScores(result.lhr),
			opportunities: getOpportunities(result.lhr),
			reportPath: path
				.join("pages", path.basename(params.pageDir), reportFile)
				.replaceAll(path.sep, "/"),
			lhrPath: path
				.join("pages", path.basename(params.pageDir), lhrFile)
				.replaceAll(path.sep, "/"),
			lhr: result.lhr,
		};
	} catch (error) {
		return {
			device: params.device,
			status: "error",
			scores: null,
			opportunities: [],
			reportPath: null,
			lhrPath: null,
			errorMessage: error instanceof Error ? error.message : "Unknown error",
		};
	}
}

// ---------------------------------------------------------------------------
// Audit a single URL  (acquire port from pool → run audits → release)
// ---------------------------------------------------------------------------

async function auditUrl(
	url: string,
	outputRoot: string,
	pool: BrowserPool,
	timeouts: Required<TimeoutConfig>,
	retryConfig: Required<RetryConfig>,
): Promise<AuditPageResult> {
	const slug = createUrlSlug(url);
	const pageDir = path.join(outputRoot, "pages", slug);
	await fs.mkdir(pageDir, { recursive: true });

	// Acquire a Chrome port from the pool (with retry)
	const { port, instanceId } = await withRetry(
		() => pool.acquire(),
		retryConfig,
		`acquire browser for ${url}`,
	);

	try {
		// ---- Desktop audit (with retry) ----
		const desktop = await withRetry(
			() =>
				runDeviceAudit({
					url,
					port,
					device: "desktop",
					pageDir,
					auditTimeout: timeouts.lighthouseAudit,
				}),
			retryConfig,
			`desktop audit ${url}`,
		);

		// ---- Mobile audit (with retry) ----
		const mobile = await withRetry(
			() =>
				runDeviceAudit({
					url,
					port,
					device: "mobile",
					pageDir,
					auditTimeout: timeouts.lighthouseAudit,
				}),
			retryConfig,
			`mobile audit ${url}`,
		);

		// ---- Screenshot: extracted from the desktop LHR ----
		let screenshotRelPath: string | null = null;
		try {
			const lhr = desktop.lhr ?? mobile.lhr;
			if (lhr) {
				const screenshotBuf = extractScreenshotFromLhr(lhr);
				if (screenshotBuf) {
					const screenshotFile = path.join(pageDir, "screenshot.png");
					await fs.writeFile(screenshotFile, screenshotBuf);
					screenshotRelPath = path
						.join("pages", slug, "screenshot.png")
						.replaceAll(path.sep, "/");
				}
			}
		} catch {
			// Non-critical – continue without screenshot
		}

		// Strip the internal lhr from the returned result
		const { lhr: _dLhr, ...desktopResult } = desktop;
		const { lhr: _mLhr, ...mobileResult } = mobile;

		return {
			url,
			canonicalUrl: url,
			slug,
			screenshotPath: screenshotRelPath,
			devices: {
				desktop: desktopResult as DeviceResult,
				mobile: mobileResult as DeviceResult,
			},
			combinedScore: combinedPerformance({
				desktop: desktopResult as DeviceResult,
				mobile: mobileResult as DeviceResult,
			}),
		};
	} finally {
		// Always return the Chrome instance to the pool
		pool.release(instanceId);
	}
}

// ---------------------------------------------------------------------------
// Public entry point
// ---------------------------------------------------------------------------

export async function runLighthouseForUrls(
	urls: string[],
	options: AuditRunnerOptions,
): Promise<AuditPageResult[]> {
	// Merge user-provided timeouts with defaults
	const timeouts: Required<TimeoutConfig> = {
		cdpConnect: options.timeouts?.cdpConnect ?? 0, // unused now
		chromeLaunch:
			options.timeouts?.chromeLaunch ?? DEFAULT_TIMEOUTS.chromeLaunch,
		pageNavigation:
			options.timeouts?.pageNavigation ??
			options.timeoutMs ??
			DEFAULT_TIMEOUTS.pageNavigation,
		lighthouseAudit:
			options.timeouts?.lighthouseAudit ?? DEFAULT_TIMEOUTS.lighthouseAudit,
	};

	// Merge retry config with defaults
	const retryConfig: Required<RetryConfig> = {
		maxRetries: options.retry?.maxRetries ?? DEFAULT_RETRY_CONFIG.maxRetries,
		initialDelayMs:
			options.retry?.initialDelayMs ?? DEFAULT_RETRY_CONFIG.initialDelayMs,
		maxDelayMs: options.retry?.maxDelayMs ?? DEFAULT_RETRY_CONFIG.maxDelayMs,
	};

	// Pool size: default to concurrency (one Chrome per concurrent audit)
	const poolSize = options.browserPoolSize ?? Math.max(options.concurrency, 2);

	console.log(`[Lighthouse] Auditing ${urls.length} URLs`);
	console.log(
		`[Lighthouse] concurrency=${options.concurrency}  poolSize=${poolSize}`,
	);
	console.log("[Lighthouse] timeouts:", timeouts);
	console.log("[Lighthouse] retry:", retryConfig);

	// Initialize the browser pool (just Chrome processes + ports, no Playwright)
	const pool = new BrowserPool({
		size: poolSize,
		chromeLaunchTimeout: timeouts.chromeLaunch,
	});

	try {
		await pool.initialize();

		const limit = pLimit(options.concurrency);
		const results: AuditPageResult[] = new Array(urls.length);
		let auditedCount = 0;

		await Promise.all(
			urls.map((url, index) =>
				limit(async () => {
					try {
						results[index] = await auditUrl(
							url,
							options.outputRoot,
							pool,
							timeouts,
							retryConfig,
						);
					} catch (error) {
						console.error(
							`[Lighthouse] FATAL for ${url}:`,
							error instanceof Error ? error.message : error,
						);
						// Record a full-failure result so the run can continue
						const slug = createUrlSlug(url);
						const errMsg =
							error instanceof Error ? error.message : "Unknown error";
						results[index] = {
							url,
							canonicalUrl: url,
							slug,
							screenshotPath: null,
							devices: {
								desktop: {
									device: "desktop",
									status: "error",
									scores: null,
									opportunities: [],
									reportPath: null,
									lhrPath: null,
									errorMessage: errMsg,
								},
								mobile: {
									device: "mobile",
									status: "error",
									scores: null,
									opportunities: [],
									reportPath: null,
									lhrPath: null,
									errorMessage: errMsg,
								},
							},
							combinedScore: null,
						};
					}

					auditedCount += 1;
					options.onProgress?.(auditedCount);

					if (auditedCount % 10 === 0 || auditedCount === urls.length) {
						const stats = pool.getStats();
						console.log(
							`[Lighthouse] ${auditedCount}/${urls.length} done  |  pool: ${stats.inUse} in-use, ${stats.available} free`,
						);
					}
				}),
			),
		);

		return results;
	} finally {
		await pool.shutdown();
	}
}
