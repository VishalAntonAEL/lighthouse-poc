"use client";

import { useEffect, useMemo, useState } from "react";

import { getReportManifestAction } from "@/app/actions/audit-actions";
import DetailedDiagnosticsTab from "@/components/report/detailed-diagnostics-tab";
import ExecutiveSummaryTab from "@/components/report/executive-summary-tab";
import { getFirstPageWithValues } from "@/components/report/report-page-utils";
import { buildExecutiveViewModel } from "@/components/report/report-view-model";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { AuditRunManifest } from "@/lib/audit/types";

type LoadState =
	| { status: "loading" }
	| { status: "error"; message: string }
	| { status: "loaded"; manifest: AuditRunManifest };

type DashboardTab = "executive" | "detailed";

function formatDate(value: string) {
	return new Date(value).toLocaleString();
}

function getHostname(value: string) {
	try {
		return new URL(value).hostname;
	} catch {
		return value;
	}
}

type SiteReportViewProps = {
	siteSlug: string;
};

export default function SiteReportView({ siteSlug }: SiteReportViewProps) {
	const [loadState, setLoadState] = useState<LoadState>({ status: "loading" });
	const [selectedSlug, setSelectedSlug] = useState<string | null>(null);
	const [activeTab, setActiveTab] = useState<DashboardTab>("executive");

	async function load() {
		setLoadState({ status: "loading" });
		try {
			const manifest = await getReportManifestAction({ siteSlug });
			if (!manifest) {
				setLoadState({
					status: "error",
					message: `No report found for "${siteSlug}". Start an audit from Home.`,
				});
				return;
			}

			setLoadState({ status: "loaded", manifest });
			setSelectedSlug((previous) => {
				if (previous && manifest.pages.some((page) => page.slug === previous)) {
					return previous;
				}
				return getFirstPageWithValues(manifest.pages)?.slug ?? null;
			});
		} catch (error) {
			setLoadState({
				status: "error",
				message:
					error instanceof Error ? error.message : "Unable to load report.",
			});
		}
	}

	useEffect(() => {
		void load();
	}, [siteSlug]);

	const executiveViewModel = useMemo(() => {
		if (loadState.status !== "loaded") {
			return null;
		}
		return buildExecutiveViewModel(loadState.manifest);
	}, [loadState]);

	if (loadState.status === "loading") {
		return (
			<div className="container mx-auto max-w-7xl px-4 py-4">
				<p className="text-muted-foreground text-xs">
					Loading report for {siteSlug}...
				</p>
			</div>
		);
	}

	if (loadState.status === "error") {
		return (
			<div className="container mx-auto max-w-7xl px-4 py-4">
				<div className="grid gap-2 border p-4">
					<p className="font-medium text-sm">No report available</p>
					<p className="text-muted-foreground text-xs">{loadState.message}</p>
					<a href="/" className="text-xs underline">
						Start an audit
					</a>
				</div>
			</div>
		);
	}

	const manifest = loadState.manifest;
	const viewModel = executiveViewModel;
	if (!viewModel) {
		return null;
	}

	return (
		<div className="report-latest-page container mx-auto grid max-w-[1400px] gap-4 px-4 py-6">
			<section className="report-shell report-reveal">
				<div className="grid gap-4 p-4 md:p-6">
					<div className="flex flex-wrap items-start justify-between gap-3">
						<div className="grid gap-1">
							<p className="report-shell-eyebrow">Lighthouse Site Report</p>
							<h1 className="report-shell-title">Executive Performance Dashboard</h1>
							<p className="text-muted-foreground text-xs">
								{getHostname(manifest.baseUrl)} | Site {siteSlug} | Run{" "}
								<span className="font-mono">{manifest.runId}</span>
							</p>
						</div>
						<div className="flex items-center gap-2">
							<Button variant="outline" onClick={() => void load()}>
								Refresh
							</Button>
							<a
								href="/"
								className="inline-flex h-9 items-center rounded-md border px-3 text-sm"
							>
								New Audit
							</a>
						</div>
					</div>
					<div className="grid gap-2 text-xs text-muted-foreground md:grid-cols-3">
						<p>
							<span className="report-meta-label">Base URL</span>{" "}
							<span className="text-foreground">{manifest.baseUrl}</span>
						</p>
						<p>
							<span className="report-meta-label">Started</span>{" "}
							<span className="text-foreground">{formatDate(manifest.startedAt)}</span>
						</p>
						<p>
							<span className="report-meta-label">Finished</span>{" "}
							<span className="text-foreground">
								{formatDate(manifest.finishedAt)}
							</span>
						</p>
					</div>
				</div>
			</section>

			<Tabs
				value={activeTab}
				onValueChange={(value) => setActiveTab(value as DashboardTab)}
				className="grid gap-4"
			>
				<TabsList variant="line" className="report-tabs-list">
					<TabsTrigger value="executive">Executive Summary</TabsTrigger>
					<TabsTrigger value="detailed">Detailed Diagnostics</TabsTrigger>
				</TabsList>

				<TabsContent value="executive" className="grid gap-4">
					<ExecutiveSummaryTab
						manifest={manifest}
						viewModel={viewModel}
						onInspectSlug={(slug) => {
							setSelectedSlug(slug);
							setActiveTab("detailed");
						}}
					/>
				</TabsContent>

				<TabsContent value="detailed" className="grid gap-4">
					<DetailedDiagnosticsTab
						manifest={manifest}
						siteSlug={siteSlug}
						selectedSlug={selectedSlug}
						onSelectSlug={setSelectedSlug}
					/>
				</TabsContent>
			</Tabs>
		</div>
	);
}
