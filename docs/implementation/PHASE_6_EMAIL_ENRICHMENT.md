# Phase 6 — Email Enrichment (HTTP + Regex)

> **Goal:** Find and fill email addresses for existing leads by crawling their
> websites with native HTTP fetch + regex. An optional, on-demand enrichment
> layer that runs through the existing worker — never during initial scraping.

**Status:** COMPLETED — all slices 6.1–6.8 done; 114 tests passing
**Last Updated:** 2026-05-22

**Prerequisites:** [Phase 5](./PHASE_5_QA_AND_HARDENING.md) completed.

---

## Slices

| # | Slice | Status |
|---|---|---|
| 6.1 | `EnrichmentRun` model + migration | COMPLETED |
| 6.2 | Email extraction core (`extract-email.ts`) — ranked strategy + denylist | COMPLETED |
| 6.3 | Enrichment engine (`enrich.ts`) — URL discovery, fetch, concurrency | COMPLETED |
| 6.4 | Worker integration — claim + process enrichment jobs | COMPLETED |
| 6.5 | API routes — queue, status, cancel | COMPLETED |
| 6.6 | Single enrichment UI — "Find Email" button in the Email modal | COMPLETED |
| 6.7 | Bulk enrichment UI — "Find Email" in the bulk-actions pill + banner | COMPLETED |
| 6.8 | Tests — extraction, engine, worker flow, cancellation | COMPLETED |

---

## What you (the user) must provide during Phase 6

| When | What | Why |
|---|---|---|
| Before Slice 6.3 | Confirm the worker can make outbound HTTPS requests (no corporate proxy blocking) | The engine fetches real third-party websites |
| During Slice 6.8 | Acknowledge tests will hit a few real public websites OR confirm fixtures-only | Some integration tests can use static HTML fixtures instead of live fetches |

---

## 1. Why This Approach (HTTP + Regex), Not Playwright

### The Decision

For email enrichment we use native `fetch()` + regex pattern matching. We do
**not** use Playwright.

### The Reasoning

| Factor | Playwright | HTTP + Regex | Winner |
|---|---|---|---|
| Speed per website | 5–10 s | 0.5–2 s | HTTP |
| Memory per request | 100–300 MB | 2–5 MB | HTTP |
| 5 concurrent | Heavy, crash risk | Lightweight, stable | HTTP |
| AJAX-loaded content | Yes | No | Playwright |
| Click buttons | Yes | No | Playwright |
| Installation | Required | Built into Node | HTTP |
| Complexity | High | Low | HTTP |

### The Honest Trade-Off

We accept that ~2–5% of leads will not yield emails via HTTP because their
sites load contact info dynamically with JavaScript.

Why acceptable:

- Target businesses (restaurants, dentists, lawyers, local services) prioritize
  SEO. Email addresses are almost always in static HTML.
- For the rare miss, the user adds the email manually — same as today.
- The speed gain (0.5–2 s vs 5–10 s per site) outweighs the small miss rate.

### The 95% Rule

For these target business types, ~95% of emails are discoverable in static HTML
on the homepage or a contact/about/team page. The remaining 5% use contact
forms, AJAX-loaded emails, or have no email at all — manual entry covers them.

---

## 1.5 Execution Model — Worker + Job Queue

> **This is the single most important architectural decision in Phase 6.**

Email enrichment runs **in the existing `apps/scraper` worker process**, driven
by a job queue — exactly like Google Maps scraping. It does **not** run inside
a Next.js API request handler.

### Why

A bulk enrichment of hundreds of leads takes minutes. An API route cannot do
this: request timeouts kill it, there is no cancellation, no progress, and a
page reload loses it. The worker already solves every one of these problems for
scraping. We reuse that machinery rather than building a second, weaker one.

Reusing the worker gives us, for free:

- **Cancellation** — the existing `CancelledError` flow from Phase 3.
- **Crash recovery** — the orphan-run reaper marks interrupted runs FAILED.
- **Progress polling** — the web UI already polls active runs at ~3 s.
- **Reload survival** — progress lives in the DB, not in a browser tab.

### The Shape

A new `EnrichmentRun` table mirrors `ScrapeRun`. The web app queues a run
(`POST /api/enrich`) and polls it (`GET /api/enrich/[runId]`) — the same
request/response shape as the scrape endpoints. The worker claims enrichment
jobs with the same `FOR UPDATE SKIP LOCKED` pattern used for scrape jobs.

