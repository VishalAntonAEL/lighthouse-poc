# Dimensions

The CrUX dataset includes dimension data to allow deeper interrogation of the data. Dimensions identify a specific group of data that a record is being aggregated against, such as a form factor of `"phone"` indicates that the record contains information about loads that took place on a mobile device.

## Current dimensions

The following dimensions are the current dimensions in CrUX.

Data may not be available for all dimensions, based on [eligibility criteria](https://developer.chrome.com/docs/crux/methodology#eligibility).

### Form factor

The form factor dimension lets you query against three separate form factors:

- `phone`
- `tablet`
- `desktop`

Form factor is inferred from the device [User-Agent string](https://developer.chrome.com/docs/multidevice/user-agent).

### Country

The country dimension was [added to the CrUX BigQuery dataset in 2018](https://developer.chrome.com/blog/crux-2018-01). The term "country" is used loosely, as some geographic areas are politically disputed. Values in the country dimension are inferred from users' IP addresses and represented as two-letter country codes as defined by [ISO 3166-1](https://en.wikipedia.org/wiki/ISO_3166-1_alpha-2).

Country-level datasets are provided in addition to the global dataset, with the standard eligibility requirements applied at a country level. A table is [provided for each country](https://developer.chrome.com/docs/crux/bigquery#schema-country-summary), as well as [summary tables](https://developer.chrome.com/docs/crux/bigquery#schema-raw-tables) which include the country code as a column.

Country dimensions are not available in the CrUX APIs.

## Optional dimensions

As of the [May 2022](https://developer.chrome.com/docs/crux/release-notes#202205) release, the CrUX dataset supports optional dimensions. Previously, a form factor and effective connection type (ECT) combination must have independently met the *sufficiently popular* criterion or else it would be excluded from the page or origin record. With this feature, experiences on different ECTs could be combined by their common form factor, and the corresponding ECT value will be `NULL`. Experiences on different form factors may also be combined, and both the ECT and form factor values will be `NULL`.

Previously, form factor and effective connection type were required columns in our BigQuery tables. This meant that when we did not have sufficient coverage to express the histogram densities in the specific rows (e.g., form factor = phone, effective connection type = 2G), we were dropping the entire origin from the dataset. With optional dimensions, we made the form factor and effective connection type optional (NULLABLE) and therefore, we're now able to publish overall histogram densities in such cases; that is, we may set the effective connection type value to NULL indicating "all effective connection types", or we may set both effective connection type and form factor to NULL indicating "all effective connection types" and "all form factors".

## Deprecated and removed dimensions

Dimensions may be deprecated and removed over time. They are documented here as older datasets available in BigQuery may still contain them. For example older datasets are still segmented by ECT dimension.

### Effective Connection Type (*removed*)

| **Deprecated:** The Effective Connection Type dimension was removed from [February 2025](https://developer.chrome.com/docs/crux/release-notes#202502) and replaced with the [RTT metric](https://developer.chrome.com/docs/metrics#round-trip-time-metric).

[Effective Connection Type](https://developer.mozilla.org/docs/Glossary/Effective_connection_type) (ECT) is a web platform API to broadly categorize visitor connection speeds. This dimension in the CrUX dataset lets you:

- See a breakdown of connection speeds of real visitors
- Filter performance data by connection speed

The specification defines four connection types, but the majority of visits are likely on connections faster than `3G` and thus classified as `4G`:  

|   ECT   | Minimum RTT | Maximum downlink |                                               Explanation                                                |
|---------|-------------|------------------|----------------------------------------------------------------------------------------------------------|
| offline | N/A         | N/A              | The network is offline, only cached files can be served.                                                 |
| slow-2g | 2000ms      | 50 Kbps          | The network is suited for small transfers only such as text-only pages.                                  |
| 2g      | 1400ms      | 70 Kbps          | The network is suited for transfers of small images.                                                     |
| 3g      | 270ms       | 700 Kbps         | The network is suited for transfers of large assets such as high resolution images, audio, and SD video. |
| 4g      | 0ms         | ∞                | The network is suited for HD video, real-time video, etc.                                                |