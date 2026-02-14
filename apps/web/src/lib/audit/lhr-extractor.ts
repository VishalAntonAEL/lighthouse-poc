import type {
	CategoryScores,
	MetricResult,
	OpportunitySummary,
	SlimLhr,
} from "./types";

/**
 * Extract category scores from LHR JSON.
 */
export function extractScores(
	lhr: Record<string, unknown>,
): CategoryScores | null {
	const categories = lhr.categories;
	if (!categories || typeof categories !== "object") {
		return null;
	}

	function scoreFor(key: string) {
		const value = (categories as Record<string, { score?: unknown }>)[key]
			?.score;
		if (typeof value !== "number") {
			return null;
		}
		return Math.round(value * 100);
	}

	return {
		performance: scoreFor("performance"),
		accessibility: scoreFor("accessibility"),
		bestPractices: scoreFor("best-practices"),
		seo: scoreFor("seo"),
	};
}

/**
 * Extract failing opportunity audits from LHR JSON.
 * Only includes audits with score < 0.9 and valid scoreDisplayMode.
 */
export function extractOpportunities(
	lhr: Record<string, unknown>,
): OpportunitySummary[] {
	const audits = lhr.audits;
	if (!audits || typeof audits !== "object") {
		return [];
	}

	return Object.entries(audits)
		.map(([id, entry]) => {
			if (!entry || typeof entry !== "object") {
				return null;
			}

			const audit = entry as {
				title?: unknown;
				description?: unknown;
				displayValue?: unknown;
				score?: unknown;
				scoreDisplayMode?: unknown;
				numericValue?: unknown;
				metricSavings?: unknown;
			};
			if (typeof audit.title !== "string") {
				return null;
			}
			// Include binary, numeric, and metricSavings audits
			if (
				audit.scoreDisplayMode !== "binary" &&
				audit.scoreDisplayMode !== "numeric" &&
				audit.scoreDisplayMode !== "metricSavings"
			) {
				return null;
			}
			// Only include failing audits (score < 0.9)
			if (typeof audit.score !== "number" || audit.score >= 0.9) {
				return null;
			}

			return {
				id,
				title: audit.title,
				description:
					typeof audit.description === "string" ? audit.description : "",
				displayValue:
					typeof audit.displayValue === "string" ? audit.displayValue : null,
				score: Math.round(audit.score * 100),
			} satisfies OpportunitySummary;
		})
		.filter((entry): entry is NonNullable<typeof entry> => Boolean(entry))
		.sort(
			(left: OpportunitySummary, right: OpportunitySummary) =>
				(left.score ?? 100) - (right.score ?? 100),
		)
		.slice(0, 8);
}

/**
 * Extract core web vitals and performance metrics from LHR JSON.
 */
export function extractMetrics(lhr: Record<string, unknown>): {
	fcp: MetricResult | null;
	lcp: MetricResult | null;
	tbt: MetricResult | null;
	cls: MetricResult | null;
	si: MetricResult | null;
	tti: MetricResult | null;
} {
	const audits = lhr.audits;
	if (!audits || typeof audits !== "object") {
		return {
			fcp: null,
			lcp: null,
			tbt: null,
			cls: null,
			si: null,
			tti: null,
		};
	}

	function extractMetric(id: string): MetricResult | null {
		const audit = (audits as Record<string, unknown>)[id];
		if (!audit || typeof audit !== "object") {
			return null;
		}

		const a = audit as {
			id?: unknown;
			title?: unknown;
			score?: unknown;
			numericValue?: unknown;
			numericUnit?: unknown;
			displayValue?: unknown;
		};

		if (
			typeof a.id !== "string" ||
			typeof a.title !== "string" ||
			typeof a.numericValue !== "number" ||
			typeof a.numericUnit !== "string" ||
			typeof a.displayValue !== "string"
		) {
			return null;
		}

		return {
			id: a.id,
			title: a.title,
			score: typeof a.score === "number" ? Math.round(a.score * 100) : null,
			numericValue: a.numericValue,
			numericUnit: a.numericUnit,
			displayValue: a.displayValue,
		};
	}

	return {
		fcp: extractMetric("first-contentful-paint"),
		lcp: extractMetric("largest-contentful-paint"),
		tbt: extractMetric("total-blocking-time"),
		cls: extractMetric("cumulative-layout-shift"),
		si: extractMetric("speed-index"),
		tti: extractMetric("interactive"),
	};
}

/**
 * Extract the final screenshot from a Lighthouse result (base64 data-URI).
 */
export function extractScreenshotBuffer(
	lhr: Record<string, unknown>,
): Buffer | null {
	const audits = lhr.audits as Record<string, unknown> | undefined;
	if (!audits) {
		return null;
	}

	// Try "final-screenshot" first (always present)
	const finalScreenshot = audits["final-screenshot"] as
		| {
				details?: { data?: string };
		  }
		| undefined;
	const dataUri = finalScreenshot?.details?.data;

	if (typeof dataUri === "string" && dataUri.startsWith("data:image/")) {
		const base64 = dataUri.replace(/^data:image\/\w+;base64,/, "");
		return Buffer.from(base64, "base64");
	}

	// Try "full-page-screenshot"
	const fullPage = audits["full-page-screenshot"] as
		| {
				details?: { screenshot?: { data?: string } };
		  }
		| undefined;
	const fullUri = fullPage?.details?.screenshot?.data;

	if (typeof fullUri === "string" && fullUri.startsWith("data:image/")) {
		const base64 = fullUri.replace(/^data:image\/\w+;base64,/, "");
		return Buffer.from(base64, "base64");
	}

	return null;
}

/**
 * Extract slim LHR from full LHR JSON.
 * Only extracts the fields we need, discarding ~95% of the data.
 */
export function extractSlimLhr(
	lhr: Record<string, unknown>,
	formFactor: "desktop" | "mobile",
): SlimLhr {
	const requestedUrl =
		typeof lhr.requestedUrl === "string" ? lhr.requestedUrl : "";
	const finalDisplayedUrl =
		typeof lhr.finalDisplayedUrl === "string"
			? lhr.finalDisplayedUrl
			: requestedUrl;
	const fetchTime =
		typeof lhr.fetchTime === "string" ? lhr.fetchTime : new Date().toISOString();

	const categories = extractScores(lhr) ?? {
		performance: null,
		accessibility: null,
		bestPractices: null,
		seo: null,
	};

	const metrics = extractMetrics(lhr);
	const opportunities = extractOpportunities(lhr);

	return {
		requestedUrl,
		finalDisplayedUrl,
		fetchTime,
		formFactor,
		categories,
		metrics,
		opportunities,
	};
}
