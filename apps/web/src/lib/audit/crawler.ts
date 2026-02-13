import { chromium } from "playwright";

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

	const browser = await chromium.launch({
		channel: "chrome",
		headless: true,
	});
	const context = await browser.newContext({
		ignoreHTTPSErrors: true,
	});
	const page = await context.newPage();

	try {
		while (queue.length > 0 && discovered.size < maxPages) {
			const currentUrl = queue.shift();
			if (!currentUrl || visited.has(currentUrl)) {
				continue;
			}

			visited.add(currentUrl);
			try {
				await page.goto(currentUrl, {
					waitUntil: "domcontentloaded",
					timeout: timeoutMs,
				});

				const foundLinks = await page
					.$$eval("a[href]", (anchors) =>
						anchors
							.map((anchor) => anchor.getAttribute("href"))
							.filter((href): href is string => Boolean(href)),
					)
					.catch(() => [] as string[]);

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
	} finally {
		await browser.close();
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

	const crawlResult = await crawlRecursively(
		normalizedBaseUrl,
		sitemapUrls,
		options.maxPages,
		crawlTimeoutMs,
		options.onProgress,
	);

	console.log(
		`[Crawler] Crawled ${crawlResult.crawled} pages, discovered ${crawlResult.discovered.size} total URLs`,
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
