# Phase 5 — QA & Hardening

> **Goal:** Verify the MVP holds up under real use. Tighten data-flow parity, run the full manual QA checklist, and lock the version.

**Status:** NOT STARTED
**Last Updated:** –

**Prerequisites:** [Phase 4](./PHASE_4_POLISH.md) completed.

---

## Slices

| # | Slice | Status |
|---|---|---|
| 5.1 | Data-flow parity test — full lifecycle end-to-end | NOT STARTED |
| 5.2 | Concurrency / race tests (dedupe under simultaneous inserts) | NOT STARTED |
| 5.3 | Manual QA checklist run-through | NOT STARTED |
| 5.4 | Performance pass — leads table with 1000 rows | NOT STARTED |
| 5.5 | Documentation pass — `README.md` for the repo | NOT STARTED |
| 5.6 | MVP sign-off | NOT STARTED |

---

## What you (the user) must provide during Phase 5

| When | What | Why |
|---|---|---|
| Slice 5.3 | About 30 minutes of click-testing | Manual QA can't be automated |
| Slice 5.6 | Final approval | Phase isn't done until you say so |

---

## Slice Specifications

### Slice 5.1 — Data-flow parity

**Status:** NOT STARTED

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

**Status:** NOT STARTED

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
[ ] Fresh DB → npm run dev → see empty state
[ ] Create campaign with each preset (Restaurants, Dentists, Lawyers, Custom)
[ ] Create campaign with statewide (no city)
[ ] Open detail page → all stats are zero
[ ] Click Run → modal appears → click Start → toast → banner appears
[ ] Wait ~30 seconds → leads appear in table
[ ] Run completes → success toast → stats update
[ ] Run AGAIN with "Add new leads only" → duplicate counter increases, total stays same
[ ] Run with "Replace all leads" → confirm dialog → previous leads gone, new set in
[ ] Change a lead's status → toast → badge updates → reload page → status persisted
[ ] Add a note → check lead_history via psql (one row per change)
[ ] Search "pizza" → only pizza-named leads visible
[ ] Filter to CONTACTED → only contacted leads visible
[ ] Sort by Updated descending → most recently edited first
[ ] Change page size to 100 → see all on one page
[ ] Select 5 leads → bulk update to IGNORED → all 5 update
[ ] Select 3 leads → bulk delete → confirm → gone
[ ] Export all → CSV downloads → opens in Excel correctly
[ ] Export filtered → CSV contains only filtered rows
[ ] Stop a running scrape → banner says "Stopping…" → run shows CANCELLED in history
[ ] Kill worker mid-scrape (Ctrl+C) → restart worker → orphan run becomes FAILED
[ ] Archive campaign → disappears from default list → reappears in Archived tab
[ ] Restore campaign → reappears in Active
[ ] Run history collapsible panel shows all past runs with correct stats
```

---

### Slice 5.4 — Performance

**Status:** NOT STARTED

- Seed 1000 leads in one campaign.
- Verify:
  - Detail page loads in <1 s
  - Search responds in <300 ms
  - Pagination doesn't lag
  - CSV export of all 1000 finishes in <5 s
- If any fail: add the right index, retry. Document any index added in this doc.

---

### Slice 5.5 — `README.md`

**Status:** NOT STARTED

Top-level `README.md` (this is the only `.md` Claude proactively creates outside `docs/`).

Sections:

- What it is (1 paragraph)
- Prerequisites (link to Phase 0)
- Quick start: `npm install`, `npx prisma migrate dev`, `npm run dev`, `npm run worker`
- Project structure (link to `docs/PROJECT_PLAN.md`)
- Development protocol (link to Section 7 of master plan)
- License placeholder

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
