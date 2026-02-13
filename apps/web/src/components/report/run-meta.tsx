import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { AuditRunManifest } from "@/lib/audit/types";

type RunMetaProps = {
	manifest: AuditRunManifest;
};

function formatDate(value: string) {
	return new Date(value).toLocaleString();
}

export default function RunMeta({ manifest }: RunMetaProps) {
	return (
		<Card>
			<CardHeader className="border-b">
				<CardTitle>Run Metadata</CardTitle>
			</CardHeader>
			<CardContent className="grid gap-2 pt-4 sm:grid-cols-2 lg:grid-cols-4">
				<div>
					<p className="text-muted-foreground text-xs uppercase">Base URL</p>
					<p className="truncate font-medium text-xs">{manifest.baseUrl}</p>
				</div>
				<div>
					<p className="text-muted-foreground text-xs uppercase">Started</p>
					<p className="font-medium text-xs">{formatDate(manifest.startedAt)}</p>
				</div>
				<div>
					<p className="text-muted-foreground text-xs uppercase">Finished</p>
					<p className="font-medium text-xs">{formatDate(manifest.finishedAt)}</p>
				</div>
				<div>
					<p className="text-muted-foreground text-xs uppercase">Coverage</p>
					<p className="font-medium text-xs">
						{manifest.summary.totalPages}/{manifest.summary.discoveredPages} pages audited
					</p>
				</div>
			</CardContent>
		</Card>
	);
}
