# CrUX vs Page Speed API in this app

## How each API is used

| | **Page Speed Insights API** | **CrUX API** |
|---|-----------------------------|--------------|
| **What it returns** | Lab data (Lighthouse) + field data (CrUX) for one URL | Field data only (real-user Core Web Vitals) |
| **Granularity** | One URL per request | **Origin** (site-wide) or **URL** (single page) |
| **Calls in this app** | **2 per URL** (desktop + mobile) | **2 per URL** (desktop + mobile) + **4 per run** (origin desktop, origin mobile, origin combined, origin history) |

So for **N unique pages** (e.g. 2000):

- **Page Speed API**: **2 × N** calls (desktop + mobile). Each call runs Lighthouse and returns both lab and field data for that URL.
- **CrUX API**:
  - **Per-URL**: **2 × N** calls (desktop + mobile) for page-level field data.
  - **Origin-level**: **4** calls total for the whole site (desktop, mobile, combined, history).

Example: 2000 URLs → 4000 Page Speed calls + 4000 per-URL CrUX calls + 4 origin CrUX calls = **8004** API calls.

---

## Should we fetch CrUX for all URLs or just the main page / origin?

**It depends what you want:**

1. **Origin-only (recommended for scale)**  
   - Use only the 4 origin CrUX calls (no per-URL CrUX).  
   - You get site-wide real-user metrics and 40-week trends.  
   - No per-page field data in drilldown; you can still show origin CrUX as a fallback.  
   - **CrUX API quota**: 150 queries/min → origin-only uses 4 calls per run.

2. **Per-URL CrUX (current behavior)**  
   - 2 CrUX calls per URL (desktop + mobile).  
   - Where CrUX has enough data, you get **per-page** field data and can show “lab vs field” per URL.  
   - Many low-traffic URLs return **404 / null** (no data); the UI already falls back to origin CrUX.  
   - For 2000 URLs: 4000 CrUX calls → ~27 minutes at 150/min, plus rate-limit/retry handling.

So:

- **All URLs**: Use per-URL CrUX only if you need “lab vs field” per page and accept the extra time and quota.  
- **Main page only**: You can run Page Speed + CrUX for just the main URL; for site-wide field data, the **origin** CrUX (and history) is enough and is already fetched once per run.

---

## Why only 1–2 CrUX JSON files in `.lighthouse-data/latest`?

CrUX is used in two ways; only one is written to **separate** JSON files:

| Data | Where it’s stored |
|------|--------------------|
| **Origin-level CrUX** (desktop, mobile, combined, history) | **Files:** `origin-crux.json`, `crux-history.json` in the run folder (e.g. `.lighthouse-data/latest/`). |
| **Per-URL CrUX** (each page’s desktop + mobile field data) | **Inside** `manifest.json`: each page has `devices.desktop.cruxData` and `devices.mobile.cruxData`. There are **no** separate CrUX JSON files per URL. |

So when you see “3000+ CrUX API calls” but only 1–2 CrUX JSON files:

- The **3000+** calls are the **per-URL** CrUX requests (2 per page × many pages).
- Their results are **not** written to individual files; they’re embedded in **manifest.json**.
- The **1–2** files are **origin-crux.json** and **crux-history.json** (origin-level data only).

Summary:

- **Page Speed**: one call per URL per device → results in `pages/<slug>/desktop.slim.json` and `mobile.slim.json` (thousands of files).
- **CrUX**: per-URL results live in **manifest.json**; only **origin** CrUX is written to **origin-crux.json** and **crux-history.json**.
