"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from "recharts";
import type { CruxHistoryRecord } from "@/lib/audit/types";

type CruxTrendsProps = {
	cruxHistory: CruxHistoryRecord | null | undefined;
};

function formatDate(dateString: string): string {
	const date = new Date(dateString);
	return date.toLocaleDateString("en-US", { month: "short", year: "numeric" });
}

function prepareTrendData(cruxHistory: CruxHistoryRecord | null | undefined) {
	if (!cruxHistory?.historyRecord) {
		return [];
	}

	return cruxHistory.historyRecord
		.map((record) => {
			const period = formatDate(record.collectionPeriod.firstDate);
			const lcp = record.metrics.largest_contentful_paint?.percentiles?.p75;
			const inp = record.metrics.interaction_to_next_paint?.percentiles?.p75;
			const cls = record.metrics.cumulative_layout_shift?.percentiles?.p75;

			return {
				period,
				lcp: lcp != null ? Math.round(lcp) : null,
				inp: inp != null ? Math.round(inp) : null,
				cls: cls != null ? cls : null,
			};
		})
		.filter((point) => point.lcp != null || point.inp != null || point.cls != null)
		.reverse(); // Show oldest to newest
}

function getTrendDirection(
	data: Array<{ lcp?: number | null; inp?: number | null; cls?: number | null }>,
	metric: "lcp" | "inp" | "cls",
): "improving" | "stable" | "degrading" | null {
	if (data.length < 2) {
		return null;
	}

	const values = data
		.map((d) => d[metric])
		.filter((v): v is number => v != null);
	if (values.length < 2) {
		return null;
	}

	const first = values[0];
	const last = values[values.length - 1];
	const change = ((last - first) / first) * 100;

	// For LCP and INP: lower is better
	// For CLS: lower is better
	if (metric === "lcp" || metric === "inp") {
		if (change < -5) {
			return "improving";
		}
		if (change > 5) {
			return "degrading";
		}
		return "stable";
	}

	// CLS
	if (change < -10) {
		return "improving";
	}
	if (change > 10) {
		return "degrading";
	}
	return "stable";
}

export default function CruxTrends({ cruxHistory }: CruxTrendsProps) {
	const trendData = prepareTrendData(cruxHistory);

	if (trendData.length === 0) {
		return null;
	}

	const lcpTrend = getTrendDirection(trendData, "lcp");
	const inpTrend = getTrendDirection(trendData, "inp");
	const clsTrend = getTrendDirection(trendData, "cls");

	return (
		<Card>
			<CardHeader className="border-b">
				<CardTitle className="text-sm">Historical Trends (CrUX)</CardTitle>
			</CardHeader>
			<CardContent className="pt-4">
				<div className="grid gap-4">
					{trendData.some((d) => d.lcp != null) && (
						<div className="grid gap-2">
							<div className="flex items-center justify-between">
								<p className="font-medium text-xs">Largest Contentful Paint (LCP)</p>
								{lcpTrend && (
									<span
										className={`text-xs ${
											lcpTrend === "improving"
												? "text-green-600"
												: lcpTrend === "degrading"
													? "text-red-600"
													: "text-muted-foreground"
										}`}
									>
										{lcpTrend === "improving"
											? "↗ Improving"
											: lcpTrend === "degrading"
												? "↘ Degrading"
												: "→ Stable"}
									</span>
								)}
							</div>
							<ResponsiveContainer width="100%" height={200}>
								<LineChart data={trendData}>
									<CartesianGrid strokeDasharray="3 3" />
									<XAxis
										dataKey="period"
										tick={{ fontSize: 10 }}
										angle={-45}
										textAnchor="end"
										height={60}
									/>
									<YAxis
										tick={{ fontSize: 10 }}
										label={{ value: "ms", angle: -90, position: "insideLeft" }}
									/>
									<Tooltip
										formatter={(value: number) => `${value}ms`}
										labelStyle={{ fontSize: 11 }}
									/>
									<Line
										type="monotone"
										dataKey="lcp"
										stroke="#8884d8"
										strokeWidth={2}
										dot={{ r: 3 }}
										name="LCP p75"
									/>
								</LineChart>
							</ResponsiveContainer>
						</div>
					)}

					{trendData.some((d) => d.inp != null) && (
						<div className="grid gap-2">
							<div className="flex items-center justify-between">
								<p className="font-medium text-xs">
									Interaction to Next Paint (INP)
								</p>
								{inpTrend && (
									<span
										className={`text-xs ${
											inpTrend === "improving"
												? "text-green-600"
												: inpTrend === "degrading"
													? "text-red-600"
													: "text-muted-foreground"
										}`}
									>
										{inpTrend === "improving"
											? "↗ Improving"
											: inpTrend === "degrading"
												? "↘ Degrading"
												: "→ Stable"}
									</span>
								)}
							</div>
							<ResponsiveContainer width="100%" height={200}>
								<LineChart data={trendData}>
									<CartesianGrid strokeDasharray="3 3" />
									<XAxis
										dataKey="period"
										tick={{ fontSize: 10 }}
										angle={-45}
										textAnchor="end"
										height={60}
									/>
									<YAxis
										tick={{ fontSize: 10 }}
										label={{ value: "ms", angle: -90, position: "insideLeft" }}
									/>
									<Tooltip
										formatter={(value: number) => `${value}ms`}
										labelStyle={{ fontSize: 11 }}
									/>
									<Line
										type="monotone"
										dataKey="inp"
										stroke="#82ca9d"
										strokeWidth={2}
										dot={{ r: 3 }}
										name="INP p75"
									/>
								</LineChart>
							</ResponsiveContainer>
						</div>
					)}

					{trendData.some((d) => d.cls != null) && (
						<div className="grid gap-2">
							<div className="flex items-center justify-between">
								<p className="font-medium text-xs">
									Cumulative Layout Shift (CLS)
								</p>
								{clsTrend && (
									<span
										className={`text-xs ${
											clsTrend === "improving"
												? "text-green-600"
												: clsTrend === "degrading"
													? "text-red-600"
													: "text-muted-foreground"
										}`}
									>
										{clsTrend === "improving"
											? "↗ Improving"
											: clsTrend === "degrading"
												? "↘ Degrading"
												: "→ Stable"}
									</span>
								)}
							</div>
							<ResponsiveContainer width="100%" height={200}>
								<LineChart data={trendData}>
									<CartesianGrid strokeDasharray="3 3" />
									<XAxis
										dataKey="period"
										tick={{ fontSize: 10 }}
										angle={-45}
										textAnchor="end"
										height={60}
									/>
									<YAxis
										tick={{ fontSize: 10 }}
										label={{
											value: "CLS",
											angle: -90,
											position: "insideLeft",
										}}
									/>
									<Tooltip
										formatter={(value: number) =>
											typeof value === "number" ? value.toFixed(3) : value
										}
										labelStyle={{ fontSize: 11 }}
									/>
									<Line
										type="monotone"
										dataKey="cls"
										stroke="#ffc658"
										strokeWidth={2}
										dot={{ r: 3 }}
										name="CLS p75"
									/>
								</LineChart>
							</ResponsiveContainer>
						</div>
					)}
				</div>
			</CardContent>
		</Card>
	);
}
