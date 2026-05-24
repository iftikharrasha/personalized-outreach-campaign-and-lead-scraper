# Phase 7 — Yelp API Adapter

> **Goal:** Add Yelp as a second lead source alongside Google Maps. Instead of
> scraping Yelp (against their TOS, technically fragile), use their official
> free API to fetch business data. Yelp leads flow through the same
> deduplication, the same leads table, and the same Phase 6 email enrichment as
> Google Maps leads.

**Status:** NOT STARTED
**Last Updated:** –

**Prerequisites:** [Phase 6](./PHASE_6_EMAIL_ENRICHMENT.md) completed.

---

## Slices

| # | Slice | Status |
|---|---|---|
| 7.1 | Campaign cursor columns + migration (`apiOffset`, `apiKeywordUsed`, `apiTotalAvailable`) | COMPLETED |
| 7.2 | Yelp API client (`yelp-client.ts`) — fetch, paginate, normalize to `RawLead` | COMPLETED |
| 7.3 | Yelp fetcher (`yelp-fetch.ts`) — offset resumption, batch loop, progress | COMPLETED |
| 7.4 | Worker source dispatch — route a run to Maps scraper or Yelp fetcher | COMPLETED |
| 7.5 | Create-campaign UI — source selector + Yelp-conditional fields | COMPLETED |
| 7.6 | `YelpRunModal` — first-run / resume, fetch-count input, error states | COMPLETED |
| 7.7 | Campaign card + Edit modal — Yelp badge, fetch progress, keyword lock | COMPLETED |
| 7.8 | Tests — API client, fetcher resumption, worker dispatch, error handling | NOT STARTED |

---

## What you (the user) must provide during Phase 7

| When | What | Why |
|---|---|---|
| Before Slice 7.2 | A Yelp Fusion API key in `.env` (`YELP_API_KEY`) | The client cannot call the API without it. Free key from yelp.com/developers |
| During Slice 7.8 | Acknowledge tests may make a few real Yelp API calls OR confirm fixtures-only | Some tests can run against recorded JSON fixtures instead of the live API |

---

## 1. Why Yelp API, Not Scraping

### The Decision

We use the **official Yelp Fusion API**. We do **not** scrape Yelp with
Playwright. This is a hard boundary for the phase.

### The Reasoning

| Factor | Scraping Yelp | Yelp Fusion API |
|---|---|---|
| Legality | Against TOS, real risk | Allowed, official |
| Stability | Blocks after 5–10 searches | 5000 requests/day free |
| Maintenance | DOM changes weekly | Stable, versioned |
| Infrastructure | Playwright + proxies | Plain HTTP fetch |
| Speed for 1000 leads | 15–20 min | 15–20 s |

The API is faster, legal, stable, and needs no browser. There is no case for
scraping Yelp.

---

## 2. Overview

### What This Phase Delivers

When creating a campaign the user picks a **source**:

- **Google Maps (scraping)** — the existing Phase 2–3 path, unchanged.
- **Yelp (API)** — the new path added here.

A Yelp campaign fetches business data from the Yelp Fusion API: business name,
phone, website, address. **No email** — exactly like Google Maps. The Phase 6
email-enrichment feature then finds emails for Yelp leads with **zero changes**,
because Yelp gives us the `website_url` that enrichment crawls.

### The Two Honest Differences From Google Maps

Yelp is not Google Maps with a different logo. It differs in exactly two
user-visible ways, and the design makes both **explicit** rather than hiding
them:

1. **A Yelp campaign's keyword is locked after its first run.** A Yelp campaign
   is a stateful cursor into one specific search — see §5. To search a different
   keyword, the user creates a new campaign.
2. **A Yelp run asks "how many businesses to fetch."** The Yelp API is
   paginated; the user chooses a fetch count. Google Maps just scrolls until it
   stops.

Everything else — worker, dedupe, leads table, enrichment, CSV export — is
shared and unchanged.