### Worker Job Handling

The worker loop currently claims one job at a time. With Phase 6 it claims
**either** a pending scrape run **or** a pending enrichment run — whichever is
oldest — and dispatches to the right processor. Enrichment jobs are short
relative to scrapes, so head-of-line blocking is acceptable for the MVP. If it
becomes a problem later, run a second worker process or split the claim query
by job type — explicitly **out of scope** here.

### Single vs. Bulk — One Engine

Single enrichment (one lead) is just a bulk run with one lead in it. There is
**one** core function — `enrichLeads(leadIds: string[])` — and **one** worker
processor. "Find Email" on a row queues a 1-lead `EnrichmentRun`; "Find Email"
in the bulk pill queues an N-lead `EnrichmentRun`. The only difference is in the
UI: a 1-lead run finishes fast enough to show an inline result instead of a
full progress banner. There is no second backend path.

---

## 2. Overview

### What This Phase Delivers

| Method | Trigger | Use Case |
|---|---|---|
| Single Enrichment | "Find Email" button inside the Email modal on a lead row | One-off email discovery for a specific lead |
| Bulk Enrichment | Select leads → "Find Email" in the floating bulk-actions pill | Populate emails for many leads at once |

### Core Principles

- **No automatic enrichment.** The user controls when it runs — initial
  scraping stays fast.
- **Stop at first email found.** Once a page yields a ranked email, that lead
  is done; remaining URLs are not fetched.
- **Preserve existing emails.** A lead that already has an email is skipped
  during bulk enrichment.
- **Non-destructive.** Enrichment never overwrites an email a lead already has.
- **Transparent progress.** During a bulk run the user sees a live banner with
  a timer — the same pattern as a Google Maps scrape.

---

## 3. Technology Stack

| Layer | Technology | Why |
|---|---|---|
| HTTP requests | Native `fetch()` (Node 20 built-in) | No install, fast, lightweight |
| Email extraction | Regex + ranked selection | Simple, covers ~95% of cases |
| Concurrency control | Promise-based pool, limit 5 | 5 concurrent leads max |
| Timeout | `AbortSignal.timeout()` | 5 s per request |
| User-Agent | Spoofed desktop Chrome | Avoids basic bot blocking |
| Job queue | `EnrichmentRun` table + worker | Reuses the Phase 2–3 pattern |

### No Additional Packages Required

Node 20 includes `fetch()` natively. Nothing to `npm install` for core
functionality. HTML-entity decoding is done with a tiny local helper, not a
package.

---

## 4. URL Discovery Strategy

> **Confirmed decision:** scan the homepage for real contact links first; fall
> back to guessed paths only if the homepage yields nothing useful.

For each lead, the engine resolves a fetchable base URL, then walks pages in
this order:

### Step 1 — Resolve the base URL

The lead stores `normalized_domain` (scheme- and `www`-stripped). The engine
tries, in order, **HTTPS only**:

1. `https://{normalized_domain}`
2. `https://www.{normalized_domain}` — if the bare domain fails fast

`fetch` follows redirects by default; leave that on. If both variants fail, the
lead is skipped.

### Step 2 — Fetch the homepage

Fetch the resolved base once. From the homepage HTML:

- Extract any emails present (see §8).
- Collect all `<a href>` links.

### Step 3 — Follow real contact links

From the homepage links, pick up to **3** whose href or visible text contains
`contact`, `about`, `team`, or `get-in-touch` (case-insensitive). Fetch those.
This catches `/contact-us`, `/get-in-touch`, locale-prefixed paths, etc. — the
things a fixed path list misses.

### Step 4 — Fall back to guessed paths

Only if the homepage exposed **no** usable contact links, try the fixed list:
`/contact`, `/about`, `/team`.

### Stop Condition

As soon as a page yields a ranked email (§8), the engine stops — it does not
fetch the remaining pages for that lead.

### Edge Cases

| Situation | Behavior |
|---|---|
| `normalized_domain` is null/empty | Skip the lead entirely |
| Both base-URL variants fail | Skip the lead |
| A page returns 404 / non-200 | Skip that page, try the next |
| A page times out (5 s) | Skip that page, try the next |
| All pages fail | Lead remains without an email |

---

## 5. Concurrency Strategy

### The Rule

Always process **5 leads simultaneously**. Each lead walks its own URLs
**sequentially** (homepage → contact links → fallbacks). Different leads run in
parallel.

