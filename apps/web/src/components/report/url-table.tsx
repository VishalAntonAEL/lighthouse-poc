"use client";

import { useEffect, useMemo, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
	const [page, setPage] = useState(1);
	const [pageSize, setPageSize] = useState(25);

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

	useEffect(() => {
		setPage(1);
	}, [query, sortBy, statusFilter, pageSize]);

	const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
	const currentPage = Math.min(page, totalPages);
	const startIndex = (currentPage - 1) * pageSize;
	const endIndex = startIndex + pageSize;
	const pagedRows = filtered.slice(startIndex, endIndex);

	return (
		<Card>
			<CardHeader className="border-b">
				<CardTitle>URL Drilldown Table</CardTitle>
			</CardHeader>
			<CardContent className="grid gap-3 pt-4">
				<div className="grid gap-2 md:grid-cols-[1fr_auto_auto]">
					<Input
						placeholder="Search by URL"
						value={query}
						onChange={(event) => setQuery(event.target.value)}
					/>
					<div className="flex gap-2 md:justify-end">
						<select
							className="h-8 border bg-background px-2 text-xs"
							value={sortBy}
							onChange={(event) => setSortBy(event.target.value)}
						>
							<option value="worst">Sort: Worst first</option>
							<option value="best">Sort: Best first</option>
							<option value="url">Sort: URL</option>
						</select>
						<select
							className="h-8 border bg-background px-2 text-xs"
							value={statusFilter}
							onChange={(event) => setStatusFilter(event.target.value)}
						>
							<option value="all">Status: All</option>
							<option value="ok">Status: Success only</option>
							<option value="errors">Status: Any errors</option>
						</select>
						<select
							className="h-8 border bg-background px-2 text-xs"
							value={pageSize}
							onChange={(event) => setPageSize(Number(event.target.value))}
						>
							<option value={25}>25 / page</option>
							<option value={50}>50 / page</option>
							<option value={100}>100 / page</option>
						</select>
					</div>
				</div>

				<Table>
					<TableHeader>
						<TableRow>
							<TableHead>URL</TableHead>
							<TableHead>Combined</TableHead>
							<TableHead>Desktop Perf</TableHead>
							<TableHead>Mobile Perf</TableHead>
							<TableHead>Desktop Status</TableHead>
							<TableHead>Mobile Status</TableHead>
						</TableRow>
					</TableHeader>
					<TableBody>
						{pagedRows.map((page) => {
							const isSelected = page.slug === selectedSlug;
							return (
								<TableRow
									key={page.slug}
									onClick={() => onSelect(page)}
									className={isSelected ? "bg-muted" : "cursor-pointer"}
								>
									<TableCell className="max-w-[24rem] truncate">
										{page.url}
									</TableCell>
									<TableCell>
										<Badge
											variant="outline"
											className={scoreTone(page.combinedScore)}
										>
											{formatScore(page.combinedScore)}
										</Badge>
									</TableCell>
									<TableCell>
										<Badge
											variant="outline"
											className={scoreTone(
												getPerformanceScore(page, "desktop"),
											)}
										>
											{formatScore(getPerformanceScore(page, "desktop"))}
										</Badge>
									</TableCell>
									<TableCell>
										<Badge
											variant="outline"
											className={scoreTone(getPerformanceScore(page, "mobile"))}
										>
											{formatScore(getPerformanceScore(page, "mobile"))}
										</Badge>
									</TableCell>
									<TableCell>
										<Badge
											variant={
												page.devices.desktop.status === "success"
													? "secondary"
													: "destructive"
											}
										>
											{page.devices.desktop.status}
										</Badge>
									</TableCell>
									<TableCell>
										<Badge
											variant={
												page.devices.mobile.status === "success"
													? "secondary"
													: "destructive"
											}
										>
											{page.devices.mobile.status}
										</Badge>
									</TableCell>
								</TableRow>
							);
						})}
					</TableBody>
				</Table>

				<div className="flex flex-wrap items-center justify-between gap-2">
					<p className="text-muted-foreground text-xs">
						Showing {filtered.length === 0 ? 0 : startIndex + 1}-
						{Math.min(endIndex, filtered.length)} of {filtered.length}
					</p>
					<div className="flex items-center gap-2">
						<Button
							variant="outline"
							size="sm"
							onClick={() => setPage((previous) => Math.max(1, previous - 1))}
							disabled={currentPage <= 1}
						>
							Previous
						</Button>
						<p className="text-xs">
							Page {currentPage} of {totalPages}
						</p>
						<Button
							variant="outline"
							size="sm"
							onClick={() =>
								setPage((previous) => Math.min(totalPages, previous + 1))
							}
							disabled={currentPage >= totalPages}
						>
							Next
						</Button>
					</div>
				</div>
			</CardContent>
		</Card>
	);
}
