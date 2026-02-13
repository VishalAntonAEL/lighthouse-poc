import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { AuditRunManifest, CategoryScores } from "@/lib/audit/types";
import { TrendingUp, AlertTriangle } from "lucide-react";

import { formatScore, scoreTone } from "./score-utils";

type ReportKpisProps = {
	manifest: AuditRunManifest;
};

function MetricCard({
	label,
	value,
	icon: Icon,
	trend,
	color,
}: {
	label: string;
	value: string | number;
	icon?: React.ComponentType<{ className?: string }>;
	trend?: "up" | "down";
	color?: "green" | "yellow" | "red";
}) {
	const colorClasses = {
		green: "bg-emerald-50 border-emerald-200 dark:bg-emerald-950/30 dark:border-emerald-800",
		yellow: "bg-amber-50 border-amber-200 dark:bg-amber-950/30 dark:border-amber-800",
		red: "bg-rose-50 border-rose-200 dark:bg-rose-950/30 dark:border-rose-800",
	};

	return (
		<div className={`rounded-lg border p-4 ${color ? colorClasses[color] : ''}`}>
			<div className="flex items-start justify-between gap-2 mb-2">
				<p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
					{label}
				</p>
				{Icon && <Icon className="h-4 w-4 text-muted-foreground" />}
			</div>
			<div className="flex items-baseline gap-2">
				<p className="text-3xl sm:text-4xl font-bold tracking-tight">
					{value}
				</p>
				{trend && (
					<div className={`text-xs font-medium px-2 py-1 rounded ${
						trend === 'up' ? 'bg-green-100 text-green-700 dark:bg-green-900/50 dark:text-green-300' : 'bg-red-100 text-red-700 dark:bg-red-900/50 dark:text-red-300'
					}`}>
						{trend === 'up' ? '↑' : '↓'} Good
					</div>
				)}
			</div>
		</div>
	);
}

function ScoreRow({
	label,
	scores,
	device,
}: {
	label: string;
	scores: CategoryScores | null;
	device: "desktop" | "mobile";
}) {
	const metrics = [
		["Performance", scores?.performance ?? null],
		["Accessibility", scores?.accessibility ?? null],
		["Best Practices", scores?.bestPractices ?? null],
		["SEO", scores?.seo ?? null],
	];

	return (
		<div className="space-y-3">
			<div className="flex items-center gap-2">
				<p className="font-semibold text-sm text-foreground">{label}</p>
				<Badge variant="outline" className="text-xs">
					{device === "desktop" ? "💻" : "📱"} {device === "desktop" ? "Desktop" : "Mobile"}
				</Badge>
			</div>
			<div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
				{metrics.map(([name, score]) => (
					<div key={name as string} className="rounded-lg border p-3 bg-muted/30">
						<p className="text-xs text-muted-foreground mb-2">{name}</p>
						<Badge
							className={`${scoreTone(score as number | null)} text-base font-bold`}
							variant="outline"
						>
							{formatScore(score as number | null)}
						</Badge>
					</div>
				))}
			</div>
		</div>
	);
}

export default function ReportKpis({ manifest }: ReportKpisProps) {
	const exec = manifest.executiveSummary;
	const pagesAtRisk = exec.pagesAtRiskPercent;
	const healthGradeColor = 
		exec.overallHealthGrade === 'A' ? 'green' :
		exec.overallHealthGrade === 'B' ? 'green' :
		exec.overallHealthGrade === 'C' ? 'yellow' : 'red';

	return (
		<div className="grid gap-4">
			{/* Top KPIs */}
			<div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
				<MetricCard
					label="Health Grade"
					value={exec.overallHealthGrade}
					icon={TrendingUp}
					color={healthGradeColor}
				/>
				<MetricCard
					label="Overall Score"
					value={exec.overallScore}
					color={exec.overallScore >= 80 ? 'green' : exec.overallScore >= 60 ? 'yellow' : 'red'}
				/>
				<MetricCard
					label="Pages At Risk"
					value={`${pagesAtRisk}%`}
					icon={pagesAtRisk > 30 ? AlertTriangle : undefined}
					color={pagesAtRisk > 30 ? 'red' : pagesAtRisk > 15 ? 'yellow' : 'green'}
				/>
				<MetricCard
					label="Problem Pages"
					value={exec.riskPageCount}
					color={exec.riskPageCount > 0 ? 'yellow' : 'green'}
				/>
			</div>

			{/* Category Averages */}
			<Card>
				<CardHeader className="border-b pb-4">
					<CardTitle>Category Averages by Device</CardTitle>
				</CardHeader>
				<CardContent className="pt-6">
					<div className="grid gap-8 lg:grid-cols-2">
						<ScoreRow
							label="Desktop"
							scores={manifest.summary.devices.desktop.averages}
							device="desktop"
						/>
						<ScoreRow
							label="Mobile"
							scores={manifest.summary.devices.mobile.averages}
							device="mobile"
						/>
					</div>
				</CardContent>
			</Card>
		</div>
	);
}
