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
