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

function sanitizeSiteSlug(value: string) {
	return value
		.toLowerCase()
		.replace(/[^a-z0-9-]+/g, "-")
		.replace(/-+/g, "-")
		.replace(/^-|-$/g, "");
}

export function deriveSiteSlugFromUrl(rawUrl: string) {
	const registrableDomain = getRegistrableDomain(rawUrl);
	if (!registrableDomain) {
		return null;
	}

	const rootToken = registrableDomain.split(".")[0] ?? "";
	const siteSlug = sanitizeSiteSlug(rootToken);
	if (!siteSlug) {
		return null;
	}

	return siteSlug;
}

/**
 * Allow same registrable domain and "regional" sibling domains.
 * E.g. when base is medisca.com, allow medisca.com.au, medisca.co.uk, etc.,
 * so the crawler follows region switcher links instead of stopping early.
 */
export function isAllowedDomain(candidateUrl: string, baseUrl: string) {
	const baseDomain = getRegistrableDomain(baseUrl);
	const candidateDomain = getRegistrableDomain(candidateUrl);

	if (!baseDomain || !candidateDomain) {
		return false;
	}

	if (baseDomain === candidateDomain) {
		return true;
	}

	// Allow regional siblings: medisca.com + medisca.com.au, or medisca.com.au + medisca.com
	const baseDot = `${baseDomain}.`;
	const candidateDot = `${candidateDomain}.`;
	if (candidateDomain.startsWith(baseDot) || baseDomain.startsWith(candidateDot)) {
		return true;
	}

	return false;
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
