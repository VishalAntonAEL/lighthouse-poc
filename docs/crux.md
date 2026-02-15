The Chrome User Experience Report (also known as the Chrome UX Report, or CrUX for short) is a dataset that reflects how real-world Chrome users experience popular destinations on the web.

CrUX is the Google dataset of the[Web Vitals](https://web.dev/articles/vitals)program. All user-centric Core Web Vitals metrics are represented.

CrUX data is collected from real browsers around the world, based on certain browser options which determine[user eligibility](https://developer.chrome.com/docs/crux/methodology#user-eligibility). A set of[dimensions](https://developer.chrome.com/docs/crux/methodology/dimensions)and[metrics](https://developer.chrome.com/docs/crux/methodology/metrics)are collected which allow site owners to determine how users experience their sites.

The data collected by CrUX is available publicly through a number of[Google tools](https://developer.chrome.com/docs/crux/methodology/tools)and third-party tools and is used by Google Search to inform the[page experience ranking factor](https://developers.google.com/search/docs/advanced/experience/page-experience).

Not all origins or pages are represented in the dataset. There are separate eligibility criteria for[origins](https://developer.chrome.com/docs/crux/methodology#origin-eligibility)and[pages](https://developer.chrome.com/docs/crux/methodology#page-eligibility), primarily that they must be publicly discoverable and there must be a large enough number of visitors in order to create a statistically significant dataset.

# CrUX methodology

This section documents how CrUX collects and organizes user experience data.

## Eligibility

At the core of the CrUX dataset are individual user experiences, which are
aggregated into page-level and origin-level distributions. This section
documents user eligibility and the requirements for pages and origins to be
included in the dataset. All eligibility criteria must be satisfied in order for
an experience to be included in page-level data available in PageSpeed Insights
and the CrUX API: [User](https://developer.chrome.com/docs/crux/methodology#user-eligibility), [Origin](https://developer.chrome.com/docs/crux/methodology#origin-eligibility) and
[Page](https://developer.chrome.com/docs/crux/methodology#page-eligibility). Experiences which meet the User and Origin criteria
but not Page aren't included in the origin-level data available in all CrUX data
sources.

Pages and origins are automatically included or removed from the dataset if
their eligibility changes over time. At this time, you cannot manually submit
pages or origins for inclusion.

### Publicly discoverable

A page must be publicly discoverable to be considered for inclusion in the CrUX
dataset.

A page is determined to be publicly discoverable using the same
[indexability](https://developers.google.com/search/docs/advanced/crawling/block-indexing)
criteria as search engines.

A page **cannot** meet the discoverability requirement if **any** of the
following conditions are met, including root pages for the origin dataset:

- The page is served with an HTTP [status code](https://developer.mozilla.org/docs/Web/HTTP/Status) other than `200` (after redirects).
- The page is served with an HTTP `X-Robots-Tag: noindex` [header](https://developers.google.com/search/docs/advanced/robots/robots_meta_tag#xrobotstag-implementation) or equivalent.
- The document includes a `<meta name="robots" content="noindex">` [meta tag](https://developers.google.com/search/docs/advanced/robots/robots_meta_tag) or equivalent.

Refer to [Google Search Console](https://search.google.com/search-console/about)
for an overview of your site's indexing status.

### Sufficiently popular

A page is determined to be sufficiently popular if it has a minimum number of
visitors. An origin is determined to be sufficiently popular if it has a minimum
number of visitors across all of its pages. An exact number is not disclosed,
but it has been chosen to ensure that we have enough samples to be confident in
the statistical distributions for included pages. The minimum number is the same
for pages and origins.

Pages and origins that don't meet the popularity threshold are not included in
the CrUX dataset.

### Origin

An [**origin**](https://developer.mozilla.org/docs/Glossary/Origin) represents
an entire website, addressable by a URL like `https://www.example.com`. For an
origin to be included in the CrUX dataset it must meet two requirements:

1. [Publicly discoverable](https://developer.chrome.com/docs/crux/methodology#discoverability-eligibility)
2. [Sufficiently popular](https://developer.chrome.com/docs/crux/methodology#popularity-eligibility)

You can verify that your origin is discoverable by running a
[Lighthouse audit](https://pagespeed.web.dev/) and looking at the SEO category
results. Your site is not discoverable if your root page fails the
[*Page is blocked from indexing*](https://developer.chrome.com/docs/lighthouse/seo/is-crawlable) or
[*Page has unsuccessful HTTP status code*](https://developer.chrome.com/docs/lighthouse/seo/http-status-code)
audits.

If an origin is determined to be publicly discoverable, eligible user
experiences on all of that origin's pages are aggregated at the origin-level,
regardless of individual page discoverability. All of these experiences count
towards the origin's popularity requirement.

For querying purposes, note that all origins in the CrUX dataset are lowercase.

### Page

The requirements for a **page** to be included in the CrUX dataset are the same
as origins:

1. [Publicly discoverable](https://developer.chrome.com/docs/crux/methodology#discoverability-eligibility)
2. [Sufficiently popular](https://developer.chrome.com/docs/crux/methodology#popularity-eligibility)

You can verify that a page is discoverable by running a
[Lighthouse audit](https://pagespeed.web.dev/) and looking at the SEO category
results. Your page is not discoverable if it fails the
[*Page is blocked from indexing*](https://developer.chrome.com/docs/lighthouse/seo/is-crawlable) or
[*Page has unsuccessful HTTP status code*](https://developer.chrome.com/docs/lighthouse/seo/http-status-code)
audits.

If page is publicly discoverable for some users, but returns a non-success HTTP status in some circumstances, then those experiences won't be included in CrUX.

Pages commonly have additional identifiers in their URL including query string parameters like `?utm_medium=email` and fragments like `#main`. These identifiers are stripped from the URL in the CrUX dataset so that all user experiences on the page are aggregated together. This is useful for pages that would otherwise not meet the popularity threshold if there were many disjointed URL variations for the same page. Note that in rare cases this may unexpectedly group experiences for distinct pages together; for example if parameters `?productID=101` and `?productID=102` represent different pages.

Pages in CrUX are measured based on the top-level page. Pages included as iframes are not reported on separately in CrUX, but do contribute to the metrics of the top-level page. For example, if `https://www.example.com/page.html` embeds `https://www.example.com/frame.html` in an iframe, then `page.html` *will be* represented in CrUX (subject to the other eligibility criteria) but `frame.html` *will not* . And if `frame.html` has poor [CLS](https://developer.chrome.com/docs/crux/methodology/metrics#cls-metric) then the CLS will be included when measuring the CLS for `page.html`. CrUX is the Chrome *User Experience* Report and a user may not even be aware this is an iframe. Therefore, the experience is measured at the top level page---as per how the user sees this.

A website's architecture may complicate how its data is represented in CrUX. For example, single page apps (SPAs) may use a JavaScript-based *route transition* scheme to move between pages, as opposed to conventional anchor-based page navigations. These transitions appear as new page views to the user, but to Chrome and the underlying platform APIs the entire experience is attributed to the initial page view. This is a limitation of the web platform APIs on which CrUX is built, see [How SPA architectures affect Core Web Vitals](https://web.dev/articles/vitals-spa-faq) on web.dev for more information.

### User

For a **user** to have their experiences aggregated in the CrUX dataset, they must meet the following criteria:

1. Enable [usage statistic reporting](https://support.google.com/chrome/answer/96817).
2. Sync their [browser history](https://support.google.com/chrome/answer/185277).
3. Not have a [Sync passphrase](https://support.google.com/chrome/answer/165139?co=GENIE.Platform%3DAndroid#zippy=%2Ccreate-a-passphrase) set.
4. Use a supported platform.

The current supported platforms are:

- Desktop versions of Chrome including Windows, macOS, ChromeOS, and Linux operating systems.
- Android versions of Chrome, including mobile apps using [Custom Tabs](https://developer.chrome.com/docs/android/custom-tabs) and [WebAPKs](https://web.dev/articles/webapks).

There are a few notable exceptions that don't provide data to the CrUX dataset:

- Chrome on iOS.
- Android apps using WebView.
- Other Chromium browsers (for example [Microsoft Edge](https://www.microsoft.com/edge)).

Chrome does not publish data about the proportions of users that meet these criteria. You can learn more about the data we collect in the [Chrome Privacy Whitepaper](https://www.google.com/chrome/privacy/whitepaper.html#usagestats).

### Accelerated Mobile Pages (AMP)

Pages built with AMP are included in the CrUX dataset like any other web page. As of the [June 2020 CrUX release](https://developer.chrome.com/docs/crux/release-notes#202006), pages served using the [AMP Cache](https://developers.google.com/amp/cache) and / or rendered in the [AMP Viewer](https://developers.google.com/search/docs/advanced/experience/about-amp#about-google-amp-viewer) are also captured, and attributed to the publisher's page URL.

## Data quality

Data in CrUX undergoes a small amount of processing to ensure that it is statistically accurate, well structured and easier to query.

### Filtering

The CrUX dataset is filtered to ensure that the presented data is statistically valid. This may exclude entire pages or origins from appearing in the dataset.

In addition to the [eligibility criteria](https://developer.chrome.com/docs/crux/methodology#eligibility) applied to origins and pages, further filtering is applied for segments within the data:

Origins or pages having more than 20% of their total traffic excluded due to ineligible combinations of dimensions are excluded entirely from the dataset.

Because the global-level dataset encompasses user experiences from all countries, combinations of dimensions that don't meet the popularity criteria at the country level may still be included at the global level, provided that there is sufficient popularity.

### Fuzzing

A small amount of randomness is applied to the dataset to prevent reverse-engineering of sensitive data, such as total traffic volumes. This does not affect the accuracy of aggregate statistics.

### Precision

Most metric values within the CrUX dataset are represented as histograms of
values and bin sizes, where the histogram value is a fraction of all included
segments summing to 1. Bin sizes are floating point numbers between 1.0 and
0.0001.

Histogram [bin widths are normalized](https://twitter.com/chromeuxreport/status/1042443549676064768) to simplify querying and visualizing the data. This means that larger bins may be split into smaller bins, which equally share the original density in order to maintain consistent bin widths.

## License

CrUX datasets by Google are licensed under a [Creative Commons Attribution 4.0 International License](https://creativecommons.org/licenses/by/4.0/).