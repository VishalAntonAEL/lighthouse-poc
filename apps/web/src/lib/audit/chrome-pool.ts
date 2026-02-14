import { promises as fs } from "node:fs";
import { createServer } from "node:net";
import os from "node:os";
import path from "node:path";

type ChromeInstance = {
	id: number;
	port: number;
	process: ReturnType<typeof Bun.spawn>;
	isHealthy: boolean;
	lastUsed: number;
	userDataDir: string;
	auditCount: number; // Track audits for recycling
};

type ChromePoolOptions = {
	size: number;
	chromeLaunchTimeout?: number;
	recycleAfter?: number; // Recycle instance after N audits (default: 100)
};

const DEFAULT_CHROME_LAUNCH_TIMEOUT = 45_000;
const DEFAULT_RECYCLE_AFTER = 100;
const CDP_POLL_INTERVAL_MS = 200;

function getChromeExecutablePath(): string {
	if (process.platform === "darwin") {
		return "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
	}
	if (process.platform === "win32") {
		return "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
	}
	return "google-chrome";
}

async function getFreePort(): Promise<number> {
	return await new Promise<number>((resolve, reject) => {
		const server = createServer();
		server.on("error", reject);
		server.listen(0, "127.0.0.1", () => {
			const address = server.address();
			if (!address || typeof address === "string") {
				server.close();
				reject(new Error("Could not allocate debug port."));
				return;
			}
			const { port } = address;
			server.close((error) => {
				if (error) {
					reject(error);
					return;
				}
				resolve(port);
			});
		});
	});
}

async function waitForCdp(port: number, timeoutMs: number): Promise<void> {
	const deadline = Date.now() + timeoutMs;
	while (Date.now() < deadline) {
		try {
			const res = await fetch(`http://127.0.0.1:${port}/json/version`);
			if (res.ok) {
				return;
			}
		} catch {
			// Port not ready yet
		}
		await new Promise((r) => setTimeout(r, CDP_POLL_INTERVAL_MS));
	}
	throw new Error(
		`Chrome CDP did not become ready on port ${port} within ${timeoutMs}ms`,
	);
}

/**
 * Checks if a Chrome instance is still alive and responding on the given port.
 */
async function isCdpAlive(port: number): Promise<boolean> {
	try {
		const controller = new AbortController();
		const timer = setTimeout(() => controller.abort(), 3_000);
		const res = await fetch(`http://127.0.0.1:${port}/json/version`, {
			signal: controller.signal,
		});
		clearTimeout(timer);
		return res.ok;
	} catch {
		return false;
	}
}

/**
 * ChromePool manages a fixed set of headless Chrome processes with recycling support.
 *
 * It tracks Chrome processes and their CDP ports.
 * Lighthouse CLI connects to the ports via --port=N flag.
 */
export class ChromePool {
	private instances: ChromeInstance[] = [];
	private waiters: Array<(id: number) => void> = [];
	private available: Set<number> = new Set();
	private options: Required<ChromePoolOptions>;
	private isShuttingDown = false;
	private cleanupDirs: string[] = [];

	constructor(options: ChromePoolOptions) {
		this.options = {
			size: options.size,
			chromeLaunchTimeout:
				options.chromeLaunchTimeout ?? DEFAULT_CHROME_LAUNCH_TIMEOUT,
			recycleAfter: options.recycleAfter ?? DEFAULT_RECYCLE_AFTER,
		};
	}

	async initialize(): Promise<void> {
		console.log(
			`[ChromePool] Launching ${this.options.size} Chrome instances...`,
		);
		const startTime = Date.now();

		// Launch all instances in parallel for speed
		const launchPromises = Array.from({ length: this.options.size }, (_, i) =>
			this.createInstance(i),
		);
		const results = await Promise.allSettled(launchPromises);

		for (let i = 0; i < results.length; i++) {
			const result = results[i];
			if (result.status === "fulfilled") {
				this.instances.push(result.value);
				this.available.add(i);
			} else {
				console.error(
					`[ChromePool] Failed to launch Chrome ${i}:`,
					result.reason,
				);
				throw result.reason;
			}
		}

		const elapsed = Date.now() - startTime;
		console.log(
			`[ChromePool] ${this.instances.length} Chrome instances ready in ${elapsed}ms`,
		);
	}

