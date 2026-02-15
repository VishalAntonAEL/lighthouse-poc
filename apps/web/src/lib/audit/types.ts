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

export type MetricResult = {
	id: string;
	title: string;
	score: number | null; // 0-100
	numericValue: number; // raw value (ms or unitless)
	numericUnit: string; // "millisecond" | "unitless"
	displayValue: string; // "3.8 s", "0.1"
};

export type SlimLhr = {
	requestedUrl: string;
	finalDisplayedUrl: string;
	fetchTime: string;
	formFactor: "desktop" | "mobile";
	categories: CategoryScores;
	metrics: {
		fcp: MetricResult | null;
		lcp: MetricResult | null;
		tbt: MetricResult | null;
		cls: MetricResult | null;
		si: MetricResult | null;
		tti: MetricResult | null;
	};
	opportunities: OpportunitySummary[];
};

export type Checkpoint = {
	jobId: string;
	completedSlugs: string[];
	failedSlugs: string[];
	auditedCount: number;
	savedAt: string;
};

export type DeviceResult = {
	device: "desktop" | "mobile";
	status: "success" | "error";
	scores: CategoryScores | null;
	opportunities: OpportunitySummary[];
	slimLhrPath: string | null; // Path to slim JSON file
	errorMessage?: string;
	cruxData?: CruxData | null; // Per-URL or origin fallback
	metrics?: {
		fcp: MetricResult | null;
		lcp: MetricResult | null;
		tbt: MetricResult | null;
		cls: MetricResult | null;
		si: MetricResult | null;
		tti: MetricResult | null;
	};
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
	originCrux?: {
		desktop?: CruxData | null;
		mobile?: CruxData | null;
		combined?: CruxData | null;
	};
	cruxHistory?: CruxHistoryRecord | null;
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

export type CruxMetric = {
	histogram: Array<{ start: number; end?: number; density: number }>;
	percentiles: { p75: number };
};

export type CruxData = {
	key: { url?: string; origin?: string; formFactor?: string };
	metrics: {
		largest_contentful_paint?: CruxMetric;
		interaction_to_next_paint?: CruxMetric;
		cumulative_layout_shift?: CruxMetric;
		first_contentful_paint?: CruxMetric;
		time_to_first_byte?: CruxMetric;
	};
	collectionPeriod?: { firstDate: string; lastDate: string };
};

export type CruxHistoryRecord = {
	key: { origin: string; formFactor?: string };
	historyRecord: Array<{
		collectionPeriod: { firstDate: string; lastDate: string };
		metrics: CruxData["metrics"];
	}>;
};