---

## 3. What Yelp Gives Us

| Yelp API field | Maps to `Lead` | Used by Phase 6 enrichment? |
|---|---|---|
| `name` | `businessName` | No |
| `phone` (E.164, e.g. `+16195551234`) | `phone` | No |
| `attributes.business_url` / `url` | `websiteUrl` | **Yes** — enrichment crawls it |
| `location.display_address[]` | `address` (joined) | No |
| `rating` | — (deferred, §17) | No |
| `review_count` | — (deferred, §17) | No |

> **Note on `website_url`.** The Yelp search endpoint's `url` field is the
> business's *Yelp page*, not its own website. The business's real website is
> not always present in the search response. Where it is missing, the lead is
> stored with `websiteUrl = null` — enrichment then skips it (a lead with no
> domain is skipped, per Phase 6 §4). This is an accepted limitation, see §16.

### The API Client Normalizes Into `RawLead`

The Yelp client's single job is to turn a Yelp API response into the **exact
same `RawLead` shape** the Google Maps scraper produces. Specifically:

- Yelp's E.164 `phone` is passed straight to the existing `normalizePhone`.
- Yelp's `display_address` array is joined into the single `address` string.
- The website (when present) is passed to the existing `normalizeDomain`.

Downstream — dedupe, the leads table, Phase 6 enrichment, CSV export — touches
**no Yelp-specific code**. Nothing downstream is "adapted." This is the whole
point of normalizing at the client boundary.

---

## 4. Yelp API Limits

| Limit | Value | Consequence |
|---|---|---|
| Businesses per request | 50 | Must paginate |
| Max offset | 950 | Hard ceiling of **1000** businesses per search |
| Requests per day (free tier) | 5000 | Far above our needs — not a real constraint |
| Location format | `City, State` (e.g. `San Diego, CA`) | **Cannot** search a whole state |

### Consequence — No Statewide Yelp Campaigns

Google Maps campaigns may target an entire state (no city). The Yelp API cannot.
Therefore **selecting Yelp as the source disables the "Entire State" option and
makes City required** in the Create Campaign form (§ Slice 7.5). This is a hard
form rule, enforced at creation — not a runtime error discovered later.

### Consequence — The 1000 Ceiling

A single Yelp search can yield at most 1000 businesses. A campaign cannot fetch
more than that for its keyword. The fetch-count input is capped at 1000 (§9).

---

## 5. The Yelp Campaign Is a Cursor — Keyword Lock

> **Confirmed decision:** a Yelp campaign's keyword is **locked after its first
> run**.

### Why

A Yelp campaign is not just "a search string." It is a **stateful cursor** into
one specific Yelp search: *this keyword, this city, fetched up to this offset*.
"Restaurants in San Diego, fetched 500 of 950" is a coherent, single-identity
thing.

If the keyword could change freely, a campaign could hold 500 "restaurants"
leads and 300 "pizza" leads — a split-identity campaign, with an offset cursor
that no longer means anything. That is exactly the confused system we are
avoiding.

### The Rule

- **Before the first run:** the keyword is freely editable. Nothing is committed
  yet — no offset, no leads.
- **After the first run:** the keyword field is **read-only** in the Edit
  Campaign modal. All other fields (name, notify email) remain editable.
- **To search a different keyword:** the user creates a new campaign. This is
  how people already think about searches — it costs them nothing real.

### What This Buys Us

Locking the keyword **eliminates**:

- An entire "keyword changed — keep or replace?" modal.
- The `keywordUsed` mismatch-detection logic and stale-offset bugs.
- A confusing question the user should never have to answer.

This is the *less* to build **and** the *less* to get wrong.

---

## 6. Database Schema

### Campaign — New Columns (the Yelp cursor)

The resumption cursor is **campaign-level state** that must persist across runs.
It lives on `Campaign`, **not** on `ScrapeRun` (a `ScrapeRun` is one execution;
the cursor outlives any single run).