	private async createInstance(id: number): Promise<ChromeInstance> {
		const port = await getFreePort();
		const userDataDir = path.join(os.tmpdir(), `lh-chrome-${id}-${Date.now()}`);
		await fs.mkdir(userDataDir, { recursive: true });
		this.cleanupDirs.push(userDataDir);

		const executable = getChromeExecutablePath();
		const proc = Bun.spawn({
			cmd: [
				executable,
				`--remote-debugging-port=${port}`,
				`--user-data-dir=${userDataDir}`,
				"--headless=new",
				"--no-sandbox",
				"--disable-dev-shm-usage",
				"--disable-gpu",
				"--disable-software-rasterizer",
				"--no-first-run",
				"--no-default-browser-check",
				"--disable-background-networking",
				"--disable-default-apps",
				"--disable-extensions",
				"--disable-sync",
				"--metrics-recording-only",
				"--mute-audio",
				"--no-zygote",
			],
			stdout: "ignore",
			stderr: "ignore",
		});

		// Wait for CDP HTTP endpoint to be ready
		await waitForCdp(port, this.options.chromeLaunchTimeout);

		console.log(
			`[ChromePool] Chrome ${id} ready on port ${port} (pid ${proc.pid})`,
		);

		return {
			id,
			port,
			process: proc,
			isHealthy: true,
			lastUsed: Date.now(),
			userDataDir,
			auditCount: 0,
		};
	}

	/**
	 * Acquire a Chrome instance from the pool.
	 * Returns the CDP port number and instance id.
	 * Blocks until an instance becomes available.
	 */
	async acquire(): Promise<{ port: number; instanceId: number }> {
		if (this.isShuttingDown) {
			throw new Error("ChromePool is shutting down");
		}

		// Try to get an available instance immediately
		const id = this.tryGetAvailable();
		if (id !== null) {
			return this.checkAndReturn(id);
		}

		// Otherwise wait for one to be released
		const waiterId = await new Promise<number>((resolve) => {
			this.waiters.push(resolve);
		});
		return this.checkAndReturn(waiterId);
	}

	private tryGetAvailable(): number | null {
		const iterator = this.available.values().next();
		if (iterator.done) {
			return null;
		}
		const id = iterator.value;
		this.available.delete(id);
		return id;
	}

	private async checkAndReturn(
		id: number,
	): Promise<{ port: number; instanceId: number }> {
		const instance = this.instances[id];

		// Quick health check
		if (!instance.isHealthy || !(await isCdpAlive(instance.port))) {
			console.log(`[ChromePool] Chrome ${id} is unhealthy, restarting...`);
			try {
				await this.restartInstance(id);
			} catch (error) {
				console.error(`[ChromePool] Failed to restart Chrome ${id}:`, error);
				// Release and let the caller retry
				this.release(id);
				throw error;
			}
		}

		const inst = this.instances[id];
		inst.lastUsed = Date.now();
		return { port: inst.port, instanceId: id };
	}

	/**
	 * Release a Chrome instance back to the pool.
	 * Increments audit count and recycles if threshold reached.
	 */
	release(instanceId: number): void {
		const instance = this.instances[instanceId];
		instance.auditCount += 1;

		// Check if recycling is needed
		if (instance.auditCount >= this.options.recycleAfter) {
			console.log(
				`[ChromePool] Chrome ${instanceId} reached ${instance.auditCount} audits, recycling...`,
			);
			// Restart asynchronously (don't block release)
			void this.restartInstance(instanceId).catch((error) => {
				console.error(
					`[ChromePool] Failed to recycle Chrome ${instanceId}:`,
					error,
				);
			});
		}

		// If someone is waiting, give it directly to them
		if (this.waiters.length > 0) {
			const waiter = this.waiters.shift()!;
			waiter(instanceId);
			return;
		}
		this.available.add(instanceId);
	}

	private async restartInstance(id: number): Promise<void> {
		const old = this.instances[id];

		// Kill old process
		try {
			old.process.kill("SIGKILL");
		} catch {
			// Already dead
		}

		// Clean up old user data dir
		try {
			await fs.rm(old.userDataDir, { recursive: true, force: true });
		} catch {
			// Ignore
		}

		// Create fresh instance
		const fresh = await this.createInstance(id);
		this.instances[id] = fresh;
		this.available.add(id);
	}

	async shutdown(): Promise<void> {
		console.log("[ChromePool] Shutting down...");
		this.isShuttingDown = true;

		// Reject all waiters
		this.waiters = [];

		// Kill all Chrome processes
		for (const instance of this.instances) {
			try {
				instance.process.kill("SIGTERM");
			} catch {
				// Already dead
			}
		}

		// Give processes a moment to exit, then force kill
		await new Promise((r) => setTimeout(r, 2000));

		for (const instance of this.instances) {
			try {
				instance.process.kill("SIGKILL");
			} catch {
				// Already dead
			}
		}

		// Clean up temp directories
		await Promise.allSettled(
			this.cleanupDirs.map((dir) =>
				fs.rm(dir, { recursive: true, force: true }),
			),
		);

		console.log("[ChromePool] Shutdown complete");
	}

	getStats() {
		return {
			total: this.instances.length,
			available: this.available.size,
			inUse: this.instances.length - this.available.size,
			healthy: this.instances.filter((i) => i.isHealthy).length,
		};
	}
}
