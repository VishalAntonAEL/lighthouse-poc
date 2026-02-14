import * as chromeLauncher from "chrome-launcher";
import puppeteer from "puppeteer-core";
import { isAllowedDomain, normalizeUrl } from "./normalize-url";
import type { CrawlResult } from "./types";

type CrawlOptions = {
	baseUrl: string;
	maxPages: number;
	timeoutMs?: number;
	sitemapTimeoutMs?: number;
	onProgress?: (progress: {
		discovered: number;
		crawled: number;
		totalTarget: number;
		sitemapDiscovered: number;
	}) => void;
};

const DEFAULT_CRAWL_TIMEOUT_MS = 30_000;
const DEFAULT_SITEMAP_TIMEOUT_MS = 15_000;

const NON_HTML_EXTENSIONS = new Set([
	".png",
	".jpg",
	".jpeg",
	".gif",
	".webp",
	".svg",
	".pdf",
	".zip",
	".rar",
	".mp4",
	".mp3",
	".mov",
	".avi",
	".json",
	".xml",
	".txt",
	".csv",
	".woff",
	".woff2",
]);

function hasIgnoredExtension(input: string) {
	const pathname = new URL(input).pathname.toLowerCase();
	for (const extension of NON_HTML_EXTENSIONS) {
		if (pathname.endsWith(extension)) {
			return true;
		}
	}

	return false;
}

function extractLocValues(xml: string) {
	const matches = [...xml.matchAll(/<loc>([\s\S]*?)<\/loc>/gi)];
	return matches
		.map((match) => match[1]?.trim() ?? "")
		.filter(Boolean)
		.map((value) =>
			value
				.replaceAll("&amp;", "&")
				.replaceAll("&lt;", "<")
				.replaceAll("&gt;", ">")
				.replaceAll("&quot;", '"')
				.replaceAll("&#39;", "'"),
		);
}

async function fetchSitemapUrls(
	baseUrl: string,
	maxPages: number,
	timeoutMs: number,
): Promise<string[]> {
	const sitemapQueue = [new URL("/sitemap.xml", baseUrl).toString()];
	const visitedSitemaps = new Set<string>();
	const discovered = new Set<string>();

	while (sitemapQueue.length > 0 && discovered.size < maxPages) {
		const sitemapUrl = sitemapQueue.shift();
		if (!sitemapUrl || visitedSitemaps.has(sitemapUrl)) {
			continue;
		}

		visitedSitemaps.add(sitemapUrl);
		try {
			const controller = new AbortController();
			const timer = setTimeout(() => controller.abort(), timeoutMs);
			const response = await fetch(sitemapUrl, {
				signal: controller.signal,
				headers: {
					"user-agent": "Mozilla/5.0 lighthouse-poc-crawler",
				},
			});
			clearTimeout(timer);

			if (!response.ok) {
				continue;
			}

			const contentType = response.headers.get("content-type") ?? "";
			if (!contentType.includes("xml") && !sitemapUrl.endsWith(".xml")) {
				continue;
			}

			const xml = await response.text();
			const locations = extractLocValues(xml);
			for (const location of locations) {
				const normalized = normalizeUrl(location);
				if (!normalized) {
					continue;
				}

				if (!isAllowedDomain(normalized, baseUrl)) {
					continue;
				}

				if (normalized.endsWith(".xml")) {
					if (!visitedSitemaps.has(normalized)) {
						sitemapQueue.push(normalized);
					}
					continue;
				}

				if (hasIgnoredExtension(normalized)) {
					continue;
				}

				discovered.add(normalized);
				if (discovered.size >= maxPages) {
					break;
				}
			}
		} catch {
			// Missing or invalid sitemap should not fail the run.
		}
	}

	return [...discovered];
}

/**
 * Extract href links from HTML using regex (no browser needed).
 */
