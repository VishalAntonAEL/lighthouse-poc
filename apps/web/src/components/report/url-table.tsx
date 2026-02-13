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

function getPerformanceScore(page: AuditPageResult, device: "desktop" | "mobile") {
	return page.devices[device].scores?.performance ?? null;
}

export default function UrlTable({ pages, selectedSlug, onSelect }: UrlTableProps) {
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
				<CardTitle>URL Drilldown Table</CardTitle>
			</CardHeader>
			<CardContent className="grid gap-3 pt-4">
				<div className="grid gap-2 md:grid-cols-[1fr_auto_auto]">
					<Input
						placeholder="Search by URL"
						value={query}
						onChange={(event) => setQuery(event.target.value)}
					/>
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
						{filtered.map((page) => {
							const isSelected = page.slug === selectedSlug;
							return (
								<TableRow
									key={page.slug}
									onClick={() => onSelect(page)}
									className={isSelected ? "bg-muted" : "cursor-pointer"}
								>
									<TableCell className="max-w-[24rem] truncate">{page.url}</TableCell>
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
											className={scoreTone(getPerformanceScore(page, "desktop"))}
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
			</CardContent>
		</Card>
	);
}
