# Phase 1 — Foundation

> **Goal:** A running Next.js app, a migrated PostgreSQL schema, and full Create/Read/Update/Archive flow for campaigns. No scraper yet.

**Status:** NOT STARTED
**Last Updated:** –

**Prerequisites:** [Phase 0](./PHASE_0_PREREQUISITES.md) completed.

---

## Slices

| # | Slice | Status |
|---|---|---|
| 1.1 | Bootstrap monorepo (root `package.json`, `tsconfig.json`, workspaces) | NOT STARTED |
| 1.2 | Initialize Next.js 14 app in `apps/web` with TypeScript + Tailwind + shadcn/ui | NOT STARTED |
| 1.3 | Set up Prisma in `prisma/` and write `schema.prisma` (all 4 tables) | NOT STARTED |
| 1.4 | Run first migration and seed `.env` / `.env.example` | NOT STARTED |
| 1.5 | Create `packages/shared` with normalization helpers + their unit tests | NOT STARTED |
| 1.6 | Build Campaign List page (`/`) — empty-state + cards grid | NOT STARTED |
| 1.7 | Build Create Campaign modal + `POST /api/campaigns` endpoint | NOT STARTED |
| 1.8 | Build Campaign Detail page (`/campaigns/[id]`) — header, empty leads table | NOT STARTED |
| 1.9 | Implement Pause / Archive / Restore + `PUT /api/campaigns/[id]` | NOT STARTED |
| 1.10 | Set up Vitest + write first integration test (`data-flow.test.ts`, campaign CRUD path) | NOT STARTED |

---

## What you (the user) must provide during Phase 1

| When | What | Where |
|---|---|---|
| Before Slice 1.4 | PostgreSQL password from Phase 0 | Claude will write `DATABASE_URL` into `.env` and ask you to confirm |
| Before Slice 1.4 | Confirmation to run `npx prisma migrate dev --name init` | Claude pauses and waits — this writes to your DB |
| After Slice 1.2 | One quick visual confirmation that `npm run dev` shows the default Next.js page at `localhost:3000` | Claude waits before moving on |

---

## Slice Specifications

### Slice 1.1 — Monorepo bootstrap

**Status:** NOT STARTED

- Root `package.json` declares workspaces: `apps/*`, `packages/*`.
- Root `tsconfig.json` with `"strict": true`, path aliases for `@shared/*` → `packages/shared/src/*`.
- Add `.gitignore` entries: `node_modules`, `.env`, `.next`, `dist`, `playwright-report`.
- Add `concurrently` as a root devDependency (used later by `npm run dev`).

**Test notes:** None — pure scaffolding.

---

### Slice 1.2 — Next.js app

**Status:** NOT STARTED

- `apps/web` is a Next.js 14+ App Router project, TypeScript, Tailwind enabled.
- Initialize shadcn/ui with neutral color palette + New York style.
- Install these shadcn components up front: `button`, `card`, `dialog`, `input`, `select`, `badge`, `tabs`, `table`, `checkbox`, `textarea`, `toast`, `progress`.
- Add a root layout with a top nav (just app name + theme toggle placeholder).
- Add TanStack Query provider in the root layout.

**Test notes:** Smoke test — visit `/`, see "no campaigns yet" empty state.

---

### Slice 1.3 — Prisma schema

**Status:** NOT STARTED

Models to define (camelCase Prisma names, snake_case DB names via `@map`):

- `Campaign` → `campaigns`
- `Lead` → `leads`
- `ScrapeRun` → `scrape_runs`
- `LeadHistory` → `lead_history`

Mirrors the column spec below. Enforce:

- `UNIQUE(campaign_id, normalized_domain)` partial index where domain is not null.
- `UNIQUE(campaign_id, normalized_phone)` partial index where phone is not null.
- Indexes on `leads.campaign_id`, `leads.status`, `leads.normalized_domain`, `leads.normalized_phone`.
- All status fields are enums in Prisma (`CampaignStatus`, `LeadStatus`, `ScrapeRunStatus`).

**Full column spec — `campaigns`:**

