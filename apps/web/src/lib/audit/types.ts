export type AuditJobStatus = "queued" | "running" | "completed" | "failed";

export type AuditProgress = {
	discovered: number;
	crawled: number;
	audited: number;
	totalTarget: number;
};

export type CategoryScores = {
	performance: number | null;
	accessibility: number | null;
	bestPractices: number | null;
	seo: number | null;
};

export type OpportunitySummary = {
	id: string;
	title: string;
	description: string;
	displayValue: string | null;
	score: number | null;
};

export type DeviceResult = {
	device: "desktop" | "mobile";
	status: "success" | "error";
	scores: CategoryScores | null;
	opportunities: OpportunitySummary[];
	reportPath: string | null;
	lhrPath: string | null;
	errorMessage?: string;
};

export type AuditPageResult = {
	url: string;
	canonicalUrl: string;
	slug: string;
	screenshotPath: string | null;
	devices: {
		desktop: DeviceResult;
		mobile: DeviceResult;
	};
	combinedScore: number | null;
};

export type ScoreDistribution = {
	good: number;
	needsImprovement: number;
	poor: number;
	unavailable: number;
};

export type DeviceSummary = {
	auditedPages: number;
	failedPages: number;
	averages: CategoryScores | null;
	performanceBuckets: ScoreDistribution;
};

export type TopIssue = {
	id: string;
	title: string;
	description: string;
	count: number;
	worstScore: number | null;
	affectedUrls: string[];
};

export type TopRiskTheme = {
	id: string;
	title: string;
	description: string;
	count: number;
	severity: "high" | "medium" | "low";
	worstScore: number | null;
};

export type DeviceCategoryComparison = {
	category: "Performance" | "Accessibility" | "Best Practices" | "SEO";
	desktop: number | null;
	mobile: number | null;
};

export type ExecutiveSummary = {
	overallHealthGrade: "A" | "B" | "C" | "D" | "F";
	overallScore: number;
	pagesAtRiskPercent: number;
	riskPageCount: number;
	topRiskThemes: TopRiskTheme[];
	scoreDistribution: {
		desktop: ScoreDistribution;
		mobile: ScoreDistribution;
	};
	categoryComparison: DeviceCategoryComparison[];
};

export type AuditSummary = {
	totalPages: number;
	discoveredPages: number;
	auditedPages: number;
	failedPages: number;
	devices: {
		desktop: DeviceSummary;
		mobile: DeviceSummary;
	};
	topIssues: TopIssue[];
};

export type AuditSettings = {
	maxPages: number;
	auditConcurrency: number;
	devices: Array<"desktop" | "mobile">;
};

export type AuditRunManifest = {
	runId: string;
	jobId: string;
	baseUrl: string;
	startedAt: string;
	finishedAt: string;
	summary: AuditSummary;
	executiveSummary: ExecutiveSummary;
	settings: AuditSettings;
	pages: AuditPageResult[];
};

export type AuditJob = {
	jobId: string;
	baseUrl: string;
	status: AuditJobStatus;
	progress: AuditProgress;
	startedAt: string;
	finishedAt: string | null;
	runId?: string;
	errorMessage?: string;
};

export type CrawlResult = {
	urls: string[];
	discovered: number;
	crawled: number;
	sitemapDiscovered: number;
};

export type TimeoutConfig = {
	cdpConnect?: number;
	chromeLaunch?: number;
	pageNavigation?: number;
	lighthouseAudit?: number;
};

export type RetryConfig = {
	maxRetries?: number;
	initialDelayMs?: number;
	maxDelayMs?: number;
};
