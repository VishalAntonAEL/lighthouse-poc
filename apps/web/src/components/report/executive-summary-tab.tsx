"use client";

import { ArrowUpRight, CircleAlert, ShieldCheck } from "lucide-react";

import {
	CategoryScoreCards,
	ScoreScaleLegend,
} from "@/components/report/category-score-cards";
import type { ExecutiveViewModel } from "@/components/report/report-view-model";
import { formatScore, scoreTone } from "@/components/report/score-utils";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StrokeMultipleRadarChart } from "@/components/ui/stroke-multiple-radar-chart";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { AuditRunManifest } from "@/lib/audit/types";

type ExecutiveSummaryTabProps = {
	manifest: AuditRunManifest;
	viewModel: ExecutiveViewModel;
	onInspectSlug: (slug: string) => void;
};

const severityBadgeTone: Record<
	"high" | "medium" | "low",
	"destructive" | "secondary" | "outline"
> = {
	high: "destructive",
	medium: "secondary",
	low: "outline",
};

const kpiToneClass: Record<"default" | "accent" | "warning", string> = {
	default: "border-border",
	accent: "report-kpi-accent border-transparent",
	warning: "border-amber-300/60 bg-amber-50/80 dark:bg-amber-950/30",
};

function withAlpha(hex: string, alphaHex: string) {
	if (!hex.startsWith("#") || hex.length !== 7) {
		return hex;
	}

	return `${hex}${alphaHex}`;
}

function DistributionRing({ value, color }: { value: number; color: string }) {
	return (
		<div
			className="grid size-12 place-items-center rounded-full border-2 font-semibold text-xs"
			style={{
				color,
				borderColor: color,
				backgroundColor: withAlpha(color, "1A"),
			}}
		>
			{value.toFixed(1)}%
		</div>
	);
}

function CategoryAverageCard({
	title,
	description,
	data,
	badgeText,
}: {
	title: string;
	description: string;
	data: Array<{ label: string; value: number }>;
	badgeText: string;
}) {
	return (
		<Card className="report-surface h-full">
			<CardHeader className="border-b">
				<div className="flex items-center justify-between gap-2">
					<CardTitle>{title}</CardTitle>
					<Badge variant="secondary">{badgeText}</Badge>
				</div>
				<p className="text-muted-foreground text-xs">{description}</p>
			</CardHeader>
			<CardContent className="grid gap-3 pt-4">
				<CategoryScoreCards
					className="sm:grid-cols-2 xl:grid-cols-2"
					items={data.map((entry) => ({
						label: entry.label,
						score: entry.value,
					}))}
				/>
				<ScoreScaleLegend className="justify-end" />
			</CardContent>
		</Card>
	);
}

function DistributionBreakdownCard({
	title,
	description,
	data,
}: {
	title: string;
	description: string;
	data: ExecutiveViewModel["desktopDistribution"];
}) {
	return (
		<Card className="report-surface h-full">
			<CardHeader className="border-b">
				<CardTitle>{title}</CardTitle>
				<p className="text-muted-foreground text-xs">{description}</p>
			</CardHeader>
			<CardContent className="grid gap-2 pt-4 sm:grid-cols-2">
				{data.map((bucket) => (
					<div
						key={bucket.id}
						className="flex items-center justify-between gap-3 rounded-lg border border-border/70 bg-card/80 p-3"
					>
						<div className="grid gap-1">
							<p className="font-medium text-xs">{bucket.label}</p>
							<p className="text-muted-foreground text-xs">
								{bucket.rawCount.toLocaleString("en-US")} URLs
							</p>
						</div>
						<DistributionRing value={bucket.value} color={bucket.color} />
					</div>
				))}
			</CardContent>
		</Card>
	);
}

