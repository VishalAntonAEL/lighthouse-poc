"use client";

import { useEffect, useMemo, useState } from "react";

import { getAuditStatusAction, startAuditRunAction } from "@/app/actions/audit-actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Progress, ProgressLabel, ProgressValue } from "@/components/ui/progress";
import type { AuditJobStatus, AuditProgress } from "@/lib/audit/types";

type JobState = {
	jobId: string;
	status: AuditJobStatus;
	progress: AuditProgress;
	startedAt: string;
	finishedAt: string | null;
	errorMessage?: string;
};

function progressPercent(progress: AuditProgress) {
	if (progress.totalTarget <= 0) {
		return 0;
	}

	return Math.min(
		100,
		Math.round((progress.audited / progress.totalTarget) * 100),
	);
}

export default function Home() {
	const [baseUrl, setBaseUrl] = useState("https://example.com");
	const [jobId, setJobId] = useState<string | null>(null);
	const [jobState, setJobState] = useState<JobState | null>(null);
	const [message, setMessage] = useState<string | null>(null);
	const [isStarting, setIsStarting] = useState(false);

	useEffect(() => {
		if (!jobId) {
			return;
		}

		let active = true;
		const interval = setInterval(() => {
			void (async () => {
				try {
					const status = await getAuditStatusAction({ jobId });
					if (!active) {
						return;
					}
					setJobState(status);
					if (status.status === "completed" || status.status === "failed") {
						clearInterval(interval);
					}
				} catch {
					if (active) {
						setMessage("Failed to poll job status.");
					}
				}
			})();
		}, 2500);

		return () => {
			active = false;
			clearInterval(interval);
		};
	}, [jobId]);

	async function startAudit() {
		setIsStarting(true);
		setMessage(null);
		setJobState(null);

		try {
			const result = await startAuditRunAction({
				baseUrl,
				maxPages: 2000,
			});
			setJobId(result.jobId);
			setMessage(
				result.status === "running"
					? "An audit is already running. Tracking current job."
					: "Audit started.",
			);
		} catch (error) {
			setMessage(error instanceof Error ? error.message : "Failed to start audit.");
		} finally {
			setIsStarting(false);
		}
	}

	const currentProgress = useMemo(() => {
		if (!jobState) {
			return 0;
		}
		return progressPercent(jobState.progress);
	}, [jobState]);

	return (
		<div className="container mx-auto grid max-w-5xl gap-3 px-4 py-4">
			<div className="grid gap-1">
				<h1 className="font-semibold text-xl">Lighthouse Site Auditor</h1>
				<p className="text-muted-foreground text-xs">
					Enter a base URL to crawl (up to 2000 pages with sitemap + recursive
					discovery) and run desktop/mobile Lighthouse audits.
				</p>
			</div>

			<Card>
				<CardHeader className="border-b">
					<CardTitle>Start New Audit</CardTitle>
				</CardHeader>
				<CardContent className="grid gap-3 pt-4">
					<div className="grid gap-2 md:grid-cols-[1fr_auto]">
						<Input
							value={baseUrl}
							onChange={(event) => setBaseUrl(event.target.value)}
							placeholder="https://example.com"
						/>
						<Button disabled={isStarting} onClick={() => void startAudit()}>
							{isStarting ? "Starting..." : "Start Audit"}
						</Button>
					</div>
					{message ? <p className="text-xs">{message}</p> : null}
				</CardContent>
			</Card>

			<Card>
				<CardHeader className="border-b">
					<CardTitle>Live Job Status</CardTitle>
				</CardHeader>
				<CardContent className="grid gap-3 pt-4">
					{jobState ? (
						<>
							<div className="flex flex-wrap items-center gap-2">
								<Badge variant="outline">Job: {jobState.jobId}</Badge>
								<Badge
									variant={jobState.status === "failed" ? "destructive" : "secondary"}
								>
									{jobState.status}
								</Badge>
							</div>

							<Progress value={currentProgress}>
								<ProgressLabel>Audit progress</ProgressLabel>
								<ProgressValue>{() => `${currentProgress}%`}</ProgressValue>
							</Progress>

							<div className="grid gap-1 text-xs sm:grid-cols-2 lg:grid-cols-4">
								<div>Discovered: {jobState.progress.discovered}</div>
								<div>Crawled: {jobState.progress.crawled}</div>
								<div>Audited: {jobState.progress.audited}</div>
								<div>Total target: {jobState.progress.totalTarget}</div>
							</div>

							{jobState.errorMessage ? (
								<p className="text-destructive text-xs">{jobState.errorMessage}</p>
							) : null}

							{jobState.status === "completed" ? (
								<a href="/report/latest" className="text-xs underline">
									Open latest report
								</a>
							) : null}
						</>
					) : (
						<p className="text-muted-foreground text-xs">
							No active job. Start an audit above.
						</p>
					)}
				</CardContent>
			</Card>
		</div>
	);
}