| Column | Type | Notes |
|---|---|---|
| id | UUID PK | |
| name | VARCHAR(255) | User label |
| keyword | VARCHAR(500) | Single search query |
| country | VARCHAR(100) | |
| state | VARCHAR(100) | |
| city | VARCHAR(100) | Nullable |
| source | VARCHAR(50) | Default `"google_maps"` |
| status | enum | `ACTIVE`, `PAUSED`, `ARCHIVED` |
| total_leads | INT | Cached count |
| created_at, updated_at | TIMESTAMP | |

**Full column spec — `leads`:**

| Column | Type | Notes |
|---|---|---|
| id | UUID PK | |
| campaign_id | UUID FK | |
| scrape_run_id | UUID FK | |
| business_name | VARCHAR(500) | Raw |
| normalized_name | VARCHAR(500) | Optional |
| website_url | TEXT | Raw URL |
| normalized_domain | VARCHAR(255) | Dedupe key |
| phone | VARCHAR(50) | Raw |
| normalized_phone | VARCHAR(50) | Digits only |
| email | VARCHAR(255) | NULL for MVP |
| address | TEXT | |
| status | enum | `NEW`, `CONTACTED`, `REPLIED`, `IGNORED`, `CLOSED` (default `NEW`) |
| notes | TEXT | |
| is_duplicate | BOOLEAN | Default false |
| created_at, updated_at | TIMESTAMP | |

**Full column spec — `scrape_runs`:**

| Column | Type | Notes |
|---|---|---|
| id | UUID PK | |
| campaign_id | UUID FK | |
| keyword_used | VARCHAR(500) | |
| started_at, finished_at | TIMESTAMP | finished_at nullable |
| status | enum | `PENDING`, `RUNNING`, `COMPLETED`, `FAILED`, `CANCELLED` |
| new_leads_count | INT | |
| duplicate_count | INT | |
| error_message | TEXT | Nullable |
| created_at | TIMESTAMP | |

**Full column spec — `lead_history`:**

