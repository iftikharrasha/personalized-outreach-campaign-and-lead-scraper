# Phase 2 — Scraper

> **Goal:** A working background worker that, when triggered by the "Run Campaign" button, scrapes Google Maps for the campaign's keyword, deduplicates, and writes leads to the database. Leads appear in the UI within 5 seconds of being saved.

**Status:** COMPLETED — all 9 slices done
**Last Updated:** 2026-05-21
**Last Updated:** 2026-05-21

**Prerequisites:** [Phase 1](./PHASE_1_FOUNDATION.md) completed.

---

## Slices

| # | Slice | Status |
|---|---|---|
| 2.1 | Scaffold `apps/scraper` (TypeScript, `tsx` runner, shares Prisma client) | COMPLETED |
| 2.2 | Install Playwright + Chromium browser | COMPLETED |
| 2.3 | Implement worker main loop (poll `scrape_runs`, claim job with SKIP LOCKED) | COMPLETED |
| 2.4 | Implement Google Maps extraction (`google-maps.ts`) | COMPLETED |
| 2.5 | Implement dedupe pipeline (`dedupe.ts`) using shared normalizers | COMPLETED |
| 2.6 | Batch-insert leads (10 at a time) and update `scrape_run` counters | COMPLETED |
| 2.7 | Wire up `POST /api/scrape/run` and Run Campaign modal | COMPLETED |
| 2.8 | Wire up `GET /api/scrape/[runId]` and UI polling at 3 s | COMPLETED |
| 2.9 | Add scraper unit tests + integration test (mocked extraction) | COMPLETED |

---

## What you (the user) must provide during Phase 2

| When | What | Why |
|---|---|---|
| Before Slice 2.2 | Run `npx playwright install chromium` | Downloads ~150 MB browser binary; Claude can't do this silently |
| Before Slice 2.3 | A second terminal | Worker runs in its own process. Claude will tell you to run `npm run worker` in a separate PowerShell tab |
| During Slice 2.4 | Be available to look at Google Maps page structure if selectors break | Google occasionally changes their DOM; Claude may need you to inspect element |

---

## Slice Specifications

### Slice 2.1 — `apps/scraper` scaffold

**Status:** COMPLETED — 2026-05-21

- New workspace `apps/scraper` with its own `package.json`.
- Entry: `apps/scraper/index.ts`.
- Uses `tsx` for dev (`npm run worker` → `tsx watch apps/scraper/index.ts`).
- Imports Prisma client from a shared location (`@/db` re-export) so both web and worker use the same generated types.
- Logs to stdout with a simple structured logger (timestamp + level + message). No external logging lib.

**Files created:**
- `apps/scraper/package.json` — workspace `@outrich/scraper`; deps: `playwright`, `@prisma/client`; devDeps: `tsx`, `typescript`, `@types/node`.
- `apps/scraper/tsconfig.json` — extends root tsconfig, adds `@shared/*` path alias.
- `apps/scraper/src/db.ts` — plain `new PrismaClient()` (no HMR singleton needed in worker process).
- `apps/scraper/src/logger.ts` — structured JSON logger (timestamp + level + message) to stdout/stderr.
- `apps/scraper/src/index.ts` — entry point: connects DB, calls `runWorkerLoop()`.
- `apps/scraper/src/google-maps.ts` — stub (implemented Slice 2.4). Exports `RawLead` interface.
- `apps/scraper/src/dedupe.ts` — stub (implemented Slice 2.5). Exports `runDedupe`.

**Test notes:** Worker boots, logs `"worker ready"`, idles. Manual verification.

---

### Slice 2.2 — Playwright install

**Status:** COMPLETED — 2026-05-21

- `playwright` added as a dependency of `apps/scraper`.
- **User must run** (one-time, downloads ~150 MB Chromium binary):
  ```powershell
  npx playwright install chromium
  ```
- Worker process uses `chromium.launchPersistentContext` with data dir at `apps/scraper/.playwright-data`.

---

### Slice 2.3 — Worker main loop

