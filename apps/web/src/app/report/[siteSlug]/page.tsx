import SiteReportView from "@/components/report/site-report-view";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type ReportPageProps = {
	params: Promise<{ siteSlug: string }>;
};

export default async function SiteReportPage({ params }: ReportPageProps) {
	const { siteSlug } = await params;
	return <SiteReportView siteSlug={siteSlug} />;
}