function extractLinksFromHtml(html: string, baseUrl: string): string[] {
	const links: string[] = [];
	// Match <a href="..."> or <a href='...'> patterns
	const hrefRegex = /<a\s+[^>]*href\s*=\s*["']([^"']+)["'][^>]*>/gi;
	const matches = [...html.matchAll(hrefRegex)];

	for (const match of matches) {
		const href = match[1];
		if (href) {
			links.push(href);
		}
	}

	return links;
}

async function crawlRecursively(
	baseUrl: string,
	seedUrls: string[],
	maxPages: number,
	timeoutMs: number,
	onProgress?: CrawlOptions["onProgress"],
) {
	const discovered = new Set<string>(seedUrls);
	const visited = new Set<string>();
	const queue: string[] = [baseUrl, ...seedUrls];

	try {
		while (queue.length > 0 && discovered.size < maxPages) {
			const currentUrl = queue.shift();
			if (!currentUrl || visited.has(currentUrl)) {
				continue;
			}

			visited.add(currentUrl);
			try {
				const controller = new AbortController();
				const timer = setTimeout(() => controller.abort(), timeoutMs);
				const response = await fetch(currentUrl, {
					signal: controller.signal,
					headers: {
						"user-agent": "Mozilla/5.0 lighthouse-poc-crawler",
					},
				});
				clearTimeout(timer);

				if (!response.ok) {
					continue;
				}

				const contentType = response.headers.get("content-type") ?? "";
				if (!contentType.includes("text/html")) {
					continue;
				}

				const html = await response.text();
				const foundLinks = extractLinksFromHtml(html, currentUrl);

				for (const link of foundLinks) {
					if (discovered.size >= maxPages) {
						break;
					}

					const normalized = normalizeUrl(link, currentUrl);
					if (!normalized) {
						continue;
					}
					if (!isAllowedDomain(normalized, baseUrl)) {
						continue;
					}
					if (hasIgnoredExtension(normalized)) {
						continue;
					}
					if (discovered.has(normalized)) {
						continue;
					}

					discovered.add(normalized);
					queue.push(normalized);
				}
			} catch {
				// Ignore per-page errors.
			}

			onProgress?.({
				discovered: discovered.size,
				crawled: visited.size,
				totalTarget: Math.min(discovered.size, maxPages),
				sitemapDiscovered: seedUrls.length,
			});
		}
	} catch {
		// Ignore errors
	}

	return {
		discovered,
		crawled: visited.size,
	};
}

/** Per-page navigation timeout when using browser crawl (networkidle can be slow). */
const BROWSER_PAGE_TIMEOUT_MS = 25_000;

/**
 * Crawl using a real browser (Puppeteer). Discovers links from the live DOM
 * after JavaScript runs, so region selectors and client-rendered links are found.
 * Uses the same BFS + isAllowedDomain logic so regional siblings (e.g. medisca.com.au) are followed.
 */