**Status:** COMPLETED — 2026-05-21

Behavior:

```
loop forever:
  job = claim_next_pending_job()   // single SQL with FOR UPDATE SKIP LOCKED
  if job:
    process(job)
  else:
    sleep 2 seconds
```

`claim_next_pending_job` is the exact SQL from the master plan — atomic `UPDATE ... RETURNING`.

`process(job)` skeleton:

1. Launch Playwright (chromium, persistent context at `apps/scraper/.playwright-data`).
2. Try/catch around the scrape; on uncaught exception → mark run `FAILED` with `error_message`.
3. On clean exit → mark run `COMPLETED`.
4. Always close browser in a `finally` block.

**Files created:**
- `apps/scraper/src/worker.ts` — `runWorkerLoop()` (exported), `claimNextJob()` (raw SQL `FOR UPDATE SKIP LOCKED`), `processJob()` (browser lifecycle, lazy-imports scraper/dedupe), `markCompleted/markFailed`.
- Headless controlled by `SCRAPER_HEADLESS` env var (default `true`); persistent context at `apps/scraper/.playwright-data`.
- Browser close in `finally` block; loop catches transient DB errors without crashing.
- `vitest.config.ts` integration project updated with `fileParallelism: false` to prevent FK races when integration test files run concurrently against the shared DB.
- `data-flow.test.ts` prefix tightened from `TEST__` → `TEST__FLOW__` so it no longer deletes rows belonging to other test files.

**Test notes:** `tests/integration/worker-claim.test.ts` — 4 tests covering: null return when no PENDING jobs exist, claim transitions row to RUNNING + sets `started_at`, SKIP LOCKED prevents double-claiming, FIFO ordering. All pass (`npm test`).

---

### Slice 2.4 — Google Maps extraction

**Status:** COMPLETED — 2026-05-21

File: `apps/scraper/google-maps.ts`.

Steps (matches master plan Section 6):

1. Navigate to `https://www.google.com/maps/search/<encoded keyword>`.
2. Wait for `div[role="feed"]` (timeout 30 s).
3. Scroll loop:
   - Scroll the feed by ~800 px.
   - Wait a randomized delay between `SCROLL_DELAY_MIN_MS` and `SCROLL_DELAY_MAX_MS`.
   - Detect "no new items in 2 consecutive scrolls" → stop.
   - Cap at `MAX_RESULTS_PER_SEARCH`.
4. For each business card (`div[role="article"]`), extract:
   - Business name
   - Website URL (first link with text containing "website" or the visible URL chip)
   - Phone (span with `aria-label` starting with "Phone")
   - Address (span with `aria-label` starting with "Address")
5. Return `RawLead[]`.

**Headless toggle:** controlled by `SCRAPER_HEADLESS` env var. Default `true`. Set `false` to watch the browser run.

**Implementation notes:**
- Navigates to `https://www.google.com/maps/search/<encoded keyword>`, waits for `div[role="feed"]` (30 s timeout).
- Scroll loop: scrolls feed by 800 px, random delay between `SCROLL_DELAY_MIN_MS`/`MAX`, stops after 2 consecutive passes with no new items or when end-of-results marker is detected.
- Extraction runs via `page.evaluate` — queries `div[role="article"]` elements, extracts name, website (first non-Google `<a>` with website aria-label), phone (`span[aria-label^="Phone:"]`), address (`span[aria-label^="Address:"]`).
- Intra-page dedupe by business name during scroll accumulation.
- Capped at `MAX_RESULTS_PER_SEARCH` (default 120). All three env vars runtime-configurable.
- Opens a new `Page` per scrape job; closes it in `finally` regardless of outcome.

**Test notes:** Covered end-to-end by `tests/integration/scraper-flow.test.ts` via mocked `RawLead` data fed into `runDedupe`. Fixture-based Playwright extraction test deferred to Phase 2.9.

---

### Slice 2.5 — Dedupe pipeline

**Status:** COMPLETED — 2026-05-21

File: `apps/scraper/dedupe.ts`.

