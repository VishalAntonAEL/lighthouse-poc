import type {
	AuditRunManifest,
	DeviceCategoryComparison,
	ScoreDistribution,
	TopRiskTheme,
} from "@/lib/audit/types";

const CATEGORY_LABELS = [
	{ key: "performance", label: "Performance" },
	{ key: "accessibility", label: "Accessibility" },
	{ key: "bestPractices", label: "Best Practices" },
	{ key: "seo", label: "SEO" },
] as const;

const DISTRIBUTION_COLORS = {
	good: "#0f9d75",
	needsImprovement: "#c9861a",
	poor: "#c44545",
	unavailable: "#6b7280",
} as const;

export type ExecutiveKpi = {
	id: string;
	label: string;
	value: string;
	supporting: string;
	tone: "default" | "accent" | "warning";
};

export type ExecutiveTakeaway = {
	id: string;
	title: string;
	body: string;
};

export type ExecutiveDistributionDatum = {
	id: string;
	label: string;
	value: number;
	color: string;
	rawCount: number;
};

export type ExecutiveRiskTheme = {
	id: string;
	title: string;
	severity: "high" | "medium" | "low";
	occurrenceCount: number;
	impact: string;
};

export type ExecutiveWatchlistItem = {
	slug: string;
	url: string;
	combinedScore: number;
	desktopPerformance: number | null;
	mobilePerformance: number | null;
	desktopStatus: "success" | "error";
	mobileStatus: "success" | "error";
};

export type ExecutiveViewModel = {
	kpis: ExecutiveKpi[];
	desktopCategoryBars: Array<{ label: string; value: number }>;
	mobileCategoryBars: Array<{ label: string; value: number }>;
	targetScore: number;
	categoryComparison: Array<{ category: string; desktop: number; mobile: number }>;
	desktopDistribution: ExecutiveDistributionDatum[];
	mobileDistribution: ExecutiveDistributionDatum[];
	riskThemes: ExecutiveRiskTheme[];
	watchlist: ExecutiveWatchlistItem[];
	takeaways: ExecutiveTakeaway[];
};

function asScore(value: number | null | undefined) {
	return value ?? 0;
}

function asPct(part: number, total: number) {
	if (total <= 0) {
		return 0;
	}
	return Number(((part / total) * 100).toFixed(1));
}

function formatInt(value: number) {
	return value.toLocaleString("en-US");
}

function buildDistributionData(
	performanceBuckets: ScoreDistribution,
): ExecutiveDistributionDatum[] {
	const total =
		performanceBuckets.good +
		performanceBuckets.needsImprovement +
		performanceBuckets.poor +
		performanceBuckets.unavailable;

	return [
		{
			id: "good",
			label: `Good (${formatInt(performanceBuckets.good)})`,
			value: asPct(performanceBuckets.good, total),
			color: DISTRIBUTION_COLORS.good,
			rawCount: performanceBuckets.good,
		},
		{
			id: "needsImprovement",
			label: `Needs Improvement (${formatInt(performanceBuckets.needsImprovement)})`,
			value: asPct(performanceBuckets.needsImprovement, total),
			color: DISTRIBUTION_COLORS.needsImprovement,
			rawCount: performanceBuckets.needsImprovement,
		},
		{
			id: "poor",
			label: `Poor (${formatInt(performanceBuckets.poor)})`,
			value: asPct(performanceBuckets.poor, total),
			color: DISTRIBUTION_COLORS.poor,
			rawCount: performanceBuckets.poor,
		},
		{
			id: "unavailable",
			label: `Unavailable (${formatInt(performanceBuckets.unavailable)})`,
			value: asPct(performanceBuckets.unavailable, total),
			color: DISTRIBUTION_COLORS.unavailable,
			rawCount: performanceBuckets.unavailable,
		},
	];
}

function riskImpact(theme: TopRiskTheme) {
	const mapped: Record<string, string> = {
		"font-display-insight":
			"Typography loading strategy can delay first readable content across templates.",
		"label-content-name-mismatch":
			"Label mismatch introduces accessibility and compliance exposure for key journeys.",
		"network-dependency-tree-insight":
			"Dependency chains increase initial load latency and amplify mobile performance drag.",
		"render-blocking-insight":
			"Render-blocking assets delay critical content and inflate time-to-value.",
		"link-name":
			"Undescriptive links reduce navigation clarity and search accessibility signals.",
		hreflang:
			"Missing locale declarations can suppress discoverability in international search.",
	};

	if (mapped[theme.id]) {
		return mapped[theme.id];
	}
	if (theme.severity === "high") {
		return "High-frequency issue pattern indicates a platform-level remediation opportunity.";
	}
	if (theme.severity === "medium") {
		return "Issue appears at scale and should be batched into the next quality sprint.";
	}
	return "Issue is present but lower urgency versus current high-severity risks.";
}

