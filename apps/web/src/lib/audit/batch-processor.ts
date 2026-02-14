import { promises as fs } from "node:fs";
import path from "node:path";

import pLimit from "p-limit";

import { ChromePool } from "./chrome-pool";
import { runLighthouseCliAudit } from "./lighthouse-cli";
import { createUrlSlug } from "./normalize-url";
import type {
	AuditPageResult,
	Checkpoint,
	DeviceResult,
	RetryConfig,
	TimeoutConfig,
} from "./types";

type BatchProcessorOptions = {
	urls: string[];
	outputRoot: string;
	jobId: string; // Job ID for checkpoint tracking
	concurrency: number; // Default: 10
	chromePoolSize?: number; // Default: concurrency
	timeouts: { audit: number; chromeLaunch: number };
	retry: { maxRetries: number; initialDelayMs: number; maxDelayMs: number };
	checkpointIntervalPages?: number; // Default: 50
	onProgress?: (audited: number, total: number) => void;
	onCheckpoint?: (checkpoint: Checkpoint) => void;
	resumeFrom?: Checkpoint; // Resume from previous run
};

const DEFAULT_CHECKPOINT_INTERVAL = 50;

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
 * Audit a single URL (acquire port from pool → run audits → release)
 */
async function auditUrl(
	url: string,
	outputRoot: string,
	pool: ChromePool,
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
				runLighthouseCliAudit({
					url,
					port,
					device: "desktop",
					outputDir: pageDir,
					timeoutMs: timeouts.lighthouseAudit,
				}),
			retryConfig,
			`desktop audit ${url}`,
		);

		// ---- Mobile audit (with retry) ----
		const mobile = await withRetry(
			() =>
				runLighthouseCliAudit({
					url,
					port,
					device: "mobile",
					outputDir: pageDir,
					timeoutMs: timeouts.lighthouseAudit,
				}),
			retryConfig,
			`mobile audit ${url}`,
		);

		// Screenshot is already saved by runLighthouseCliAudit
		let screenshotRelPath: string | null = null;
		try {
			const screenshotFile = path.join(pageDir, "screenshot.png");
			const exists = await fs
				.access(screenshotFile)
				.then(() => true)
				.catch(() => false);
			if (exists) {
				screenshotRelPath = path
					.join("pages", slug, "screenshot.png")
					.replaceAll(path.sep, "/");
			}
		} catch {
			// Non-critical – continue without screenshot
		}

		return {
			url,
			canonicalUrl: url,
			slug,
			screenshotPath: screenshotRelPath,
			devices: {
				desktop,
				mobile,
			},
			combinedScore: combinedPerformance({
				desktop,
				mobile,
			}),
		};
	} finally {
		// Always return the Chrome instance to the pool
		pool.release(instanceId);
	}
}

/**
 * Process a batch of URLs with concurrency control, checkpointing, and retry logic.
 */
export async function processUrlBatch(
	options: BatchProcessorOptions,
): Promise<AuditPageResult[]> {
	const checkpointInterval =
		options.checkpointIntervalPages ?? DEFAULT_CHECKPOINT_INTERVAL;
	const poolSize = options.chromePoolSize ?? options.concurrency;

	const timeouts: Required<TimeoutConfig> = {
		cdpConnect: 0, // Unused with CLI
		chromeLaunch: options.timeouts.chromeLaunch,
		pageNavigation: 0, // Unused with CLI
		lighthouseAudit: options.timeouts.audit,
	};

	const retryConfig: Required<RetryConfig> = {
		maxRetries: options.retry.maxRetries,
		initialDelayMs: options.retry.initialDelayMs,
		maxDelayMs: options.retry.maxDelayMs,
	};

	console.log(`[BatchProcessor] Auditing ${options.urls.length} URLs`);
	console.log(
		`[BatchProcessor] concurrency=${options.concurrency}  poolSize=${poolSize}`,
	);
	console.log("[BatchProcessor] timeouts:", timeouts);
	console.log("[BatchProcessor] retry:", retryConfig);

	// Initialize the browser pool
	const pool = new ChromePool({
		size: poolSize,
		chromeLaunchTimeout: timeouts.chromeLaunch,
	});

	try {
		await pool.initialize();

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

								results[index] = {
									url,
									canonicalUrl: url,
									slug,
									screenshotPath: null, // Could load if needed
									devices: {
										desktop: {
											device: "desktop",
											status: "success",
											scores: desktop.categories,
											opportunities: desktop.opportunities,
											slimLhrPath: `pages/${slug}/desktop.slim.json`,
										},
										mobile: {
											device: "mobile",
											status: "success",
											scores: mobile.categories,
											opportunities: mobile.opportunities,
											slimLhrPath: `pages/${slug}/mobile.slim.json`,
										},
									},
									combinedScore: combinedPerformance({
										desktop: results[index]?.devices.desktop ?? {
											device: "desktop",
											status: "success",
											scores: desktop.categories,
											opportunities: desktop.opportunities,
											slimLhrPath: `pages/${slug}/desktop.slim.json`,
										},
										mobile: results[index]?.devices.mobile ?? {
											device: "mobile",
											status: "success",
											scores: mobile.categories,
											opportunities: mobile.opportunities,
											slimLhrPath: `pages/${slug}/mobile.slim.json`,
										},
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
							pool,
							timeouts,
							retryConfig,
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
						const stats = pool.getStats();
						console.log(
							`[BatchProcessor] ${auditedCount}/${options.urls.length} done  |  pool: ${stats.inUse} in-use, ${stats.available} free`,
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
