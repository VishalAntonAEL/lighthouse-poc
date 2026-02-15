import { promises as fs } from "node:fs";
import path from "node:path";

import pLimit from "p-limit";

import {
	createThrottledPageSpeedClient,
	runPageSpeedApiAudit,
} from "./pagespeed-api";
import {
	createThrottledCruxClient,
	queryCruxOrigin,
	queryCruxHistory,
} from "./crux-api";
import { createUrlSlug } from "./normalize-url";
import type {
	AuditPageResult,
	Checkpoint,
	DeviceResult,
	RetryConfig,
	CruxData,
	CruxHistoryRecord,
} from "./types";

type BatchProcessorOptions = {
	urls: string[];
	outputRoot: string;
	jobId: string; // Job ID for checkpoint tracking
	concurrency: number; // Default: 5 (lower for API rate limits)
	timeouts: { audit: number };
	retry: { maxRetries: number; initialDelayMs: number; maxDelayMs: number };
	checkpointIntervalPages?: number; // Default: 50
	onProgress?: (audited: number, total: number) => void;
	onCheckpoint?: (checkpoint: Checkpoint) => void;
	resumeFrom?: Checkpoint; // Resume from previous run
	apiKey: string; // Google PageSpeed API key (same key works for CrUX)
	delayBetweenRequestsMs?: number; // Default: 500ms
	baseUrl: string; // Base URL for origin-level CrUX queries
};

const DEFAULT_CHECKPOINT_INTERVAL = 50;
const DEFAULT_DELAY_BETWEEN_REQUESTS_MS = 500;

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

/**
 * Extract origin from URL (e.g., https://example.com/page -> https://example.com)
 */
function extractOrigin(url: string): string {
	try {
		const urlObj = new URL(url);
		return `${urlObj.protocol}//${urlObj.host}`;
	} catch {
		return url;
	}
}

/**
 * Audit a single URL using PageSpeed API (desktop + mobile) and CrUX API.
 */
async function auditUrl(
	url: string,
	outputRoot: string,
	apiKey: string,
	timeoutMs: number,
	retryConfig: Required<RetryConfig>,
	throttledPageSpeedClient: ReturnType<typeof createThrottledPageSpeedClient>,
	throttledCruxClient: ReturnType<typeof createThrottledCruxClient>,
): Promise<AuditPageResult> {
	const slug = createUrlSlug(url);
	const pageDir = path.join(outputRoot, "pages", slug);
	await fs.mkdir(pageDir, { recursive: true });

	// 1. Run PageSpeed desktop + mobile audits (existing)
	const [desktop, mobile] = await Promise.all([
		throttledPageSpeedClient.runAudit({
			url,
			device: "desktop",
			outputDir: pageDir,
			apiKey,
			timeoutMs,
			retry: retryConfig,
		}),
		throttledPageSpeedClient.runAudit({
			url,
			device: "mobile",
			outputDir: pageDir,
			apiKey,
			timeoutMs,
			retry: retryConfig,
		}),
	]);

	// 2. Query CrUX API per-URL (desktop + mobile)
	// Many URLs may return null (404) if they don't have sufficient traffic
	const [cruxDesktop, cruxMobile] = await Promise.all([
		throttledCruxClient.queryRecord(
			{ url, formFactor: "DESKTOP" },
			{
				apiKey,
				timeoutMs: timeoutMs,
				retry: retryConfig,
			},
		),
		throttledCruxClient.queryRecord(
			{ url, formFactor: "PHONE" },
			{
				apiKey,
				timeoutMs: timeoutMs,
				retry: retryConfig,
			},
		),
	]);

	// Attach CrUX data to DeviceResult (null if no data available)
	desktop.cruxData = cruxDesktop;
	mobile.cruxData = cruxMobile;

	return {
		url,
		canonicalUrl: url,
		slug,
		screenshotPath: null, // PageSpeed API does not return screenshots
		devices: {
			desktop,
			mobile,
		},
		combinedScore: combinedPerformance({
			desktop,
			mobile,
		}),
	};
}

/**
 * Process a batch of URLs with concurrency control, checkpointing, and retry logic.
 * Uses Google PageSpeed Insights API instead of local Lighthouse CLI.
 */
