import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { AuditRunManifest } from "@/lib/audit/types";
import { Calendar, Link2, Clock, CheckCircle2 } from "lucide-react";

type RunMetaProps = {
	manifest: AuditRunManifest;
};

function formatDate(value: string) {
	const date = new Date(value);
	return date.toLocaleDateString("en-US", { 
		month: "short", 
		day: "numeric", 
		year: "numeric",
		hour: "2-digit",
		minute: "2-digit"
	});
}

function MetadataField({
	icon: Icon,
	label,
	value,
}: {
	icon: React.ComponentType<{ className?: string }>;
	label: string;
	value: string;
}) {
	return (
		<div className="flex items-start gap-3 p-4 rounded-lg bg-muted/30 border">
			<Icon className="h-5 w-5 text-primary flex-shrink-0 mt-0.5" />
			<div className="flex-1 min-w-0">
				<p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{label}</p>
				<p className="text-sm font-medium text-foreground truncate mt-1">{value}</p>
			</div>
		</div>
	);
}

export default function RunMeta({ manifest }: RunMetaProps) {
	const coveragePercent = Math.round((manifest.summary.totalPages / manifest.summary.discoveredPages) * 100);

	return (
		<Card>
			<CardHeader className="border-b pb-4">
				<CardTitle className="text-lg">Audit Details</CardTitle>
			</CardHeader>
			<CardContent className="pt-6">
				<div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
					<MetadataField
						icon={Link2}
						label="Base URL"
						value={manifest.baseUrl.replace(/^https?:\/\//, '').replace(/\/$/, '')}
					/>
					<MetadataField
						icon={Calendar}
						label="Started"
						value={formatDate(manifest.startedAt)}
					/>
					<MetadataField
						icon={Clock}
						label="Finished"
						value={formatDate(manifest.finishedAt)}
					/>
					<MetadataField
						icon={CheckCircle2}
						label="Coverage"
						value={`${manifest.summary.totalPages}/${manifest.summary.discoveredPages} pages (${coveragePercent}%)`}
					/>
				</div>
			</CardContent>
		</Card>
	);
}
