export type ScoreBand = "good" | "needs-improvement" | "poor" | "unknown";

type ScorePalette = {
	text: string;
	ringBorder: string;
	ringSurface: string;
	line: string;
	fill: string;
};

const SCORE_PALETTES: Record<ScoreBand, ScorePalette> = {
	good: {
		text: "text-emerald-700 dark:text-emerald-300",
		ringBorder: "border-emerald-500/90",
		ringSurface: "bg-emerald-500/8",
		line: "bg-emerald-500",
		fill: "bg-emerald-500/24",
	},
	"needs-improvement": {
		text: "text-amber-700 dark:text-amber-300",
		ringBorder: "border-amber-500/90",
		ringSurface: "bg-amber-500/10",
		line: "bg-amber-500",
		fill: "bg-amber-500/22",
	},
	poor: {
		text: "text-rose-700 dark:text-rose-300",
		ringBorder: "border-rose-500/90",
		ringSurface: "bg-rose-500/10",
		line: "bg-rose-500",
		fill: "bg-rose-500/22",
	},
	unknown: {
		text: "text-muted-foreground",
		ringBorder: "border-muted-foreground/50",
		ringSurface: "bg-muted/50",
		line: "bg-muted-foreground/70",
		fill: "bg-muted/70",
	},
};

export function getScoreBand(score: number | null): ScoreBand {
	if (score == null) {
		return "unknown";
	}

	if (score >= 90) {
		return "good";
	}

	if (score >= 50) {
		return "needs-improvement";
	}

	return "poor";
}

export function getScorePalette(score: number | null) {
	return SCORE_PALETTES[getScoreBand(score)];
}

export function scoreTone(score: number | null) {
	if (score == null) {
		return "bg-muted text-muted-foreground";
	}

	if (score >= 90) {
		return "bg-emerald-100 text-emerald-900 dark:bg-emerald-950/70 dark:text-emerald-200";
	}

	if (score >= 50) {
		return "bg-amber-100 text-amber-900 dark:bg-amber-950/70 dark:text-amber-200";
	}

	return "bg-rose-100 text-rose-900 dark:bg-rose-950/70 dark:text-rose-200";
}

export function formatScore(score: number | null) {
	if (score == null) {
		return "--";
	}

	return `${score}`;
}
