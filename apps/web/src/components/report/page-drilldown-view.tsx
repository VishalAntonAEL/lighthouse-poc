"use client";

import { useEffect, useMemo, useState } from "react";

import { getReportManifestAction } from "@/app/actions/audit-actions";
import PageDrilldown from "@/components/report/page-drilldown";
import { resolveDrilldownPage } from "@/components/report/report-page-utils";
import type { AuditRunManifest } from "@/lib/audit/types";

type LoadState =
	| { status: "loading" }
	| { status: "error"; message: string }
	| { status: "loaded"; manifest: AuditRunManifest };

type PageDrilldownViewProps = {
	siteSlug: string;
	pageSlug: string;
};

export default function PageDrilldownView({
	siteSlug,
	pageSlug,
}: PageDrilldownViewProps) {
	const [loadState, setLoadState] = useState<LoadState>({ status: "loading" });

	useEffect(() => {
		async function load() {
			setLoadState({ status: "loading" });
			try {
				const manifest = await getReportManifestAction({ siteSlug });
				if (!manifest) {
					setLoadState({
						status: "error",
						message: `No report found for "${siteSlug}".`,
					});
					return;
				}
				setLoadState({ status: "loaded", manifest });
			} catch (error) {
				setLoadState({
					status: "error",
					message:
						error instanceof Error ? error.message : "Unable to load report.",
				});
			}
		}
		void load();
	}, [siteSlug]);

	const drilldownPage = useMemo(() => {
		if (loadState.status !== "loaded") return null;
		return resolveDrilldownPage(loadState.manifest.pages, pageSlug);
	}, [loadState, pageSlug]);

	const backHref = `/report/${siteSlug}`;

	return (
		<div className="container mx-auto max-w-[1400px] px-4 py-6 grid gap-4">
			<div className="flex items-center gap-3">
				<a
					href={backHref}
					className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
				>
					← Back to Report
				</a>
			</div>

			{loadState.status === "loading" && (
				<p className="text-muted-foreground text-xs">Loading page details…</p>
			)}

			{loadState.status === "error" && (
				<div className="grid gap-2 border p-4">
					<p className="font-medium text-sm">Unable to load page details</p>
					<p className="text-muted-foreground text-xs">{loadState.message}</p>
					<a href={backHref} className="text-xs underline">
						Back to report
					</a>
				</div>
			)}

			{loadState.status === "loaded" && (
				<>
					{drilldownPage ? (
						<PageDrilldown
							page={drilldownPage}
							originCrux={loadState.manifest.originCrux}
						/>
					) : (
						<div className="grid gap-2 border p-4">
							<p className="font-medium text-sm">Page not found</p>
							<p className="text-muted-foreground text-xs">
								No data found for page slug &ldquo;{pageSlug}&rdquo;.
							</p>
							<a href={backHref} className="text-xs underline">
								Back to report
							</a>
						</div>
					)}
				</>
			)}
		</div>
	);
}