| Column | Type | Notes |
|---|---|---|
| id | UUID PK | |
| lead_id | UUID FK | |
| previous_status | enum | Nullable (notes-only changes have no status diff) |
| new_status | enum | Nullable (status-only changes don't change notes) |
| note | TEXT | Free-form audit note |
| changed_at | TIMESTAMP | |

> **Trigger rule:** a `lead_history` row is written by the API layer (NOT a DB trigger) whenever `PUT /api/leads/[id]/status` or `/notes` changes the field. Phase 4 implements the writes.

**Test notes:** None in this slice — schema only. Slice 1.10 hits the DB.

---

### Slice 1.4 — First migration + `.env`

**Status:** NOT STARTED

**Claude will pause here** and prompt you for:

1. Your PostgreSQL `postgres` user password.

Claude will then:

- Write `DATABASE_URL="postgresql://postgres:<password>@localhost:5432/lead_scraper"` into `.env`.
- Write a sanitized `.env.example` with placeholders.
- Run `npx prisma migrate dev --name init`.
- Run `npx prisma generate`.

After this slice, the DB has all 4 tables and your `.env` is real.

**Test notes:** None. Slice 1.10 verifies via integration test.

---

### Slice 1.5 — `packages/shared` + normalization unit tests

**Status:** NOT STARTED

Exports:

- `normalizeDomain(url: string | null): string | null` — strips protocol, www, paths, trailing slashes; lowercase; returns null for empty/garbage.
- `normalizePhone(phone: string | null): string | null` — keeps digits only; null if fewer than 7 digits.
- `normalizeBusinessName(name: string): string` — trims, collapses whitespace, removes trailing `, Inc`, `LLC`, `Ltd` (case-insensitive).
- `LeadStatus`, `CampaignStatus`, `ScrapeRunStatus` re-exports from Prisma client for cross-package use.

**Test location:** `tests/unit/normalize.test.ts`

**Required test cases:**

- `https://www.PizzaHut.com/menu/` → `pizzahut.com`
- `http://abc.com` → `abc.com`
- `null` → `null`
- `"  "` → `null`
- `"(555) 123-4567"` → `"5551234567"`
- `"+1 555 123"` → `null` (under 7 digits)
- `"Joe's Diner, LLC"` → `"Joe's Diner"`

---

### Slice 1.6 — Campaign List page

**Status:** NOT STARTED

- Route: `/` (in `apps/web/app/page.tsx`).
- Server component fetches campaigns via Prisma.
- Empty state: large icon, "Create your first campaign" CTA.
- Filter tabs: All | Active | Paused | Archived (client-side filter; URL search param `?filter=`).
- Cards (2-3 per row, responsive grid):
  - Campaign name (bold)
  - Keyword (muted)
  - Location badge (e.g., "USA • CA • San Diego" or "USA • CA (statewide)")
  - Status dot + label
  - Stats row: total / contacted counts (Phase 1 shows zeros)
  - Progress bar (0% in Phase 1)
  - "Last run: never" (until Phase 2)
  - Actions: `[Open]`, `[Run Now]` *(disabled with tooltip "Available in Phase 2")*, `[Pause]` / `[Archive]`

**Test notes:** Integration test in 1.10 hits `GET /api/campaigns` and asserts shape.

---

### Slice 1.7 — Create Campaign modal + API

**Status:** NOT STARTED

- Modal (shadcn `Dialog`) triggered by "+ New Campaign" button on `/`.
- Form fields:
  - Campaign Name (text, required)
  - Type (select: Restaurants / Dentists / Lawyers / Custom) — auto-fills keyword template
  - Custom keyword (text, shown if Custom)
  - Country (select: US / CA / UK)
  - State (select, filtered by country)
  - City (text) **OR** "Entire State" checkbox
- Submit → `POST /api/campaigns` → returns new campaign → redirect to `/campaigns/[id]`.
- Validate server-side: name 1–255, keyword 1–500, country/state required.

**Test notes:** Integration test asserts POST creates row, returns 201 with new ID.

---

### Slice 1.8 — Campaign Detail page (shell)

**Status:** NOT STARTED

- Route: `/campaigns/[id]` (server component).
- Header: campaign name, keyword, location breadcrumb, status badge.
- Action buttons: `[Run Campaign]` *(disabled in Phase 1)*, `[Export CSV]` *(disabled in Phase 1)*, `[Edit]`, `[Archive]`.
- 4-card stats row: Total / New / Contacted / Conversion Rate (all 0 in Phase 1).
- Empty leads table (shadcn `Table`) with columns: Business Name, Phone, Website, Status, Notes, Last Updated, Actions.
- Empty state inside the table: "No leads yet. Run the campaign to start scraping (available in Phase 2)."

**Test notes:** Smoke test — page renders without error for an existing campaign ID.

---

### Slice 1.9 — Pause / Archive / Restore + update endpoint

**Status:** NOT STARTED

- `PUT /api/campaigns/[id]` accepts `{ status?: CampaignStatus, name?, keyword?, ... }`.
- Pause toggles `ACTIVE ⇄ PAUSED`. Archive sets to `ARCHIVED`. Restore (from archived view) sets back to `ACTIVE`.
- Cards update optimistically via TanStack Query.

**Test notes:** Integration test exercises all three transitions.

---

### Slice 1.10 — Vitest setup + first integration test

**Status:** NOT STARTED

- Install `vitest`, `@vitest/ui`, `vitest-environment-node`.
- Root `vitest.config.ts` with two projects: `unit` (jsdom) and `integration` (node, uses real DB).
- `tests/integration/data-flow.test.ts` — covers:
  1. `POST /api/campaigns` creates a row.
  2. `GET /api/campaigns` returns it.
  3. `PUT /api/campaigns/[id]` with `status: "PAUSED"` works.
  4. `PUT /api/campaigns/[id]` with `status: "ARCHIVED"` works.
- Integration tests run against the real `lead_scraper` DB; each test cleans up after itself with `prisma.campaign.deleteMany({ where: { name: { startsWith: "TEST__" } } })`.
- Add npm scripts: `test`, `test:unit`, `test:integration`, `test:watch`.

**Test notes:** This file is the seed for the "data flow parity" suite. Every later phase adds to it.

---

## Definition of Done for Phase 1

- `npm run dev` starts the Next.js app at `localhost:3000`.
- You can create, view, pause, archive, and restore campaigns through the UI.
- `npm run test` passes (unit + integration).
- Master plan progress table updated to `COMPLETED`.
