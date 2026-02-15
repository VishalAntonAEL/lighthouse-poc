"use client";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { CruxData } from "@/lib/audit/types";

type CruxSectionProps = {
	cruxData: CruxData | null | undefined;
	title?: string;
	fallbackMessage?: string;
};

function formatMetricValue(value: number | string | undefined, unit: string): string {
	const n = typeof value === "number" ? value : Number(value);
	if (Number.isNaN(n)) {
		return "—";
	}
	if (unit === "millisecond") {
		if (n < 1000) {
			return `${Math.round(n)}ms`;
		}
		return `${(n / 1000).toFixed(1)}s`;
	}
	return n.toFixed(2);
}

function getCWVStatus(
	metric: CruxData["metrics"][keyof CruxData["metrics"]],
	thresholds: { good: number; needsImprovement: number },
): "good" | "needs-improvement" | "poor" | null {
	if (!metric?.percentiles?.p75) {
		return null;
	}
	const p75 = metric.percentiles.p75;
	if (p75 <= thresholds.good) {
		return "good";
	}
	if (p75 <= thresholds.needsImprovement) {
		return "needs-improvement";
	}
	return "poor";
}

function getDistributionPercentages(
	histogram: Array<{ start: number; end?: number; density: number }>,
	thresholds: { good: number; needsImprovement: number },
): { good: number; needsImprovement: number; poor: number } {
	let good = 0;
	let needsImprovement = 0;
	let poor = 0;

	for (const bin of histogram) {
		const density = bin.density;
		if (bin.end == null) {
			// Last bin (no end) - check if start > needsImprovement
			if (bin.start > thresholds.needsImprovement) {
				poor += density;
			} else if (bin.start > thresholds.good) {
				needsImprovement += density;
			} else {
				good += density;
			}
		} else {
			if (bin.end <= thresholds.good) {
				good += density;
			} else if (bin.start <= thresholds.good && bin.end <= thresholds.needsImprovement) {
				// Bin spans good -> needs improvement
				const goodPortion = (thresholds.good - bin.start) / (bin.end - bin.start);
				good += density * goodPortion;
				needsImprovement += density * (1 - goodPortion);
			} else if (bin.start <= thresholds.needsImprovement) {
				needsImprovement += density;
			} else {
				poor += density;
			}
		}
	}

	return {
		good: Math.round(good * 100),
		needsImprovement: Math.round(needsImprovement * 100),
		poor: Math.round(poor * 100),
	};
}

function CruxMetricCard({
	label,
	metric,
	unit,
	thresholds,
}: {
	label: string;
	metric: CruxData["metrics"][keyof CruxData["metrics"]];
	unit: string;
	thresholds: { good: number; needsImprovement: number };
}) {
	if (!metric) {
		return null;
	}

	const p75 = metric.percentiles?.p75;
	const status = getCWVStatus(metric, thresholds);
	const distribution = getDistributionPercentages(metric.histogram, thresholds);

	const statusColors = {
		good: "bg-green-500",
		"needs-improvement": "bg-amber-500",
		poor: "bg-red-500",
	};

	const statusBadge = {
		good: "bg-green-100 text-green-800 border-green-300",
		"needs-improvement": "bg-amber-100 text-amber-800 border-amber-300",
		poor: "bg-red-100 text-red-800 border-red-300",
	};

	return (
		<div className="grid gap-2 border p-3">
			<div className="flex items-center justify-between">
				<p className="font-medium text-xs">{label}</p>
				{status && (
					<Badge className={statusBadge[status]} variant="outline">
						{status === "good"
							? "Good"
							: status === "needs-improvement"
								? "Needs Improvement"
								: "Poor"}
					</Badge>
				)}
			</div>
			{p75 != null && (
				<div>
					<p className="text-muted-foreground text-xs">75th percentile</p>
					<p className="font-mono text-sm font-semibold">
						{formatMetricValue(p75, unit)}
					</p>
				</div>
			)}
			{metric.histogram.length > 0 && (
				<div className="grid gap-1">
					<p className="text-muted-foreground text-xs">User Experience Distribution</p>
					<div className="flex h-4 gap-0.5 overflow-hidden rounded border">
						{distribution.good > 0 && (
							<div
								className={statusColors.good}
								style={{ width: `${distribution.good}%` }}
								title={`${distribution.good}% Good`}
							/>
						)}
						{distribution.needsImprovement > 0 && (
							<div
								className={statusColors["needs-improvement"]}
								style={{ width: `${distribution.needsImprovement}%` }}
								title={`${distribution.needsImprovement}% Needs Improvement`}
							/>
						)}
						{distribution.poor > 0 && (
							<div
								className={statusColors.poor}
								style={{ width: `${distribution.poor}%` }}
								title={`${distribution.poor}% Poor`}
							/>
						)}
					</div>
					<div className="flex justify-between text-xs">
						<span className="text-green-700">{distribution.good}% Good</span>
						<span className="text-amber-700">
							{distribution.needsImprovement}% Needs Improvement
						</span>
						<span className="text-red-700">{distribution.poor}% Poor</span>
					</div>
				</div>
			)}
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
			<Card>
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

	return (
		<Card>
			<CardHeader className="border-b">
				<CardTitle className="text-sm">
					{title}
					{isOriginData && (
						<Badge variant="secondary" className="ml-2">
							Origin-level
						</Badge>
					)}
				</CardTitle>
			</CardHeader>
			<CardContent className="grid gap-3 pt-4">
				{metrics.largest_contentful_paint && (
					<CruxMetricCard
						label="Largest Contentful Paint (LCP)"
						metric={metrics.largest_contentful_paint}
						unit="millisecond"
						thresholds={{ good: 2500, needsImprovement: 4000 }}
					/>
				)}
				{metrics.interaction_to_next_paint && (
					<CruxMetricCard
						label="Interaction to Next Paint (INP)"
						metric={metrics.interaction_to_next_paint}
						unit="millisecond"
						thresholds={{ good: 200, needsImprovement: 500 }}
					/>
				)}
				{metrics.cumulative_layout_shift && (
					<CruxMetricCard
						label="Cumulative Layout Shift (CLS)"
						metric={metrics.cumulative_layout_shift}
						unit="unitless"
						thresholds={{ good: 0.1, needsImprovement: 0.25 }}
					/>
				)}
				{metrics.first_contentful_paint && (
					<CruxMetricCard
						label="First Contentful Paint (FCP)"
						metric={metrics.first_contentful_paint}
						unit="millisecond"
						thresholds={{ good: 1800, needsImprovement: 3000 }}
					/>
				)}
				{!metrics.largest_contentful_paint &&
					!metrics.interaction_to_next_paint &&
					!metrics.cumulative_layout_shift &&
					!metrics.first_contentful_paint && (
						<p className="text-muted-foreground text-xs">
							No Core Web Vitals metrics available.
						</p>
					)}
			</CardContent>
		</Card>
	);
}
