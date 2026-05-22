# Phase 3 — Reliability

> **Goal:** Make scrapes survive the real world. Detect Google blocks, recover from crashes, support clean cancellation, and ensure the UI never gets stuck.

**Status:** COMPLETED
**Last Updated:** 2026-05-21

**Prerequisites:** [Phase 2](./PHASE_2_SCRAPER.md) completed.

---

## Slices

| # | Slice | Status |
|---|---|---|
| 3.1 | Block detection (`detectBlock`) — soft, hard, IP ban | COMPLETED |
| 3.2 | Block handling: stop scrape, mark FAILED, surface in UI | COMPLETED |
| 3.3 | Smart waits — replace fixed timeouts with `waitForSelector` / `waitForFunction` | COMPLETED |
| 3.4 | Random user-agent rotation per run | COMPLETED |
| 3.5 | Worker crash recovery — orphan run reaper | COMPLETED |
| 3.6 | `POST /api/scrape/stop` + Stop Scraping button | COMPLETED |
| 3.7 | Run history table on campaign detail page (collapsed by default) | COMPLETED |
| 3.8 | Tests for block detection, cancellation, orphan recovery | COMPLETED |

---

## What you (the user) must provide during Phase 3

| When | What | Why |
|---|---|---|
| Before Slice 3.4 | Confirm the user-agent JSON in `.env` is filled in | Default has placeholders; Claude prompts you to paste real UA strings |
| During Slice 3.5 | Acknowledge that Claude will deliberately kill the worker mid-scrape to test recovery | Manual integration test |

---

## Slice Specifications

### Slice 3.1 — Block detection

**Status:** NOT STARTED

File: `apps/scraper/block-detection.ts`.

```
detectBlock(page) → { type: 'RATE_LIMIT' | 'CAPTCHA' | 'IP_BAN' | 'NONE', severity: 'soft' | 'hard' }
```

Checks page text for:

- "detected unusual traffic" → `RATE_LIMIT`, soft
- "Enter the characters" / `iframe[src*="recaptcha"]` → `CAPTCHA`, hard
- "Access denied", HTTP 403 → `IP_BAN`, hard

Called:

- Immediately after navigation
- Every 5 scrolls during the scroll loop

**Test notes:** Unit-test with stub pages that contain each trigger string.

---

### Slice 3.2 — Block handling

**Status:** NOT STARTED

When `detectBlock` returns non-NONE:

1. Throw `BlockedError(type, severity)`.
2. Worker catches it, marks the run `FAILED` with `error_message = "Blocked by Google: <type>"`.
3. UI banner: "Scrape blocked by Google (rate limit). Please wait ~1 hour and retry." — wording varies by type.
4. No automatic retry.

**Test notes:** Integration test injects a blocked HTML fixture and asserts the run ends FAILED with the right message.

---

### Slice 3.3 — Smart waits

**Status:** COMPLETED

Audited `apps/scraper/google-maps.ts` and replaced:

- `page.waitForTimeout()` content waits → `page.waitForSelector` / `page.waitForFunction`.
- Detail-panel extraction waits for the panel's `role="main"` `aria-label` to become
  a real business name (`waitForFunction`), not a fixed sleep.
- Random delays kept ONLY between cards/scrolls (human-pause mimicry) via `randomDelay()`.
- Detail panels are now scraped **in-place** (no `page.goto()` reload per lead) — this
  eliminated the ~30 s/lead slowdown and the stale "ফলাফল" heading bug.

**Test notes:** No new test; existing scraper tests still pass and run faster.

---

### Slice 3.4 — User-agent rotation

**Status:** NOT STARTED

- Read `USER_AGENTS` env var (JSON array).
- On each worker job, pick one at random.
- Set on Playwright context via `userAgent` option.
- Match viewport size to UA family (desktop UAs → 1280×720, no mobile UAs in pool).

**Claude pauses here** if `USER_AGENTS` is still placeholder. Asks you to paste real strings (Claude suggests 5 current Chrome desktop UA strings).

---

### Slice 3.5 — Orphan run reaper

**Status:** NOT STARTED

Problem: if the worker process dies mid-scrape, a `scrape_runs` row stays at RUNNING forever. The UI thinks a scrape is active. New runs can't start cleanly.

Solution: on worker startup, before the main loop:

```sql
UPDATE scrape_runs
SET status = 'FAILED',
    error_message = 'Worker crashed or restarted before this run completed',
    finished_at = NOW()
WHERE status = 'RUNNING';
```

Logged at INFO level with the count.

**Test notes:** Integration test — start worker, claim a job, kill the worker process, restart, assert the orphan run becomes FAILED.

---

### Slice 3.6 — Stop Scraping

**Status:** NOT STARTED

- `POST /api/scrape/stop` with `{ runId }`:
  - Marks run `CANCELLED` in DB (if currently RUNNING or PENDING).
- Worker checks run status before each scroll iteration. If CANCELLED, throws `CancelledError`, exits cleanly, leaves the cancellation status in place.
- UI: Stop button on the banner. After click, banner becomes "Stopping…", then disappears when worker confirms.

> Per Locked Decision 3: this is **cancel**, not pause. Existing inserted leads stay. No resume.

**Test notes:** Integration test — start a run, send stop, assert worker exits and status is CANCELLED.

---

### Slice 3.7 — Run history table

**Status:** NOT STARTED

- Below the leads table on the campaign detail page, a collapsible "Run History" panel.
- Columns: Started At, Finished At, Status, New Leads, Duplicates, Error.
- Sorted newest first, paginated 10 per page.

**Test notes:** Smoke test only.

---

### Slice 3.8 — Reliability tests

**Status:** NOT STARTED

- Block detection unit tests (3.1)
- Block flow integration test (3.2)
- Orphan reaper integration test (3.5)
- Cancel integration test (3.6)
- Add data-flow parity assertion: after a CANCELLED run, partial leads must equal the count the worker reported having flushed before cancel.

---

## Definition of Done for Phase 3

- A run that hits a block ends FAILED with a clear UI message.
- A user can click Stop and the worker exits cleanly within ~3 s.
- Killing `npm run worker` mid-scrape and restarting it auto-fails the orphan run.
- All Phase 3 tests pass.
- Phase 3 marked `COMPLETED` in master plan.
