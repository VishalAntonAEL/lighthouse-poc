import type {
	AuditPageResult,
	AuditRunManifest,
	AuditSettings,
	AuditSummary,
	CategoryScores,
	DeviceCategoryComparison,
	DeviceResult,
	DeviceSummary,
	ExecutiveSummary,
	ScoreDistribution,
	TopIssue,
	TopRiskTheme,
} from "./types";

type BuildManifestInput = {
	runId: string;
	jobId: string;
	baseUrl: string;
	startedAt: string;
	finishedAt: string;
	discoveredPages: number;
	settings: AuditSettings;
	pages: AuditPageResult[];
};

function average(values: number[]) {
	if (values.length === 0) {
		return null;
	}

	return Math.round(values.reduce((sum, value) => sum + value, 0) / values.length);
}

function toDistribution(scores: Array<number | null>): ScoreDistribution {
	const distribution: ScoreDistribution = {
		good: 0,
		needsImprovement: 0,
		poor: 0,
		unavailable: 0,
	};

	for (const score of scores) {
		if (score == null) {
			distribution.unavailable += 1;
			continue;
		}

		if (score >= 90) {
			distribution.good += 1;
			continue;
		}
		if (score >= 50) {
			distribution.needsImprovement += 1;
			continue;
		}
		distribution.poor += 1;
	}

	return distribution;
}

function averageScores(results: DeviceResult[]): CategoryScores | null {
	const performance = average(
		results
			.map((entry) => entry.scores?.performance)
			.filter((score): score is number => score != null),
	);
	const accessibility = average(
		results
			.map((entry) => entry.scores?.accessibility)
			.filter((score): score is number => score != null),
	);
	const bestPractices = average(
		results
			.map((entry) => entry.scores?.bestPractices)
			.filter((score): score is number => score != null),
	);
	const seo = average(
		results
			.map((entry) => entry.scores?.seo)
			.filter((score): score is number => score != null),
	);

	if (
		performance == null &&
		accessibility == null &&
		bestPractices == null &&
		seo == null
	) {
		return null;
	}

	return {
		performance,
		accessibility,
		bestPractices,
		seo,
	};
}

function summarizeDevice(
	pages: AuditPageResult[],
	device: "desktop" | "mobile",
): DeviceSummary {
	const results = pages.map((page) => page.devices[device]);
	const successful = results.filter((entry) => entry.status === "success");
	const failed = results.length - successful.length;

	return {
		auditedPages: successful.length,
		failedPages: failed,
		averages: averageScores(successful),
		performanceBuckets: toDistribution(
			results.map((entry) => entry.scores?.performance ?? null),
		),
	};
}

function summarizeTopIssues(pages: AuditPageResult[]): TopIssue[] {
	const issueMap = new Map<
		string,
		{
			id: string;
			title: string;
			description: string;
			count: number;
			worstScore: number | null;
			affectedUrls: Set<string>;
		}
	>();

	for (const page of pages) {
		for (const device of [page.devices.desktop, page.devices.mobile]) {
			for (const issue of device.opportunities) {
				const existing = issueMap.get(issue.id);
				if (existing) {
					existing.count += 1;
					existing.affectedUrls.add(page.url);
					if (
						issue.score != null &&
						(existing.worstScore == null || issue.score < existing.worstScore)
					) {
						existing.worstScore = issue.score;
					}
					continue;
				}

				issueMap.set(issue.id, {
					id: issue.id,
					title: issue.title,
					description: issue.description,
					count: 1,
					worstScore: issue.score,
					affectedUrls: new Set([page.url]),
				});
			}
		}
	}

	return [...issueMap.values()]
		.sort((left, right) => {
			if (left.count !== right.count) {
				return right.count - left.count;
			}
			return (left.worstScore ?? 100) - (right.worstScore ?? 100);
		})
		.slice(0, 20)
		.map((entry) => ({
			id: entry.id,
			title: entry.title,
			description: entry.description,
			count: entry.count,
			worstScore: entry.worstScore,
			affectedUrls: [...entry.affectedUrls].slice(0, 50),
		}));
}