| Column | Type | Notes |
|---|---|---|
| `apiOffset` | int, default `0` | Next Yelp offset to fetch from. `0` until the first run completes |
| `apiKeywordUsed` | string? | The keyword the cursor is valid for. Set on first run; with the keyword lock (§5) it never diverges from `keyword` |
| `apiTotalAvailable` | int? | What Yelp reported as `total` for this search. `null` until the first run — see §8 |

These are nullable / defaulted and are only meaningful for `source = "yelp"`
campaigns. Google Maps campaigns leave them at their defaults and ignore them.

> `apiKeywordUsed` is kept even though the keyword lock makes a mismatch
> impossible — it is a cheap integrity check and documents intent. It is **not**
> the basis of any keyword-change flow; there is no keyword-change flow.

### `source` Column — Already Exists

The `Campaign` model already has `source String @default("google_maps")` from
Phase 1. Phase 7 **uses** it (`"google_maps"` | `"yelp"`); it is **not** added.

### `ScrapeRun` — No Changes

`ScrapeRun` keeps exactly its current columns. A Yelp run reuses the same
`newLeadsCount` / `duplicateCount` / status lifecycle as a scrape run. The
worker reads the *campaign's* cursor, fetches, and updates the campaign's
`apiOffset` when done — the run row only logs that one execution's counts.

> **Reusing `ScrapeRun` for Yelp.** A Yelp fetch is still "a run against a
> campaign that produces leads." It reuses the `ScrapeRun` table and
> `ScrapeRunStatus` enum rather than introducing a `YelpRun` table — the
> lifecycle is identical (`PENDING → RUNNING → COMPLETED | FAILED | CANCELLED`)
> and run history stays unified. The job's *source* is determined by the
> campaign, not the run.

### `Lead` — No Changes

Yelp leads use the existing `Lead` columns. Rating / review count are **not**
added in this MVP (§17).

---

## 7. Configuration

| Setting | Where | Notes |
|---|---|---|
| `YELP_API_KEY` | `.env` (git-ignored) | Yelp Fusion API key. `.env.example` carries a `<your-yelp-api-key>` placeholder |

If `YELP_API_KEY` is missing or empty:

- The **Create Campaign** form, when Yelp is selected, shows an inline warning
  that no Yelp key is configured — so the user does not build a Yelp campaign
  that can never run.
- If a Yelp run is somehow queued without a key, the worker fails it fast with
  a clear `errorMessage` ("Yelp API key is missing or invalid") — the Phase 3
  failure pattern (§13).

---

## 8. The "Available" Number Is Unknown Until the First Fetch

Yelp returns the search's `total` **only in the response to the first API
call**. Before any run, the system genuinely does not know whether
"pizza in San Diego" yields 1000 businesses or 80.

The UI must respect this:

- **Before the first run** — no invented number. The run modal says
  *"Yelp returns up to 1,000 businesses per search,"* and the fetch-count input
  is capped at the API ceiling of 1000.
- **After the first run** — the real `total` is now known and stored in
  `apiTotalAvailable`. From then on the campaign card and the resume modal show
  the **real** number (e.g. "312 available").

`apiTotalAvailable` is `null` until the first run completes, and the UI keys off
that null to decide which copy to show. Never display a fabricated availability.

---

## 9. Fetch-Count Semantics — "Fetch Up To N Businesses"

> **Confirmed decision:** the user chooses how many *businesses to fetch*; the
> system fetches that many and reports the real outcome honestly. It does **not**
> chase "N new leads."

### Why

If the system chased "N *new* leads," dedupe drops would force unpredictable
extra requests, which can silently exhaust the 950-offset ceiling. Fetching a
fixed number of businesses keeps request count exact and predictable.

### How It Works

- The modal input is labelled **"How many businesses to fetch from Yelp?"** —
  never "how many leads."
