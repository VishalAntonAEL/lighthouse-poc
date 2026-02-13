"use client";

import { useEffect, useMemo, useState } from "react";
import { getLatestManifestAction } from "@/app/actions/audit-actions";
import PageDrilldown from "@/components/report/page-drilldown";
import ReportKpis from "@/components/report/report-kpis";
import RunMeta from "@/components/report/run-meta";
import UrlTable from "@/components/report/url-table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { RoundedPieChart } from "@/components/ui/rounded-pie-chart";
import { StrokeMultipleRadarChart } from "@/components/ui/stroke-multiple-radar-chart";
import { ValueLineBarChart } from "@/components/ui/value-line-bar-chart";
import type { AuditPageResult, AuditRunManifest } from "@/lib/audit/types";
import { AlertCircle, TrendingDown, Target, CheckCircle2 } from "lucide-react";

type LoadState =
	| { status: "loading" }
	| { status: "error"; message: string }
	| { status: "loaded"; manifest: AuditRunManifest };

export default function LatestReportView() {
	const [loadState, setLoadState] = useState<LoadState>({ status: "loading" });
	const [selectedSlug, setSelectedSlug] = useState<string | null>(null);

	async function load() {
		setLoadState({ status: "loading" });
		try {
			const manifest = await getLatestManifestAction();
			if (!manifest) {
				setLoadState({
					status: "error",
					message: "No report found. Start an audit from Home.",
				});
				return;
			}

			setLoadState({ status: "loaded", manifest });
			setSelectedSlug((previous) => {
				if (previous && manifest.pages.some((page) => page.slug === previous)) {
					return previous;
				}
				return manifest.pages[0]?.slug ?? null;
			});
		} catch (error) {
			setLoadState({
				status: "error",
				message:
					error instanceof Error ? error.message : "Unable to load report.",
			});
		}
	}

	useEffect(() => {
		void load();
	}, []);

	const selectedPage = useMemo(() => {
		if (loadState.status !== "loaded") {
			return null;
		}
		return (
			loadState.manifest.pages.find((page) => page.slug === selectedSlug) ??
			null
		);
	}, [loadState, selectedSlug]);

	if (loadState.status === "loading") {
		return (
			<div className="flex items-center justify-center min-h-screen">
				<div className="flex flex-col items-center gap-3">
					<div className="h-8 w-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
					<p className="text-muted-foreground text-sm">Loading latest report...</p>
				</div>
			</div>
		);
	}

	if (loadState.status === "error") {
		return (
			<div className="flex items-center justify-center min-h-screen">
				<div className="max-w-md w-full mx-4">
					<Card className="border-destructive/50">
						<CardContent className="pt-6">
							<div className="flex gap-3">
								<AlertCircle className="h-5 w-5 text-destructive flex-shrink-0 mt-0.5" />
								<div className="grid gap-2">
									<p className="font-semibold text-sm">No report available</p>
									<p className="text-muted-foreground text-sm">{loadState.message}</p>
									<a href="/" className="text-primary text-sm underline hover:no-underline">
										Start an audit
									</a>
								</div>
							</div>
						</CardContent>
					</Card>
				</div>
			</div>
		);
	}

	const manifest = loadState.manifest;
	const exec = manifest.executiveSummary;

	const worstPerfData = manifest.pages.slice(0, 12).map((page) => ({
		label: page.slug,
		value: page.combinedScore ?? 0,
	}));

	const distribution = exec.scoreDistribution;
	const pieData = [
		{
			id: "good",
			label: "Good",
			value: distribution.desktop.good + distribution.mobile.good,
			color: "var(--chart-2)",
		},
		{
			id: "needs_work",
			label: "Needs Work",
			value:
				distribution.desktop.needsImprovement +
				distribution.mobile.needsImprovement,
			color: "var(--chart-3)",
		},
		{
			id: "poor",
			label: "Poor",
			value: distribution.desktop.poor + distribution.mobile.poor,
			color: "var(--chart-5)",
		},
		{
			id: "unavailable",
			label: "Unavailable",
			value: distribution.desktop.unavailable + distribution.mobile.unavailable,
			color: "var(--muted-foreground)",
		},
	];

	const radarData = exec.categoryComparison.map((entry) => ({
		category: entry.category,
		desktop: entry.desktop ?? 0,
		mobile: entry.mobile ?? 0,
	}));

	return (
		<div className="min-h-screen bg-gradient-to-br from-background to-muted/30">
			{/* Header */}
			<div className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
				<div className="container mx-auto max-w-7xl px-4 py-6 sm:py-8">
					<div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
						<div className="space-y-2">
							<h1 className="text-3xl sm:text-4xl font-bold tracking-tight">
								Website Performance Report
							</h1>
							<p className="text-sm text-muted-foreground">
								Lighthouse audit for <span className="font-semibold text-foreground">{manifest.baseUrl}</span>
							</p>
						</div>
						<div className="flex flex-wrap gap-2">
							<Button variant="outline" onClick={() => void load()} size="sm">
								Refresh
							</Button>
							<a
								href="/"
								className="inline-flex items-center justify-center h-9 px-4 border rounded-md bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90"
							>
								New Audit
							</a>
						</div>
					</div>
				</div>
			</div>

			{/* Main Content */}
			<div className="container mx-auto max-w-7xl px-4 py-8 sm:py-12">
				<div className="grid gap-8">
					{/* KPIs Section */}
					<div>
						<h2 className="text-xl font-semibold mb-4 text-foreground">Executive Summary</h2>
						<ReportKpis manifest={manifest} />
					</div>

					{/* Charts Section */}
					<div>
						<h2 className="text-xl font-semibold mb-4 text-foreground">Performance Insights</h2>
						<div className="grid gap-4 lg:grid-cols-3">
							<ValueLineBarChart
								title="Performance"
								description="Lowest combined score pages"
								data={worstPerfData}
								target={90}
								badgeText={`Health ${exec.overallHealthGrade}`}
							/>
							<RoundedPieChart
								title="Score Distribution"
								description="Desktop + Mobile bucket share"
								data={pieData}
								badgeText={`${exec.pagesAtRiskPercent}% at risk`}
							/>
							<StrokeMultipleRadarChart
								title="Desktop vs Mobile"
								description="Category score spread"
								data={radarData}
								badgeText={`Overall ${exec.overallScore}`}
							/>
						</div>
					</div>

					{/* Metadata */}
					<RunMeta manifest={manifest} />

					{/* Risk Themes Section */}
					{exec.topRiskThemes.length > 0 && (
						<div>
							<div className="flex items-center gap-2 mb-4">
								<AlertCircle className="h-5 w-5 text-amber-500" />
								<h2 className="text-xl font-semibold text-foreground">Critical Issues & Opportunities</h2>
							</div>
							<Card>
								<CardContent className="pt-6">
									<div className="grid gap-3">
										{exec.topRiskThemes.map((issue) => (
											<div
												key={issue.id}
												className="flex gap-4 p-4 border rounded-lg hover:bg-muted/50 transition-colors"
											>
												<div className="flex-shrink-0">
													{issue.severity === "high" ? (
														<div className="h-10 w-10 rounded-full bg-destructive/10 flex items-center justify-center">
															<TrendingDown className="h-5 w-5 text-destructive" />
														</div>
													) : (
														<div className="h-10 w-10 rounded-full bg-amber-500/10 flex items-center justify-center">
															<Target className="h-5 w-5 text-amber-600" />
														</div>
													)}
												</div>
												<div className="flex-1 min-w-0">
													<div className="flex items-start justify-between gap-2 mb-1">
														<p className="font-semibold text-sm text-foreground">{issue.title}</p>
														<div className="flex gap-2 flex-shrink-0">
															<Badge variant="secondary" className="whitespace-nowrap">
																{issue.count} {issue.count === 1 ? 'page' : 'pages'}
															</Badge>
															<Badge 
																variant="outline"
																className={issue.severity === 'high' ? 'bg-destructive/10 text-destructive border-destructive/20' : 'bg-amber-500/10 text-amber-700 border-amber-200'}
															>
																{issue.severity.charAt(0).toUpperCase() + issue.severity.slice(1)}
															</Badge>
														</div>
													</div>
													{issue.description ? (
														<p className="text-sm text-muted-foreground">{issue.description}</p>
													) : null}
												</div>
											</div>
										))}
									</div>
								</CardContent>
							</Card>
						</div>
					)}

					{/* URL Table Section */}
					<div>
						<h2 className="text-xl font-semibold mb-4 text-foreground flex items-center gap-2">
							<CheckCircle2 className="h-5 w-5" />
							Page-by-Page Analysis
						</h2>
						<UrlTable
							pages={manifest.pages}
							selectedSlug={selectedSlug}
							onSelect={(page: AuditPageResult) => setSelectedSlug(page.slug)}
						/>
					</div>

					{/* Drilldown Section */}
					<PageDrilldown page={selectedPage} />
				</div>
			</div>
		</div>
	);
}