function buildTakeaways(manifest: AuditRunManifest): ExecutiveTakeaway[] {
	const exec = manifest.executiveSummary;
	const summary = manifest.summary;
	const desktopPerf = summary.devices.desktop.averages?.performance ?? 0;
	const mobilePerf = summary.devices.mobile.averages?.performance ?? 0;
	const performanceGap = desktopPerf - mobilePerf;

	const strongestCategory =
		exec.categoryComparison
			.filter((entry) => entry.desktop != null || entry.mobile != null)
			.map((entry) => ({
				category: entry.category,
				score: Math.max(entry.desktop ?? 0, entry.mobile ?? 0),
			}))
			.sort((left, right) => right.score - left.score)[0]?.category ?? "Best Practices";

	const largestVariance =
		exec.categoryComparison
			.map((entry) => ({
				category: entry.category,
				gap: (entry.desktop ?? 0) - (entry.mobile ?? 0),
			}))
			.sort((left, right) => Math.abs(right.gap) - Math.abs(left.gap))[0] ?? null;

	const topRisk = exec.topRiskThemes[0];

	return [
		{
			id: "health",
			title: "Portfolio Health",
			body: `Overall health is grade ${exec.overallHealthGrade} with score ${exec.overallScore} across ${formatInt(summary.auditedPages)} audited pages.`,
		},
		{
			id: "parity",
			title: "Channel Parity",
			body: largestVariance
				? `${largestVariance.category} shows the largest desktop-mobile variance (${largestVariance.gap > 0 ? "+" : ""}${largestVariance.gap} points). ${strongestCategory} remains the strongest category.`
				: `Desktop and mobile remain generally balanced, led by ${strongestCategory}.`,
		},
		{
			id: "risk",
			title: "Risk Concentration",
			body: topRisk
				? `Top recurring risk is "${topRisk.title}" with ${formatInt(topRisk.count)} occurrences. Performance gap currently sits at ${performanceGap > 0 ? "+" : ""}${performanceGap} points (desktop vs mobile).`
				: "No dominant recurring risk theme identified in this run.",
		},
	];
}

function asRadarData(
	categoryComparison: DeviceCategoryComparison[],
): ExecutiveViewModel["categoryComparison"] {
	return categoryComparison.map((entry) => ({
		category: entry.category,
		desktop: entry.desktop ?? 0,
		mobile: entry.mobile ?? 0,
	}));
}

export function buildExecutiveViewModel(
	manifest: AuditRunManifest,
): ExecutiveViewModel {
	const summary = manifest.summary;
	const exec = manifest.executiveSummary;
	const desktopPerformance = summary.devices.desktop.averages?.performance ?? null;
	const mobilePerformance = summary.devices.mobile.averages?.performance ?? null;
	const performanceGap = asScore(desktopPerformance) - asScore(mobilePerformance);
	const riskPercentExact =
		summary.auditedPages > 0
			? Number(((exec.riskPageCount / summary.auditedPages) * 100).toFixed(2))
			: 0;

	const desktopCategoryBars = CATEGORY_LABELS.map(({ key, label }) => ({
		label,
		value: asScore(summary.devices.desktop.averages?.[key]),
	}));

	const mobileCategoryBars = CATEGORY_LABELS.map(({ key, label }) => ({
		label,
		value: asScore(summary.devices.mobile.averages?.[key]),
	}));

	const kpis: ExecutiveKpi[] = [
		{
			id: "overall-score",
			label: "Overall Score",
			value: String(exec.overallScore),
			supporting: "Weighted cross-category signal",
			tone: "accent",
		},
		{
			id: "health-grade",
			label: "Health Grade",
			value: exec.overallHealthGrade,
			supporting: "Executive quality index",
			tone: "default",
		},
		{
			id: "audited-pages",
			label: "Audited Pages",
			value: formatInt(summary.auditedPages),
			supporting: `${formatInt(summary.totalPages)} total discovered`,
			tone: "default",
		},
		{
			id: "risk-pages",
			label: "Pages at Risk",
			value: formatInt(exec.riskPageCount),
			supporting: `${riskPercentExact.toFixed(2)}% of audited pages`,
			tone: exec.riskPageCount > 0 ? "warning" : "default",
		},
		{
			id: "performance-gap",
			label: "Desktop vs Mobile",
			value: `${performanceGap > 0 ? "+" : ""}${performanceGap}`,
			supporting: "Performance point gap",
			tone: Math.abs(performanceGap) >= 10 ? "warning" : "default",
		},
	];

	const watchlist = manifest.pages
		.filter((page) => page.combinedScore != null)
		.sort((left, right) => (left.combinedScore ?? 0) - (right.combinedScore ?? 0))
		.slice(0, 8)
		.map((page) => ({
			slug: page.slug,
			url: page.url,
			combinedScore: page.combinedScore ?? 0,
			desktopPerformance: page.devices.desktop.scores?.performance ?? null,
			mobilePerformance: page.devices.mobile.scores?.performance ?? null,
			desktopStatus: page.devices.desktop.status,
			mobileStatus: page.devices.mobile.status,
		}));

	const riskThemes = exec.topRiskThemes.slice(0, 6).map((theme) => ({
		id: theme.id,
		title: theme.title,
		severity: theme.severity,
		occurrenceCount: theme.count,
		impact: riskImpact(theme),
	}));

	return {
		kpis,
		desktopCategoryBars,
		mobileCategoryBars,
		targetScore: 90,
		categoryComparison: asRadarData(exec.categoryComparison),
		desktopDistribution: buildDistributionData(
			summary.devices.desktop.performanceBuckets,
		),
		mobileDistribution: buildDistributionData(
			summary.devices.mobile.performanceBuckets,
		),
		riskThemes,
		watchlist,
		takeaways: buildTakeaways(manifest),
	};
}
