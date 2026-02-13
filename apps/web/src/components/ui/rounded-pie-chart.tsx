"use client";

import { LabelList, Pie, PieChart } from "recharts";

import { Badge } from "@/components/ui/badge";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import {
	ChartContainer,
	ChartTooltip,
	ChartTooltipContent,
} from "@/components/ui/chart";

type RoundedPieDatum = {
	id: string;
	label: string;
	value: number;
	color: string;
};

type RoundedPieChartProps = {
	title: string;
	description: string;
	data: RoundedPieDatum[];
	badgeText?: string;
};

export function RoundedPieChart({
	title,
	description,
	data,
	badgeText,
}: RoundedPieChartProps) {
	const chartConfig = data.reduce<
		Record<string, { label: string; color: string }>
	>((config, item) => {
		config[item.id] = {
			label: item.label,
			color: item.color,
		};
		return config;
	}, {});

	return (
		<Card className="flex flex-col">
			<CardHeader className="items-center pb-0">
				<CardTitle>
					{title}
					{badgeText ? (
						<Badge
							variant="outline"
							className="ml-2 border-none bg-muted text-foreground"
						>
							{badgeText}
						</Badge>
					) : null}
				</CardTitle>
				<CardDescription>{description}</CardDescription>
			</CardHeader>
			<CardContent className="flex-1 pb-0">
				<ChartContainer
					config={chartConfig}
					className="mx-auto aspect-square max-h-[280px] [&_.recharts-text]:fill-foreground"
				>
					<PieChart>
						<ChartTooltip content={<ChartTooltipContent hideLabel />} />
						<Pie
							data={data}
							innerRadius={36}
							dataKey="value"
							nameKey="label"
							cornerRadius={8}
							paddingAngle={3}
						>
							<LabelList
								dataKey="value"
								stroke="none"
								fontSize={11}
								fontWeight={500}
								formatter={(value) => `${value}`}
							/>
						</Pie>
					</PieChart>
				</ChartContainer>
			</CardContent>
		</Card>
	);
}
