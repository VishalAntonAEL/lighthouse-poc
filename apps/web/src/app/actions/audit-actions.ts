"use server";

import { spawn } from "node:child_process";
import { randomUUID } from "node:crypto";

import { z } from "zod";

import { normalizeUrl } from "@/lib/audit/normalize-url";
import {
	ensureAuditDataDirectories,
	findActiveJob,
	getWorkerEntrypoint,
	readJobStatus,
	readLatestManifest,
	writeJobStatus,
} from "@/lib/audit/storage";
import type { AuditJob, AuditRunManifest } from "@/lib/audit/types";

const startInputSchema = z.object({
	baseUrl: z.string().min(1),
	maxPages: z.number().int().positive().max(2000).optional(),
});

const statusInputSchema = z.object({
	jobId: z.string().min(1),
});

export async function startAuditRunAction(input: {
	baseUrl: string;
	maxPages?: number;
}): Promise<{ jobId: string; status: "queued" | "running" }> {
	const parsed = startInputSchema.parse(input);
	const normalizedBaseUrl = normalizeUrl(parsed.baseUrl);
	if (!normalizedBaseUrl) {
		throw new Error("Please provide a valid URL including protocol.");
	}

	await ensureAuditDataDirectories();
	const active = await findActiveJob();
	if (active) {
		return {
			jobId: active.jobId,
			status: active.status === "queued" ? "queued" : "running",
		};
	}

	const jobId = randomUUID();
	const now = new Date().toISOString();
	const maxPages = parsed.maxPages ?? 2000;

	const initialStatus: AuditJob = {
		jobId,
		baseUrl: normalizedBaseUrl,
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

export async function getLatestManifestAction(): Promise<AuditRunManifest | null> {
	return await readLatestManifest();
}
