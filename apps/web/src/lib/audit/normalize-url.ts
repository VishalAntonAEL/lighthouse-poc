import { createHash } from "node:crypto";

import { getDomain } from "tldts";

const TRACKING_KEYS = new Set(["gclid", "fbclid", "msclkid"]);

function isHttpUrl(input: URL) {
	return input.protocol === "http:" || input.protocol === "https:";
}

function shouldStripParam(param: string) {
	if (TRACKING_KEYS.has(param.toLowerCase())) {
		return true;
	}

	return param.toLowerCase().startsWith("utm_");
}

function normalizePathname(pathname: string) {
	if (!pathname) {
		return "/";
	}

	const collapsed = pathname.replace(/\/{2,}/g, "/");
	if (collapsed !== "/" && collapsed.endsWith("/")) {
		return collapsed.slice(0, -1);
	}

	return collapsed;
}

function sortSearchParams(params: URLSearchParams) {
	const entries = [...params.entries()].sort(([left], [right]) =>
		left.localeCompare(right),
	);

	const sorted = new URLSearchParams();
	for (const [key, value] of entries) {
		sorted.append(key, value);
	}

	return sorted;
}

export function normalizeUrl(raw: string, base?: string) {
	let parsed: URL;
	try {
		parsed = base ? new URL(raw, base) : new URL(raw);
	} catch {
		return null;
	}

	if (!isHttpUrl(parsed)) {
		return null;
	}

	parsed.hash = "";

	for (const key of [...parsed.searchParams.keys()]) {
		if (shouldStripParam(key)) {
			parsed.searchParams.delete(key);
		}
	}

	parsed.pathname = normalizePathname(parsed.pathname);
	parsed.search = sortSearchParams(parsed.searchParams).toString();

	return parsed.toString();
}

export function getRegistrableDomain(rawUrl: string) {
	try {
		const parsed = new URL(rawUrl);
		return getDomain(parsed.hostname, {
			allowIcannDomains: true,
			allowPrivateDomains: true,
		});
	} catch {
		return null;
	}
}

export function isAllowedDomain(candidateUrl: string, baseUrl: string) {
	const baseDomain = getRegistrableDomain(baseUrl);
	const candidateDomain = getRegistrableDomain(candidateUrl);

	if (!baseDomain || !candidateDomain) {
		return false;
	}

	return baseDomain === candidateDomain;
}

export function createUrlSlug(url: string) {
	const parsed = new URL(url);
	const pathname = parsed.pathname
		.replace(/^\/+/, "")
		.replace(/[^a-zA-Z0-9-_]+/g, "-")
		.replace(/-+/g, "-")
		.replace(/^-|-$/g, "");
	const query = parsed.search
		.replace(/^\?/, "")
		.replace(/[^a-zA-Z0-9-_]+/g, "-")
		.replace(/-+/g, "-")
		.replace(/^-|-$/g, "");
	const hash = createHash("sha1").update(url).digest("hex").slice(0, 8);
	const prefix = pathname || "home";
	if (!query) {
		return `${prefix}-${hash}`;
	}

	return `${prefix}-${query}-${hash}`;
}
