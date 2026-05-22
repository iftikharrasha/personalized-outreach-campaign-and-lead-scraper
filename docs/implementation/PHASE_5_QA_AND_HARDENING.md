# Phase 5 — QA & Hardening

> **Goal:** Verify the MVP holds up under real use. Tighten data-flow parity, run the full manual QA checklist, and lock the version.

**Status:** IN PROGRESS — 5.1/5.2/5.4/5.5 done; 5.3 (manual QA) + 5.6 (sign-off) need the user
**Last Updated:** 2026-05-22

**Prerequisites:** [Phase 4](./PHASE_4_POLISH.md) completed.

---

## Slices

| # | Slice | Status |
|---|---|---|
| 5.1 | Data-flow parity test — full lifecycle end-to-end | COMPLETED |
| 5.2 | Concurrency / race tests (dedupe under simultaneous inserts) | COMPLETED |
| 5.3 | Manual QA checklist run-through | NOT STARTED — needs the user |
| 5.4 | Performance pass — leads table with 1000 rows | COMPLETED |
| 5.5 | Documentation pass — `README.md` for the repo | COMPLETED |
| 5.6 | MVP sign-off | NOT STARTED — needs the user |

---

## What you (the user) must provide during Phase 5

| When | What | Why |
|---|---|---|
| Slice 5.3 | About 30 minutes of click-testing | Manual QA can't be automated |
| Slice 5.6 | Final approval | Phase isn't done until you say so |

---

## Slice Specifications

### Slice 5.1 — Data-flow parity

**Status:** COMPLETED — `data-flow.test.ts` › "full lifecycle (Slice 5.1)"

The big test. Lives in `tests/integration/data-flow.test.ts`.

Asserts the **entire lifecycle** in one scenario:

1. Create campaign.
2. Trigger scrape (mocked extraction returns 50 leads with 10 known duplicates).
3. Assert: 40 leads inserted, 10 duplicates counted, scrape_run COMPLETED.
4. Update 5 leads to CONTACTED (one-by-one inline edits).
5. Update 3 of those to REPLIED.
6. Bulk-update 10 remaining leads to IGNORED.
7. Add notes to 2 leads.
8. Assert: `lead_history` contains exactly the right number of rows of the right shapes.
9. Search for a known string, assert correct subset returned.
10. Export filtered to CSV, parse the CSV, assert headers + row count.
11. Cancel a fresh scrape mid-flight, assert partial leads remain and status is CANCELLED.
12. Archive the campaign, assert it disappears from default list view.

---

### Slice 5.2 — Race tests

**Status:** COMPLETED — `tests/integration/race.test.ts`

- Spin up two workers in-process simultaneously (same DB).
- Both try to claim the same PENDING job.
- Assert exactly one wins (SKIP LOCKED works).
- Spin up a single worker but issue two concurrent `createMany` calls with overlapping domains.
- Assert no constraint violations bubble up; duplicates correctly counted.

---

### Slice 5.3 — Manual QA checklist

**Status:** NOT STARTED

Claude prints this checklist; you go through it and mark each line. Claude updates the doc when you say "QA done."

```
SHELL & NAVIGATION
[ ] Fresh DB → npm run dev → shell renders, sidebar + breadcrumb visible
[ ] Sidebar collapse toggle works; "Coming soon" Yelp/LinkedIn are disabled
[ ] Dark-mode toggle works and survives a page reload
[ ] / → Manager dashboard · /googlemaps → list · /googlemaps/[id] → detail

DASHBOARD
[ ] Manager dashboard renders against an empty DB without errors
[ ] After scrapes + a CLOSED lead with a raised amount → funnel, earnings, and Winning Leads update
[ ] Block-cooldown card counts down per second; shows "Clear to run" when no block

CAMPAIGNS
[ ] Create campaign with each preset (Restaurants, Dentists, Lawyers, Custom)
[ ] Create campaign statewide (no city) → keyword preview uses the state
[ ] Edit campaign → change fields + set a client email → Save (disabled until dirty)
[ ] Open detail page → all stats are zero

SCRAPING
[ ] Click Run → modal appears → click Start → toast → banner appears
[ ] Wait ~30 seconds → leads appear in table
[ ] Run completes → success toast → stats update
[ ] Run AGAIN with "Add new leads only" → duplicate counter increases, total stays same
[ ] Run with "Replace all leads" → destructive warning → previous leads gone, new set in
[ ] Stop a running scrape → banner says "Stopping…" → run shows CANCELLED in history
[ ] Kill worker mid-scrape (Ctrl+C) → restart worker → orphan run becomes FAILED

LEADS
[ ] Change a lead's status (portaled dropdown) → toast → reload → status persisted
[ ] Add a note → check lead_history via psql (one row per change)
[ ] Add an email via the Email modal → persists; invalid format is rejected
[ ] Search "pizza" → only matching leads visible (name/phone/email/notes)
[ ] Filter to CONTACTED → only contacted leads visible
[ ] Sort by Updated descending → most recently edited first
[ ] Change page size to 100 → see all on one page
[ ] Select 5 leads → bulk update to IGNORED → all 5 update
[ ] Select 3 leads → bulk delete → confirm → gone
[ ] Export all → CSV downloads → opens in Excel correctly (Email column present)
[ ] Export filtered → CSV contains only filtered rows

CAMPAIGN LIFECYCLE
[ ] Archive campaign → disappears from default list → reappears in Archived tab
[ ] Restore campaign → reappears in Active
[ ] Per-campaign run history shows past runs; dashboard run history shows all
```

---

### Slice 5.4 — Performance

**Status:** COMPLETED — `tests/integration/performance.test.ts`. 1000-lead
seed: leads-list query, search, and status-filter all well under budget; CSV
export of 1000 rows under 5 s. No new index needed — the existing
`leads(campaignId)` and `leads(status)` indexes already cover these queries.

- Seed 1000 leads in one campaign.
- Verify:
  - Detail page loads in <1 s
  - Search responds in <300 ms
  - Pagination doesn't lag
  - CSV export of all 1000 finishes in <5 s
- If any fail: add the right index, retry. Document any index added in this doc.

---

### Slice 5.5 — `README.md` final pass

**Status:** COMPLETED — `README.md` rewritten to reflect the shipped app:
operator-focused quick-start (install → migrate → playwright install → dev +
worker), accurate routes, project-structure tree, and command reference.

A top-level `README.md` already exists (the operator-facing doc). This slice updates it so it reflects the shipped app:

- Confirm the project-structure tree, routes (`/`, `/googlemaps`, `/googlemaps/[id]`), and run commands are accurate.
- Confirm the quick-start works end-to-end: `npm install` → `npx prisma migrate dev` → `npm run dev` + `npm run worker`.
- Keep it simple and operator-focused — no implementation detail.

---

### Slice 5.6 — MVP sign-off

**Status:** NOT STARTED

When all of the following are true, you mark this slice COMPLETED and the MVP is shipped (to localhost):

- Every MVP Definition-of-Done item in `PROJECT_PLAN.md` Section 6 is checked.
- All tests green (`npm run test`).
- Manual QA checklist (5.3) fully passed.
- Performance bar (5.4) met.
- `README.md` present.

Claude updates the master plan progress table one last time. Done.

---

## Definition of Done for Phase 5

- The MVP is provably correct (tests) and provably usable (manual QA).
- Performance is acceptable at 1000 leads.
- A new person could clone the repo, follow the README, and have it running in <30 minutes.