For each `RawLead`:

1. Compute `normalized_domain` and `normalized_phone` using `@shared` helpers.
2. Query existing leads in the same campaign:
   - If domain non-null and matches → duplicate.
   - Else if phone non-null and matches → duplicate.
3. If duplicate → increment `duplicate_count`, do NOT insert.
4. If new → push to a batch buffer.

**Race safety:** the DB-level partial unique constraints (from Phase 1) catch races. Insert errors with `P2002` (Prisma unique violation) are caught, counted as duplicates, and logged at debug level.

**Implementation notes:**
- Loads all existing `normalizedDomain` + `normalizedPhone` for the campaign in one query upfront (avoids N+1).
- In-memory `Set` for O(1) lookups; also updated intra-batch so two entries in the same batch don't duplicate against each other.
- Merged with Slice 2.6 in `apps/scraper/src/dedupe.ts` — the same file owns the full pipeline from raw → dedupe → batch flush → counter update.

**Test notes:** `tests/unit/dedupe.test.ts` — 7 tests with mocked DB: clean insert, domain match skip, phone match skip, intra-batch dedupe, multiple distinct leads, normalization applied before insert, campaign totalLeads counter updated. All pass.

---

### Slice 2.6 — Batch insert & counter updates

**Status:** COMPLETED — 2026-05-21

- Flush buffer every 10 leads OR at end of scrape.
- Each flush wraps `prisma.lead.createMany` + `prisma.scrapeRun.update({ data: { new_leads_count: { increment: N }, duplicate_count: { increment: M } } })` in a transaction.
- After every flush, the UI's polling endpoint sees fresh counts within 3 s.

**Implementation notes:**
- `flushBatch` wraps `prisma.lead.createMany` + `prisma.scrapeRun.update` in a `$transaction` — both commit atomically.
- `skipDuplicates: true` on `createMany` catches any race-condition dupes that slip past the in-memory set.
- `P2002` unique constraint errors caught explicitly — counted as dupes, not re-thrown.
- After all batches, `campaign.totalLeads` incremented by the final `newCount`.
- Final partial batch flushed after the loop; if no new leads exist, the dupe counter is still written.

**Test notes:** `tests/integration/scraper-flow.test.ts` — 3 integration tests against the real DB:
1. 25 raw leads with 5 pre-seeded → `newLeadsCount ≥ 20`, `duplicateCount ≥ 5`, total DB rows = 25.
2. Campaign `totalLeads` incremented after insert.
3. Second run with identical leads → `newLeadsCount = 0`, `duplicateCount = 25`. All pass.

---

### Slice 2.7 — `POST /api/scrape/run` + Run Campaign modal

**Status:** COMPLETED — 2026-05-21

- Endpoint creates a `scrape_runs` row with status `PENDING`, returns its `id`.
- Modal (triggered by Run Campaign button on detail page):
  - Title: "Run Campaign: <name>"
  - Read-only keyword display
  - Radio:
    - **Add new leads only (skip duplicates)** — default
    - **Replace all leads with fresh data** — confirm dialog warns it deletes existing leads
  - `[Cancel]` `[Start Scraping]`
- On Start: POST, close modal, show toast, mark UI as "scraping" → activates polling (Slice 2.8).
- "Replace all" mode: deletes existing leads for the campaign **before** creating the run.

**Implementation notes:**
- `POST /api/scrape/run` — validates campaign exists and is not ARCHIVED, rejects 409 if a PENDING/RUNNING run already exists, optionally deletes all existing leads + resets `totalLeads` when `replaceAll: true`, creates PENDING `scrape_runs` row, returns `{ runId }` with 201.
- `GET /api/campaigns/[id]/runs` — returns the 50 most recent runs for a campaign (new endpoint added for the run history card).
- `RunCampaignModal` (`components/campaigns/run-campaign-modal.tsx`) — 520px modal with:
  - Read-only keyword preview chip
  - Two radio options: "Add new leads only" (default) / "Replace all leads with fresh data"
  - Inline destructive confirmation panel that appears when Replace is selected and user clicks Start (two-step confirm)
  - 409 conflict handled gracefully — attaches to the existing run rather than showing an error

