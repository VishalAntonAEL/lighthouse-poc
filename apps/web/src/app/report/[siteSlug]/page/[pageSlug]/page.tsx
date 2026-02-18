import PageDrilldownView from "@/components/report/page-drilldown-view";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type PageDrilldownPageProps = {
	params: Promise<{ siteSlug: string; pageSlug: string }>;
};

export default async function PageDrilldownPage({
	params,
}: PageDrilldownPageProps) {
	const { siteSlug, pageSlug } = await params;
	return <PageDrilldownView siteSlug={siteSlug} pageSlug={pageSlug} />;
}
