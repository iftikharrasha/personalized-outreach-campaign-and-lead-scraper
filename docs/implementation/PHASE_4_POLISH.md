# Phase 4 — Polish

> **Goal:** Make the leads table usable for real outreach. Inline status edits, notes with audit trail, search + filter, bulk operations, CSV export, toasts everywhere.

**Status:** NOT STARTED
**Last Updated:** –

**Prerequisites:** [Phase 3](./PHASE_3_RELIABILITY.md) completed.

---

## Slices

| # | Slice | Status |
|---|---|---|
| 4.1 | Inline status edit (click badge → dropdown → persist + toast) | NOT STARTED |
| 4.2 | Notes column — inline edit modal + `lead_history` audit row | NOT STARTED |
| 4.3 | Search input (name / phone / notes, debounced) | NOT STARTED |
| 4.4 | Status filter dropdown + URL persistence | NOT STARTED |
| 4.5 | Sortable columns (Name, Status, Updated) | NOT STARTED |
| 4.6 | Pagination (25 / 50 / 100 per page) | NOT STARTED |
| 4.7 | Bulk selection (checkbox column + select-all) | NOT STARTED |
| 4.8 | Bulk status update + bulk delete (with confirm) | NOT STARTED |
| 4.9 | CSV export (all / filtered / selected) | NOT STARTED |
| 4.10 | Stats row live counts (NEW / CONTACTED / Conversion Rate) | NOT STARTED |
| 4.11 | Tests for status transitions, audit trail, bulk ops, export | NOT STARTED |

---

## What you (the user) must provide during Phase 4

Nothing new — this phase is purely web work. No env changes, no manual installs.

---

## Slice Specifications

### Slice 4.1 — Inline status edit

**Status:** NOT STARTED

- Status badge in the leads table is a dropdown trigger.
- On selection: optimistic update, `PUT /api/leads/[id]/status`, toast "Status updated to CONTACTED".
- On error: revert + error toast.
- Endpoint also writes a `lead_history` row: `previous_status`, `new_status`, `note = null`, `changed_at = NOW()`.

**Test notes:** Integration test — change status, assert lead row updated AND lead_history row inserted.

---

### Slice 4.2 — Notes + audit

**Status:** NOT STARTED

- Notes cell shows first 50 chars + ellipsis if longer.
- Click → inline textarea (or modal on mobile widths).
- Save → `PUT /api/leads/[id]/notes` with `{ notes, auditNote? }`.
- Endpoint writes `lead_history` row: `previous_status = null`, `new_status = null`, `note = <auditNote or "Notes updated">`, `changed_at = NOW()`.

**Test notes:** Integration test asserts both the lead row update AND the audit row.

---

### Slice 4.3 — Search

**Status:** NOT STARTED

- Input above the leads table, placeholder "Search name, phone, or notes…".
- Debounced 300 ms.
- Server-side: `WHERE business_name ILIKE %q% OR phone LIKE %q% OR notes ILIKE %q%`.
- Backed by `GET /api/campaigns/[id]/leads?q=...`.

**Test notes:** Integration test seeds 3 leads, queries with `q`, asserts only matches return.

---

### Slice 4.4 — Status filter

**Status:** NOT STARTED

- Select above table: All / NEW / CONTACTED / REPLIED / IGNORED / CLOSED.
- Persists to URL (`?status=CONTACTED`).
- Backend: filter in same `/leads` endpoint.

**Test notes:** Integration test covers each value.

---

### Slice 4.5 — Sortable columns

**Status:** NOT STARTED

- Clickable headers for Name, Status, Updated.
- URL params: `sort=name&dir=asc`.
- Backend orderBy clause.

**Test notes:** Integration test with 3 known leads, assert order.

---

### Slice 4.6 — Pagination

**Status:** NOT STARTED

- Footer: page size select (25/50/100), prev/next, current range ("Showing 1-25 of 142").
- URL params: `page=2&pageSize=50`.

**Test notes:** Integration test — seed 60 leads, assert page 1 has 25, page 3 has 10.

---

### Slice 4.7 — Bulk selection

**Status:** NOT STARTED

- Checkbox column.
- Header checkbox = select all on current page (indeterminate if mixed).
- Selection persists across pagination via in-memory `Set<leadId>`.
- "Selected (N)" indicator above table when any selection exists.

**Test notes:** Component test for selection state.

---

### Slice 4.8 — Bulk operations

**Status:** NOT STARTED

- When N>0 selected, action bar shows: `Bulk Status Update` (select), `Bulk Delete`, `Export Selected`.
- `PUT /api/leads/bulk-status` accepts `{ ids: string[], status: LeadStatus }`. Writes lead_history rows for each.
- `DELETE /api/leads/bulk` accepts `{ ids }`. Confirm modal shows count + warning.

**Test notes:** Integration tests for both endpoints, including audit rows on bulk-status.

---

### Slice 4.9 — CSV export

**Status:** NOT STARTED

- `GET /api/campaigns/[id]/export?scope=all|filtered|selected&ids=...&filters=...`
- Streams CSV with columns: Business Name, Phone, Website, Normalized Domain, Status, Notes, Address, Created At, Last Updated.
- Filename: `<campaign-name-slug>_YYYY-MM-DD.csv`.

**Test notes:** Integration test asserts content-type, headers, and that row count matches scope.

---

### Slice 4.10 — Stats live counts

**Status:** NOT STARTED

- 4 cards at top of detail page get real data:
  - Total Leads
  - New (status NEW)
  - Contacted (CONTACTED + REPLIED)
  - Conversion Rate = (REPLIED + CLOSED) / (CONTACTED + REPLIED + CLOSED), shown as %, "—" if denominator 0
- Backed by `GET /api/campaigns/[id]` (extend with stats payload).

**Test notes:** Integration test asserts stats calculation.

---

### Slice 4.11 — Polish tests

**Status:** NOT STARTED

- Combine all of the above into the `data-flow.test.ts` parity suite.
- Add one big scenario test: "outreach lifecycle" — create campaign, scrape (mocked), change statuses, add notes, search, filter, bulk delete, export. Assert every step's effect.

---

## Definition of Done for Phase 4

- Every interaction in the leads table feels instant (optimistic updates).
- Toasts appear for every state-changing action.
- Audit trail rows are written for status and notes changes.
- CSV export works for all three scopes.
- All Phase 4 tests pass.
- Phase 4 marked `COMPLETED` in master plan.