async function crawlWithBrowser(
	baseUrl: string,
	seedUrls: string[],
	maxPages: number,
	timeoutMs: number,
	onProgress?: CrawlOptions["onProgress"],
): Promise<{ discovered: Set<string>; crawled: number }> {
	const discovered = new Set<string>(seedUrls);
	const visited = new Set<string>();
	const queue: string[] = [baseUrl, ...seedUrls];

	let chrome: Awaited<ReturnType<typeof chromeLauncher.launch>> | null = null;
	let browser: Awaited<ReturnType<typeof puppeteer.connect>> | null = null;

	try {
		chrome = await chromeLauncher.launch({
			chromeFlags: [
				"--headless=new",
				"--no-sandbox",
				"--disable-dev-shm-usage",
				"--disable-gpu",
			],
		});

		browser = await puppeteer.connect({
			browserURL: `http://127.0.0.1:${chrome.port}`,
		});

		const page = await browser.newPage();
		await page.setDefaultNavigationTimeout(BROWSER_PAGE_TIMEOUT_MS);

		while (queue.length > 0 && discovered.size < maxPages) {
			const currentUrl = queue.shift();
			if (!currentUrl || visited.has(currentUrl)) {
				continue;
			}

			visited.add(currentUrl);
			try {
				await page.goto(currentUrl, {
					waitUntil: "networkidle2",
					timeout: BROWSER_PAGE_TIMEOUT_MS,
				});
			} catch {
				// Timeout or load error: skip this URL
				onProgress?.({
					discovered: discovered.size,
					crawled: visited.size,
					totalTarget: Math.min(discovered.size, maxPages),
					sitemapDiscovered: seedUrls.length,
				});
				continue;
			}

			const hrefs = await page.$$eval("a", (anchors) =>
				anchors.map((a) => (a as HTMLAnchorElement).href),
			);

			for (const href of hrefs) {
				if (discovered.size >= maxPages) {
					break;
				}
				const normalized = normalizeUrl(href, currentUrl);
				if (!normalized) {
					continue;
				}
				if (!isAllowedDomain(normalized, baseUrl)) {
					continue;
				}
				if (hasIgnoredExtension(normalized)) {
					continue;
				}
				if (discovered.has(normalized)) {
					continue;
				}
				discovered.add(normalized);
				queue.push(normalized);
			}

			onProgress?.({
				discovered: discovered.size,
				crawled: visited.size,
				totalTarget: Math.min(discovered.size, maxPages),
				sitemapDiscovered: seedUrls.length,
			});
		}

		await page.close();
	} catch (err) {
		console.warn("[Crawler] Browser crawl failed, continuing with discovered URLs:", err);
	} finally {
		if (browser) {
			try {
				browser.disconnect();
			} catch {
				// ignore
			}
		}
		if (chrome) {
			await chrome.kill();
		}
	}

	return {
		discovered,
		crawled: visited.size,
	};
}

export async function discoverUrls(
	options: CrawlOptions,
): Promise<CrawlResult> {
	const crawlTimeoutMs = options.timeoutMs ?? DEFAULT_CRAWL_TIMEOUT_MS;
	const sitemapTimeoutMs =
		options.sitemapTimeoutMs ?? DEFAULT_SITEMAP_TIMEOUT_MS;

	const normalizedBaseUrl = normalizeUrl(options.baseUrl);
	if (!normalizedBaseUrl) {
		throw new Error("Invalid base URL.");
	}

	console.log(`[Crawler] Starting discovery for ${normalizedBaseUrl}`);
	console.log(
		`[Crawler] Crawl timeout: ${crawlTimeoutMs}ms, Sitemap timeout: ${sitemapTimeoutMs}ms`,
	);

	const sitemapUrls = await fetchSitemapUrls(
		normalizedBaseUrl,
		options.maxPages,
		sitemapTimeoutMs,
	);

	console.log(`[Crawler] Found ${sitemapUrls.length} URLs from sitemap`);

	options.onProgress?.({
		discovered: sitemapUrls.length,
		crawled: 0,
		totalTarget: Math.min(sitemapUrls.length, options.maxPages),
		sitemapDiscovered: sitemapUrls.length,
	});

	const crawlResult = await crawlWithBrowser(
		normalizedBaseUrl,
		sitemapUrls,
		options.maxPages,
		crawlTimeoutMs,
		options.onProgress,
	);

	console.log(
		`[Crawler] Browser crawl: ${crawlResult.crawled} pages visited, ${crawlResult.discovered.size} URLs discovered`,
	);

	const urls = [...crawlResult.discovered].slice(0, options.maxPages);
	if (!urls.includes(normalizedBaseUrl)) {
		urls.unshift(normalizedBaseUrl);
	}

	return {
		urls: urls.slice(0, options.maxPages),
		discovered: urls.length,
		crawled: crawlResult.crawled,
		sitemapDiscovered: sitemapUrls.length,
	};
}