| Lead Volume | Behavior |
|---|---|
| 1 lead | 1 worker slot |
| 10 leads | two batches of 5 |
| 50 leads | ten batches of 5 |
| 100 leads | twenty batches of 5 |
| 500 leads | one hundred batches of 5 |

### Active Requests at Any Time

Because URLs within a lead run sequentially, the maximum number of in-flight
HTTP requests is **5** (one per lead) — not 20.

| Approach | Active requests | Risk | Speed |
|---|---|---|---|
| 5 leads × 4 URLs concurrently | 20 | Medium — looks like a burst | Fastest, risky |
| 5 leads, sequential URLs per lead | 5 | Low — natural pattern | Slightly slower, safer |

We choose the safer pattern. The ~10–20% speed cost is worth the much lower
block risk.

---

## 6. Batch Delay Strategy

### The Rule

Add a **0.5 s delay between batches**, but only when the run has **more than 50
leads**.

| Leads Selected | Delay Between Batches | Why |
|---|---|---|
| 1–50 | None | User is likely waiting at their desk |
| 51+ | 0.5 s | User has stepped away; be a good citizen |

### Example — 100 Leads

20 batches → 19 inter-batch delays → 19 × 0.5 s = 9.5 s of delay overhead.
Processing ≈ 30 s. Total ≈ 40 s.

---

## 7. Expected Performance

### Assumptions

| Factor | Value |
|---|---|
| Fast website response | 0.5 s |
| Normal website response | 1.5 s |
| Slow website response | 3.0 s |
| Timeout (counts as failure) | 5.0 s |

### Time Estimates

| Leads | Total Time (avg) | User leaves desk? |
|---|---|---|
| 1 | 1–2 s | No |
| 10 | 3–4 s | No |
| 25 | 8–10 s | No |
| 50 | ~15 s | No (stretch) |
| 100 | 35–40 s | Yes |
| 200 | 70–80 s | Yes |
| 500 | 175–200 s (~3 min) | Yes |
| 1000 | 350–400 s (~6 min) | Yes (lunch) |

### What the User Sees During a Bulk Run

The same active-run banner used for a Google Maps scrape, with: a live timer,
processed count, found count, failed count, skipped count, and a Stop button.

---

## 8. Email Extraction Method

> **Confirmed decision:** ranked strategy — `mailto:` first, body regex second,
> denylist applied to both, same-domain preference. **Not** "first match in HTML
> order" — that reliably picks up placeholders and asset strings.

Lives in `apps/scraper/src/extract-email.ts`.

### The Regex

```
[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}
```

Used as the matcher — but never as the sole selector. Selection is ranked.

### Step 1 — Decode HTML entities

Before matching, decode HTML entities so an encoded address resolves to a real
one. A tiny local helper covers both forms for the two characters that matter:

- `@` — numeric `&#64;` / `&#x40;` and named `&commat;`
- `.` — numeric `&#46;` / `&#x2e;` and named `&period;`

So `info&#64;site&#46;com` and `info&commat;site&period;com` both decode to
`info@site.com`. We do **not** handle `[at]` / `[dot]` text obfuscation or
JS-encoded emails — those are deliberate anti-scraping by the site owner and
are rare for local businesses.

### Step 2 — Collect candidates, ranked

1. **`mailto:` hrefs first.** Parse every `<a href="mailto:...">`. These are
   unambiguously real addresses and are where ~70%+ of legitimate contact
   emails live.
2. **Body-text regex second.** Only consulted if no `mailto:` candidate
   survives the denylist.

### Step 3 — Apply the denylist

Two layers, checked in order:

**Hard deny — exact domain match**
`example.com` · `domain.com` · `email.com` · `yourdomain.com` · `test.com` ·
`sentry.io` · `mailchimp.com` · `sendgrid.net` · `amazonaws.com` ·
`googletagmanager.com` · `google.com` · `facebook.com` · `schema.org`

**Hard deny — suffix match (blocks all subdomains too)**
`wixpress.com` (catches `sentry.wixpress.com`, `sentry-next.wixpress.com`, …) ·
`squarespace.com` · `shopify.com` · `myshopify.com` · `weebly.com` ·
`godaddy.com` · `zendesk.com` · `intercom.io` · `hubspot.com` ·
`klaviyo.com` · `mailgun.org` · `sparkpostmail.com`