export default function ExecutiveSummaryTab({
	manifest,
	viewModel,
	onInspectSlug,
}: ExecutiveSummaryTabProps) {
	return (
		<div className="report-latest-dashboard grid gap-5">
			<section className="report-reveal grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
				{viewModel.kpis.map((kpi, index) => (
					<Card
						key={kpi.id}
						className={`report-kpi-card ${kpiToneClass[kpi.tone]}`}
						data-step={index + 1}
					>
						<CardContent className="grid gap-1 p-4">
							<p className="report-kpi-label">{kpi.label}</p>
							<p className="report-kpi-value">{kpi.value}</p>
							<p className="text-muted-foreground text-xs">{kpi.supporting}</p>
						</CardContent>
					</Card>
				))}
			</section>

			<section className="report-reveal grid gap-4 xl:grid-cols-[minmax(0,1.7fr)_minmax(300px,0.9fr)]">
				<div className="report-surface rounded-xl border border-border/70 p-4">
					<Tabs defaultValue="desktop" className="grid gap-4">
						<TabsList variant="line" className="border-border border-b pb-1">
							<TabsTrigger value="desktop">Desktop</TabsTrigger>
							<TabsTrigger value="mobile">Mobile</TabsTrigger>
						</TabsList>

						<TabsContent value="desktop" className="grid gap-4 xl:grid-cols-2">
							<CategoryAverageCard
								title="Desktop Category Averages"
								description="Average score by category"
								data={viewModel.desktopCategoryBars}
								badgeText="Desktop"
							/>
							<DistributionBreakdownCard
								title="Desktop Performance Distribution"
								description="Bucket share and raw count by performance band."
								data={viewModel.desktopDistribution}
							/>
						</TabsContent>

						<TabsContent value="mobile" className="grid gap-4 xl:grid-cols-2">
							<CategoryAverageCard
								title="Mobile Category Averages"
								description="Average score by category"
								data={viewModel.mobileCategoryBars}
								badgeText="Mobile"
							/>
							<DistributionBreakdownCard
								title="Mobile Performance Distribution"
								description="Bucket share and raw count by performance band."
								data={viewModel.mobileDistribution}
							/>
						</TabsContent>
					</Tabs>
				</div>

				<StrokeMultipleRadarChart
					title="Channel Parity"
					description="Desktop vs mobile category spread"
					data={viewModel.categoryComparison}
					badgeText={`Overall ${manifest.executiveSummary.overallScore}`}
				/>
			</section>

			<section className="report-reveal grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
				<Card className="report-surface">
					<CardHeader className="border-b">
						<CardTitle className="flex items-center gap-2">
							<CircleAlert className="size-4 text-amber-600" />
							Risk Concentration
						</CardTitle>
					</CardHeader>
					<CardContent className="grid gap-2 pt-4">
						{viewModel.riskThemes.map((issue) => (
							<div
								key={issue.id}
								className="grid gap-2 rounded-lg border border-border/70 p-3"
							>
								<div className="flex flex-wrap items-start justify-between gap-2">
									<p className="font-medium text-sm leading-tight">
										{issue.title}
									</p>
									<div className="flex items-center gap-2">
										<Badge variant={severityBadgeTone[issue.severity]}>
											{issue.severity}
										</Badge>
										<Badge variant="outline">
											{issue.occurrenceCount.toLocaleString("en-US")}{" "}
											occurrences
										</Badge>
									</div>
								</div>
								<p className="text-muted-foreground text-xs">{issue.impact}</p>
							</div>
						))}
					</CardContent>
				</Card>

				<Card className="report-surface">
					<CardHeader className="border-b">
						<CardTitle className="flex items-center gap-2">
							<ShieldCheck className="size-4 text-emerald-600" />
							Priority URL Watchlist
						</CardTitle>
					</CardHeader>
					<CardContent className="grid gap-2 pt-4">
						{viewModel.watchlist.map((page) => (
							<div
								key={page.slug}
								className="group grid gap-2 rounded-lg border border-border/70 p-3 transition-colors hover:bg-muted/40"
							>
								<div className="flex items-center justify-between gap-2">
									<p className="max-w-[75%] truncate font-medium text-xs">
										{page.url}
									</p>
									<button
										type="button"
										className="inline-flex items-center gap-1 rounded-md border px-2 py-1 text-xs transition-colors hover:border-foreground/30 hover:bg-background"
										onClick={() => onInspectSlug(page.slug)}
									>
										Inspect
										<ArrowUpRight className="size-3" />
									</button>
								</div>
								<div className="flex flex-wrap items-center gap-2">
									<Badge
										variant="outline"
										className={scoreTone(page.combinedScore)}
									>
										Combined {formatScore(page.combinedScore)}
									</Badge>
									<Badge
										variant="outline"
										className={scoreTone(page.desktopPerformance)}
									>
										Desktop {formatScore(page.desktopPerformance)}
									</Badge>
									<Badge
										variant="outline"
										className={scoreTone(page.mobilePerformance)}
									>
										Mobile {formatScore(page.mobilePerformance)}
									</Badge>
									<Badge
										variant={
											page.desktopStatus === "success"
												? "secondary"
												: "destructive"
										}
									>
										D {page.desktopStatus}
									</Badge>
									<Badge
										variant={
											page.mobileStatus === "success"
												? "secondary"
												: "destructive"
										}
									>
										M {page.mobileStatus}
									</Badge>
								</div>
							</div>
						))}
					</CardContent>
				</Card>
			</section>

			<section className="report-reveal grid gap-3 md:grid-cols-3">
				{viewModel.takeaways.map((takeaway) => (
					<Card key={takeaway.id} className="report-surface">
						<CardContent className="grid gap-1 p-4">
							<p className="report-kpi-label">{takeaway.title}</p>
							<p className="text-sm leading-relaxed">{takeaway.body}</p>
						</CardContent>
					</Card>
				))}
			</section>
		</div>
	);
}