- The system fetches `ceil(N / 50)` requests of 50 each, starting at the
  campaign's `apiOffset`.
- Dedupe runs as always (campaign-scoped unique constraints). Some fetched
  businesses may already be leads in this campaign and are counted as
  duplicates, not inserted.
- The result is reported **honestly** in the completion toast:
  *"Fetched 500 businesses — 440 new leads added, 60 already in this campaign."*

The user can end up with fewer *new* leads than the number they typed. That is
correct and expected; the honest label and honest toast make it not confusing.

### Clamping

If the user types more than what is available, the system fetches what exists
and stops. Capping rules:

- First run: input hard-capped at 1000 (the API ceiling).
- Resume run: input hard-capped at `apiTotalAvailable - apiOffset` (the leads
  not yet fetched).

---

## 10. How a Yelp Fetch Runs (Worker + Source Dispatch)

The existing worker (Phase 2–6) already claims jobs and dispatches by type
(scrape vs. enrichment). Phase 7 adds a **source** branch inside scrape-job
handling.

### Worker Dispatch

When the worker claims a `ScrapeRun`, it loads the run's campaign and branches
on `campaign.source`:

- `"google_maps"` → existing Playwright scraper (`processScrapeJob`, unchanged).
- `"yelp"` → new `processYelpJob`.

No new worker process. No new job table. The same claim loop, one extra branch.

### `processYelpJob` Flow

1. Mark the run `RUNNING`, set `startedAt`.
2. If `YELP_API_KEY` is missing → fail fast (§7).
3. Read the campaign's cursor: `apiOffset` (where to resume), `keyword`, `city`,
   `state`.
4. Determine the fetch target: the run carries the user's requested fetch count
   (see §11 on how it is passed). Compute the number of 50-item requests.
5. Loop — for each request: call the Yelp API at the current offset, normalize
   the 50 results into `RawLead[]`, hand the batch to the existing dedupe
   pipeline (the same `onBatch` contract scraping uses), increment offset by 50.
6. After each batch: update the run's counters and the campaign's `apiOffset`
   so progress survives a crash and the leads table fills in live.
7. On the **first ever** request for this campaign: capture the response's
   `total` into `apiTotalAvailable`.
8. Stop when the requested count is reached, the 950 offset ceiling is hit, or
   Yelp returns fewer than 50 (no more results).
9. A small courtesy delay (~0.1 s) between requests. Yelp's real limit is daily
   (5000/day), not a per-second burst — the delay is politeness, not a
   requirement.
10. On normal completion: mark `COMPLETED`, persist final `apiOffset`.
11. On `CancelledError` (user pressed Stop): leave the run `CANCELLED`, persist
    `apiOffset` at wherever the loop stopped — already-fetched leads and the
    advanced cursor both survive, so a later run resumes cleanly.
12. On API error: mark `FAILED` with a clear `errorMessage` (§15).

### Crash & Cancel Safety

Because `apiOffset` is advanced and persisted **per batch** (step 6), a crash or
cancel never loses progress and never re-fetches the same offsets. A subsequent
run resumes from the persisted cursor.

---

## 11. Pagination — The User Never Sees "Offset"

The user thinks in **businesses fetched**, never in offsets. The offset is the
campaign's private cursor.

### First Run

1. User opens a fresh Yelp campaign, clicks **Run**.
2. The `YelpRunModal` shows the keyword + location and says *"Yelp returns up to
   1,000 businesses per search."* (No real number yet — §8.)
3. User types a fetch count (e.g. 500).
4. The worker fetches 500 businesses (10 requests) starting at offset 0, then
   sets `apiOffset = 500` and `apiTotalAvailable` to Yelp's reported `total`.
5. The campaign card shows real progress, e.g. *"500 fetched · 950 available."*

### Resume (Same Keyword — Which Is the Only Possibility)