**Also drop** any address ending in an image/asset extension
(`.png .jpg .svg .gif .webp .ico .woff .ttf .eot`) or containing `@2x` / `@3x`.

### Step 4 — Select the best surviving candidate

After the denylist, candidates are ranked through **four tiers**, stopping at
the first tier that produces a result:

```
┌─────────────────────────────────────────────────────────────────────────┐
│                    EMAIL SELECTION PRIORITY ORDER                       │
├──────┬──────────────────────────────────┬──────────────────────────────┤
│ Tier │ Condition                        │ Example                      │
├──────┼──────────────────────────────────┼──────────────────────────────┤
│  1   │ Same domain as lead's website    │ info@joespizza.com           │
│      │ (own-domain address)             │ contact@vitosnytrattoria.com │
├──────┼──────────────────────────────────┼──────────────────────────────┤
│  2   │ Non-free-mail, third-party       │ info@partneragency.com       │
│      │ business domain                  │ (rare — found on the page)   │
├──────┼──────────────────────────────────┼──────────────────────────────┤
│  3   │ Free-mail — ranked by local-part │ see sub-scores below ↓       │
│      │ (Gmail / Yahoo / Outlook / …)    │                              │
├──────┼──────────────────────────────────┼──────────────────────────────┤
│  —   │ No candidates survived           │ → null (lead stays blank)    │
└──────┴──────────────────────────────────┴──────────────────────────────┘

  Tier 3 — free-mail sub-scores (lower = better, first place wins)
  ┌─────────┬────────────────────────────────────────┬──────────────────────────────────────┐
  │ Score 0 │ Generic business handle                │ info@   contact@   hello@            │
  │         │ (business operating on free mail)      │ bookings@  reservations@  office@    │
  │         │                                        │ mail@  admin@  reception@  general@  │
  ├─────────┼────────────────────────────────────────┼──────────────────────────────────────┤
  │ Score 1 │ Owner / decision-maker signal          │ owner@   manager@   director@        │
  │         │ (high-value outreach target)           │ gm@  ceo@  president@  sales@        │
  ├─────────┼────────────────────────────────────────┼──────────────────────────────────────┤
  │ Score 2 │ Name-shaped local-part                 │ jane.smith@   carlos@                │
  │         │ (letters only, optional dot/hyphen)    │ eric.rynne@   frankleamy@            │
  ├─────────┼────────────────────────────────────────┼──────────────────────────────────────┤
  │ Score 3 │ Everything else                        │ x4j2k9@   frank1972leamy@            │
  │         │ (random strings, numbers, etc.)        │ 8eb368c6@                            │
  └─────────┴────────────────────────────────────────┴──────────────────────────────────────┘

  When no lead domain is known, Tier 1 & 2 are skipped and Tier 3 runs directly.
  Free-mail is never hard-denied — a sole trader may genuinely use Gmail.
```

### Step 5 — Normalize

Lowercase, trim, and dedupe. Return the single best candidate.

### Validation

Basic only: contains `@`, has characters before and after it, has a dot after
the `@`. MX-record / deliverability checks are **out of scope** for the MVP.

---

## 9. Request Configuration

### Headers

| Header | Value | Why |
|---|---|---|
| User-Agent | Chrome desktop (current) | Mimics a real browser |
| Accept | `text/html,application/xhtml+xml` | We want HTML |
| Accept-Language | `en-US,en;q=0.9` | English preference |

### Timeout

5 s per request via `AbortSignal.timeout(5000)`. On timeout, that URL is
skipped and the next URL for the same lead is tried.

### Retry Policy

| Scenario | Retry? | Why |
|---|---|---|
| Timeout | No | User can re-run enrichment later |
| 5xx server error | No | Unlikely to resolve in seconds |
| 404 Not Found | No | The page does not exist |
| Network error | No | Transient; re-run later |

**No in-session retries.** This keeps a batch predictable and fast.

---

## 10. robots.txt — Deliberate Decision

> **Confirmed decision:** the engine does **not** fetch or parse `robots.txt`.

This is intentional, not an oversight. Phase 6 fetches roughly four specific,
public, human-reachable pages per domain (homepage + a few contact pages) at
human-like rates. That is targeted page retrieval, not crawling. Fetching and
parsing `robots.txt` per domain would add a request and a failure mode for
near-zero practical benefit at this scope.

