"use client";

import { PolarAngleAxis, PolarGrid, Radar, RadarChart } from "recharts";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";

type RadarDatum = {
	category: string;
	desktop: number;
	mobile: number;
};

type StrokeMultipleRadarChartProps = {
	title: string;
	description: string;
	data: RadarDatum[];
	badgeText?: string;
};

const chartConfig = {
	desktop: {
		label: "Desktop",
		color: "var(--chart-1)",
	},
	mobile: {
		label: "Mobile",
		color: "var(--chart-4)",
	},
};

export function StrokeMultipleRadarChart({
	title,
	description,
	data,
	badgeText,
}: StrokeMultipleRadarChartProps) {
	return (
		<Card>
			<CardHeader className="items-center pb-4">
				<CardTitle>
					{title}
					{badgeText ? (
						<Badge variant="outline" className="ml-2 border-none bg-muted text-foreground">
							{badgeText}
						</Badge>
					) : null}
				</CardTitle>
				<CardDescription>{description}</CardDescription>
			</CardHeader>
			<CardContent className="pb-0">
				<ChartContainer config={chartConfig} className="mx-auto aspect-square max-h-[280px]">
					<RadarChart data={data}>
						<ChartTooltip cursor={false} content={<ChartTooltipContent />} />
						<PolarAngleAxis dataKey="category" />
						<PolarGrid strokeDasharray="3 3" />
						<Radar
							stroke="var(--color-desktop)"
							dataKey="desktop"
							fill="var(--color-desktop)"
							fillOpacity={0.1}
						/>
						<Radar
							stroke="var(--color-mobile)"
							dataKey="mobile"
							fill="var(--color-mobile)"
							fillOpacity={0.1}
						/>
					</RadarChart>
				</ChartContainer>
			</CardContent>
		</Card>
	);
}
