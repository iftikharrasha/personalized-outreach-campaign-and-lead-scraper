# Phase 2 — Scraper

> **Goal:** A working background worker that, when triggered by the "Run Campaign" button, scrapes Google Maps for the campaign's keyword, deduplicates, and writes leads to the database. Leads appear in the UI within 5 seconds of being saved.

**Status:** NOT STARTED
**Last Updated:** –

**Prerequisites:** [Phase 1](./PHASE_1_FOUNDATION.md) completed.

---

## Slices

| # | Slice | Status |
|---|---|---|
| 2.1 | Scaffold `apps/scraper` (TypeScript, `tsx` runner, shares Prisma client) | NOT STARTED |
| 2.2 | Install Playwright + Chromium browser | NOT STARTED |
| 2.3 | Implement worker main loop (poll `scrape_runs`, claim job with SKIP LOCKED) | NOT STARTED |
| 2.4 | Implement Google Maps extraction (`google-maps.ts`) | NOT STARTED |
| 2.5 | Implement dedupe pipeline (`dedupe.ts`) using shared normalizers | NOT STARTED |
| 2.6 | Batch-insert leads (10 at a time) and update `scrape_run` counters | NOT STARTED |
| 2.7 | Wire up `POST /api/scrape/run` and Run Campaign modal | NOT STARTED |
| 2.8 | Wire up `GET /api/scrape/[runId]` and UI polling at 3 s | NOT STARTED |
| 2.9 | Add scraper unit tests + integration test (mocked extraction) | NOT STARTED |

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

**Status:** NOT STARTED

- New workspace `apps/scraper` with its own `package.json`.
- Entry: `apps/scraper/index.ts`.
- Uses `tsx` for dev (`npm run worker` → `tsx watch apps/scraper/index.ts`).
- Imports Prisma client from a shared location (`@/db` re-export) so both web and worker use the same generated types.
- Logs to stdout with a simple structured logger (timestamp + level + message). No external logging lib.

**Test notes:** Worker boots, logs `"worker ready"`, idles. Manual verification.

---

### Slice 2.2 — Playwright install

**Status:** NOT STARTED

- Add `playwright` as a dependency of `apps/scraper`.
- **Claude pauses here** and tells you to run:
  ```powershell
  npx playwright install chromium
  ```
- Claude verifies by listing the browser cache directory.

---

### Slice 2.3 — Worker main loop

**Status:** NOT STARTED

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

**Test notes:** Unit-test the SQL claim by inserting a PENDING row and asserting the claim returns it and flips status to RUNNING.

---

### Slice 2.4 — Google Maps extraction

**Status:** NOT STARTED

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

**Test notes:** Fixture-based test. Save a sample Google Maps HTML to `tests/fixtures/google-maps-sample.html`, mount it via Playwright's `page.setContent`, run the extraction, assert at least N businesses parsed.

---

### Slice 2.5 — Dedupe pipeline

**Status:** NOT STARTED

File: `apps/scraper/dedupe.ts`.

For each `RawLead`:

1. Compute `normalized_domain` and `normalized_phone` using `@shared` helpers.
2. Query existing leads in the same campaign:
   - If domain non-null and matches → duplicate.
   - Else if phone non-null and matches → duplicate.
3. If duplicate → increment `duplicate_count`, do NOT insert.
4. If new → push to a batch buffer.

**Race safety:** the DB-level partial unique constraints (from Phase 1) catch races. Insert errors with `P2002` (Prisma unique violation) are caught, counted as duplicates, and logged at debug level.

**Test notes:** Unit test in `tests/unit/dedupe.test.ts` — feed a mock DB and assert which leads are inserted.

---

### Slice 2.6 — Batch insert & counter updates

**Status:** NOT STARTED

- Flush buffer every 10 leads OR at end of scrape.
- Each flush wraps `prisma.lead.createMany` + `prisma.scrapeRun.update({ data: { new_leads_count: { increment: N }, duplicate_count: { increment: M } } })` in a transaction.
- After every flush, the UI's polling endpoint sees fresh counts within 3 s.

**Test notes:** Integration test asserts that after a mocked extraction of 25 leads (with 5 duplicates seeded), the run record has `new_leads_count=20`, `duplicate_count=5`.

---

### Slice 2.7 — `POST /api/scrape/run` + Run Campaign modal

**Status:** NOT STARTED

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

**Test notes:** Integration test asserts row creation + that worker picks it up within 4 s (sleep + assertion).

---

### Slice 2.8 — `GET /api/scrape/[runId]` + UI polling

**Status:** NOT STARTED

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

**Test notes:** Smoke test via mock fetch — polling hook stops after status becomes COMPLETED.

---

### Slice 2.9 — Scraper tests

**Status:** NOT STARTED

- `tests/unit/dedupe.test.ts` (from Slice 2.5)
- `tests/integration/scraper-flow.test.ts`:
  - Seed a campaign.
  - Insert a PENDING `scrape_runs` row.
  - Start the worker in-process (function call, not subprocess).
  - Mock Playwright with a stub that returns 25 known leads.
  - Assert: run goes to RUNNING then COMPLETED, 25 leads inserted, counters correct.
- Extend `tests/integration/data-flow.test.ts` with one end-to-end happy path that uses the mocked scraper.

---

## Definition of Done for Phase 2

- `npm run dev` starts the web app.
- `npm run worker` starts the worker in a separate terminal.
- Creating a campaign + clicking Run + waiting ~30 s produces real Google Maps leads in the table.
- All Phase 2 tests pass.
- Phase 2 marked `COMPLETED` in master plan.
