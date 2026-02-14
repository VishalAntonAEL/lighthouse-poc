import { randomUUID } from "node:crypto";

import { buildRunManifest } from "./aggregate";
import { processUrlBatch } from "./batch-processor";
import { discoverUrls } from "./url-discovery";
import { normalizeUrl } from "./normalize-url";
import {
	createJobDirectory,
	publishLatestFromJob,
	readCheckpoint,
	readJobStatus,
	writeCheckpoint,
	writeJobManifest,
	writeJobStatus,
} from "./storage";
import type { AuditJob, Checkpoint } from "./types";

function getArg(flag: string): string | null {
	const index = process.argv.indexOf(flag);
	if (index === -1) {
		return null;
	}

	return process.argv[index + 1] ?? null;
}

function getIntArg(flag: string, defaultValue: number): number {
	const value = getArg(flag);
	if (value === null) {
		return defaultValue;
	}
	const parsed = Number.parseInt(value, 10);
	return Number.isNaN(parsed) ? defaultValue : parsed;
}

function createRunId() {
	const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
	return `${timestamp}-${randomUUID().slice(0, 8)}`;
}

async function updateStatus(
	jobId: string,
	updater: (job: AuditJob) => AuditJob,
) {
	const current = await readJobStatus(jobId);
	if (!current) {
		return;
	}

	const next = updater(current);
	await writeJobStatus(next);
}

async function run() {
	const jobId = getArg("--job");
	const baseUrlInput = getArg("--base");
	const maxPages = getIntArg("--max-pages", 2000);
	const concurrency = getIntArg("--concurrency", 5);
	const browserPoolSize = getIntArg("--browser-pool-size", 0); // 0 = auto

	// Timeout configurations (all in milliseconds)
	const crawlTimeout = getIntArg("--crawl-timeout", 30_000);
	const sitemapTimeout = getIntArg("--sitemap-timeout", 15_000);
	const cdpConnectTimeout = getIntArg("--cdp-timeout", 60_000);
	const pageNavigationTimeout = getIntArg("--page-timeout", 60_000);
	const lighthouseAuditTimeout = getIntArg("--audit-timeout", 90_000);

	// Retry configuration
	const maxRetries = getIntArg("--max-retries", 3);

	if (!jobId || !baseUrlInput) {
		throw new Error("Missing required args: --job and --base");
	}

	const normalizedBaseUrl = normalizeUrl(baseUrlInput);
	if (!normalizedBaseUrl) {
		throw new Error("Invalid base URL");
	}

	const runId = createRunId();
	const startedAt = new Date().toISOString();

	console.log(`[Worker] Starting audit job ${jobId}`);
	console.log(`[Worker] Base URL: ${normalizedBaseUrl}`);
	console.log(`[Worker] Max pages: ${maxPages}, Concurrency: ${concurrency}`);
	console.log(`[Worker] Browser pool size: ${browserPoolSize || "auto"}`);
	console.log(
		`[Worker] Timeouts: crawl=${crawlTimeout}ms, sitemap=${sitemapTimeout}ms, cdp=${cdpConnectTimeout}ms, page=${pageNavigationTimeout}ms, audit=${lighthouseAuditTimeout}ms`,
	);
	console.log(`[Worker] Max retries: ${maxRetries}`);

	await createJobDirectory(jobId);
	await updateStatus(jobId, (job) => ({
		...job,
		baseUrl: normalizedBaseUrl,
		status: "running",
		startedAt,
		errorMessage: undefined,
	}));

	try {
		const crawlResult = await discoverUrls({
			baseUrl: normalizedBaseUrl,
			maxPages,
			timeoutMs: crawlTimeout,
			sitemapTimeoutMs: sitemapTimeout,
			onProgress: (progress) => {
				void updateStatus(jobId, (job) => ({
					...job,
					progress: {
						...job.progress,
						discovered: progress.discovered,
						crawled: progress.crawled,
						totalTarget: progress.totalTarget,
					},
				}));
			},
		});

		const jobRoot = await createJobDirectory(jobId);

		// Try to load checkpoint for resume
		const checkpoint = await readCheckpoint(jobId);
		const resumeFrom = checkpoint || undefined;

		const pages = await processUrlBatch({
			urls: crawlResult.urls,
			outputRoot: jobRoot,
			jobId,
			concurrency,
			chromePoolSize: browserPoolSize > 0 ? browserPoolSize : undefined,
			timeouts: {
				audit: lighthouseAuditTimeout,
				chromeLaunch: 45_000, // Default Chrome launch timeout
			},
			retry: {
				maxRetries,
				initialDelayMs: 1_000,
				maxDelayMs: 8_000,
			},
			onProgress: (auditedCount, total) => {
				void updateStatus(jobId, (job) => ({
					...job,
					progress: {
						...job.progress,
						audited: auditedCount,
						totalTarget: total,
					},
				}));
			},
			onCheckpoint: async (checkpoint) => {
				await writeCheckpoint(jobId, checkpoint);
			},
			resumeFrom,
		});

		const finishedAt = new Date().toISOString();
		const manifest = buildRunManifest({
			runId,
			jobId,
			baseUrl: normalizedBaseUrl,
			startedAt,
			finishedAt,
			discoveredPages: crawlResult.discovered,
			settings: {
				maxPages,
				auditConcurrency: concurrency,
				devices: ["desktop", "mobile"],
			},
			pages,
		});

		await writeJobManifest(jobId, manifest);
		await publishLatestFromJob(jobId);
		await updateStatus(jobId, (job) => ({
			...job,
			status: "completed",
			runId,
			finishedAt,
			progress: {
				...job.progress,
				audited: pages.length,
				totalTarget: pages.length,
			},
		}));
	} catch (error) {
		await updateStatus(jobId, (job) => ({
			...job,
			status: "failed",
			finishedAt: new Date().toISOString(),
			errorMessage: error instanceof Error ? error.message : "Unknown error",
		}));
		throw error;
	}
}

void run().catch((error) => {
	console.error("Audit worker failed:", error);
	process.exit(1);
});
