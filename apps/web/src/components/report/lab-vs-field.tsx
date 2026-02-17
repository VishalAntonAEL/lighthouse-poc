"use client";

import {
	CircleCheck,
	CircleDashed,
	CircleX,
	TriangleAlert,
} from "lucide-react";

import { ScoreScaleLegend } from "@/components/report/category-score-cards";
import { getScoreBand, getScorePalette } from "@/components/report/score-utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { CruxData, DeviceResult, MetricResult } from "@/lib/audit/types";
import { cn } from "@/lib/utils";

type LabVsFieldProps = {
	device: DeviceResult;
	cruxData: CruxData | null | undefined;
};

type MetricRowItem = {
	id: string;
	label: string;
	metric: MetricResult | null;
};

function normalizeDisplayValue(value: string) {
	return value.replaceAll("\u00a0", " ").trim();
}

function formatMetricValue(metric: MetricResult | null) {
	if (!metric) {
		return "—";
	}

	if (metric.displayValue) {
		return normalizeDisplayValue(metric.displayValue);
	}

	if (metric.numericUnit === "millisecond") {
		if (metric.numericValue < 1000) {
			return `${Math.round(metric.numericValue)} ms`;
		}
		return `${(metric.numericValue / 1000).toFixed(1)} s`;
	}

	if (metric.numericUnit === "unitless") {
		return metric.numericValue.toFixed(3);
	}

	return metric.numericValue.toFixed(2);
}

function MetricStatusIcon({ score }: { score: number | null }) {
	const band = getScoreBand(score);

	if (band === "good") {
		return <CircleCheck className="size-4 text-emerald-600" />;
	}

	if (band === "needs-improvement") {
		return <TriangleAlert className="size-4 text-amber-600" />;
	}

	if (band === "poor") {
		return <CircleX className="size-4 text-rose-600" />;
	}

	return <CircleDashed className="size-4 text-muted-foreground" />;
}

function MetricRow({ item }: { item: MetricRowItem }) {
	const score = item.metric?.score ?? null;
	const palette = getScorePalette(score);

	return (
		<div className="border-border/70 border-b py-2 last:border-b-0">
			<div className="flex items-center justify-between gap-3">
				<p className="text-sm leading-tight">{item.label}</p>
				<div className="flex items-center gap-1.5">
					<span
						className={cn("font-medium text-sm tabular-nums", palette.text)}
					>
						{formatMetricValue(item.metric)}
					</span>
					<MetricStatusIcon score={score} />
				</div>
			</div>
		</div>
	);
}

export default function LabVsField({ device }: LabVsFieldProps) {
	const metrics = device.metrics;

	if (!metrics) {
		return null;
	}

	const metricGroups: Array<{ id: string; items: MetricRowItem[] }> = [
		{
			id: "paint-metrics",
			items: [
				{ id: "fcp", label: "First Contentful Paint", metric: metrics.fcp },
				{ id: "si", label: "Speed Index", metric: metrics.si },
				{ id: "lcp", label: "Largest Contentful Paint", metric: metrics.lcp },
			],
		},
		{
			id: "interaction-metrics",
			items: [
				{ id: "tti", label: "Time to Interactive", metric: metrics.tti },
				{ id: "tbt", label: "Total Blocking Time", metric: metrics.tbt },
				{ id: "cls", label: "Cumulative Layout Shift", metric: metrics.cls },
			],
		},
	];

	const hasMetrics = metricGroups.some((group) =>
		group.items.some((row) => row.metric != null),
	);

	if (!hasMetrics) {
		return null;
	}

	return (
		<Card className="report-surface">
			<CardHeader className="border-b">
				<div className="flex flex-wrap items-center justify-between gap-2">
					<CardTitle className="text-sm">Lighthouse Metric Snapshot</CardTitle>
					<ScoreScaleLegend />
				</div>
			</CardHeader>
			<CardContent className="grid gap-3 pt-4 lg:grid-cols-2">
				{metricGroups.map((group) => (
					<div
						key={group.id}
						className="rounded-lg border border-border/70 bg-card/85 px-3"
					>
						{group.items.map((item) => (
							<MetricRow key={item.id} item={item} />
						))}
					</div>
				))}
			</CardContent>
		</Card>
	);
}
