"use client";

import {
	CircleCheck,
	CircleDashed,
	CircleX,
	TriangleAlert,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { CruxData } from "@/lib/audit/types";
import { cn } from "@/lib/utils";

type CruxSectionProps = {
	cruxData: CruxData | null | undefined;
	title?: string;
	fallbackMessage?: string;
};

type CruxMetricStatus = "good" | "needs-improvement" | "poor" | "unknown";

type MetricRow = {
	id: string;
	label: string;
	metric: CruxData["metrics"][keyof CruxData["metrics"]] | undefined;
	unit: "millisecond" | "unitless";
	thresholds: { good: number; needsImprovement: number };
	flag?: boolean;
};

function getMetricStatus(
	metric: CruxData["metrics"][keyof CruxData["metrics"]] | undefined,
	thresholds: { good: number; needsImprovement: number },
): CruxMetricStatus {
	const p75 = metric?.percentiles?.p75;
	if (p75 == null) {
		return "unknown";
	}

	if (p75 <= thresholds.good) {
		return "good";
	}

	if (p75 <= thresholds.needsImprovement) {
		return "needs-improvement";
	}

	return "poor";
}

function formatMetricValue(
	value: number | undefined,
	unit: "millisecond" | "unitless",
) {
	const n = typeof value === "number" ? value : Number(value);
	if (value == null || Number.isNaN(n)) {
		return "—";
	}

	if (unit === "millisecond") {
		if (n < 1000) {
			return `${Math.round(n)} ms`;
		}
		return `${(n / 1000).toFixed(1)} s`;
	}

	return n.toFixed(3);
}

function statusTextClass(status: CruxMetricStatus) {
	if (status === "good") {
		return "text-emerald-600 dark:text-emerald-300";
	}

	if (status === "needs-improvement") {
		return "text-amber-600 dark:text-amber-300";
	}

	if (status === "poor") {
		return "text-rose-600 dark:text-rose-300";
	}

	return "text-muted-foreground";
}

function StatusIcon({ status }: { status: CruxMetricStatus }) {
	if (status === "good") {
		return <CircleCheck className="size-4 text-emerald-600" />;
	}

	if (status === "needs-improvement") {
		return <TriangleAlert className="size-4 text-amber-600" />;
	}

	if (status === "poor") {
		return <CircleX className="size-4 text-rose-600" />;
	}

	return <CircleDashed className="size-4 text-muted-foreground" />;
}

function CruxMetricRow({ row }: { row: MetricRow }) {
	const status = getMetricStatus(row.metric, row.thresholds);
	const value = formatMetricValue(row.metric?.percentiles?.p75, row.unit);

	return (
		<div className="border-border/70 border-b py-2 last:border-b-0">
			<div className="flex items-center justify-between gap-3">
				<div className="flex items-center gap-2">
					<p className="text-sm leading-tight">{row.label}</p>
					{row.flag ? (
						<span className="size-3 rounded-[2px] bg-blue-500/90" aria-hidden />
					) : null}
				</div>
				<div className="flex items-center gap-1.5">
					<span
						className={cn(
							"font-medium text-sm tabular-nums",
							statusTextClass(status),
						)}
					>
						{value}
					</span>
					<StatusIcon status={status} />
				</div>
			</div>
		</div>
	);
}

export default function CruxSection({
	cruxData,
	title = "Real-User Experience (CrUX)",
	fallbackMessage = "No real-user data available for this page.",
}: CruxSectionProps) {
	if (!cruxData || !cruxData.metrics) {
		return (
			<Card className="report-surface">
				<CardHeader className="border-b">
					<CardTitle className="text-sm">{title}</CardTitle>
				</CardHeader>
				<CardContent className="pt-4">
					<p className="text-muted-foreground text-xs">{fallbackMessage}</p>
				</CardContent>
			</Card>
		);
	}

	const { metrics } = cruxData;
	const isOriginData = cruxData.key.origin != null;

	const metricRows = (
		[
			{
				id: "fcp",
				label: "First Contentful Paint",
				metric: metrics.first_contentful_paint,
				unit: "millisecond",
				thresholds: { good: 1800, needsImprovement: 3000 },
			},
			{
				id: "lcp",
				label: "Largest Contentful Paint",
				metric: metrics.largest_contentful_paint,
				unit: "millisecond",
				thresholds: { good: 2500, needsImprovement: 4000 },
				flag: true,
			},
			{
				id: "inp",
				label: "Interaction to Next Paint",
				metric: metrics.interaction_to_next_paint,
				unit: "millisecond",
				thresholds: { good: 200, needsImprovement: 500 },
			},
			{
				id: "cls",
				label: "Cumulative Layout Shift",
				metric: metrics.cumulative_layout_shift,
				unit: "unitless",
				thresholds: { good: 0.1, needsImprovement: 0.25 },
				flag: true,
			},
			{
				id: "ttfb",
				label: "Time to First Byte",
				metric: metrics.time_to_first_byte,
				unit: "millisecond",
				thresholds: { good: 800, needsImprovement: 1800 },
			},
		] satisfies MetricRow[]
	).filter((row) => row.metric != null);

	if (metricRows.length === 0) {
		return (
			<Card className="report-surface">
				<CardHeader className="border-b">
					<CardTitle className="text-sm">
						{title}
						{isOriginData ? (
							<Badge variant="secondary" className="ml-2">
								Origin-level
							</Badge>
						) : null}
					</CardTitle>
				</CardHeader>
				<CardContent className="pt-4">
					<p className="text-muted-foreground text-xs">
						No Core Web Vitals metrics available.
					</p>
				</CardContent>
			</Card>
		);
	}

	return (
		<Card className="report-surface">
			<CardHeader className="border-b">
				<CardTitle className="text-sm">
					{title}
					{isOriginData ? (
						<Badge variant="secondary" className="ml-2">
							Origin-level
						</Badge>
					) : null}
				</CardTitle>
			</CardHeader>
			<CardContent className="pt-4">
				<div className="rounded-lg border border-border/70 bg-muted/20 p-3">
					{metricRows.map((row) => (
						<CruxMetricRow key={row.id} row={row} />
					))}
				</div>
			</CardContent>
		</Card>
	);
}