function severityFor(score: number | null): TopRiskTheme["severity"] {
	if (score == null) {
		return "low";
	}
	if (score < 50) {
		return "high";
	}
	if (score < 75) {
		return "medium";
	}
	return "low";
}

function buildExecutiveSummary(summary: AuditSummary): ExecutiveSummary {
	const desktopAvg = summary.devices.desktop.averages?.performance ?? null;
	const mobileAvg = summary.devices.mobile.averages?.performance ?? null;
	const validAverages = [desktopAvg, mobileAvg].filter(
		(value): value is number => value != null,
	);
	const overallScore =
		validAverages.length > 0
			? Math.round(
					validAverages.reduce((sum, value) => sum + value, 0) /
						validAverages.length,
				)
			: 0;

	const grade: ExecutiveSummary["overallHealthGrade"] =
		overallScore >= 90
			? "A"
			: overallScore >= 80
				? "B"
				: overallScore >= 70
					? "C"
					: overallScore >= 60
						? "D"
						: "F";

	const riskPages =
		summary.devices.desktop.performanceBuckets.poor +
		summary.devices.mobile.performanceBuckets.poor;
	const totalDevicePages = summary.totalPages * 2 || 1;
	const pagesAtRiskPercent = Math.round((riskPages / totalDevicePages) * 100);

	const topRiskThemes: TopRiskTheme[] = summary.topIssues.slice(0, 8).map((issue) => ({
		id: issue.id,
		title: issue.title,
		description: issue.description,
		count: issue.count,
		severity: severityFor(issue.worstScore),
		worstScore: issue.worstScore,
	}));

	const categoryComparison: DeviceCategoryComparison[] = [
		{
			category: "Performance",
			desktop: summary.devices.desktop.averages?.performance ?? null,
			mobile: summary.devices.mobile.averages?.performance ?? null,
		},
		{
			category: "Accessibility",
			desktop: summary.devices.desktop.averages?.accessibility ?? null,
			mobile: summary.devices.mobile.averages?.accessibility ?? null,
		},
		{
			category: "Best Practices",
			desktop: summary.devices.desktop.averages?.bestPractices ?? null,
			mobile: summary.devices.mobile.averages?.bestPractices ?? null,
		},
		{
			category: "SEO",
			desktop: summary.devices.desktop.averages?.seo ?? null,
			mobile: summary.devices.mobile.averages?.seo ?? null,
		},
	];

	return {
		overallHealthGrade: grade,
		overallScore,
		pagesAtRiskPercent,
		riskPageCount: riskPages,
		topRiskThemes,
		scoreDistribution: {
			desktop: summary.devices.desktop.performanceBuckets,
			mobile: summary.devices.mobile.performanceBuckets,
		},
		categoryComparison,
	};
}

function summarizePages(
	pages: AuditPageResult[],
	discoveredPages: number,
): AuditSummary {
	const failedPages = pages.filter(
		(page) =>
			page.devices.desktop.status === "error" &&
			page.devices.mobile.status === "error",
	).length;

	return {
		totalPages: pages.length,
		discoveredPages,
		auditedPages: pages.length,
		failedPages,
		devices: {
			desktop: summarizeDevice(pages, "desktop"),
			mobile: summarizeDevice(pages, "mobile"),
		},
		topIssues: summarizeTopIssues(pages),
	};
}

export function buildRunManifest(input: BuildManifestInput): AuditRunManifest {
	const sortedPages = [...input.pages].sort((left, right) => {
		const leftScore = left.combinedScore ?? -1;
		const rightScore = right.combinedScore ?? -1;
		return leftScore - rightScore;
	});

	const summary = summarizePages(sortedPages, input.discoveredPages);
	const executiveSummary = buildExecutiveSummary(summary);

	return {
		runId: input.runId,
		jobId: input.jobId,
		baseUrl: input.baseUrl,
		startedAt: input.startedAt,
		finishedAt: input.finishedAt,
		settings: input.settings,
		summary,
		executiveSummary,
		pages: sortedPages,
	};
}
