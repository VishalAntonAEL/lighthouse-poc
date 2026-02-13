import { notFound } from "next/navigation";

import { getArtifactHtmlAction } from "@/app/actions/audit-actions";
import { isValidDevice } from "@/lib/audit/storage";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export default async function ArtifactReportPage({
	params,
}: {
	params: Promise<{ slug: string; device: string }>;
}) {
	const { slug, device } = await params;
	if (!isValidDevice(device)) {
		notFound();
	}

	const html = await getArtifactHtmlAction({
		slug,
		device,
	});
	if (!html) {
		notFound();
	}

	return (
		<div className="h-screen w-full bg-background">
			<div className="flex h-full flex-col">
				<div className="flex items-center justify-between border-b px-4 py-2">
					<p className="font-medium text-sm">
						{slug} ({device})
					</p>
					<a href="/report/latest" className="text-xs underline">
						Back to consolidated report
					</a>
				</div>
				<iframe
					title={`${slug}-${device}`}
					srcDoc={html}
					className="h-full w-full"
				/>
			</div>
		</div>
	);
}
