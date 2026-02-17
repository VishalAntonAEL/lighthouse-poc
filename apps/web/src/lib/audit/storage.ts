import { promises as fs } from "node:fs";
import path from "node:path";

import { deriveSiteSlugFromUrl } from "./normalize-url";
import type { AuditJob, AuditRunManifest, Checkpoint, SlimLhr } from "./types";

export const AUDIT_DATA_ROOT = path.join(process.cwd(), ".lighthouse-data");
export const AUDIT_JOBS_ROOT = path.join(AUDIT_DATA_ROOT, "jobs");

function asJobPath(jobId: string) {
	return path.join(AUDIT_JOBS_ROOT, jobId);
}

export function getReportRoot(siteSlug: string) {
	return path.join(AUDIT_DATA_ROOT, siteSlug);
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

export function getCheckpointPath(jobId: string) {
	return path.join(asJobPath(jobId), "checkpoint.json");
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
		const status = JSON.parse(data) as Partial<AuditJob> & { baseUrl?: string };
		if (typeof status.siteSlug === "string" && status.siteSlug.length > 0) {
			return status as AuditJob;
		}

		const fallbackSiteSlug =
			(typeof status.baseUrl === "string" &&
				deriveSiteSlugFromUrl(status.baseUrl)) ||
			"unknown-site";
		return {
			...(status as AuditJob),
			siteSlug: fallbackSiteSlug,
		};
	} catch {
		return null;
	}
}

export async function findActiveJob() {
	await ensureAuditDataDirectories();
	const entries = await fs.readdir(AUDIT_JOBS_ROOT, { withFileTypes: true });
	const dirs = entries
		.filter((entry) => entry.isDirectory())
		.map((entry) => entry.name);

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

export async function writeJobManifest(
	jobId: string,
	manifest: AuditRunManifest,
) {
	await fs.writeFile(
		getJobManifestPath(jobId),
		JSON.stringify(manifest, null, 2),
		"utf8",
	);
}

export function isValidSiteSlug(input: string) {
	return /^[a-z0-9-]+$/.test(input);
}

export async function reportFolderExists(siteSlug: string) {
	if (!isValidSiteSlug(siteSlug)) {
		return false;
	}

	try {
		const stat = await fs.stat(getReportRoot(siteSlug));
		return stat.isDirectory();
	} catch {
		return false;
	}
}

export async function publishReportFromJob(jobId: string, siteSlug: string) {
	if (!isValidSiteSlug(siteSlug)) {
		throw new Error("Invalid site slug.");
	}

	const source = asJobPath(jobId);
	const reportRoot = getReportRoot(siteSlug);
	const staging = `${reportRoot}.staging`;

	await fs.rm(staging, { recursive: true, force: true });
	await fs.cp(source, staging, { recursive: true });
	await fs.rm(reportRoot, { recursive: true, force: true });
	await fs.rename(staging, reportRoot);
}

export async function readReportManifest(siteSlug: string) {
	if (!isValidSiteSlug(siteSlug)) {
		return null;
	}

	try {
		const data = await fs.readFile(
			path.join(getReportRoot(siteSlug), "manifest.json"),
			"utf8",
		);
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

export async function readCheckpoint(jobId: string): Promise<Checkpoint | null> {
	try {
		const data = await fs.readFile(getCheckpointPath(jobId), "utf8");
		return JSON.parse(data) as Checkpoint;
	} catch {
		return null;
	}
}

export async function writeCheckpoint(
	jobId: string,
	checkpoint: Checkpoint,
): Promise<void> {
	await ensureAuditDataDirectories();
	await createJobDirectory(jobId);
	await fs.writeFile(
		getCheckpointPath(jobId),
		JSON.stringify(checkpoint, null, 2),
		"utf8",
	);
}

export async function readReportSlimLhr(
	siteSlug: string,
	slug: string,
	device: "desktop" | "mobile",
): Promise<SlimLhr | null> {
	if (!isValidSiteSlug(siteSlug) || !isValidSlug(slug)) {
		return null;
	}

	const artifactPath = path.join(
		getReportRoot(siteSlug),
		"pages",
		slug,
		`${device}.slim.json`,
	);
	try {
		const data = await fs.readFile(artifactPath, "utf8");
		return JSON.parse(data) as SlimLhr;
	} catch {
		return null;
	}
}