export async function processUrlBatch(
	options: BatchProcessorOptions,
): Promise<AuditPageResult[]> {
	const checkpointInterval =
		options.checkpointIntervalPages ?? DEFAULT_CHECKPOINT_INTERVAL;
	const delayBetweenRequests =
		options.delayBetweenRequestsMs ?? DEFAULT_DELAY_BETWEEN_REQUESTS_MS;

	const retryConfig: Required<RetryConfig> = {
		maxRetries: options.retry.maxRetries,
		initialDelayMs: options.retry.initialDelayMs,
		maxDelayMs: options.retry.maxDelayMs,
	};

	console.log(`[BatchProcessor] Auditing ${options.urls.length} URLs via PageSpeed + CrUX APIs`);
	console.log(`[BatchProcessor] concurrency=${options.concurrency}`);
	console.log(`[BatchProcessor] delayBetweenRequests=${delayBetweenRequests}ms`);
	console.log(`[BatchProcessor] timeout=${options.timeouts.audit}ms`);
	console.log(`[BatchProcessor] retry:`, retryConfig);

	// Create throttled API clients
	const throttledPageSpeedClient = createThrottledPageSpeedClient(
		options.concurrency,
		delayBetweenRequests,
	);
	const throttledCruxClient = createThrottledCruxClient(
		options.concurrency,
		delayBetweenRequests,
	);

	// Build set of already-completed slugs if resuming
	const completedSlugs = new Set<string>();
	if (options.resumeFrom) {
		for (const slug of options.resumeFrom.completedSlugs) {
			completedSlugs.add(slug);
		}
		console.log(
			`[BatchProcessor] Resuming from checkpoint: ${completedSlugs.size} URLs already completed`,
		);
	}

	const limit = pLimit(options.concurrency);
	const results: AuditPageResult[] = new Array(options.urls.length);
	let auditedCount = 0;
	let lastCheckpointCount = 0;

	// Process URLs with concurrency control (throttling handled by client)
	await Promise.all(
		options.urls.map((url, index) =>
			limit(async () => {
				const slug = createUrlSlug(url);

		// Skip if already completed (resume mode)
		if (completedSlugs.has(slug)) {
			// Try to load existing result
			try {
				const desktopSlimPath = path.join(
					options.outputRoot,
					"pages",
					slug,
					"desktop.slim.json",
				);
				const mobileSlimPath = path.join(
					options.outputRoot,
					"pages",
					slug,
					"mobile.slim.json",
				);

				const [desktopData, mobileData] = await Promise.all([
					fs.readFile(desktopSlimPath, "utf8").catch(() => null),
					fs.readFile(mobileSlimPath, "utf8").catch(() => null),
				]);

							if (desktopData && mobileData) {
								const desktop = JSON.parse(desktopData);
								const mobile = JSON.parse(mobileData);

								const desktopResult = {
									device: "desktop" as const,
									status: "success" as const,
									scores: desktop.categories,
									opportunities: desktop.opportunities,
									metrics: desktop.metrics,
									slimLhrPath: `pages/${slug}/desktop.slim.json`,
									cruxData: null, // Will be loaded separately if needed
								};
								const mobileResult = {
									device: "mobile" as const,
									status: "success" as const,
									scores: mobile.categories,
									opportunities: mobile.opportunities,
									metrics: mobile.metrics,
									slimLhrPath: `pages/${slug}/mobile.slim.json`,
									cruxData: null, // Will be loaded separately if needed
								};

								results[index] = {
									url,
									canonicalUrl: url,
									slug,
									screenshotPath: null,
									devices: {
										desktop: desktopResult,
										mobile: mobileResult,
									},
									combinedScore: combinedPerformance({
										desktop: desktopResult,
										mobile: mobileResult,
									}),
								};
					auditedCount += 1;
					options.onProgress?.(auditedCount, options.urls.length);
					return;
				}
			} catch {
				// Failed to load, will re-audit
			}
		}

		try {
			results[index] = await auditUrl(
				url,
				options.outputRoot,
				options.apiKey,
				options.timeouts.audit,
				retryConfig,
				throttledPageSpeedClient,
				throttledCruxClient,
			);
		} catch (error) {
			console.error(
				`[BatchProcessor] FATAL for ${url}:`,
				error instanceof Error ? error.message : error,
			);
			// Record a full-failure result so the run can continue
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
						slimLhrPath: null,
						errorMessage: errMsg,
					},
					mobile: {
						device: "mobile",
						status: "error",
						scores: null,
						opportunities: [],
						slimLhrPath: null,
						errorMessage: errMsg,
					},
				},
				combinedScore: null,
			};
		}

		auditedCount += 1;
		options.onProgress?.(auditedCount, options.urls.length);

		// Checkpoint every N pages
		if (
			auditedCount - lastCheckpointCount >= checkpointInterval ||
			auditedCount === options.urls.length
		) {
			const completedSlugs = results
				.slice(0, auditedCount)
				.filter((r) => r && r.devices.desktop.status === "success")
				.map((r) => r.slug);
			const failedSlugs = results
				.slice(0, auditedCount)
				.filter(
					(r) =>
						r &&
						r.devices.desktop.status === "error" &&
						r.devices.mobile.status === "error",
				)
				.map((r) => r.slug);

			const checkpoint: Checkpoint = {
				jobId: options.jobId,
				completedSlugs,
				failedSlugs,
				auditedCount,
				savedAt: new Date().toISOString(),
			};

			options.onCheckpoint?.(checkpoint);
			lastCheckpointCount = auditedCount;
		}

		if (auditedCount % 10 === 0 || auditedCount === options.urls.length) {
			console.log(
				`[BatchProcessor] ${auditedCount}/${options.urls.length} done`,
			);
		}
			}),
		),
	);

	// Query origin-level CrUX data and history (once per run)
	const origin = extractOrigin(options.baseUrl);
	console.log(`[BatchProcessor] Querying origin-level CrUX data for ${origin}`);

	const originCruxOptions = {
		apiKey: options.apiKey,
		timeoutMs: options.timeouts.audit,
		retry: retryConfig,
	};

	const [originCruxDesktop, originCruxMobile, originCruxCombined, cruxHistory] =
		await Promise.all([
			queryCruxOrigin(origin, "DESKTOP", originCruxOptions),
			queryCruxOrigin(origin, "PHONE", originCruxOptions),
			queryCruxOrigin(origin, undefined, originCruxOptions),
			queryCruxHistory({ origin }, originCruxOptions),
		]);

	// Store origin CrUX data in a separate file for manifest
	const originCruxPath = path.join(options.outputRoot, "origin-crux.json");
	await fs.writeFile(
		originCruxPath,
		JSON.stringify(
			{
				desktop: originCruxDesktop,
				mobile: originCruxMobile,
				combined: originCruxCombined,
			},
			null,
			2,
		),
		"utf8",
	);

	if (cruxHistory) {
		const cruxHistoryPath = path.join(options.outputRoot, "crux-history.json");
		await fs.writeFile(
			cruxHistoryPath,
			JSON.stringify(cruxHistory, null, 2),
			"utf8",
		);
	}

	console.log(`[BatchProcessor] Origin CrUX data saved`);

	return results;
}
