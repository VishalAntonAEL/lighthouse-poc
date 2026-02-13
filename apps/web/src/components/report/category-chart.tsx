"use client";

import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
	ChartContainer,
	ChartLegend,
	ChartLegendContent,
	ChartTooltip,
	ChartTooltipContent,
} from "@/components/ui/chart";
import type { AuditRunManifest } from "@/lib/audit/types";

type CategoryChartProps = {
	manifest: AuditRunManifest;
};

const chartConfig = {
	desktop: {
		label: "Desktop",
		color: "var(--color-chart-2)",
	},
	mobile: {
		label: "Mobile",
		color: "var(--color-chart-4)",
	},
};

export default function CategoryChart({ manifest }: CategoryChartProps) {
	const categoryData = [
		{
			category: "Performance",
			desktop: manifest.summary.devices.desktop.averages?.performance ?? 0,
			mobile: manifest.summary.devices.mobile.averages?.performance ?? 0,
		},
		{
			category: "Accessibility",
			desktop: manifest.summary.devices.desktop.averages?.accessibility ?? 0,
			mobile: manifest.summary.devices.mobile.averages?.accessibility ?? 0,
		},
		{
			category: "Best Practices",
			desktop: manifest.summary.devices.desktop.averages?.bestPractices ?? 0,
			mobile: manifest.summary.devices.mobile.averages?.bestPractices ?? 0,
		},
		{
			category: "SEO",
			desktop: manifest.summary.devices.desktop.averages?.seo ?? 0,
			mobile: manifest.summary.devices.mobile.averages?.seo ?? 0,
		},
	];

	const performanceBucketData = [
		{
			bucket: "Good",
			desktop: manifest.summary.devices.desktop.performanceBuckets.good,
			mobile: manifest.summary.devices.mobile.performanceBuckets.good,
		},
		{
			bucket: "Needs Work",
			desktop: manifest.summary.devices.desktop.performanceBuckets.needsImprovement,
			mobile: manifest.summary.devices.mobile.performanceBuckets.needsImprovement,
		},
		{
			bucket: "Poor",
			desktop: manifest.summary.devices.desktop.performanceBuckets.poor,
			mobile: manifest.summary.devices.mobile.performanceBuckets.poor,
		},
		{
			bucket: "Unavailable",
			desktop: manifest.summary.devices.desktop.performanceBuckets.unavailable,
			mobile: manifest.summary.devices.mobile.performanceBuckets.unavailable,
		},
	];

	return (
		<div className="grid gap-3 xl:grid-cols-2">
			<Card>
				<CardHeader className="border-b">
					<CardTitle>Category Averages</CardTitle>
				</CardHeader>
				<CardContent>
					<ChartContainer config={chartConfig} className="h-[240px] w-full">
						<BarChart data={categoryData} barGap={8}>
							<CartesianGrid vertical={false} />
							<XAxis dataKey="category" tickLine={false} axisLine={false} />
							<YAxis domain={[0, 100]} tickLine={false} axisLine={false} />
							<ChartTooltip content={<ChartTooltipContent />} />
							<ChartLegend content={<ChartLegendContent />} />
							<Bar dataKey="desktop" fill="var(--color-desktop)" radius={0} />
							<Bar dataKey="mobile" fill="var(--color-mobile)" radius={0} />
						</BarChart>
					</ChartContainer>
				</CardContent>
			</Card>

			<Card>
				<CardHeader className="border-b">
					<CardTitle>Performance Distribution</CardTitle>
				</CardHeader>
				<CardContent>
					<ChartContainer config={chartConfig} className="h-[240px] w-full">
						<BarChart data={performanceBucketData} barGap={8}>
							<CartesianGrid vertical={false} />
							<XAxis dataKey="bucket" tickLine={false} axisLine={false} />
							<YAxis tickLine={false} axisLine={false} />
							<ChartTooltip content={<ChartTooltipContent />} />
							<ChartLegend content={<ChartLegendContent />} />
							<Bar dataKey="desktop" fill="var(--color-desktop)" radius={0} />
							<Bar dataKey="mobile" fill="var(--color-mobile)" radius={0} />
						</BarChart>
					</ChartContainer>
				</CardContent>
			</Card>
		</div>
	);
}
