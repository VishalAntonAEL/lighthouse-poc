"use client";

import { useEffect, useMemo, useState } from "react";
import { getLatestManifestAction } from "@/app/actions/audit-actions";
import PageDrilldown from "@/components/report/page-drilldown";
import ReportKpis from "@/components/report/report-kpis";
import RunMeta from "@/components/report/run-meta";
import UrlTable from "@/components/report/url-table";
import CruxSection from "@/components/report/crux-section";
import CruxTrends from "@/components/report/crux-trends";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StrokeMultipleRadarChart } from "@/components/ui/stroke-multiple-radar-chart";
import type { AuditPageResult, AuditRunManifest } from "@/lib/audit/types";

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
			<div className="container mx-auto max-w-7xl px-4 py-4">
				<p className="text-muted-foreground text-xs">
					Loading latest report...
				</p>
			</div>
		);
	}

	if (loadState.status === "error") {
		return (
			<div className="container mx-auto max-w-7xl px-4 py-4">
				<div className="grid gap-2 border p-4">
					<p className="font-medium text-sm">No report available</p>
					<p className="text-muted-foreground text-xs">{loadState.message}</p>
					<a href="/" className="text-xs underline">
						Start an audit
					</a>
				</div>
			</div>
		);
	}

	const manifest = loadState.manifest;
	const exec = manifest.executiveSummary;

	const radarData = exec.categoryComparison.map((entry) => ({
		category: entry.category,
		desktop: entry.desktop ?? 0,
		mobile: entry.mobile ?? 0,
	}));

	return (
		<div className="container mx-auto grid max-w-7xl gap-3 px-4 py-4">
			<div className="flex flex-wrap items-center justify-between gap-2">
				<div>
					<h1 className="font-semibold text-lg">Latest Lighthouse Report</h1>
					<p className="text-muted-foreground text-xs">
						Run ID: <span className="font-mono">{manifest.runId}</span>
					</p>
				</div>
				<div className="flex gap-2">
					<Button variant="outline" onClick={() => void load()}>
						Refresh
					</Button>
					<a
						href="/"
						className="inline-flex h-8 items-center border px-2.5 text-xs"
					>
						New Audit
					</a>
				</div>
			</div>

			<RunMeta manifest={manifest} />
			<ReportKpis manifest={manifest} />

			<div className="grid gap-3">
				<StrokeMultipleRadarChart
					title="Desktop vs Mobile"
					description="Category score spread"
					data={radarData}
					badgeText={`Overall ${exec.overallScore}`}
				/>
			</div>

			<Card>
				<CardHeader className="border-b">
					<CardTitle>Top Risk Themes</CardTitle>
				</CardHeader>
				<CardContent className="grid gap-2 pt-4">
					{exec.topRiskThemes.length === 0 ? (
						<p className="text-muted-foreground text-xs">
							No recurring risk themes found.
						</p>
					) : (
						exec.topRiskThemes.map((issue) => (
							<div key={issue.id} className="grid gap-1 border p-2">
								<div className="flex items-center justify-between gap-2">
									<p className="font-medium text-xs">{issue.title}</p>
									<div className="flex items-center gap-1">
										<Badge variant="secondary">{issue.count} pages</Badge>
										<Badge variant="outline">Severity: {issue.severity}</Badge>
									</div>
								</div>
								{issue.description ? (
									<p className="text-muted-foreground text-xs">
										{issue.description}
									</p>
								) : null}
							</div>
						))
					)}
				</CardContent>
			</Card>

			{manifest.originCrux && (
				<div className="grid gap-3">
					<CruxSection
						cruxData={manifest.originCrux.combined || manifest.originCrux.desktop}
						title="Site-Wide Real-User Experience (CrUX)"
						fallbackMessage="No origin-level CrUX data available."
					/>
					{manifest.cruxHistory && (
						<CruxTrends cruxHistory={manifest.cruxHistory} />
					)}
				</div>
			)}

			<UrlTable
				pages={manifest.pages}
				selectedSlug={selectedSlug}
				onSelect={(page: AuditPageResult) => setSelectedSlug(page.slug)}
			/>
			<PageDrilldown page={selectedPage} originCrux={manifest.originCrux} />
		</div>
	);
}
