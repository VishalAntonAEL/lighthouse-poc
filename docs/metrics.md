<br />

Published: June 23, 2022, Last updated: November 18, 2025

<br />

Metrics in CrUX are powered by standard web platform APIs exposed by browsers. In the BigQuery dataset in particular, this data is aggregated to origin-resolution. Site owners requiring more detailed (e.g. URL-level resolution) analysis and insight into their site performance can use the same APIs to gather detailed real user measurement (RUM) data for their own origins. Note that while all APIs are available in Chrome, other browsers may not support the full set of metrics.

Most metrics are represented as a histogram aggregation, allowing visualization of the distribution and approximation of percentile values.

## Cumulative Layout Shift

"Cumulative Layout Shift (CLS) is an important, user-centric metric for measuring visual stability because it helps quantify how often users experience unexpected layout shifts --- a low CLS helps ensure that the page is delightful."

[web.dev/articles/cls](https://web.dev/articles/cls)

## DOM Content Loaded

"The DOMContentLoaded reports the time when the initial HTML document has been completely loaded and parsed, without waiting for stylesheets, images, and subframes to finish loading."

[MDN](https://developer.mozilla.org/docs/web/api/window/domcontentloaded_event)

## First Paint

"First Paint reports the time when the browser first rendered after navigation. This excludes the default background paint, but includes non-default background paint. This is the first key moment developers care about in page load - when the browser has started to render the page."

[Paint Timing API](https://w3c.github.io/paint-timing/#first-paint)

## First Contentful Paint

"First Contentful Paint (FCP) reports the time when the browser first rendered any text, image (including background images), non-white canvas or SVG. This includes text with pending webfonts. This is the first time users could start consuming page content."

[Paint Timing API](https://w3c.github.io/paint-timing/#first-contentful-paint)

## Interaction to Next Paint

"Interaction to Next Paint (INP) is a field metric that assesses[responsiveness](https://web.dev/articles/user-centric-performance-metrics#types_of_metrics). INP logs the latency of all interactions throughout the entire page lifecycle. The highest value of those interactions---or close to the highest for pages with many interactions---is recorded as the page's INP. A low INP ensures that the page will be reliably responsive at all times."

[web.dev/articles/inp](https://web.dev/articles/inp)

Interaction to Next Paint (INP) was added to the CrUX dataset in[February 2022](https://developer.chrome.com/docs/crux/release-notes#202202). This new metric captures the end-to-end latency of individual events and offers a more holistic picture of the overall responsiveness of a page throughout its lifetime.

## Largest Contentful Paint

"Largest Contentful Paint (LCP) is an important, user-centric metric for measuring perceived load speed because it marks the point in the page load timeline when the page's main content has likely loaded --- a fast LCP helps reassure the user that the page is useful."

[web.dev/articles/lcp](https://web.dev/articles/lcp)

### Largest Contentful Paint resource type

"LCP reports the render time of the largest image, text block, or video visible in the viewport, relative to when the user first navigated to the page."

[web.dev/articles/lcp - What elements are considered for LCP](https://web.dev/articles/https://web.dev/articles/lcp#what-elements-are-considered)

Text and image (including first video frame image) often have very different loading characteristics and optimization techniques. Understanding the ratio of LCP resource types lets you understand your LCP metrics and optimization paths better.
| **Note:** LCP resource types are only collected on full page loads, unlike the[LCP metric](https://developer.chrome.com/docs/crux/methodology/metrics#lcp-metric)itself which is also collected on back-forward navigations and prerendered pages.

For more information see the[LCP resource types launch blog post](https://developer.chrome.com/blog/crux-2025-02#lcp_resource_types).

### Largest Contentful Paint image subparts

"Optimizing for LCP can be a more complex task when PageSpeed Insights does not give you the answer on how to improve this metric. With complex tasks it's generally better to break them down into smaller, more manageable tasks and address each separately."

[web.dev/articles/optimize-lcp - LCP breakdown into subparts](https://web.dev/articles/optimize-lcp#lcp-breakdown)

Breaking down images LCPs into its most critical subparts provides the ability to utilize specific recommendations and best practices for how to optimize each part.

LCP image subparts are provided in four separate metrics:

- `largest_contentful_paint_image_time_to_first_byte`
- `largest_contentful_paint_image_resource_load_delay`
- `largest_contentful_paint_image_resource_load_duration`
- `largest_contentful_paint_image_element_render_delay`

| **Key point:**As they represent aggregated data across many page views, image subparts are provided at the 75th percentile so the sum of the subparts aren't expected to equal the overall LCP 75th percentile. LCP image subparts should be used to give an indication of relative subpart importance rather than of an exact breakdown of the 75th percentile LCP value.

Subparts are only included for images and this does not include first video frame images as they are a little more complicated as we cannot measure the full download time (note first video frames are included in the LCP resource type metric, where that complication is not relevant).

Text subparts are also not included since they are less useful and would distort image LCPs numbers. For sites that are largely made of text LCPs the overall[TTFB](https://developer.chrome.com/docs/crux/methodology/metrics#ttfb-metric)and overall[FCP](https://developer.chrome.com/docs/crux/methodology/metrics#fcp-metric)metrics are useful breakdowns---though note they are across all LCPs and not specific to text LCPs.
| **Note:** LCP image subparts are only collected on full page loads, unlike the[LCP metric](https://developer.chrome.com/docs/crux/methodology/metrics#lcp-metric)itself which is also collected on back-forward navigations and prerendered pages.

For more information see the[LCP image subparts launch blog post](https://developer.chrome.com/blog/crux-2025-02#lcp_diagnostic_information).

## Navigation types

The*navigation types*metric provides a breakdown of the percentage of page views of the following navigations:

|         Type         |                                                                                                                                                                                              Description                                                                                                                                                                                               |
|----------------------|--------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| `navigate`           | A page load, which does not fit into any of the other categories.                                                                                                                                                                                                                                                                                                                                      |
| `navigate_cache`     | A page load for which the main resource (the main HTML document) was served from the HTTP cache. Sites often make use of caching for sub-resources, but the main HTML document is often[cached considerably less](https://almanac.httparchive.org/en/2022/cdn#cdn-adoption)and when it can be, it can result in noticeable performance improvements from being able to be cached locally and at a CDN. |
| `reload`             | The user reloaded the page, either by hitting the reload button, by hitting enter in the address bar, or by undoing a tab close. Page reloads often result in revalidation back to the server to check if the main page has changed. A high percentage of page reloads may indicate user experience frustrations.                                                                                      |
| `restore`            | The page was reloaded after a browser restart, or a tab that had been removed for memory reasons. For Chrome on Android these are reported as 'reload' instead.                                                                                                                                                                                                                                        |
| `back_forward`       | A history navigation, meaning that the page was seen and returned to recently. With correct caching, these should be reasonably fast experiences but still require the page to be processed and JavaScript to be executed---both of which the bfcache avoids.                                                                                                                                          |
| `back_forward_cache` | A history navigation which was served from the bfcache.[Optimizing your pages](https://web.dev/articles/bfcache#optimize_your_pages_for_bfcache)to take advantage of the bfcache, by removing blockers, should result in faster experiences, so sites should look                                                                                                                                      |
| `prerender`          | The page was[prerendered](https://developer.chrome.com/docs/web-platform/prerender-pages)which---similar to bfcache---can result in near-instant page loads.                                                                                                                                                                                                                                           |

In some cases, a page load can be a combination of multiple navigation types. In that case, CrUX reports the first match in reverse order of the table (from bottom to top).

More information can be found in the[navigation types announcement post](https://developer.chrome.com/blog/crux-navigation-types).

## Onload

"The load event is fired when the page and its dependent resources have finished loading."

[MDN](https://developer.mozilla.org/docs/Web/Events/load)

## Round Trip Time

Provides an estimate of the HTTP (application layer) round trip time at the start of the navigation, based on recent network connections. This metric is based on the[`rtt`](https://developer.mozilla.org/docs/Web/API/NetworkInformation/rtt)property of the[Network Information API](https://developer.mozilla.org/docs/Web/API/Network_Information_API), which is the same API responsible for the former[Effective Connection Type (ECT)](https://developer.chrome.com/docs/crux/methodology/dimensions#ect-dimension)dimension.
| **Key Point:**Round trip time is a measure of the users to your site (based on their recent internet activity), and not of the site itself.

For more information see the[LCP resource types launch blog post](https://developer.chrome.com/blog/crux-2025-02#lcp_resource_types).

## Experimental metrics

Experimental metrics are available in the CrUX dataset using[BigQuery](https://developer.chrome.com/docs/crux/bigquery), with some also available in the[CrUX API](https://developer.chrome.com/docs/crux/api). These metrics are likely to change regularly as they evolve based on user feedback. Check the[release notes](https://developer.chrome.com/docs/crux/release-notes)to keep up to date on the latest changes.

### Time to First Byte

| **Note:** "Time to First Byte (TTFB) is a foundational metric for measuring connection setup time and web server responsiveness in both the lab and the field. It helps identify when a web server is too slow to respond to requests. In the case of navigation requests---that is, requests for an HTML document---it precedes every other meaningful loading performance metric."[web.dev/articles/ttfb](https://web.dev/articles/ttfb)

TTFB in CrUX is only collected on full page loads, unlike other timers (such as[LCP](https://developer.chrome.com/docs/crux/methodology/metrics#lcp-metric)) which are also collected on back-forward navigations and prerendered pages. As such, the sample size of TTFB can be smaller than other metrics and may not necessarily be compared directly with them. TTFB in CrUX will include cold page loads, cached page loads, and page loads from an established connection (for example, intra-site page loads).

TTFB is not a direct measure of server response time as it does include measures before that, including redirect time and be affected by whether a response is served from cache or CDN or from server. This is particularly apparent in field data like CrUX, whereas lab testing typically is less affected by these factors since the end URL is tests and often repeatedly negating caching changes.

### Popularity

The[popularity rank](https://developer.chrome.com/blog/crux-rank-magnitude)metric is a relative measure of site popularity within the CrUX dataset, measured by the total number of navigations on the origin. Rank is on a log10 scale with half steps (e.g. top 1k, top 5k, top 10k, top 50k, top 100k, top 500k, top 1M, etc.) with each rank excluding the previous (e.g. top 5k is actually 4k URLs, excluding top 1k). The upper limit is dynamic as the dataset grows.

Popularity is provided as a guide for broad analysis, for example to determine performance by country for the top 1,000 origins.

### Notification Permissions

| **Note:** "The Notifications API allows web pages to control the display of system notifications to the end user. These are outside the top-level browsing context viewport, so therefore can be displayed even when the user has switched tabs or moved to a different app. The API is designed to be compatible with existing notification systems, across different platforms."[MDN](https://developer.mozilla.org/docs/Web/API/Notifications_API)

For websites that request permission to show users notifications, this metric represents the relative frequency of users' responses to the prompts: accept, deny, ignore, or dismiss.