"use client";

import { useMemo } from "react";

import CruxSection from "@/components/report/crux-section";
import CruxTrends from "@/components/report/crux-trends";
import PageDrilldown from "@/components/report/page-drilldown";
import RunMeta from "@/components/report/run-meta";
import UrlTable from "@/components/report/url-table";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { AuditRunManifest } from "@/lib/audit/types";

type DetailedDiagnosticsTabProps = {
	manifest: AuditRunManifest;
	selectedSlug: string | null;
	onSelectSlug: (slug: string) => void;
};

function hasCruxTrendData(manifest: AuditRunManifest) {
	return Boolean(
		manifest.cruxHistory?.historyRecord?.some((record) => {
			const metrics = record.metrics;
			return (
				metrics.largest_contentful_paint?.percentiles?.p75 != null ||
				metrics.interaction_to_next_paint?.percentiles?.p75 != null ||
				metrics.cumulative_layout_shift?.percentiles?.p75 != null
			);
		}),
	);
}

function OriginInsightsCard({ manifest }: { manifest: AuditRunManifest }) {
	const topIssues = manifest.summary.topIssues.slice(0, 5);
	return (
		<Card>
			<CardHeader className="border-b">
				<CardTitle className="text-sm">Origin Intelligence Snapshot</CardTitle>
			</CardHeader>
			<CardContent className="grid gap-3 pt-4">
				<div className="grid gap-1 text-xs">
					<p className="text-muted-foreground">Coverage</p>
					<p className="font-medium">
						{manifest.summary.auditedPages.toLocaleString("en-US")} audited /{" "}
						{manifest.summary.totalPages.toLocaleString("en-US")} discovered
					</p>
				</div>
				<div className="grid gap-2">
					<p className="text-muted-foreground text-xs">Top recurring issue clusters</p>
					{topIssues.map((issue) => (
						<div key={issue.id} className="flex items-start justify-between gap-2">
							<p className="line-clamp-2 text-xs">{issue.title}</p>
							<Badge variant="outline">
								{issue.count.toLocaleString("en-US")}
							</Badge>
						</div>
					))}
				</div>
			</CardContent>
		</Card>
	);
}

export default function DetailedDiagnosticsTab({
	manifest,
	selectedSlug,
	onSelectSlug,
}: DetailedDiagnosticsTabProps) {
	const selectedPage = useMemo(() => {
		return manifest.pages.find((page) => page.slug === selectedSlug) ?? null;
	}, [manifest.pages, selectedSlug]);
	const showTrendChart = hasCruxTrendData(manifest);

	return (
		<div className="grid gap-4">
			<Card className="report-detail-callout border-border/70 bg-muted/30">
				<CardContent className="p-3">
					<p className="text-muted-foreground text-xs">
						Detailed diagnostics preserve all technical analysis modules for QA and
						engineer workflows.
					</p>
				</CardContent>
			</Card>

			<RunMeta manifest={manifest} />

			{manifest.originCrux && (
				<div className="grid gap-3 xl:grid-cols-2">
					<CruxSection
						cruxData={manifest.originCrux.combined || manifest.originCrux.desktop}
						title="Site-Wide Real-User Experience (CrUX)"
						fallbackMessage="No origin-level CrUX data available."
					/>
					{showTrendChart ? (
						<CruxTrends cruxHistory={manifest.cruxHistory} />
					) : (
						<OriginInsightsCard manifest={manifest} />
					)}
				</div>
			)}

			<UrlTable
				pages={manifest.pages}
				selectedSlug={selectedSlug}
				onSelect={(page) => onSelectSlug(page.slug)}
			/>

			<PageDrilldown page={selectedPage} originCrux={manifest.originCrux} />
		</div>
	);
}
