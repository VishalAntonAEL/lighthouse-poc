import type { AuditPageResult, DeviceResult } from "@/lib/audit/types";

function deviceHasAllFourCategories(device: DeviceResult): boolean {
	if (device.status !== "success" || !device.scores) return false;
	const s = device.scores;
	return (
		s.performance != null &&
		s.accessibility != null &&
		s.bestPractices != null &&
		s.seo != null
	);
}

/** True when at least one device has status success (used to skip error-only pages). */
export function pageHasValues(page: AuditPageResult): boolean {
	return (
		page.devices.desktop.status === "success" ||
		page.devices.mobile.status === "success"
	);
}

/** True when at least one device has all four category scores (Performance, Accessibility, Best Practices, SEO). */
export function pageHasAllFourCategories(page: AuditPageResult): boolean {
	return (
		deviceHasAllFourCategories(page.devices.desktop) ||
		deviceHasAllFourCategories(page.devices.mobile)
	);
}

export function getFirstPageWithValues(
	pages: AuditPageResult[],
	fromIndex = 0,
): AuditPageResult | null {
	for (let i = fromIndex; i < pages.length; i++) {
		if (pageHasAllFourCategories(pages[i])) return pages[i];
	}
	for (let i = fromIndex; i < pages.length; i++) {
		if (pageHasValues(pages[i])) return pages[i];
	}
	return null;
}

/**
 * For page drilldown: if the selected page has values, return it;
 * otherwise return the next page that has values (so we don't show an error-only page).
 */
export function resolveDrilldownPage(
	pages: AuditPageResult[],
	selectedSlug: string | null,
): AuditPageResult | null {
	if (!selectedSlug) {
		return getFirstPageWithValues(pages);
	}
	const index = pages.findIndex((p) => p.slug === selectedSlug);
	if (index === -1) return getFirstPageWithValues(pages);
	const selected = pages[index];
	if (pageHasValues(selected)) return selected;
	return getFirstPageWithValues(pages, index + 1);
}