1. User clicks **Run** again on a campaign that already has an offset.
2. The `YelpRunModal` shows *"You've fetched 500 of 950. Fetch how many more?"*
   with the input capped at `950 − 500 = 450`.
3. The worker resumes from `apiOffset = 500`.

Because the keyword is locked (§5), "resume" is the **only** second-run case.
There is no keyword-changed branch, no keep/replace modal — by design.

### Fully Fetched

If `apiOffset >= apiTotalAvailable`, the campaign has fetched everything Yelp
has for this search. The `YelpRunModal` shows *"All 950 businesses for this
search have been fetched"* and the Run action is disabled.

---

## 12. The `YelpRunModal`

> A Yelp campaign opens a **different** run modal from a Google Maps campaign.

### Component Strategy

`YelpRunModal` is a **separate component** from `RunCampaignModal`, but it
**reuses the same `Modal` primitive and visual language**. The campaign's
`source` decides which modal opens — Maps campaigns open `RunCampaignModal`,
Yelp campaigns open `YelpRunModal`. Neither component carries conditional
branches for the other source.

### What It Shows

| State | Modal content |
|---|---|
| First run | Keyword + location · "Yelp returns up to 1,000 businesses per search" · fetch-count input (1–1000) · Start |
| Resume | Keyword + location · "You've fetched X of Y · fetch how many more?" · input (1 to `Y−X`) · Start |
| Fully fetched | "All Y businesses for this search have been fetched" · Run disabled |
| No API key | Inline warning "No Yelp API key configured" · Start disabled |

No technical terms — no "offset", no "pagination". The user types a number of
businesses. The "Add new leads only / Replace all" choice from the Maps modal
is **not** present: a Yelp resume always *adds* (it continues the cursor); a
full re-fetch is done by creating a new campaign.

---

## 13. Create-Campaign UI Changes

The Create Campaign modal gains a **Source** selector: *Google Maps (scraping)*
or *Yelp (API)*. Default: Google Maps.

Source-conditional behavior:

| When source = Google Maps | When source = Yelp |
|---|---|
| "Entire State" option available | "Entire State" **disabled**; City **required** (§4) |
| No API-key check | If `YELP_API_KEY` missing → inline warning, create allowed but flagged |
| Existing keyword/category presets | Same presets — keyword is just a search string here too |

The keyword field works the same at creation time for both sources. The Yelp
keyword lock (§5) only applies *after the first run*, enforced in the **Edit**
modal — not at creation.

---

## 14. Campaign Card + Edit Modal

### Campaign Card

- A **Yelp badge** distinguishes Yelp campaigns from Google Maps campaigns.
- For a Yelp campaign that has run, the card shows fetch progress in honest
  language: *"500 fetched · 950 available."* Before the first run it shows no
  availability number (§8).

### Edit Campaign Modal

