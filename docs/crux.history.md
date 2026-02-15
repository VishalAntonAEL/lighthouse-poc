Published: Feb 7, 2023, Last updated: Apr 11, 2025

<br />

The CrUX History API gives low-latency access to six months of historical real-user experience data at page and origin granularity.  

[Try it!](https://developer.chrome.com/docs/crux/history-api#try-it)

## Common use case

The CrUX History API allows for the querying of historical user experience metrics for a specific URI like "Get the historical UX trends for the `https://example.com` origin."

The History API follows the same structure as the daily [CrUX API](https://developer.chrome.com/docs/crux) except values are given in an array, and keys are labelled with plural names (for example, `histogramTimeseries` instead of `histogram`, or `p75s` instead of `p75`).

## CrUX API Key

Like the daily API, using the CrUX History API requires a Google Cloud API key provisioned for `Chrome UX Report API` usage. The same key can be used for the daily and history API.


### Acquiring and using an API key

Get a Key

Or create one in the [Credentials page](https://console.cloud.google.com/apis/credentials).

After you have an API key, your application can append the query parameter
`key=`<var translate="no">yourAPIKey</var> to all request URLs.

The API key is safe for embedding in URLs; it doesn't need any encoding.

<br />

See [Example queries](https://developer.chrome.com/docs/crux/history-api#example_queries).

## Data model

This section details the structure of data in requests and responses.

### Record

A discrete piece of information about a page, or site. A record can have data that is specific for an identifier and for a specific combination of dimensions. A record can contain data for one or more metrics.

### Identifiers

Identifiers specify what records should be looked up. In CrUX these identifiers are webpages and websites.

### Origin

When the identifier is an origin all data present for all pages in that origin are aggregated together. For example, say the `http://www.example.com` origin had pages as laid out by this sitemap:  

    http://www.example.com/
    http://www.example.com/foo.html
    http://www.example.com/bar.html

This would mean that when querying the Chrome UX Report with the origin set to `http://www.example.com`, data for `http://www.example.com/`, `http://www.example.com/foo.html`, and `http://www.example.com/bar.html` would be returned, aggregated together, because those are all pages under that origin.

### URLs

When the identifier is a URL, only data for that specific URL will be returned. Looking again to the `http://www.example.com` origin sitemap:  

    http://www.example.com/
    http://www.example.com/foo.html
    http://www.example.com/bar.html

If the identifier is set to URL with the value of `http://www.example.com/foo.html`, only data for that page will be returned.

### Dimensions

Dimensions identify a specific group of data that a record is being aggregated against. For example, a form factor of `PHONE` indicates that the record contains information about loads that took place on a mobile device.

#### Form Factor

The CrUX History API is only available aggregated by form factor dimension. This is a general class of device split into `PHONE`, `TABLET`, and `DESKTOP`.

### Metric

We report metrics in timeseries of statistical aggregations, which are histograms, percentiles,
and fractions.

#### Histograms

When metrics are expressed in a histogram array, then each timeseries entry represents the percentage of
page loads for which the metric fell into an interval, proportionally to all.
The data points are presented in the order of the [collection period](https://developer.chrome.com/docs/crux/history-api#collection-periods) dates also returned by the API, with the first point being the earliest period, and the final point being the most recent collection period.

A three bin histogram for an example metric looks like this:  

    {
      "histogramTimeseries": [
        {
          "start": 0,
          "end": 2500,
          "densities": [0.9190, 0.9203, 0.9194, 0.9195, 0.9183, 0.9187]
        },
        {
          "start": 2500,
          "end": 4000,
          "densities": [0.0521, 0.0513, 0.0518, 0.0518, 0.0526, 0.0527]
        },
        {
          "start": 4000,
          "densities": [0.0288, 0.0282, 0.0286, 0.0285, 0.0290, 0.0285]
        }
      ],
    }

This data indicates that 91.90% of page loads experienced the example metric value between 0ms and 2,500ms for the first collection period in the history, followed by 92.03%, 91.94%... The units of the metric are not contained in this histogram, in this case we will assume milliseconds.

Additionally, 5.21% of page loads experienced the example metric value between 2,500ms and 4,000ms in the first collection period in the history, and 2.88% of page loads experienced a value greater than 4,000ms in the first collection period in the history.

#### Percentiles

Metrics may also contain timeseries of percentiles that can be useful for additional analysis.

The data points are presented in the order of the [collection period](https://developer.chrome.com/docs/crux/history-api#collection-periods) dates also returned by the API, with the first point being the earliest period, and the final point being the most recent collection period.  

    {
      "percentilesTimeseries": {
        "p75s": [1362, 1352, 1344, 1356, 1366, 1377]
      },
    }

These percentiles can show specific metric values at the given percentile for that metric. They are based on the full set of available data and not the final binned data, so they don't necessarily match an interpolated percentile that is based on the final binned histogram.
| **Note:** The values for each percentile are synthetically derived, it does not imply that any user actually experienced the value indicated, only that some percentage of users experienced a metric value that was less than the value given.

#### Fractions

Metrics may be expressed as timeseries of labeled fractions; each label describes a page load in a particular
way. The data points are presented in the order of the [collection period](https://developer.chrome.com/docs/crux/history-api#collection-periods) dates also returned by the API, with the first point being the earliest period, and the final point being the most recent collection period.

Example:  

    {    
      "fractionTimeseries": {
        "desktop": {"fractions": [0.3195, 0.2115, 0.1421]},
        "phone": {"fractions": [0.6295, 0.7544, 0.8288]},
        "tablet": {"fractions": [0.051, 0.0341, 0.029]}
      }
    }

In this example, the most recent data point indicates 14.21% of page loads came from desktop, and 82.88% came from phones.

#### Metric value types

As the CrUX History API uses the same metric value types, you can reference [the daily CrUX API metric value types documentation](https://developer.chrome.com/docs/crux/methodology/metrics) for more details.

#### Metric eligibility

Based on the [eligibility criteria](https://developer.chrome.com/docs/crux/methodology#eligibility) an origin or URL may only be eligible for some of the collection periods covered by the CrUX History API. In these cases the CrUX History API will return `"NaN"` for the `histogramTimeseries` densities and `null` for the `percentilesTimeseries` for the collection periods which have no eligible data. The reason for the difference is the histogram densities are always numbers, while the percentiles can be numbers or strings (CLS uses strings, even if they look like numbers).

For example, if the second period did not have any eligible data, this would show as:  

    {
      "histogramTimeseries": [
        {
          "start": 0,
          "end": 2500,
          "densities": [0.9190, "NaN", 0.9194, 0.9195, 0.9183, 0.9187]
        },
        {
          "start": 2500,
          "end": 4000,
          "densities": [0.0521, "NaN", 0.0518, 0.0518, 0.0526, 0.0527]
        },
        {
          "start": 4000,
          "densities": [0.0288, "NaN", 0.0286, 0.0285, 0.0290, 0.0285]
        }
      ],
      "percentilesTimeseries": {
        "p75s": [1362, null, 1344, 1356, 1366, 1377]
      },
    }

For URLs or origins that fall in and out of eligibility over time, you may notice many missing entries.

### Collection periods

The CrUX History API contains a `collectionPeriods` object with an array of `firstDate` and `endDate` fields representing the beginning and end dates of each aggregation window. For example:  

        "collectionPeriods": [{
            "firstDate": { "year": 2022, "month": 7, "day": 10 },
            "lastDate": { "year": 2022, "month": 8, "day": 6 }
          }, {
            "firstDate": { "year": 2022, "month": 7, "day": 17 },
            "lastDate": { "year": 2022, "month": 8, "day": 13 }
          }, {
            "firstDate": { "year": 2022, "month": 7, "day": 24 },
            "lastDate": { "year": 2022, "month": 8, "day": 20 }
          }, {
            "firstDate": { "year": 2022, "month": 7, "day": 31 },
            "lastDate": { "year": 2022, "month": 8, "day": 27 }
          }, {
            "firstDate": { "year": 2022, "month": 8, "day": 7 },
            "lastDate": { "year": 2022, "month": 9, "day": 3 }
          }, {
            "firstDate": { "year": 2022, "month": 8, "day": 14 },
            "lastDate": { "year": 2022, "month": 9, "day": 10 }
          }
        ]

These collection periods are in ascending order and represent the date span of each of the data points in the other sections of the response.

The History API is updated each Monday and contains data up until the previous Saturday (as per the standard 2-day lag). It contains the previous 40-weeks worth of data---one collection period per week. By default, 25 collection periods are returned. This can be changed by setting `"collectionPeriodCount"` in the request to a number between 1 and 40.

As each collection period contains the previous 28-days aggregated data, and the collection periods are per week, this means the collection periods will overlap. They are similar to a moving average of data, with three weeks worth of data being included in each subsequent period, and one week being different.

## Example queries

Queries are submitted as JSON objects using a POST request to `https://chromeuxreport.googleapis.com/v1/records:queryHistoryRecord?key=[YOUR_API_KEY]"` with query data as a JSON object in the POST body.

Note the use of `queryHistoryRecord` replacing the `queryRecord` of the daily CrUX API.

An example body is:  

    {
      "origin": "https://example.com",
      "formFactor": "PHONE",
      "metrics": [
        "largest_contentful_paint",
        "experimental_time_to_first_byte"
      ]
    }

For example, this can be called from `curl` with the following command line (replacing `API_KEY` with your key):  

    curl -s --request POST 'https://chromeuxreport.googleapis.com/v1/records:queryHistoryRecord?key=API_KEY' \
        --header 'Accept: application/json' \
        --header 'Content-Type: application/json' \
        --data '{"formFactor":"PHONE","origin":"https://www.example.com","metrics":["largest_contentful_paint", "experimental_time_to_first_byte"]}'

| **Note:** The prevous example is for macOS or Linux based systems---including the Git BASH shell for Windows. Other systems may require slight modifications. For example, the `cmd.exe` command line does not allow single quotes for parameters, nor the line continuations (`\`), so requires using double quotes (escaping inner quotes as appropriate with `\"`), and also using a single line.

Page-level data is available through the API by passing a `url` property in the query, instead of `origin`:  

    {
      "url": "https://example.com/page",
      "formFactor": "PHONE",
      "metrics": [
        "largest_contentful_paint",
        "experimental_time_to_first_byte"
      ]
    }

If the `metrics` property is not set then all available metrics will be returned:

- `cumulative_layout_shift`
- `first_contentful_paint`
- `interaction_to_next_paint`
- `largest_contentful_paint`
- `experimental_time_to_first_byte`
- `largest_contentful_paint_resource_type`
- `largest_contentful_paint_image_time_to_first_byte`
- `largest_contentful_paint_image_resource_load_delay`
- `largest_contentful_paint_image_resource_load_duration`
- `largest_contentful_paint_image_element_render_delay`
- `navigation_types`
- `round_trip_time`
- `form_factors` (only reported if no `formFactor` is specified in the request)

If no `formFactor` value is provided then the values will be aggregated across all form factors.

See [Using the CrUX History API](https://developer.chrome.com/docs/crux/guides/history-api) guide for more example queries.

## Data pipeline

The CrUX dataset is processed through a pipeline to consolidate, aggregate and filter the data before becoming available through the API.

### The rolling average

The data in the Chrome UX Report is a 28-day rolling average of aggregated metrics. This means that the data presented in the Chrome UX Report at any given time is actually data for the past 28 days aggregated together.

The History API contains a number of collection periods, each spanning these 28 days. As each collection period contains the previous 28-days aggregated data, and the collection periods are per week, this means the collection periods will overlap. They are similar to a moving average of data, with three weeks worth of data being included in each subsequent period, and one week being different.

### Weekly updates

The History API is updated each Monday around 04:00 UTC and contains data up until the previous Saturday (as per the standard 2-day lag). It contains the previous 40 weeks (approximately 10 months) worth of data, one collection period per week. Note that by default, we return 25 entries per timeseries; but this can be overridden by specifying the `collectionPeriodCount` request parameter.

There is no service level agreement for update times; it is run on a best-effort basis every day.
| **Caution:** Data won't differ within the same week after it has been updated each Monday around 04:00 UTC, repeated calls will yield the same results.

## Schema

There is a single endpoint for the CrUX History API which accepts `POST` HTTP requests. The API returns a `record` which contains one or more `metrics` corresponding to performance data about the requested origin or page.

### HTTP request

    POST https://chromeuxreport.googleapis.com/v1/records:queryHistoryRecord

The URL uses [gRPC Transcoding](https://google.aip.dev/127) syntax.

### Request body

The CrUX History API uses similar request bodies as [the daily CrUX API](https://developer.chrome.com/docs/crux/api#request_body), with one additional, optional `"collectionPeriodCount"` field:  

    {
      "formFactor": enum (FormFactor),
      "metrics": [
        string
      ],

      // Union field url_pattern can be only one of the following:
      "origin": string,
      "url": string,
      // End of list of possible types for union field url_pattern.

      "collectionPeriodCount": int32 // Optional: Number of periods to collect
    }

| Fields ||
|---|---|
| `formFactor` | **`enum` ([`FormFactor`](https://developer.chrome.com/docs/crux/history-api#form_factor))** The form factor is a query dimension that specifies the device class that the record's data should belong to. This field uses the values `DESKTOP`, `PHONE`, or `TABLET`. Note: If no form factor is specified, then a special record with aggregated data over all form factors will be returned. |
| `metrics[]` | **`string`** The metrics that should be included in the response. If none are specified then any metrics found will be returned. Allowed values: `["cumulative_layout_shift", "first_contentful_paint", "interaction_to_next_paint", "largest_contentful_paint", "experimental_time_to_first_byte", "largest_contentful_paint_resource_type", "largest_contentful_paint_image_time_to_first_byte", "largest_contentful_paint_image_resource_load_delay", "largest_contentful_paint_image_resource_load_duration", "largest_contentful_paint_image_element_render_delay", "navigation_types", "round_trip_time"]` |
| Union field `url_``pattern`. The `url_pattern` is the main identifier for a record lookup. It can be only one of the following: ||
| `origin` | **`string`** The `url_pattern` "origin" refers to a URL pattern that is the origin of a website. Examples: `"https://example.com"`, `"https://cloud.google.com"` |
| `url` | **`string`** The `url_pattern` `url` refers to a URL pattern that is any arbitrary URL. Examples: `"https://example.com/`, `https://cloud.google.com/why-google-cloud/"` |
| End of Union field `url_``pattern`. ||
| `collectionPeriodCount` | **`int32` *(optional)*** The number of collection periods to return between 1 and 40. The default is 25. Note if no `collectionPeriodCount` is specified the default of 25 is returned. |

For example, to request the desktop Largest Contentful Paint values for the web.dev homepage:  

    {
      "url": "https://web.dev/",
      "formFactor": "DESKTOP",
      "metrics": [
        "largest_contentful_paint"
      ]
    }

This similar request includes the optional `collectionPeriodCount` field and would yield 40 timeseries entries providing roughly 10 months of web performance history for the https://web.dev origin:  

    {
      "url": "https://web.dev/",
      "formFactor": "DESKTOP",
      "metrics": [
        "largest_contentful_paint"
      ],
      "collectionPeriodCount": 40
    }

### Response body

Successful requests return responses with a `record` object and `urlNormalizationDetails` in the following structure:  

    {
      "record": {
        "key": {
          object (Key)
        },
        "metrics": [
          string: {
            object (Metric)
          }
        ]
      },
      "urlNormalizationDetails": {
        object (UrlNormalization)
      }
    }

For example, the response to the request body in the previous request could be:  

    {
      "record": {
        "key": {
          "origin": "https://web.dev"
        },
        "metrics": {
          "largest_contentful_paint": {
            "histogramTimeseries": [{
                "start": 0, "end": 2500, "densities": [
                  0.9190, 0.9203, 0.9194, 0.9195, 0.9183, 0.9187, ...
                ]
              }, {
                "start": 2500, "end": 4000, "densities": [
                  0.0521, 0.0513, 0.0518, 0.0518, 0.0526, 0.0527, ...
                ]
              },  {
                "start": 4000, "densities": [
                  0.0288, 0.0282, 0.0286, 0.0285, 0.0290, 0.0285, ...
                ]
              }
            ],
            "percentilesTimeseries": {
              "p75s": [
                1362, 1352, 1344, 1356, 1366, 1377, ...
              ]
            }
          }
        },
        "collectionPeriods": [{
            "firstDate": { "year": 2022, "month": 7, "day": 10 },
            "lastDate": { "year": 2022, "month": 8, "day": 6 }
          }, {
            "firstDate": { "year": 2022, "month": 7, "day": 17 },
            "lastDate": { "year": 2022, "month": 8, "day": 13 }
          }, {
            "firstDate": { "year": 2022, "month": 7, "day": 24 },
            "lastDate": { "year": 2022, "month": 8, "day": 20 }
          }, {
            "firstDate": { "year": 2022, "month": 7, "day": 31 },
            "lastDate": { "year": 2022, "month": 8, "day": 27 }
          }, {
            "firstDate": { "year": 2022, "month": 8, "day": 7 },
            "lastDate": { "year": 2022, "month": 9, "day": 3 }
          }, {
            "firstDate": { "year": 2022, "month": 8, "day": 14 },
            "lastDate": { "year": 2022, "month": 9, "day": 10 }
          }, {
            ...
          }
        ]
      }
    }

#### Key

`Key` defines all the dimensions that identify this record as unique.  

    {
      "formFactor": enum (FormFactor),

      // Union field url_pattern can be only one of the following:
      "origin": string,
      "url": string
      // End of list of possible types for union field url_pattern.
    }

| Fields ||
|---|---|
| `formFactor` | **`enum (`[FormFactor](https://developer.chrome.com/docs/crux/history-api#form-factor)`)`** The form factor is the device class that all users used to access the site for this record. If the form factor is unspecified, then aggregated data over all form factors will be returned. |
| Union field `url_``pattern`. The URL pattern is the URL that the record applies to. `url_``pattern` can be only one of the following: ||
| `origin` | **`string`** Origin specifies the origin that this record is for. Note: When specifying an origin, data for loads under this origin over all pages are aggregated into origin level user experience data. |
| `url` | **`string`** `url` specifies a specific URL that this record is for. Note: When specifying a `url` only data for that specific URL will be aggregated. |

#### Metrics

A `metric` is a set of user experience data for a single web performance metric, such as first contentful paint. It contains a summary histogram of real world Chrome usage as a series of `bins`.  

    {
      "histogramTimeseries": [
        {
          object (Bin)
        }
      ],
      "percentilesTimeseries": {
        object (Percentiles)
      }
    }

or  

    "fractionTimeseries": {
      object (Fractions)
    }

| Fields ||
|---|---|
| `histogramTimeseries[]` | **`object (`[Bin](https://developer.chrome.com/docs/crux/history-api#api-response-bin)`)`** The timeseries histogram of user experiences for a metric. The timeseries histogram will have at least one bin and the densities of all bins will add up to \~1. Missing values for that particular Collection Period will be marked as `"NaN"`. |
| `percentilesTimeseries` | **`object (`[Percentiles](https://developer.chrome.com/docs/crux/history-api#api-response-percentiles)`)`** Common useful percentiles of the Metric. The value type for the percentiles will be the same as the value types given for the Histogram bins. Missing values for that particular Collection Period will be marked as `null`. |
| `fractionTimeseries` | **`object (`[Fractions](https://developer.chrome.com/docs/crux/history-api#api-response-fractions)`)`** This object contains timeseries of labeled fractions, which add up to \~1 per entry. Fractions are rounded to 4 decimal places. Missing entries are expressed as \`"NaN"\` across all fractions. |

#### Bin

A `bin` is a discrete portion of data spanning from start to end, or if no end is given from start to positive infinity.

A bin's start and end values are given in the value type of the metric it represents. For example, first contentful paint is measured in milliseconds and exposed as ints, therefore its metric bins will use int32s for its start and end types. However cumulative layout shift is measured in unitless decimals and is exposed as a decimal encoded as a string, therefore its metric bins will use strings for its value type.  

    {
      "start": value,
      "end": value,
      "densities": [number, number, number...etc.]
    }

| Fields ||
|---|---|
| `start` | **`(integer | string)`** Start is the beginning of the data bin. |
| `end` | **`(integer | string)`** End is the end of the data bin. If end is not populated, then the bin has no end and is valid from start to +inf. |
| `densities` | **`array[number]`** A timeseries of the proportion of users that experienced this bin's value for the given metric. Densities are rounded to 4 decimal places. |

#### Percentiles

`Percentiles` contains synthetic values of a metric at a given statistical percentile. These are used for estimating a metric's value as experienced by a percentage of users out of the total number of users.  

    {
      "P75": value
    }

| Fields ||
|---|---|
| `p75s` | **`array[(integer | string)]`** Timeseries of the values that 75% of page loads experienced the given metric at or less than this value. |

#### Fractions

`Fractions` contains timeseries of labeled fractions that add up to \~1, per entry.
Each label describes a page load in some way, so metrics represented in this way
can be thought of as producing distinct values instead of numerical values, and the
fractions express how frequently a particular distinct value was measured.  

    {
      "label_1": { "fractions": array[fraction]},
      "label_1": { "fractions": array[fraction]},
      ...
      "label_n": { "fractions": array[fraction]}
    }

Much like the density values in histogram bins, each `fraction` is a number
`0.0 <= value <= 1.0`, and they add up to \~1.0. When the metric is not available
for a particular collection period, then the corresponding entry will be
"NaN" in all arrays of fractions.

| Fields ||
|---|---|
| `p75s` | **`array[(integer | string)]`** Timeseries of the values that 75% of page loads experienced the given metric at or lower than this value. |

#### UrlNormalization

Object representing the normalization actions taken to normalize a URL to achieve a higher chance of successful lookup. These are basic, automated changes that are taken when looking up the provided `url_pattern` would be known to fail. Complex actions like following redirects are not handled.  

    {
      "originalUrl": string,
      "normalizedUrl": string
    }

| Fields ||
|---|---|
| `originalUrl` | **`string`** The original requested URL prior to any normalization actions. |
| `normalizedUrl` | **`string`** The URL after any normalization actions. This is a valid user experience URL that could reasonably be looked up. |

## Rate limits

The CrUX History API shares the same limit with the [CrUX API](https://developer.chrome.com/docs/crux/api) for 150 queries per minute per Google Cloud project for either API, which is offered without charge. This limit, and your current usage, can be seen in the [Google Cloud Console](https://console.cloud.google.com/apis/api/chromeuxreport.googleapis.com/quotas). This generous quota should be sufficient for the vast majority of use cases and it is not possible to pay for an increased quota.