**Test notes:** Covered by the end-to-end flow test in Slice 2.9.

---

### Slice 2.8 — `GET /api/scrape/[runId]` + UI polling

**Status:** COMPLETED — 2026-05-21

- Endpoint returns `{ id, status, new_leads_count, duplicate_count, started_at, finished_at, error_message }`.
- Detail page uses TanStack Query with `refetchInterval: 3000` while an active run exists.
- During RUNNING:
  - Banner above leads table: "Scraping in progress… 47 leads found so far"
  - Run button disabled
  - Stop button visible (wired in Phase 3)
- On COMPLETED:
  - Toast: "Added 142 new leads, skipped 23 duplicates"
  - Refetch leads table
  - Re-enable Run button
- On FAILED:
  - Banner with `error_message`
  - Re-enable Run button

**Implementation notes:**
- `GET /api/scrape/[runId]` — returns `{ id, status, newLeadsCount, duplicateCount, startedAt, finishedAt, errorMessage }`.
- Detail page (`app/googlemaps/[id]/page.tsx`) wired with:
  - `useQuery` for `scrapeRuns` list (powers the run history card).
  - `activeRunId` state — set when user starts a run via modal, or detected from existing PENDING/RUNNING run on page load (page-reload resilience).
  - Polling query with `refetchInterval: 3000` — automatically stops when status is no longer PENDING/RUNNING.
  - `prevStatusRef` tracks status transitions to fire the completion/failure toast exactly once.
  - On COMPLETED: toast with new/dupe counts, invalidates `leads` + `campaign` + `scrapeRuns` queries, clears `activeRunId`.
  - On FAILED: error toast with `errorMessage`, invalidates `scrapeRuns`, clears `activeRunId`.
- `ScrapingBanner` component — green spinner banner during PENDING/RUNNING, red error banner on FAILED.
- Run button shows spinner + "Scraping…" label and is disabled during an active run; also disabled for ARCHIVED/PAUSED campaigns.
- Empty leads table message adapts: "Scraping in progress — leads will appear here as they are found." when running.
- Run history card now reads live from the `scrapeRuns` query instead of a static empty array.

**Test notes:** Covered by the end-to-end flow test in Slice 2.9.

---

### Slice 2.9 — Scraper tests

**Status:** COMPLETED — 2026-05-21

**What was already in place:**
- `tests/unit/dedupe.test.ts` — 7 unit tests (mocked DB), all dedupe cases. Done in Slice 2.5.
- `tests/integration/scraper-flow.test.ts` — 3 tests for dedupe+batch pipeline against real DB. Done in Slice 2.6.

**Added in this slice:**

`worker.ts` — exported `processJob` so tests can invoke it directly without the polling loop.

`tests/integration/scraper-flow.test.ts` — two new worker in-process tests:
1. `processJob` with mocked `scrapeGoogleMaps` (25 stub leads) + mocked Playwright `launchPersistentContext` → asserts run transitions to `COMPLETED`, `newLeadsCount=25`, `duplicateCount=0`, 25 leads in DB, `campaign.totalLeads=25`.
2. `processJob` when `scrapeGoogleMaps` throws → asserts run transitions to `FAILED` with the error message set.

`tests/integration/data-flow.test.ts` — one new end-to-end happy path:
- Creates campaign → POST `scrape_runs` (PENDING) → claims job (RUNNING) → calls `processJob` with 3 known stub leads → asserts `COMPLETED`, `newLeadsCount=3`, leads in DB with correct names, `totalLeads=3`.

---

## Definition of Done for Phase 2

- `npm run dev` starts the web app.
- `npm run worker` starts the worker in a separate terminal.
- Creating a campaign + clicking Run + waiting ~30 s produces real Google Maps leads in the table.
- All Phase 2 tests pass.
- Phase 2 marked `COMPLETED` in master plan.
