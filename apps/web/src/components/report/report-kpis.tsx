import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { AuditRunManifest, CategoryScores } from "@/lib/audit/types";

import {
	CategoryScoreCards,
	toCategoryScoreItems,
} from "./category-score-cards";

type ReportKpisProps = {
	manifest: AuditRunManifest;
};

function ScoreRow({
	label,
	scores,
}: {
	label: string;
	scores: CategoryScores | null;
}) {
	return (
		<div className="grid gap-2 rounded-none border p-2">
			<p className="font-medium text-xs uppercase tracking-wide">{label}</p>
			<CategoryScoreCards items={toCategoryScoreItems(scores)} />
		</div>
	);
}

export default function ReportKpis({ manifest }: ReportKpisProps) {
	return (
		<div className="grid gap-3 lg:grid-cols-3">
			<Card>
				<CardHeader className="border-b">
					<CardTitle>Executive Snapshot</CardTitle>
				</CardHeader>
				<CardContent className="grid grid-cols-2 gap-3 pt-4">
					<div>
						<p className="text-muted-foreground text-xs uppercase">
							Health Grade
						</p>
						<p className="font-semibold text-2xl">
							{manifest.executiveSummary.overallHealthGrade}
						</p>
					</div>
					<div>
						<p className="text-muted-foreground text-xs uppercase">
							Overall Score
						</p>
						<p className="font-semibold text-2xl">
							{manifest.executiveSummary.overallScore}
						</p>
					</div>
					<div>
						<p className="text-muted-foreground text-xs uppercase">
							Pages At Risk
						</p>
						<p className="font-medium text-sm">
							{manifest.executiveSummary.pagesAtRiskPercent}%
						</p>
					</div>
					<div>
						<p className="text-muted-foreground text-xs uppercase">Risk Hits</p>
						<p className="font-medium text-sm">
							{manifest.executiveSummary.riskPageCount}
						</p>
					</div>
				</CardContent>
			</Card>

			<Card className="lg:col-span-2">
				<CardHeader className="border-b">
					<CardTitle>Category Averages</CardTitle>
				</CardHeader>
				<CardContent className="grid gap-2 pt-4">
					<ScoreRow
						label="Desktop"
						scores={manifest.summary.devices.desktop.averages}
					/>
					<ScoreRow
						label="Mobile"
						scores={manifest.summary.devices.mobile.averages}
					/>
				</CardContent>
			</Card>
		</div>
	);
}
