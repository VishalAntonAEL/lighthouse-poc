"use client";

import type { CategoryScores } from "@/lib/audit/types";
import { cn } from "@/lib/utils";

import { formatScore, getScorePalette } from "./score-utils";

export type CategoryScoreItem = {
	label: string;
	score: number | null;
};

const CATEGORY_SCORE_KEYS: Array<{
	label: string;
	key: keyof CategoryScores;
}> = [
	{ label: "Performance", key: "performance" },
	{ label: "Accessibility", key: "accessibility" },
	{ label: "Best Practices", key: "bestPractices" },
	{ label: "SEO", key: "seo" },
];

function getLineTop(score: number | null) {
	if (score == null) {
		return "42%";
	}

	const clamped = Math.min(98, Math.max(8, score));
	const top = 100 - clamped;
	return `${Math.min(88, Math.max(6, top))}%`;
}

export function toCategoryScoreItems(
	scores: CategoryScores | null,
): CategoryScoreItem[] {
	return CATEGORY_SCORE_KEYS.map((entry) => ({
		label: entry.label,
		score: scores?.[entry.key] ?? null,
	}));
}

export function ScoreCircle({
	score,
	className,
}: {
	score: number | null;
	className?: string;
}) {
	const palette = getScorePalette(score);

	return (
		<div
			className={cn(
				"grid size-11 shrink-0 place-items-center rounded-full border-2 font-semibold text-[0.95rem] leading-none tracking-tight",
				palette.ringBorder,
				palette.ringSurface,
				palette.text,
				className,
			)}
		>
			{formatScore(score)}
		</div>
	);
}

export function ScoreScaleLegend({ className }: { className?: string }) {
	return (
		<div
			className={cn(
				"flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground",
				className,
			)}
		>
			<span>Score scale:</span>
			<span className="inline-flex items-center gap-1">
				<span className="size-2 rounded-full bg-rose-500" /> 0-49
			</span>
			<span className="inline-flex items-center gap-1">
				<span className="size-2 rounded-full bg-amber-500" /> 50-89
			</span>
			<span className="inline-flex items-center gap-1">
				<span className="size-2 rounded-full bg-emerald-500" /> 90-100
			</span>
		</div>
	);
}

export function CategoryScoreCards({
	items,
	className,
}: {
	items: CategoryScoreItem[];
	className?: string;
}) {
	return (
		<div className={cn("grid gap-3 sm:grid-cols-2 xl:grid-cols-4", className)}>
			{items.map((item) => {
				const palette = getScorePalette(item.score);
				const lineTop = getLineTop(item.score);
				return (
					<div
						key={item.label}
						className="grid gap-3 rounded-xl border border-border/70 bg-card/90 p-3"
					>
						<div className="flex items-center justify-between gap-2">
							<p className="font-medium text-sm">{item.label}</p>
							<ScoreCircle score={item.score} />
						</div>
					</div>
				);
			})}
		</div>
	);
}