Instead, good-citizen behavior is enforced **structurally**:

- 5-concurrent cap (§5) — never a burst.
- 5 s timeout (§9) — slow servers are not hammered.
- Real User-Agent (§9) — honest identification.
- Zero retries (§9) — a failing server is left alone.
- 0.5 s batch delay for large runs (§6).

If enrichment is ever generalized beyond targeted contact-page retrieval, this
decision should be revisited.

---

## 11. Database Schema

### New Model — `EnrichmentRun`

Mirrors `ScrapeRun`. Tracks one enrichment job's lifecycle and progress.

| Column | Type | Notes |
|---|---|---|
| `id` | uuid | PK |
| `campaignId` | uuid | FK → `Campaign`, `onDelete: Cascade` |
| `status` | enum | `PENDING → RUNNING → COMPLETED \| FAILED \| CANCELLED` |
| `leadIds` | String[] | The worklist — which leads this run processes (§ Lead Selection) |
| `totalLeads` | int | Count of leads in this run (`leadIds.length` at queue time) |
| `processedCount` | int | Leads processed so far |
| `foundCount` | int | Emails successfully found |
| `failedCount` | int | Leads where no email was found |
| `skippedCount` | int | Leads skipped (already had an email) |
| `startedAt` | datetime? | Set when the worker claims it |
| `finishedAt` | datetime? | Set on terminal state |
| `durationSec` | int? | Wall-clock seconds |
| `errorMessage` | string? | Set on FAILED |
| `createdAt` | datetime | Default now |

A new enum `EnrichmentRunStatus` is added (same five values as
`ScrapeRunStatus`; kept separate so the two job types can evolve independently).

### Lead Selection

The queue endpoint receives a `leadIds` list, filters it to leads that still
lack an email, and stores the result in the run's **`leadIds` column**
(a Postgres native `String[]`). This is the worker's worklist — when it claims
the run it reads `leadIds` to know exactly which leads to process.

This is a single column on the run row, **not** a run↔lead join table. The
distinction matters: `leadIds` is just the worklist; it records no per-lead
*outcome*. The run's counters (`foundCount` / `failedCount` / `skippedCount`)
remain the source of truth for progress, and each lead carries its own result
in `leads.email`. If per-lead enrichment outcomes ever need auditing, a real
join table is the enhancement to add — see §19.

### No `lead_history` Rows for Email Enrichment

Email updates from enrichment are **not** logged to `lead_history`. That table
records deliberate user actions (status, notes). Enrichment is data population.
This matches the Phase 4 decision that the Email modal also does not write
history rows.

### Reused Column

Enrichment writes to the existing `leads.email` column — present since Phase 1.
No change to the `Lead` model.

---

## 12. API Routes

All under `apps/web/app/api/`. Shapes mirror the scrape endpoints so the web
client reuses its existing polling patterns.

### `POST /api/enrich`

Queues an enrichment run.

- Body: `{ campaignId: string, leadIds: string[] }`.
- Validates the campaign exists and is not ARCHIVED.
- Filters `leadIds` to leads that **do not already have an email** — the
  count removed is recorded as the run's initial `skippedCount`.
- If no leads remain after filtering → `409` with a clear message
  (UI shows "All selected leads already have emails").
