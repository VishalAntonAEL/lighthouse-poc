"use client";

import { useMemo, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@/components/ui/table";
import type { AuditPageResult } from "@/lib/audit/types";

import { formatScore, scoreTone } from "./score-utils";

type UrlTableProps = {
	pages: AuditPageResult[];
	selectedSlug: string | null;
	onSelect: (page: AuditPageResult) => void;
};

function getPerformanceScore(
	page: AuditPageResult,
	device: "desktop" | "mobile",
) {
	return page.devices[device].scores?.performance ?? null;
}

export default function UrlTable({
	pages,
	selectedSlug,
	onSelect,
}: UrlTableProps) {
	const [query, setQuery] = useState("");
	const [sortBy, setSortBy] = useState("worst");
	const [statusFilter, setStatusFilter] = useState("all");

	const filtered = useMemo(() => {
		const byQuery = pages.filter((page) =>
			page.url.toLowerCase().includes(query.trim().toLowerCase()),
		);

		const byStatus = byQuery.filter((page) => {
			if (statusFilter === "all") {
				return true;
			}

			if (statusFilter === "errors") {
				return (
					page.devices.desktop.status === "error" ||
					page.devices.mobile.status === "error"
				);
			}

			return (
				page.devices.desktop.status === "success" &&
				page.devices.mobile.status === "success"
			);
		});

		const sorted = [...byStatus];
		sorted.sort((left, right) => {
			if (sortBy === "best") {
				return (right.combinedScore ?? -1) - (left.combinedScore ?? -1);
			}

			if (sortBy === "url") {
				return left.url.localeCompare(right.url);
			}

			return (left.combinedScore ?? 101) - (right.combinedScore ?? 101);
		});

		return sorted;
	}, [pages, query, sortBy, statusFilter]);

	return (
		<Card>
			<CardHeader className="border-b">
				<CardTitle>All Pages Performance</CardTitle>
				<p className="text-sm text-muted-foreground mt-1">Click a page to view detailed insights</p>
			</CardHeader>
			<CardContent className="pt-6">
				<div className="grid gap-4 mb-6">
					<Input
						placeholder="🔍 Search pages by URL..."
						value={query}
						onChange={(event) => setQuery(event.target.value)}
						className="h-10"
					/>
					<div className="grid gap-2 grid-cols-2 sm:grid-cols-3 gap-2">
						<div>
							<label className="text-xs font-medium text-muted-foreground block mb-2">Sort By</label>
							<select
								className="w-full h-9 border bg-background px-3 text-xs rounded-md"
								value={sortBy}
								onChange={(event) => setSortBy(event.target.value)}
							>
								<option value="worst">Worst First</option>
								<option value="best">Best First</option>
								<option value="url">By URL</option>
							</select>
						</div>
						<div>
							<label className="text-xs font-medium text-muted-foreground block mb-2">Status</label>
							<select
								className="w-full h-9 border bg-background px-3 text-xs rounded-md"
								value={statusFilter}
								onChange={(event) => setStatusFilter(event.target.value)}
							>
								<option value="all">All</option>
								<option value="ok">Success Only</option>
								<option value="errors">With Errors</option>
							</select>
						</div>
						<div>
							<label className="text-xs font-medium text-muted-foreground block mb-2">Showing</label>
							<div className="h-9 flex items-center px-3 border rounded-md text-xs bg-muted text-muted-foreground font-medium">
								{filtered.length} {filtered.length === 1 ? 'page' : 'pages'}
							</div>
						</div>
					</div>
				</div>

				{filtered.length === 0 ? (
					<div className="text-center py-12">
						<p className="text-muted-foreground text-sm">No pages match your filters</p>
					</div>
				) : (
					<div className="overflow-x-auto">
						<Table>
							<TableHeader>
								<TableRow className="hover:bg-transparent">
									<TableHead className="font-semibold">Page URL</TableHead>
									<TableHead className="text-center font-semibold">Combined Score</TableHead>
									<TableHead className="text-center font-semibold">Desktop</TableHead>
									<TableHead className="text-center font-semibold">Mobile</TableHead>
									<TableHead className="text-center font-semibold">Status</TableHead>
								</TableRow>
							</TableHeader>
							<TableBody>
								{filtered.map((page) => {
									const isSelected = page.slug === selectedSlug;
									const desktopScore = getPerformanceScore(page, "desktop");
									const mobileScore = getPerformanceScore(page, "mobile");
									
									return (
										<TableRow
											key={page.slug}
											onClick={() => onSelect(page)}
											className={`cursor-pointer transition-colors ${
												isSelected 
													? "bg-primary/5 border-primary/50" 
													: "hover:bg-muted/50"
											}`}
										>
											<TableCell className="max-w-[300px]">
												<div className="font-medium text-sm truncate hover:text-clip">
													{page.url.replace(/^https?:\/\//, '').replace(/\/$/, '')}
												</div>
											</TableCell>
											<TableCell className="text-center">
												<Badge
													variant="outline"
													className={`${scoreTone(page.combinedScore)} font-bold text-base`}
												>
													{formatScore(page.combinedScore)}
												</Badge>
											</TableCell>
											<TableCell className="text-center">
												<Badge
													variant="outline"
													className={`${scoreTone(desktopScore)} font-semibold`}
												>
													{formatScore(desktopScore)}
												</Badge>
											</TableCell>
											<TableCell className="text-center">
												<Badge
													variant="outline"
													className={`${scoreTone(mobileScore)} font-semibold`}
												>
													{formatScore(mobileScore)}
												</Badge>
											</TableCell>
											<TableCell className="text-center">
												<div className="flex items-center justify-center gap-1">
													<Badge
														variant={
															page.devices.desktop.status === "success"
																? "secondary"
																: "destructive"
														}
														className="text-xs"
													>
														{page.devices.desktop.status === "success" ? "✓" : "✕"} D
													</Badge>
													<Badge
														variant={
															page.devices.mobile.status === "success"
																? "secondary"
																: "destructive"
														}
														className="text-xs"
													>
														{page.devices.mobile.status === "success" ? "✓" : "✕"} M
													</Badge>
												</div>
											</TableCell>
										</TableRow>
									);
								})}
							</TableBody>
						</Table>
					</div>
				)}
			</CardContent>
		</Card>
	);
}
