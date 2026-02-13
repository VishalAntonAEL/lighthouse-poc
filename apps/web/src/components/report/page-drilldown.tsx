"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { AuditPageResult, DeviceResult } from "@/lib/audit/types";
import { ExternalLink, AlertCircle, Zap } from "lucide-react";

import { formatScore, scoreTone } from "./score-utils";

type PageDrilldownProps = {
	page: AuditPageResult | null;
};

function ScoreMetric({
	label,
	score,
}: {
	label: string;
	score: number | null;
}) {
	return (
		<div className="flex items-center justify-between p-3 rounded-lg bg-muted/50 border">
			<p className="text-sm font-medium text-foreground">{label}</p>
			<Badge className={`${scoreTone(score)} text-base font-bold`} variant="outline">
				{formatScore(score)}
			</Badge>
		</div>
	);
}

function DevicePanel({ device, slug }: { device: DeviceResult; slug: string }) {
	const detailLink = `/report/latest/${slug}/${device.device}`;

	return (
		<div className="grid gap-6">
			{/* Category Scores */}
			<div>
				<h4 className="font-semibold text-sm mb-3 text-foreground">Category Scores</h4>
				<div className="grid gap-2">
					<ScoreMetric label="Performance" score={device.scores?.performance ?? null} />
					<ScoreMetric label="Accessibility" score={device.scores?.accessibility ?? null} />
					<ScoreMetric label="Best Practices" score={device.scores?.bestPractices ?? null} />
					<ScoreMetric label="SEO" score={device.scores?.seo ?? null} />
				</div>
			</div>

			{/* Error Message */}
			{device.errorMessage ? (
				<div className="p-4 rounded-lg bg-destructive/10 border border-destructive/20 flex gap-3">
					<AlertCircle className="h-5 w-5 text-destructive flex-shrink-0 mt-0.5" />
					<p className="text-sm text-destructive">{device.errorMessage}</p>
				</div>
			) : null}

			{/* Priority Issues */}
			{device.opportunities.length > 0 && (
				<div>
					<div className="flex items-center gap-2 mb-3">
						<Zap className="h-4 w-4 text-amber-500" />
						<h4 className="font-semibold text-sm text-foreground">Top Opportunities</h4>
						<Badge variant="secondary" className="text-xs">
							{device.opportunities.length} {device.opportunities.length === 1 ? 'item' : 'items'}
						</Badge>
					</div>
					<div className="space-y-2">
						{device.opportunities.map((issue) => (
							<div key={issue.id} className="p-4 border rounded-lg hover:bg-muted/30 transition-colors">
								<div className="flex items-start justify-between gap-2 mb-2">
									<p className="font-semibold text-sm text-foreground flex-1">{issue.title}</p>
									<Badge className={`${scoreTone(issue.score)} font-bold whitespace-nowrap flex-shrink-0`} variant="outline">
										{formatScore(issue.score)}
									</Badge>
								</div>
								{issue.displayValue ? (
									<p className="text-xs text-muted-foreground mb-1 font-mono">
										{issue.displayValue}
									</p>
								) : null}
								{issue.description ? (
									<p className="text-sm text-muted-foreground leading-relaxed">{issue.description}</p>
								) : null}
							</div>
						))}
					</div>
				</div>
			)}

			{device.opportunities.length === 0 && !device.errorMessage && (
				<div className="p-4 rounded-lg bg-emerald-50 border border-emerald-200 dark:bg-emerald-950/30 dark:border-emerald-800">
					<p className="text-sm text-emerald-700 dark:text-emerald-300 font-medium">
						✓ No high-priority opportunities found. This page is performing well!
					</p>
				</div>
			)}

			{/* View Full Report */}
			<a href={detailLink} target="_blank" rel="noreferrer">
				<Button className="w-full" variant="outline">
					<ExternalLink className="h-4 w-4 mr-2" />
					View Full Lighthouse Report
				</Button>
			</a>
		</div>
	);
}

export default function PageDrilldown({ page }: PageDrilldownProps) {
	if (!page) {
		return (
			<Card>
				<CardHeader className="border-b">
					<CardTitle>Page Insights</CardTitle>
				</CardHeader>
				<CardContent className="pt-6">
					<div className="flex flex-col items-center justify-center py-12 text-center">
						<AlertCircle className="h-12 w-12 text-muted-foreground/50 mb-3" />
						<p className="text-muted-foreground text-sm">
							Select a page from the table above to view detailed performance insights
						</p>
					</div>
				</CardContent>
			</Card>
		);
	}

	return (
		<Card>
			<CardHeader className="border-b pb-4">
				<div className="flex items-start justify-between gap-2">
					<div className="flex-1 min-w-0">
						<CardTitle className="text-lg sm:text-xl truncate">
							{page.url.replace(/^https?:\/\//, '').replace(/\/$/, '')}
						</CardTitle>
						<p className="text-xs text-muted-foreground mt-1">
							Combined Score: <span className="font-semibold text-foreground">{page.combinedScore}</span>
						</p>
					</div>
					<Badge 
						className={`${scoreTone(page.combinedScore)} text-lg font-bold`}
						variant="outline"
					>
						{formatScore(page.combinedScore)}
					</Badge>
				</div>
			</CardHeader>
			<CardContent className="pt-6">
				<Tabs defaultValue="desktop" className="w-full">
					<TabsList className="grid w-full grid-cols-2 mb-6">
						<TabsTrigger value="desktop" className="text-sm">
							💻 Desktop
						</TabsTrigger>
						<TabsTrigger value="mobile" className="text-sm">
							📱 Mobile
						</TabsTrigger>
					</TabsList>
					<TabsContent value="desktop">
						<DevicePanel device={page.devices.desktop} slug={page.slug} />
					</TabsContent>
					<TabsContent value="mobile">
						<DevicePanel device={page.devices.mobile} slug={page.slug} />
					</TabsContent>
				</Tabs>
			</CardContent>
		</Card>
	);
}