- Creates a `PENDING` `EnrichmentRun`: stores the filtered list in the
  `leadIds` column (the worker's worklist) and sets `totalLeads` to its length.
- Returns `{ runId }` with `201`.

### `GET /api/enrich/[runId]`

Returns run status for polling:
`{ id, status, totalLeads, processedCount, foundCount, failedCount,
skippedCount, startedAt, finishedAt, errorMessage }`.

### `POST /api/enrich/[runId]/cancel`

Marks a `PENDING`/`RUNNING` run `CANCELLED`. The worker observes this between
batches and exits cleanly (mirrors `POST /api/scrape/[runId]/cancel`).

---

## 13. Worker Integration

### Job Claiming

The worker loop's claim step is extended to claim the oldest pending job of
**either** type. Implementation: claim a pending `scrape_runs` row or a pending
`enrichment_runs` row (the existing `FOR UPDATE SKIP LOCKED` query, applied to
whichever table has the older `created_at`), then dispatch:

- scrape run → existing `processScrapeJob`
- enrichment run → new `processEnrichmentJob`

### `processEnrichmentJob`

1. Mark the run `RUNNING`, set `startedAt`.
2. Read the run's `leadIds` column — that is the worklist. Load those leads.
   If a lead gained an email between queue time and now, count it as skipped
   (increment `skippedCount`) and drop it from the worklist.
3. Run `enrichLeads` in batches of 5 (§5), with the conditional batch delay
   (§6).
4. After each lead: if an email was found, update `leads.email` immediately and
   increment `foundCount`; otherwise increment `failedCount`. Always increment
   `processedCount`.
5. Between batches, check the run's DB status — if `CANCELLED`, throw
   `CancelledError` and stop (the Phase 3 pattern).
6. On normal completion: mark `COMPLETED`, set `finishedAt` + `durationSec`.
7. On `CancelledError`: leave the run `CANCELLED`, just set `durationSec` —
   already-found emails persist.
8. On any other error: mark `FAILED` with `errorMessage`.

### Orphan Reaper

The Phase 3 startup reaper is extended to also mark any `RUNNING`
`enrichment_runs` as `FAILED` ("Worker crashed or restarted before this run
completed").

### Crash Safety

Because each found email is written immediately (step 4), a worker crash never
loses progress — re-running enrichment simply skips the leads that now have
emails.

---

## 14. Single Enrichment Flow (UI)

> **Confirmed UI placement.** The entry point is the existing **Email modal**
> (Phase 4) — the one opened from a lead row's Email cell.

### Trigger & Modal

The Email modal keeps everything it has today — the email `Input` and the
Save/Clear button for manual entry. Phase 6 adds **one** button to it:
**"Find Email"**.

### Flow

1. User opens the Email modal on a lead.
2. User clicks **Find Email**.
3. The app queues a 1-lead `EnrichmentRun` (`POST /api/enrich`) and the modal
   **closes immediately**.
4. The active-run banner appears — the same banner used for a Google Maps
   scrape, but its text reads **"Email searching…"** instead of
   "Scraping in progress…". The live timer runs in the Stop button exactly as
   it does for a scrape.
5. When the run completes, a confirmation toast appears and — if an email was
   found — the email **appears live in that lead's row** (the leads table is
   already polling during an active run).
6. If no email was found, the toast says so and suggests adding one manually.

### Notes

- If the lead already has an email, **Find Email** is disabled (or the queue
  endpoint returns `409` and the UI shows "Email already exists").
- Manual entry via the same modal is unchanged — Find Email is purely additive.
- **Re-clicking Find Email while a run for that lead is already in flight** is
  harmless and needs no special guard for the MVP: the lead still has no email,
  so a second queued run simply re-enriches it. The worker writes the email the
  instant the first run finds it, after which any later run filters the lead
  out as already-enriched. A dedicated "is this lead in an active run" check is
  explicitly out of scope (it would require the run↔lead relationship §11
  deliberately avoids).

---

## 15. Bulk Enrichment Flow (UI)

> **Confirmed UI placement.** The entry point is the **floating bulk-actions
> pill** (Phase 4) — the same pill that already hosts Set status / Export /
> Delete.

### Trigger

1. User selects leads with the row checkboxes (existing behavior).
2. The floating pill gains a new action: **Find Email**.
3. Clicking it queues an N-lead `EnrichmentRun`.

### Pre-Flight

- The queue endpoint filters out leads that already have an email; the count
  removed is reported as `skippedCount`.
- If every selected lead already has an email → `409`; the UI shows a toast
  "All selected leads already have emails" and nothing is queued.

### Execution & Progress

The journey is identical to a Google Maps scrape:

- The active-run banner appears reading **"Email searching…"**.
- The live **timer** runs in the **Stop button** (same component, same
  behavior as Phase 4's scrape timer fix).
- The banner shows live counters: processed / found / failed / skipped.
- The leads table fills in emails **live** as the run progresses (it is already
  polling during an active run).
- A **Stop** button cancels the run; already-found emails are kept.

### Completion

- Success toast: "Enrichment complete — found N emails for M leads."
- The banner clears; the table shows the final state.

### Partial Success (Cancel)

If the user stops mid-run: already-found emails remain saved, the run shows
`CANCELLED` in history, and a toast reports how many emails were found before
the stop.

---

## 16. Error Handling

| Error | Behavior |
|---|---|
| Timeout (5 s) | Skip that URL, try the next URL for the lead |
| 404 / non-200 | Skip that URL, try the next |
| 5xx server error | Skip that URL, try the next |
| Network failure | Skip that URL, try the next |
| Invalid / null domain | Skip the lead entirely (counts as failed) |
| No email found anywhere | Lead remains without an email (counts as failed) |
| Worker crash mid-run | Found emails persist; orphan reaper marks the run FAILED; user re-runs |

A single lead failing never aborts the run — the batch continues.

---

## 17. What Enrichment Does NOT Do (MVP Scope)

| Feature | Status | Reason |
|---|---|---|
| Automatic enrichment during a scrape | ❌ | Would balloon scrape time |
| Overwrite an existing email | ❌ | User may have entered a better one |
| MX-record / deliverability validation | ❌ | Complexity, low MVP value |
| Visit LinkedIn / social profiles | ❌ | Out of scope |
| Handle contact forms (no visible email) | ❌ | Requires form submission |
| Scheduled / cron enrichment | ❌ | User controls when it runs |
| Email dedup across leads | ❌ | Different leads can share `info@company.com` |
| `[at]` / `[dot]` de-obfuscation, JS-encoded emails | ❌ | Deliberate anti-scraping; respect it |
| robots.txt fetching | ❌ | Deliberate — see §10 |
| Per-lead enrichment audit (run↔lead join table) | ❌ | Counters on the run row suffice for MVP |

---

## 18. Success Metrics for the MVP

| Metric | Target | Measurement |
|---|---|---|
| Email discovery rate | **55–70%** of leads | Run logs: found vs not found |
| Average time per lead (bulk) | 1–2 s | Wall-clock / lead count |
| Timeout rate | < 10% | Run logs |
| Feature adoption | Qualitative | Does the user use it? |

> The 55–70% target is deliberately honest. "No email anywhere" and
> "form-only contact" together are realistically 20%+ for local businesses.

**How it is measured:** the worker emits one INFO log line when a run finishes
— `enrichment complete { runId, found, failed, skipped, total }`. The discovery
rate is `found / (found + failed)` read off that line. No dashboard or stored
metric is built for the MVP; the run's own counters plus this log line are
enough to eyeball whether the feature lands in the target band.

---

## 19. Future Enhancements (Explicitly Out of MVP)

| Enhancement | When to consider |
|---|---|
| MX-record validation | If users report bounces |
| Re-check / refresh existing emails | If sites change often |
| Playwright fallback for AJAX-only sites | If miss rate exceeds 15% |
| Per-lead enrichment audit trail (join table) | If outcomes need history |
| `[at]`/`[dot]` de-obfuscation | If discovery rate is too low |
| Automatic background enrichment for new leads | If the user wants zero-touch |
| Export integration with outreach tools | User request |

---

## 20. Known Limitations

| Limitation | Impact | Mitigation |
|---|---|---|
| AJAX-loaded emails not captured | ~2–5% miss | Manual entry |
| Contact-form-only sites | ~5–10% miss | Manual entry |
| Shared-hosting rate limits | Occasional timeouts | Re-run later |
| Non-standard TLDs | Rare misses | Acceptable |
| Email only on a page not reached | Reduced by homepage-link scan (§4) | Re-run / manual |
| Two leads sharing a domain in one run | Same server hit ~twice concurrently | Acceptable for MVP — low probability; the 5-concurrent cap keeps it gentle |

---

## Slice Specifications

### Slice 6.1 — `EnrichmentRun` model + migration

**Status:** COMPLETED — `EnrichmentRunStatus` enum + `EnrichmentRun` model added to `prisma/schema.prisma`; `enrichmentRuns` relation added to `Campaign`; migration `add-enrichment-runs` applied.

- Add `EnrichmentRunStatus` enum and `EnrichmentRun` model to
  `prisma/schema.prisma` (§11), including the `leadIds String[]` worklist
  column.
- Generate and apply the migration.

**Test notes:** none — covered by later slices.

---

### Slice 6.2 — Email extraction core

**Status:** COMPLETED — `apps/scraper/src/extract-email.ts`; `extractEmail(html, leadDomain)` implements entity-decode → mailto: first → body regex fallback → denylist → same-domain preference → normalize.

`apps/scraper/src/extract-email.ts` — pure, no I/O.

- `extractEmail(html: string, leadDomain: string): string | null` implementing
  the ranked strategy of §8: entity decode → `mailto:` candidates → body regex
  → denylist → same-domain preference → normalize.

**Test notes:** unit-test with HTML fixtures — `mailto:` present, body-only,
denylisted asset strings, placeholder domains, same-domain preference,
entity-encoded `@`.

---

### Slice 6.3 — Enrichment engine

**Status:** COMPLETED — `apps/scraper/src/enrich.ts`; `enrichLead(domain)` resolves base URL, fetches homepage, follows up to 3 real contact links (falls back to guessed paths), stops at first email. `enrichLeads(leads, onProgress, isCancelled)` runs batches of 5 with conditional 0.5 s delay for >50 leads. `writeLeadEmail` writes found email to DB immediately.

`apps/scraper/src/enrich.ts`.

- `enrichLead(domain)` — resolve base URL (§4 step 1), fetch homepage, scan for
  contact links, walk pages, stop at first ranked email.
- `enrichLeads(leadIds, onProgress)` — batch of 5 (§5), conditional 0.5 s delay
  (§6), per-lead DB write on success, progress callback per lead.
- Request config per §9; no retries.

**Test notes:** unit-test URL resolution and link selection with fixtures;
engine-level test with a mocked `fetch`.

---

### Slice 6.4 — Worker integration

**Status:** COMPLETED — `reapOrphanRuns` extended to cover `enrichment_runs`; `claimNextJob` rewritten to claim oldest PENDING job from either table (releases the newer one if both ready); `processEnrichmentJob` implements full lifecycle (RUNNING → per-lead counters → COMPLETED/CANCELLED/FAILED); `runWorkerLoop` dispatches to the right processor by job type.

- Extend the claim step to claim either job type and dispatch (§13).
- `processEnrichmentJob` — lifecycle, batching, per-batch cancellation check,
  terminal-state handling.
- Extend the orphan reaper to cover `enrichment_runs`.

**Test notes:** integration test — queue an enrichment run, process it with a
mocked `fetch`, assert counters and `COMPLETED`.

---

### Slice 6.5 — API routes

**Status:** COMPLETED — `POST /api/enrich`, `GET /api/enrich/[runId]`, `POST /api/enrich/[runId]/cancel` implemented; shape mirrors scrape endpoints.

- `POST /api/enrich`, `GET /api/enrich/[runId]`,
  `POST /api/enrich/[runId]/cancel` (§12).

**Test notes:** integration test — queue (with the already-has-email filter),
poll, cancel.

---

### Slice 6.6 — Single enrichment UI

**Status:** COMPLETED — `EmailModal` updated with auto-find panel (gmaps-only, no existing email) and Re-find link (has existing email); `EnrichmentBanner` + `SearchingPill` components added; enrichment state machine wired into campaign detail page (polling, flash-on-found, completion/cancel toasts); "Find Email" added to bulk-actions pill.

- Add a **Find Email** button to the existing Email modal (§14).
- On click: queue a 1-lead run, close the modal, show the "Email searching…"
  banner, inject the email into the row on completion.

**Test notes:** manual — covered by the Phase 6 QA checklist.

---

### Slice 6.7 — Bulk enrichment UI

**Status:** COMPLETED — delivered as part of Slice 6.6. `handleFindEmails(leadIds[])` is one shared path; "Find Email" button in the bulk-actions pill calls it with all selected IDs. Same banner, same Stop button, same live table polling.

- Add a **Find Email** action to the floating bulk-actions pill (§15).
- Reuse the active-run banner + Stop-button timer; show live counters; table
  fills in live.

**Test notes:** manual — covered by the Phase 6 QA checklist.

---

### Slice 6.8 — Tests

**Status:** NOT STARTED

- Extraction unit tests (6.2).
- Engine tests with mocked `fetch` (6.3).
- Worker enrichment-flow integration test (6.4).
- API route tests (6.5).
- Cancellation test — partial emails persist, run ends `CANCELLED`.

---

## Definition of Done for Phase 6

- A user can find an email for one lead from the Email modal, and the result
  appears live in the row.
- A user can select many leads and bulk-enrich them, watching live progress in
  the same banner used for scraping, with a working Stop.
- Enrichment runs entirely through the worker — a page reload never loses it.
- Killing the worker mid-enrichment and restarting it auto-fails the orphan run;
  already-found emails persist.
- Discovery rate sits in the 55–70% band on real campaigns.
- All Phase 6 tests pass.
- Phase 6 marked `COMPLETED` in `PROJECT_PLAN.md`.
