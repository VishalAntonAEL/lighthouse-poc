"use server";

import { spawn } from "node:child_process";
import { randomUUID } from "node:crypto";

import { z } from "zod";

import { deriveSiteSlugFromUrl, normalizeUrl } from "@/lib/audit/normalize-url";
import {
	ensureAuditDataDirectories,
	findActiveJob,
	getWorkerEntrypoint,
	readJobStatus,
	readReportManifest,
	reportFolderExists,
	writeJobStatus,
} from "@/lib/audit/storage";
import type { AuditJob, AuditRunManifest } from "@/lib/audit/types";

const startInputSchema = z.object({
	baseUrl: z.string().min(1),
	maxPages: z.number().int().positive().max(5000).optional(),
});

const statusInputSchema = z.object({
	jobId: z.string().min(1),
});

const reportInputSchema = z.object({
	siteSlug: z.string().min(1),
});

export async function startAuditRunAction(input: {
	baseUrl: string;
	maxPages?: number;
}): Promise<{ jobId: string; siteSlug: string; status: "queued" | "running" }> {
	const parsed = startInputSchema.parse(input);
	const normalizedBaseUrl = normalizeUrl(parsed.baseUrl);
	if (!normalizedBaseUrl) {
		throw new Error("Please provide a valid URL including protocol.");
	}
	const siteSlug = deriveSiteSlugFromUrl(normalizedBaseUrl);
	if (!siteSlug) {
		throw new Error("Unable to derive a site slug from this URL.");
	}

	if (await reportFolderExists(siteSlug)) {
		throw new Error(
			`Report already exists for "${siteSlug}". Use a different site URL.`,
		);
	}

	await ensureAuditDataDirectories();
	const active = await findActiveJob();
	if (active) {
		return {
			jobId: active.jobId,
			siteSlug: active.siteSlug,
			status: active.status === "queued" ? "queued" : "running",
		};
	}

	const jobId = randomUUID();
	const now = new Date().toISOString();
	const maxPages = parsed.maxPages ?? 5000;

	const initialStatus: AuditJob = {
		jobId,
		baseUrl: normalizedBaseUrl,
		siteSlug,
		status: "queued",
		progress: {
			discovered: 0,
			crawled: 0,
			audited: 0,
			totalTarget: maxPages,
		},
		startedAt: now,
		finishedAt: null,
	};
	await writeJobStatus(initialStatus);

	const workerEntrypoint = await getWorkerEntrypoint();
	const child = spawn(
		"bun",
		[
			"run",
			workerEntrypoint,
			"--job",
			jobId,
			"--base",
			normalizedBaseUrl,
			"--site",
			siteSlug,
			"--max-pages",
			String(maxPages),
			"--concurrency",
			"5",
		],
		{
			cwd: process.cwd(),
			detached: true,
			stdio: "ignore",
			env: process.env,
		},
	);
	child.unref();

	return {
		jobId,
		siteSlug,
		status: "queued",
	};
}

export async function getAuditStatusAction(input: {
	jobId: string;
}): Promise<AuditJob> {
	const { jobId } = statusInputSchema.parse(input);
	const status = await readJobStatus(jobId);
	if (!status) {
		throw new Error("Audit job not found.");
	}

	return status;
}

export async function getReportManifestAction(input: {
	siteSlug: string;
}): Promise<AuditRunManifest | null> {
	const { siteSlug } = reportInputSchema.parse(input);
	return await readReportManifest(siteSlug);
}