- For a Yelp campaign **that has already run**, the keyword field is
  **read-only** (§5), with a short hint explaining why ("Yelp keyword is locked
  once a search has started — create a new campaign to search something else").
- For a Yelp campaign that has **not** run yet, the keyword is editable.
- Google Maps campaigns: the Edit modal is unchanged.

---

## 15. Error Handling

| Error | Behavior |
|---|---|
| `YELP_API_KEY` missing/empty | Run fails fast, `errorMessage` "Yelp API key is missing or invalid"; create form warns up front |
| API returns 401 / invalid key | Run `FAILED`, `errorMessage` "Yelp API key is invalid" |
| API returns 429 (rate limited) | Run `FAILED`, `errorMessage` "Yelp rate limit reached — try again tomorrow"; `apiOffset` persists so the next run resumes |
| Location not found by Yelp | Run `FAILED`, `errorMessage` "Yelp could not find that city" |
| Network error mid-fetch | Run `FAILED`; `apiOffset` persisted at the last good batch — next run resumes cleanly |
| Yelp returns 0 results at offset 0 | Run `COMPLETED` with 0 leads; toast "Yelp found no businesses for this search" |
| User cancels mid-fetch | Run `CANCELLED`; fetched leads and advanced `apiOffset` both persist |

The UI surfaces these on the run banner the same way Phase 3 surfaces a scrape
block — a clear message, no automatic retry.

---

## 16. What Doesn't Change

| Component | Status |
|---|---|
| `Lead` table schema | Unchanged — Yelp leads use the same columns |
| Deduplication | Unchanged — the existing campaign-scoped unique constraints (`campaignId` + `normalizedDomain` / `normalizedPhone`) handle Yelp leads exactly as they handle Maps leads. No new dedupe logic |
| Email enrichment (Phase 6) | Unchanged — Yelp leads carry `websiteUrl`, so enrichment crawls them with zero modification |
| Leads table UI / search / filter / sort / export | Unchanged |
| Worker process & job-claim loop | Unchanged — one extra `source` branch, no new process |
| `ScrapeRun` table & run history | Unchanged — Yelp runs reuse it |

---

## 17. What This Phase Does NOT Do (MVP Scope)

| Feature | Status | Reason |
|---|---|---|
| Scraping Yelp with Playwright | ❌ | Hard boundary — API only |
| Statewide Yelp campaigns | ❌ | Yelp API requires `City, State` |
| Editing a Yelp campaign's keyword after first run | ❌ | The campaign is a cursor (§5) — make a new campaign instead |
| Storing Yelp `rating` / `review_count` | ❌ | No `Lead` schema changes for MVP; can add later |
| A separate `YelpRun` table | ❌ | Yelp runs reuse `ScrapeRun` — identical lifecycle |
| "N new leads" fetch target | ❌ | Fetch-count is "N businesses" — predictable request count (§9) |
| Keyword-change keep/replace flow | ❌ | Eliminated by the keyword lock (§5) |
| Automatic re-fetch / scheduled Yelp runs | ❌ | User controls when a run happens |

---

## 18. Future Enhancements (Explicitly Out of MVP)

| Enhancement | When to consider |
|---|---|
| Store Yelp rating / review count on `Lead` | If the user wants to sort/filter leads by rating |
| Yelp categories filter (the API supports `categories`) | If keyword search proves too coarse |
| Cross-source dedupe (same business from Maps *and* Yelp) | If users run both sources for one area and want a merge |
| Multi-city Yelp campaigns | If users want one campaign spanning cities |
| Higher Yelp tier (paid) for >1000 results | If the 1000 ceiling becomes limiting |

---

## 19. Known Limitations

| Limitation | Impact | Mitigation |
|---|---|---|
| 1000-business ceiling per Yelp search | A keyword in a big city may have more businesses than reachable | Narrower keyword, or accept the cap |
| Yelp search response may omit a business's own website | That lead has `websiteUrl = null`; enrichment skips it | Manual email entry, same as today |
| `apiTotalAvailable` unknown until first run | First-run modal cannot show a real number | Modal copy says "up to 1,000" until the first run (§8) |
| Yelp `total` can shift slightly between runs | A resume's "remaining" count may be marginally off | Cosmetic only; the loop stops correctly on a short response |

---

## Slice Specifications

### Slice 7.1 — Campaign cursor columns + migration

**Status:** COMPLETED

- Add `apiOffset` (int, default 0), `apiKeywordUsed` (string?),
  `apiTotalAvailable` (int?) to the `Campaign` model (§6).
- Generate and apply the migration.

**Test notes:** none — covered by later slices.

---

### Slice 7.2 — Yelp API client

**Status:** COMPLETED

`apps/scraper/src/yelp-client.ts`.

- `fetchYelpBusinesses(keyword, location, offset)` — one Yelp Fusion
  `/businesses/search` call, returns `{ businesses: RawLead[], total: number }`.
- Normalizes each Yelp business into the existing `RawLead` shape (§3) —
  E.164 phone, joined `display_address`, website where present.
- Maps HTTP failures to typed errors the fetcher/worker can surface (§15).

**Test notes:** unit-test the normalizer with recorded Yelp JSON fixtures —
phone, multi-line address, missing website.

---

### Slice 7.3 — Yelp fetcher

**Status:** COMPLETED

`apps/scraper/src/yelp-fetch.ts`.

- `runYelpFetch(campaign, fetchCount, onBatch)` — resume from `campaign.apiOffset`,
  loop `ceil(fetchCount/50)` requests, hand each batch to the existing dedupe
  `onBatch` contract, advance and persist `apiOffset` per batch, capture
  `apiTotalAvailable` on the first request, stop on ceiling / short response /
  target reached / cancellation (§10).

**Test notes:** unit-test offset resumption and the stop conditions with a
mocked client; assert `apiOffset` persists per batch.

---

### Slice 7.4 — Worker source dispatch

**Status:** COMPLETED

- In the worker's scrape-job handling, branch on `campaign.source`:
  `"google_maps"` → existing scraper, `"yelp"` → `processYelpJob` (§10).
- `processYelpJob` — lifecycle, cursor read/write, error → `FAILED` mapping,
  cancellation handling.
- The orphan reaper already covers `RUNNING` scrape runs — a stuck Yelp run is
  reaped the same way (no change needed).

**Test notes:** integration test — queue a Yelp run, process it with a mocked
client, assert leads inserted, counters set, `apiOffset` advanced, `COMPLETED`.

---

### Slice 7.5 — Create-campaign UI

**Status:** NOT STARTED

- Add the **Source** selector (Google Maps / Yelp) to the Create Campaign modal.
- Yelp selected → disable "Entire State", require City, warn if `YELP_API_KEY`
  is absent (§13).

**Test notes:** manual — covered by the Phase 7 QA checklist.

---

### Slice 7.6 — `YelpRunModal`

**Status:** NOT STARTED

- New `YelpRunModal` component reusing the shared `Modal` primitive (§12).
- First-run / resume / fully-fetched / no-key states; fetch-count input with the
  correct cap per state (§9).
- Campaign-detail page opens `YelpRunModal` for Yelp campaigns, the existing
  `RunCampaignModal` for Google Maps campaigns.

**Test notes:** manual — covered by the Phase 7 QA checklist.

---

### Slice 7.7 — Campaign card + Edit modal

**Status:** NOT STARTED

- Campaign card: Yelp badge; "X fetched · Y available" progress for Yelp
  campaigns that have run (§14).
- Edit Campaign modal: keyword field read-only for a Yelp campaign that has
  already run, with an explanatory hint (§5, §14).

**Test notes:** manual — covered by the Phase 7 QA checklist.

---

### Slice 7.8 — Tests

**Status:** NOT STARTED

- API client normalizer unit tests (7.2).
- Fetcher resumption + stop-condition tests with a mocked client (7.3).
- Worker Yelp-dispatch integration test (7.4).
- Error-handling tests — missing key, 401, 429, location-not-found (§15).
- Cancellation test — `apiOffset` persists, run ends `CANCELLED`.

---

## Definition of Done for Phase 7

- A user can create a Yelp campaign, choose a fetch count, and watch Yelp leads
  land in the leads table in seconds.
- A second run on the same campaign resumes from where the last run stopped —
  the user never sees an offset.
- A Yelp campaign's keyword is locked after its first run; there is no
  keep/replace confusion.
- Yelp leads run through the existing dedupe and the existing Phase 6 email
  enrichment with zero source-specific code downstream.
- API errors (bad key, rate limit, bad location) fail the run with a clear
  message; the cursor survives so a later run resumes.
- All Phase 7 tests pass.
- Phase 7 marked `COMPLETED` in `PROJECT_PLAN.md`.
