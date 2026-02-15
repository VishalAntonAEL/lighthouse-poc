"use client";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { DeviceResult, CruxData } from "@/lib/audit/types";

type LabVsFieldProps = {
	device: DeviceResult;
	cruxData: CruxData | null | undefined;
};

function formatValue(value: number, unit: string): string {
	if (unit === "millisecond") {
		if (value < 1000) {
			return `${Math.round(value)}ms`;
		}
		return `${(value / 1000).toFixed(1)}s`;
	}
	if (unit === "unitless") {
		return value.toFixed(3);
	}
	return value.toFixed(2);
}

function compareLabVsField(
	labMetric: { numericValue: number; numericUnit: string } | null,
	fieldMetric: CruxData["metrics"][keyof CruxData["metrics"]] | undefined,
): {
	lab: string | null;
	field: string | null;
	difference: string | null;
} {
	if (!labMetric && !fieldMetric) {
		return { lab: null, field: null, difference: null };
	}

	const labValue = labMetric
		? formatValue(labMetric.numericValue, labMetric.numericUnit)
		: null;
	const fieldValue = fieldMetric?.percentiles?.p75
		? formatValue(fieldMetric.percentiles.p75, "millisecond")
		: null;

	let difference: string | null = null;
	if (labValue && fieldValue && labMetric && fieldMetric?.percentiles?.p75) {
		const diff = labMetric.numericValue - fieldMetric.percentiles.p75;
		// For unitless metrics (CLS), show absolute difference
		if (labMetric.numericUnit === "unitless") {
			const absDiff = Math.abs(diff);
			if (absDiff < 0.01) {
				difference = "Similar";
			} else if (diff < 0) {
				difference = `${absDiff.toFixed(3)} worse in field`;
			} else {
				difference = `${absDiff.toFixed(3)} better in field`;
			}
		} else {
			// For time-based metrics (LCP, INP), show percentage
			const diffPercent = Math.round((diff / labMetric.numericValue) * 100);
			if (diffPercent > 0) {
				difference = `${diffPercent}% faster in field`;
			} else if (diffPercent < 0) {
				difference = `${Math.abs(diffPercent)}% slower in field`;
			} else {
				difference = "Similar";
			}
		}
	}

	return { lab: labValue, field: fieldValue, difference };
}

export default function LabVsField({ device, cruxData }: LabVsFieldProps) {
	if (!cruxData || !cruxData.metrics) {
		return null;
	}

	const lcpComparison = compareLabVsField(
		device.metrics?.lcp || null,
		cruxData.metrics.largest_contentful_paint,
	);

	// For INP, compare with TTI from lab (closest lab metric to INP)
	const inpComparison = compareLabVsField(
		device.metrics?.tti || null, // TTI is closest lab equivalent to INP
		cruxData.metrics.interaction_to_next_paint,
	);

	const clsComparison = compareLabVsField(
		device.metrics?.cls || null,
		cruxData.metrics.cumulative_layout_shift,
	);

	const hasAnyComparison =
		lcpComparison.lab ||
		lcpComparison.field ||
		inpComparison.field ||
		clsComparison.field;

	if (!hasAnyComparison) {
		return null;
	}

	return (
		<Card>
			<CardHeader className="border-b">
				<CardTitle className="text-sm">Lab vs Field Comparison</CardTitle>
			</CardHeader>
			<CardContent className="grid gap-3 pt-4">
				{lcpComparison.lab || lcpComparison.field ? (
					<div className="grid gap-2 border p-3">
						<p className="font-medium text-xs">Largest Contentful Paint (LCP)</p>
						<div className="grid grid-cols-2 gap-2 text-xs">
							<div>
								<p className="text-muted-foreground">Lab (Lighthouse)</p>
								<p className="font-mono font-semibold">
									{lcpComparison.lab || "—"}
								</p>
							</div>
							<div>
								<p className="text-muted-foreground">Field (CrUX p75)</p>
								<p className="font-mono font-semibold">
									{lcpComparison.field || "—"}
								</p>
							</div>
						</div>
						{lcpComparison.difference && (
							<Badge variant="outline" className="w-fit">
								{lcpComparison.difference}
							</Badge>
						)}
					</div>
				) : null}

				{inpComparison.field ? (
					<div className="grid gap-2 border p-3">
						<p className="font-medium text-xs">Interaction to Next Paint (INP)</p>
						<div className="grid grid-cols-2 gap-2 text-xs">
							<div>
								<p className="text-muted-foreground">Lab (TTI)</p>
								<p className="font-mono font-semibold">
									{inpComparison.lab || "—"}
								</p>
								{inpComparison.lab && (
									<p className="text-muted-foreground text-xs">
										(Time to Interactive)
									</p>
								)}
							</div>
							<div>
								<p className="text-muted-foreground">Field (CrUX p75)</p>
								<p className="font-mono font-semibold">{inpComparison.field}</p>
							</div>
						</div>
						{inpComparison.difference && (
							<Badge variant="outline" className="w-fit">
								{inpComparison.difference}
							</Badge>
						)}
					</div>
				) : null}

				{clsComparison.lab || clsComparison.field ? (
					<div className="grid gap-2 border p-3">
						<p className="font-medium text-xs">Cumulative Layout Shift (CLS)</p>
						<div className="grid grid-cols-2 gap-2 text-xs">
							<div>
								<p className="text-muted-foreground">Lab (Lighthouse)</p>
								<p className="font-mono font-semibold">
									{clsComparison.lab || "—"}
								</p>
							</div>
							<div>
								<p className="text-muted-foreground">Field (CrUX p75)</p>
								<p className="font-mono font-semibold">
									{clsComparison.field || "—"}
								</p>
							</div>
						</div>
						{clsComparison.difference && (
							<Badge variant="outline" className="w-fit">
								{clsComparison.difference}
							</Badge>
						)}
					</div>
				) : null}
			</CardContent>
		</Card>
	);
}
