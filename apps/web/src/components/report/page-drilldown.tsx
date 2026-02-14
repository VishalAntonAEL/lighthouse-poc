"use client";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { AuditPageResult, DeviceResult } from "@/lib/audit/types";

import { formatScore, scoreTone } from "./score-utils";

type PageDrilldownProps = {
	page: AuditPageResult | null;
};

function DevicePanel({ device }: { device: DeviceResult }) {
	return (
		<div className="grid gap-3">
			<div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
				{[
					["Performance", device.scores?.performance ?? null],
					["Accessibility", device.scores?.accessibility ?? null],
					["Best Practices", device.scores?.bestPractices ?? null],
					["SEO", device.scores?.seo ?? null],
				].map(([label, score]) => (
					<div key={label as string} className="rounded-none border p-2">
						<p className="text-muted-foreground text-xs">{label}</p>
						<Badge
							className={scoreTone(score as number | null)}
							variant="outline"
						>
							{formatScore(score as number | null)}
						</Badge>
					</div>
				))}
			</div>

			{device.errorMessage ? (
				<p className="text-destructive text-xs">{device.errorMessage}</p>
			) : null}

			<div className="grid gap-2">
				<p className="font-medium text-xs uppercase">Priority Issues</p>
				{device.opportunities.length === 0 ? (
					<p className="text-muted-foreground text-xs">
						No high-priority issues.
					</p>
				) : (
					<div className="grid gap-2">
						{device.opportunities.map((issue) => (
							<div key={issue.id} className="border p-2">
								<div className="flex items-center justify-between gap-2">
									<p className="font-medium text-xs">{issue.title}</p>
									<Badge className={scoreTone(issue.score)} variant="outline">
										{formatScore(issue.score)}
									</Badge>
								</div>
								{issue.displayValue ? (
									<p className="text-muted-foreground text-xs">
										{issue.displayValue}
									</p>
								) : null}
								{issue.description ? (
									<p className="mt-1 text-xs">{issue.description}</p>
								) : null}
							</div>
						))}
					</div>
				)}
			</div>
		</div>
	);
}

export default function PageDrilldown({ page }: PageDrilldownProps) {
	if (!page) {
		return (
			<Card>
				<CardHeader className="border-b">
					<CardTitle>Page Drilldown</CardTitle>
				</CardHeader>
				<CardContent className="pt-4">
					<p className="text-muted-foreground text-xs">
						Select a URL in the table to inspect detailed findings.
					</p>
				</CardContent>
			</Card>
		);
	}

	return (
		<Card>
			<CardHeader className="border-b">
				<CardTitle className="truncate">Page Drilldown: {page.url}</CardTitle>
			</CardHeader>
			<CardContent className="grid gap-4 pt-4">
				<Tabs defaultValue="desktop">
					<TabsList>
						<TabsTrigger value="desktop">Desktop</TabsTrigger>
						<TabsTrigger value="mobile">Mobile</TabsTrigger>
					</TabsList>
					<TabsContent value="desktop">
						<DevicePanel device={page.devices.desktop} />
					</TabsContent>
					<TabsContent value="mobile">
						<DevicePanel device={page.devices.mobile} />
					</TabsContent>
				</Tabs>
			</CardContent>
		</Card>
	);
}
