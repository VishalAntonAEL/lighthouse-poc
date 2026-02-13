import { promises as fs } from "node:fs";
import path from "node:path";

import type { AuditJob, AuditRunManifest } from "./types";

export const AUDIT_DATA_ROOT = path.join(process.cwd(), ".lighthouse-data");
export const AUDIT_JOBS_ROOT = path.join(AUDIT_DATA_ROOT, "jobs");
export const AUDIT_LATEST_ROOT = path.join(AUDIT_DATA_ROOT, "latest");

function asJobPath(jobId: string) {
	return path.join(AUDIT_JOBS_ROOT, jobId);
}

export function getWorkerEntrypoint() {
	const cwd = process.cwd();
	const appLocal = path.resolve(cwd, "src/lib/audit/worker.ts");
	const monorepoLocal = path.resolve(cwd, "apps/web/src/lib/audit/worker.ts");
	return fs
		.access(appLocal)
		.then(() => appLocal)
		.catch(async () => {
			await fs.access(monorepoLocal);
			return monorepoLocal;
		});
}

export async function ensureAuditDataDirectories() {
	await fs.mkdir(AUDIT_JOBS_ROOT, { recursive: true });
}

export async function createJobDirectory(jobId: string) {
	const jobRoot = asJobPath(jobId);
	await fs.mkdir(path.join(jobRoot, "pages"), { recursive: true });
	return jobRoot;
}

export function getJobStatusPath(jobId: string) {
	return path.join(asJobPath(jobId), "status.json");
}

export function getJobManifestPath(jobId: string) {
	return path.join(asJobPath(jobId), "manifest.json");
}

export async function writeJobStatus(status: AuditJob) {
	await ensureAuditDataDirectories();
	await createJobDirectory(status.jobId);
	await fs.writeFile(
		getJobStatusPath(status.jobId),
		JSON.stringify(status, null, 2),
		"utf8",
	);
}

export async function readJobStatus(jobId: string) {
	try {
		const data = await fs.readFile(getJobStatusPath(jobId), "utf8");
		return JSON.parse(data) as AuditJob;
	} catch {
		return null;
	}
}

export async function findActiveJob() {
	await ensureAuditDataDirectories();
	const entries = await fs.readdir(AUDIT_JOBS_ROOT, { withFileTypes: true });
	const dirs = entries.filter((entry) => entry.isDirectory()).map((entry) => entry.name);

	for (const dir of dirs) {
		const status = await readJobStatus(dir);
		if (!status) {
			continue;
		}
		if (status.status === "queued" || status.status === "running") {
			return status;
		}
	}

	return null;
}

export async function writeJobManifest(jobId: string, manifest: AuditRunManifest) {
	await fs.writeFile(
		getJobManifestPath(jobId),
		JSON.stringify(manifest, null, 2),
		"utf8",
	);
}

export async function publishLatestFromJob(jobId: string) {
	const source = asJobPath(jobId);
	const staging = `${AUDIT_LATEST_ROOT}.staging`;

	await fs.rm(staging, { recursive: true, force: true });
	await fs.cp(source, staging, { recursive: true });
	await fs.rm(AUDIT_LATEST_ROOT, { recursive: true, force: true });
	await fs.rename(staging, AUDIT_LATEST_ROOT);
}

export async function readLatestManifest() {
	try {
		const data = await fs.readFile(path.join(AUDIT_LATEST_ROOT, "manifest.json"), "utf8");
		return JSON.parse(data) as AuditRunManifest;
	} catch {
		return null;
	}
}

export function isValidSlug(input: string) {
	return /^[a-zA-Z0-9-_]+$/.test(input);
}

export function isValidDevice(input: string): input is "desktop" | "mobile" {
	return input === "desktop" || input === "mobile";
}

export async function readLatestArtifactHtml(slug: string, device: "desktop" | "mobile") {
	if (!isValidSlug(slug)) {
		return null;
	}

	const artifactPath = path.join(
		AUDIT_LATEST_ROOT,
		"pages",
		slug,
		`${device}.report.html`,
	);
	try {
		return await fs.readFile(artifactPath, "utf8");
	} catch {
		return null;
	}
}
