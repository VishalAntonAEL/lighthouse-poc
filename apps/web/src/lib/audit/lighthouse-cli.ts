import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";

import { extractScreenshotBuffer, extractSlimLhr } from "./lhr-extractor";
import { createUrlSlug } from "./normalize-url";
import type { DeviceResult } from "./types";

type LighthouseCliOptions = {
	url: string;
	port: number; // CDP port of pre-launched Chrome
	device: "desktop" | "mobile";
	outputDir: string; // Where to write slim JSON + screenshot
	timeoutMs?: number; // Kill process after this
	categories?: string[]; // --only-categories
	extraFlags?: string[]; // Any additional CLI flags
};

const DEFAULT_TIMEOUT_MS = 90_000;

/**
 * Run Lighthouse CLI audit via Bun.spawn.
 * Uses --output=json only, extracts slim LHR, saves screenshot.
 */
export async function runLighthouseCliAudit(
	options: LighthouseCliOptions,
): Promise<DeviceResult> {
	const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
	const slug = createUrlSlug(options.url);
	const pageDir = options.outputDir;

	// Create temp file for full LHR JSON (will be deleted after extraction)
	const tmpFile = path.join(
		os.tmpdir(),
		`lighthouse-${slug}-${options.device}-${Date.now()}.json`,
	);

	// Build CLI args
	const args: string[] = [
		"bunx",
		"lighthouse",
		options.url,
		`--port=${options.port}`,
		"--output=json",
		`--output-path=${tmpFile}`,
		"--only-categories=performance,accessibility,best-practices,seo",
		"--chrome-flags=--no-sandbox --disable-dev-shm-usage",
	];

	// Add preset for desktop
	if (options.device === "desktop") {
		args.push("--preset=desktop");
	}

	// Add custom categories if specified
	if (options.categories && options.categories.length > 0) {
		args.push(`--only-categories=${options.categories.join(",")}`);
	}

	// Add extra flags
	if (options.extraFlags) {
		args.push(...options.extraFlags);
	}

	try {
		// Spawn Lighthouse CLI process
		const proc = Bun.spawn({
			cmd: args,
			stdout: "pipe",
			stderr: "pipe",
		});

		// Set timeout
		const timeoutId = setTimeout(() => {
			try {
				proc.kill("SIGKILL");
			} catch {
				// Process may have already exited
			}
		}, timeoutMs);

		// Wait for process to exit
		const exitCode = await proc.exited;
		clearTimeout(timeoutId);

		if (exitCode !== 0) {
			const stderr = await new Response(proc.stderr).text();
			throw new Error(
				`Lighthouse CLI exited with code ${exitCode}: ${stderr.slice(0, 500)}`,
			);
		}

		// Read the full LHR JSON
		const lhrData = await fs.readFile(tmpFile, "utf8");
		const lhr = JSON.parse(lhrData) as Record<string, unknown>;

		// Extract slim LHR
		const slimLhr = extractSlimLhr(lhr, options.device);

		// Save slim JSON
		const slimJsonPath = path.join(pageDir, `${options.device}.slim.json`);
		await fs.writeFile(slimJsonPath, JSON.stringify(slimLhr, null, 2), "utf8");

		// Extract and save screenshot
		const screenshotBuffer = extractScreenshotBuffer(lhr);
		let screenshotRelPath: string | null = null;
		if (screenshotBuffer) {
			const screenshotPath = path.join(pageDir, "screenshot.png");
			await fs.writeFile(screenshotPath, screenshotBuffer);
			screenshotRelPath = path
				.join("pages", slug, "screenshot.png")
				.replaceAll(path.sep, "/");
		}

		// Delete temp file
		await fs.unlink(tmpFile).catch(() => {
			// Ignore errors deleting temp file
		});

		// Return DeviceResult
		return {
			device: options.device,
			status: "success",
			scores: slimLhr.categories,
			opportunities: slimLhr.opportunities,
			slimLhrPath: path
				.join("pages", slug, `${options.device}.slim.json`)
				.replaceAll(path.sep, "/"),
		};
	} catch (error) {
		// Clean up temp file on error
		await fs.unlink(tmpFile).catch(() => {
			// Ignore errors deleting temp file
		});

		return {
			device: options.device,
			status: "error",
			scores: null,
			opportunities: [],
			slimLhrPath: null,
			errorMessage:
				error instanceof Error ? error.message : "Unknown error",
		};
	}
}
