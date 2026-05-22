# Phase 4 — Polish

> **Goal:** Make the leads table usable for real outreach. Inline status edits, notes with audit trail, search + filter, bulk operations, CSV export, toasts everywhere.

**Status:** COMPLETED
**Last Updated:** 2026-05-22

**Prerequisites:** [Phase 3](./PHASE_3_RELIABILITY.md) completed.

---

## Slices

| # | Slice | Status |
|---|---|---|
| 4.1 | Inline status edit (click badge → portaled dropdown → persist + toast) | COMPLETED |
| 4.2 | Notes column — `NotesModal` + `lead_history` audit row | COMPLETED |
| 4.3 | Email column — `EmailModal` (manual email entry + validation) | COMPLETED |
| 4.4 | Search input (name / phone / email / notes, debounced) | COMPLETED |
| 4.5 | Status filter dropdown + URL persistence | COMPLETED |
| 4.6 | Sortable columns (Name, Status, Updated) | COMPLETED |
| 4.7 | Pagination (10 / 25 / 50 / 100 per page) | COMPLETED |
| 4.8 | Bulk selection (checkbox column + select-all) | COMPLETED |
| 4.9 | Bulk status update + bulk delete (with confirm) | COMPLETED |
| 4.10 | CSV export (all / filtered / selected) | COMPLETED |
| 4.11 | Stats row live counts (Total / New / Contacted / Conversion) | COMPLETED |
| 4.12 | Tests for status transitions, audit trail, bulk ops, export | COMPLETED |

> **Numbering note:** the Email-modal slice (4.3) was inserted after the design pass added a manual email field. Slices 4.4–4.12 here correspond to the original 4.3–4.11.

---

## What you (the user) must provide during Phase 4

Nothing new — this phase is purely web work. No env changes, no manual installs.

---

## Slice Specifications

### Slice 4.1 — Inline status edit

**Status:** COMPLETED

Reference: `prototype/screens-detail.jsx` (`LeadRow` status dropdown).

- The status `Badge` in the leads table row is a dropdown trigger (badge + chevron).
- Clicking opens a **portaled dropdown** (`ReactDOM.createPortal` to `document.body`) so it escapes the table/card overflow. It lists all five statuses, each as its tone-colored badge, with a check on the current one.
- On selection: optimistic update, `PUT /api/leads/[id]/status`, toast "Status updated".
- On error: revert + error toast.
- Endpoint also writes a `lead_history` row: `previous_status`, `new_status`, `note = null`, `changed_at = NOW()`.

**Test notes:** Integration test — change status, assert lead row updated AND lead_history row inserted.

---

### Slice 4.2 — Notes + audit

**Status:** COMPLETED

Reference: `prototype/screens-detail.jsx` (`NotesModal`).

- Notes cell shows a one-line preview; empty cells show an "Add note" affordance on row hover.
- Click → opens `NotesModal` (textarea, "Saved changes are tracked in lead_history").
- Save → `PUT /api/leads/[id]/notes` with `{ notes, auditNote? }`.
- Endpoint writes `lead_history` row: `previous_status = null`, `new_status = null`, `note = <auditNote or "Notes updated">`, `changed_at = NOW()`.

**Test notes:** Integration test asserts both the lead row update AND the audit row.

---

### Slice 4.3 — Email (manual entry)

**Status:** COMPLETED

Reference: `prototype/screens-detail.jsx` (`EmailModal`).

- The Email column shows the address when set (click to edit); empty cells show an "Add email" affordance on row hover.
- Click → opens `EmailModal` — a single email `Input` with format validation.
- Save → `PUT /api/leads/[id]/email` with `{ email }`. Empty string clears it.
- Toast on save / clear.
- **Email is never scraped** — this slice is the only way an address gets onto a lead.

**Test notes:** Integration test — set a valid email, assert persisted; assert an invalid format is rejected.

---

### Slice 4.4 — Search

**Status:** COMPLETED

- Input above the leads table, placeholder "Search by name, phone, notes…".
- Debounced 300 ms.
- Server-side: `WHERE business_name ILIKE %q% OR phone LIKE %q% OR email ILIKE %q% OR notes ILIKE %q%`.
- Backed by `GET /api/campaigns/[id]/leads?q=...`.

**Test notes:** Integration test seeds 3 leads, queries with `q`, asserts only matches return.

---

### Slice 4.5 — Status filter

**Status:** COMPLETED

- Select above table: All / NEW / CONTACTED / REPLIED / IGNORED / CLOSED.
- Persists to URL (`?status=CONTACTED`).
- Backend: filter in same `/leads` endpoint.

**Test notes:** Integration test covers each value.

---

### Slice 4.6 — Sortable columns

**Status:** COMPLETED

- Clickable headers for Name, Status, Updated.
- URL params: `sort=name&dir=asc`.
- Backend orderBy clause.

**Test notes:** Integration test with 3 known leads, assert order.

---

### Slice 4.7 — Pagination

**Status:** COMPLETED

- Footer: page size select (10/25/50/100), prev/next, current range ("Showing 1–25 of 142"), "Page N of M".
- URL params: `page=2&pageSize=50`.

**Test notes:** Integration test — seed 60 leads, assert page 1 has 25, page 3 has 10.

---

### Slice 4.8 — Bulk selection

**Status:** COMPLETED

- Checkbox column.
- Header checkbox = select all on current page (indeterminate if mixed).
- Selection persists across pagination via in-memory `Set<leadId>`.
- A floating `BulkActionsBar` appears when any selection exists (centered against the content area).

**Test notes:** Component test for selection state.

---

### Slice 4.9 — Bulk operations

**Status:** COMPLETED

- The `BulkActionsBar` shows: `Set status` (menu), `Export`, `Delete`.
- `PUT /api/leads/bulk-status` accepts `{ ids: string[], status: LeadStatus }`. Writes lead_history rows for each.
- `DELETE /api/leads/bulk` accepts `{ ids }`. Confirm modal shows count + warning.

**Test notes:** Integration tests for both endpoints, including audit rows on bulk-status.

---

### Slice 4.10 — CSV export

**Status:** COMPLETED

- `GET /api/campaigns/[id]/export?scope=all|filtered|selected&ids=...&filters=...`
- Streams CSV with columns: Business Name, Phone, Email, Website, Normalized Domain, Status, Notes, Address, Created At, Last Updated.
- Filename: `<campaign-name-slug>_YYYY-MM-DD.csv`.

**Test notes:** Integration test asserts content-type, headers, and that row count matches scope.

---

### Slice 4.11 — Stats live counts

**Status:** COMPLETED

- The 4 stat cards on the campaign detail page get real data:
  - Total Leads
  - New (status NEW)
  - Contacted (CONTACTED + REPLIED + CLOSED)
  - Conversion = (REPLIED + CLOSED) / Total, shown as %, "—" if total is 0
- Backed by `GET /api/campaigns/[id]` (extend with stats payload).

**Test notes:** Integration test asserts stats calculation.

---

### Slice 4.12 — Polish tests

**Status:** COMPLETED

- Combine all of the above into the `data-flow.test.ts` parity suite.
- Add one big scenario test: "outreach lifecycle" — create campaign, scrape (mocked), change statuses, add notes, add an email, search, filter, bulk delete, export. Assert every step's effect.

---

## Definition of Done for Phase 4

- Every interaction in the leads table feels instant (optimistic updates).
- Toasts appear for every state-changing action.
- Audit trail rows are written for status and notes changes.
- CSV export works for all three scopes.
- All Phase 4 tests pass.
- Phase 4 marked `COMPLETED` in master plan.
