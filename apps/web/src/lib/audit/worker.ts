import "dotenv/config";
import { randomUUID } from "node:crypto";
import { promises as fs } from "node:fs";
import path from "node:path";

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
import type { AuditJob, Checkpoint, CruxData, CruxHistoryRecord } from "./types";

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
	const maxPages = getIntArg("--max-pages", 5000);
	const concurrency = getIntArg("--concurrency", 5);
	const crawlConcurrency = getIntArg("--crawl-concurrency", 10);

	// Timeout configurations (all in milliseconds)
	const crawlTimeout = getIntArg("--crawl-timeout", 30_000);
	const sitemapTimeout = getIntArg("--sitemap-timeout", 15_000);
	const lighthouseAuditTimeout = getIntArg("--audit-timeout", 90_000);

	// Retry configuration
	const maxRetries = getIntArg("--max-retries", 3);

	// API key from environment (required for PageSpeed + CrUX APIs)
	const apiKey = process.env.GOOGLE_API_KEY ?? "";
	if (!apiKey) {
		throw new Error("Missing GOOGLE_API_KEY environment variable.");
	}

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
	console.log(`[Worker] Max pages: ${maxPages}, Concurrency: ${concurrency}, Crawl concurrency: ${crawlConcurrency}`);
	console.log(
		`[Worker] Timeouts: crawl=${crawlTimeout}ms, sitemap=${sitemapTimeout}ms, audit=${lighthouseAuditTimeout}ms`,
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
			concurrency: crawlConcurrency,
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
			apiKey,
			baseUrl: normalizedBaseUrl,
			timeouts: {
				audit: lighthouseAuditTimeout,
			},
			retry: {
				maxRetries,
				initialDelayMs: 1_000,
				maxDelayMs: 8_000,
			},
			delayBetweenRequestsMs: 500, // Throttle API requests
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

		// Load origin CrUX data and history from files saved by batch processor
		let originCrux: {
			desktop?: CruxData | null;
			mobile?: CruxData | null;
			combined?: CruxData | null;
		} | undefined;
		let cruxHistory: CruxHistoryRecord | null | undefined;

		try {
			const originCruxPath = path.join(jobRoot, "origin-crux.json");
			const originCruxData = await fs.readFile(originCruxPath, "utf8").catch(() => null);
			if (originCruxData) {
				originCrux = JSON.parse(originCruxData);
			}
		} catch (error) {
			console.warn(`[Worker] Failed to load origin CrUX data:`, error);
		}

		try {
			const cruxHistoryPath = path.join(jobRoot, "crux-history.json");
			const cruxHistoryData = await fs.readFile(cruxHistoryPath, "utf8").catch(() => null);
			if (cruxHistoryData) {
				cruxHistory = JSON.parse(cruxHistoryData);
			}
		} catch (error) {
			console.warn(`[Worker] Failed to load CrUX history:`, error);
		}

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
			originCrux,
			cruxHistory,
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
