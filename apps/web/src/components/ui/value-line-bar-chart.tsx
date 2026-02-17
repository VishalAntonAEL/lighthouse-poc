"use client";

import * as React from "react";
import { Bar, BarChart, Cell, ReferenceLine, XAxis } from "recharts";

import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import { ChartContainer } from "@/components/ui/chart";

type ValueLineBarDatum = {
	label: string;
	value: number;
};

type ValueLineBarChartProps = {
	title: string;
	description: string;
	data: ValueLineBarDatum[];
	target: number;
	badgeText?: string;
	valuePrefix?: string;
	targetLabel?: string;
	className?: string;
};

const chartConfig = {
	value: {
		label: "Value",
		color: "var(--secondary-foreground)",
	},
};

export function ValueLineBarChart({
	title,
	description,
	data,
	target,
	badgeText,
	valuePrefix = "",
	targetLabel,
	className,
}: ValueLineBarChartProps) {
	const [activeIndex, setActiveIndex] = React.useState<number | null>(null);
	const highlightedIndex =
		activeIndex ??
		data.reduce((bestIndex, item, index) => {
			return item.value > data[bestIndex]!.value ? index : bestIndex;
		}, 0);

	const highlightedValue = data[highlightedIndex]?.value ?? 0;

	return (
		<Card className={cn(className)}>
			<CardHeader className="gap-2 border-b">
				<div className="flex items-center justify-between gap-2">
					<div>
						<p className="text-muted-foreground text-[11px] uppercase tracking-[0.14em]">
							{title}
						</p>
						<CardTitle className="font-mono text-2xl tracking-tight">
							{valuePrefix}
							{highlightedValue}
						</CardTitle>
					</div>
					{badgeText ? <Badge variant="secondary">{badgeText}</Badge> : null}
				</div>
				<CardDescription>{description}</CardDescription>
			</CardHeader>
			<CardContent>
				<ChartContainer config={chartConfig} className="h-[260px] w-full">
					<BarChart
						data={data}
						onMouseLeave={() => setActiveIndex(null)}
						margin={{ left: 8, right: 8 }}
					>
						<XAxis
							dataKey="label"
							tickLine={false}
							axisLine={false}
							tickMargin={8}
							tickFormatter={(value: string) =>
								value.length > 12 ? `${value.slice(0, 12)}...` : value
							}
						/>
						<Bar dataKey="value" fill="var(--color-value)" radius={4}>
							{data.map((_, index) => (
								<Cell
									key={index}
									onMouseEnter={() => setActiveIndex(index)}
									opacity={index === highlightedIndex ? 1 : 0.25}
								/>
							))}
						</Bar>
						<ReferenceLine
							y={target}
							strokeDasharray="3 3"
							stroke="var(--secondary-foreground)"
							label={{
								value: targetLabel ?? `${title} target ${target}`,
								position: "insideTopRight",
								fill: "var(--secondary-foreground)",
								fontSize: 10,
							}}
						/>
					</BarChart>
				</ChartContainer>
			</CardContent>
		</Card>
	);
}
