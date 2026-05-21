# Phase 1 — Foundation

> **Goal:** A running Next.js app with the admin shell, a migrated PostgreSQL schema, full Create/Read/Update/Archive flow for campaigns, and a Manager dashboard. No scraper yet.

**Status:** COMPLETED — all 13 slices done
**Last Updated:** 2026-05-21

**Prerequisites:** [Phase 0](./PHASE_0_PREREQUISITES.md) — COMPLETED.

> **Design contract:** every UI slice must match the approved prototype in [`docs/design/prototype/`](../design/prototype/). Read [`DESIGN_SYSTEM.md`](../design/DESIGN_SYSTEM.md) and [`DESIGN_SCREENS.md`](../design/DESIGN_SCREENS.md) before building UI. The prototype components (`Sidebar`, `Header`, `StatCard`, `RunHistoryCard`, `BulkActionsBar`, `Select`, `Button`, `Badge`, `Card`, modals) map 1:1 to the shadcn components you build here.
>
> **Routes (changed from the original plan):** `/` = Manager dashboard, `/googlemaps` = campaigns list, `/googlemaps/[id]` = campaign detail.

---

## Slices

| # | Slice | Status |
|---|---|---|
| 1.1 | Bootstrap monorepo (root `package.json`, `tsconfig.json`, workspaces) | COMPLETED |
| 1.2 | Initialize Next.js 16 app in `apps/web` with TypeScript + Tailwind + shadcn/ui | COMPLETED |
| 1.3 | Set up Prisma in `prisma/` and write `schema.prisma` (all 4 tables) | COMPLETED |
| 1.4 | Run first migration and seed `.env` / `.env.example` | COMPLETED |
| 1.5 | Create `packages/shared` with normalization helpers + their unit tests | COMPLETED |
| 1.6 | Build the admin shell — `Sidebar` (inverted, collapsible) + `Header` (breadcrumb, theme toggle) | COMPLETED |
| 1.7 | Build the shared UI kit — `Button`, `Card`, `Badge`, `StatCard`, `Select`, `Input`, `Checkbox`, `Modal`, `Tabs`, `Progress`, toasts | COMPLETED |
| 1.8 | Build Campaign List page (`/googlemaps`) — empty-state + cards grid + filter tabs | COMPLETED |
| 1.9 | Build Create + Edit Campaign modals + `POST` / `PUT /api/campaigns` | COMPLETED |
| 1.10 | Build Campaign Detail page (`/googlemaps/[id]`) — header, stat cards, empty leads table | COMPLETED |
| 1.11 | Implement Pause / Archive / Restore (via the campaign update endpoint) | COMPLETED |
| 1.12 | Build Manager dashboard (`/`) — KPI rows, run-history card, Winning Leads table (reads live + derived data) | COMPLETED |
| 1.13 | Set up Vitest + write first integration test (`data-flow.test.ts`, campaign CRUD path) | COMPLETED |

---

## What you (the user) must provide during Phase 1

| When | What | Status |
|---|---|---|
| Before Slice 1.4 | PostgreSQL password | ✅ Done — `DATABASE_URL` in `.env` updated, migration applied |
| After Slice 1.2 | Visual confirmation that `npm run dev` runs at `localhost:3000` | ✅ Done — dev server smoke-tested |

---

## Slice Specifications

### Slice 1.1 — Monorepo bootstrap

**Status:** COMPLETED — 2026-05-21

- Root `package.json` declares workspaces `apps/*`, `packages/*`, plus `dev` / `build` / `worker` / `test*` scripts.
- Root `tsconfig.json` with `"strict": true`, `noUncheckedIndexedAccess`, and the `@shared/*` → `packages/shared/src/*` path alias.
- `.gitignore` covers `node_modules`, `.env`, `.next`, `dist`, `coverage`, `playwright-report`, the scraper's persistent context, etc.
- Root devDependencies installed: `concurrently`, `typescript` (5.9.3).

**Test notes:** None — pure scaffolding. Verified `npx tsc --version` and valid JSON.

---

### Slice 1.2 — Next.js app

**Status:** COMPLETED — 2026-05-21

- `apps/web` is a **Next.js 16** App Router project (React 19), TypeScript, Tailwind enabled. Scaffolded manually (not `create-next-app`) for a clean workspace fit.
- shadcn/ui initialized via `components.json` (New York style, neutral base, `cn` helper in `lib/utils.ts`). The actual shadcn component files are added in **Slice 1.7** (the shared UI kit) — per the phase plan, not here.
- Tailwind color block copied **verbatim** from [`DESIGN_SYSTEM.md`](../design/DESIGN_SYSTEM.md) into `tailwind.config.ts` — light + dark tokens, `fontFamily.sans = Inter`, `borderRadius.card = 24px`, `darkMode: 'class'`. Keyframes (`fadein`, `scalein`, `pulsegreen`, `indeterm`) live in the Tailwind config's `animation`.
- `globals.css` baseline from the prototype: Inter font, body background (light + dark), scrollbar styling, the `2px #9fe870` focus ring.
- `Providers` wires the TanStack Query provider; `ThemeProvider` handles dark mode, persisting to `localStorage` key `outrich-dark`.
- Route skeleton in place: `app/page.tsx` (dashboard), `app/googlemaps/page.tsx` (list), `app/googlemaps/[id]/page.tsx` (detail) — placeholders.

**Decisions made during this slice:**
- **Next.js 16 + React 19** instead of 14. The Next 14.x line has unpatched critical/high `npm audit` advisories; they are only fixed in 16.x. The locked stack (`PROJECT_PLAN.md` §3) now reads "Next.js 16".
- **Next 16 consequence:** route `params` is a `Promise` — `page.tsx` for `[id]` routes must `await params`. The detail page placeholder already does this; later route work must follow suit.

**Test notes:** ✅ `next build` compiles + type-checks all 3 routes; dev server smoke-tested — `/`, `/googlemaps`, `/googlemaps/[id]` all return `200`.

#### Locked dependency versions (verified 2026-05-21)

| Package | Installed | Latest | Note |
|---|---|---|---|
| next | 16.2.6 | 16.2.6 | ✅ latest Next 16 |
| react / react-dom | 19.2.6 | 19.2.6 | ✅ latest |
| @tanstack/react-query | 5.100.11 | 5.100.11 | ✅ latest |
| lucide-react | 1.16.0 | 1.16.0 | ✅ latest (upgraded from 0.468 — icons only) |
| vitest | 4.1.7 | 4.1.7 | ✅ latest (upgraded from 2.x — cleared 5 transitive `esbuild`/`vite` advisories) |
| typescript | 5.9.3 | 6.0.x | held on 5.9 — TS 6.0 is days-old; not adopting mid-build |
| prisma / @prisma/client | 6.19.3 | 7.8.0 | held on 6.x by decision (see Slice 1.3) |
| tailwindcss | 3.4.19 | 4.3.0 | held on 3.x — Tailwind 4 is a config-format rewrite; the design system + prototype assume v3 syntax |

**`npm audit` status:** 2 moderate, both the *same* advisory — `postcss@8.4.31` **bundled inside the `next` package** (`node_modules/next/node_modules/postcss`). Our own `postcss` is `8.5.15` (safe) and a root `overrides` pins it; npm cannot rewrite the copy baked into Next's published artifact. It is a build-time CSS tool with no localhost runtime exposure and will clear when Next ships a patch bumping its bundled postcss. **Not actionable on our side** — do not run `npm audit fix --force` (it would try to change the Next major).

---

### Slice 1.3 — Prisma schema

**Status:** COMPLETED — 2026-05-21

`prisma/schema.prisma` written with all four models, three enums, indexes, and the partial-unique dedupe constraints. Prisma 6.19.x added as a root dependency (`@prisma/client`) + devDependency (`prisma`); root scripts `db:migrate` / `db:generate` / `db:studio` added. `npx prisma validate` passes; `npx prisma generate` produces the client. The actual migration against the DB happens in Slice 1.4.

> Note: Prisma 7 is available but the schema targets the stable 6.19.x line for this phase — upgrading is a separate decision.

Models defined (camelCase Prisma names, snake_case DB names via `@map`):

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
| keyword | VARCHAR(500) | Single search query (derived from category + location) |
| category | VARCHAR(50) | Restaurants / Dentists / Lawyers / … / `custom` — drives keyword auto-fill |
| country | VARCHAR(100) | |
| state | VARCHAR(100) | |
| city | VARCHAR(100) | Nullable (null = entire state) |
| source | VARCHAR(50) | Default `"google_maps"` |
| status | enum | `ACTIVE`, `PAUSED`, `ARCHIVED` |
| notify_email | VARCHAR(255) | Nullable — optional client/notification email, set in Edit modal |
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
| email | VARCHAR(255) | Nullable — **manual only, never scraped**. Operator fills it in after a prospect replies. |
| address | TEXT | |
| status | enum | `NEW`, `CONTACTED`, `REPLIED`, `IGNORED`, `CLOSED` (default `NEW`) |
| notes | TEXT | |
| raised | INT | Nullable — dollar amount on a CLOSED lead; feeds the dashboard earnings rollup |
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
| duration_sec | INT | Nullable — run duration, shown in run-history tables |
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

**Status:** COMPLETED — 2026-05-21

- `.env.example` committed with all keys + `<password>` placeholder (no real credentials).
- `.env` (git-ignored) has real `DATABASE_URL` pointing to PostgreSQL 17 on `localhost:5432`, database `lead_scraper`, user `postgres`.
- `npx prisma migrate dev --name init` ran successfully — migration `20260521104448_init` applied, creating all 4 tables (`campaigns`, `leads`, `scrape_runs`, `lead_history`) in the `lead_scraper` database.
- `npx prisma generate` produced Prisma Client v6.19.3.

**Test notes:** None. Slice 1.13 verifies via integration test.

---

### Slice 1.5 — `packages/shared` + normalization unit tests

**Status:** COMPLETED — 2026-05-21

`packages/shared` created (`@outrich/shared`) with `src/normalize.ts` + `src/index.ts`. Vitest 2.1.x added at the root with a minimal `vitest.config.ts` (the full unit/integration project split is Slice 1.13). All 14 unit tests in `tests/unit/normalize.test.ts` pass.

**Decision made during this slice:** the phone threshold was raised from 7 to **10 digits**. The doc's required example `"+1 555 123" → null` actually has 7 digits, which a `≥7` rule would *keep* — contradicting the example's intent. 10 digits is the floor for a dialable number (US 10-digit / international with country code). The spec text below was updated to match.

Exports:

- `normalizeDomain(url: string | null): string | null` — strips protocol, www, paths, trailing slashes; lowercase; returns null for empty/garbage.
- `normalizePhone(phone: string | null): string | null` — keeps digits only; null if fewer than **10** digits (a dialable number — US 10-digit or international with country code; shorter strings are fragments).
- `normalizeBusinessName(name: string): string` — trims, collapses whitespace, removes trailing `, Inc`, `LLC`, `Ltd` (case-insensitive).
- `LeadStatus`, `CampaignStatus`, `ScrapeRunStatus` re-exports from Prisma client for cross-package use.

**Test location:** `tests/unit/normalize.test.ts`

**Required test cases:**

- `https://www.PizzaHut.com/menu/` → `pizzahut.com`
- `http://abc.com` → `abc.com`
- `null` → `null`
- `"  "` → `null`
- `"(555) 123-4567"` → `"5551234567"`
- `"+1 555 123"` → `null` (only 7 digits — a fragment, not dialable)
- `"Joe's Diner, LLC"` → `"Joe's Diner"`

---

### Slice 1.6 — Admin shell (Sidebar + Header)

**Status:** COMPLETED — 2026-05-21

Reference: `prototype/screens.jsx` (`Sidebar`, `Header`), `DESIGN_SCREENS.md` → Global Shell.

- **Sidebar** — inverted palette (`bg-ink` light / `bg-canvas` dark), 240px expanded / 64px collapsed, 200ms transition.
  - Logo block (logo mark + "Outrich / Lead Scraper" wordmark).
  - Workspace nav: **Outrich Manager** → `/`, **Google Maps Scraper** → `/googlemaps`. Active item gets a 3px `primary` left bar + tinted row.
  - "Coming soon" group: **Yelp**, **LinkedIn** — disabled, `cursor-not-allowed`, `v2` pill.
  - Account row at the bottom with avatar + collapse toggle.
- **Header** — sticky 64px, `bg-canvas/90` backdrop blur, breadcrumb on the left, dark-mode toggle (sun/moon) on the right.
- Root layout composes `Sidebar` + `Header` + `<main>`; sidebar publishes width as CSS var `--sidebar-w`.

**Test notes:** Smoke — shell renders on all three routes; collapse toggle works; dark mode persists.

---

### Slice 1.7 — Shared UI kit

**Status:** COMPLETED — 2026-05-21

Build the shared primitives as shadcn-based components, matching `prototype/ui.jsx` for prop + visual parity. These are reused everywhere — get them right once.

- `Button` — variants `primary` / `secondary` / `chip` / `ghost` / `destructive` / `outline`; sizes `sm` / `md` / `lg`.
- `Card`, `Badge` (tones per `DESIGN_SYSTEM.md`), `StatusDot`, `Progress`.
- `StatCard` — `label / value / sub / icon / tone / valueClassName`; tones `canvas` / `primary` / `ink`.
- `Input`, `Checkbox`, `Tabs`, `Field` (label + hint + error wrapper).
- `Select` — **portaled** dropdown that escapes `overflow-hidden` parents.
- `Modal` — centered, `rounded-card`, backdrop, scale-in.
- Toast system — provider + `useToast`; success (auto-dismiss 3s), warning, error (manual).

**Test notes:** None — exercised by later slices.

---

### Slice 1.8 — Campaign List page (`/googlemaps`)

**Status:** COMPLETED — 2026-05-21

Reference: `prototype/screens.jsx` (`CampaignListPage`, `CampaignCard`, `EmptyState`).

- Route: `apps/web/app/googlemaps/page.tsx`. Fetches campaigns via Prisma / `GET /api/campaigns`.
- `PageHeader`: "Campaigns" + subtitle ("N active · N leads scraped") + **New Campaign** button.
- Filter row: search `Input` + status `Tabs` (All / Active / Paused / Archived, with counts).
- Card grid: `grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-6`.
- `CampaignCard`: name + keyword + overflow `Menu` (Edit / Duplicate / Archive-or-Restore) · location pill + `StatusDot` · two-up Leads/Contacted stats · `Progress` + "Outreach progress N%" · "Last run · +N new" footer · Open / Run / pause buttons.
- Empty state: map-pin circle icon, "No campaigns yet", copy, "Create your first campaign" button.

**Test notes:** Integration test in 1.13 hits `GET /api/campaigns` and asserts shape.

---

### Slice 1.9 — Create + Edit Campaign modals + API

**Status:** COMPLETED — 2026-05-21

Reference: `prototype/screens.jsx` (`CreateCampaignModal`), `prototype/edit-modal.jsx` (`EditCampaignModal`).

- **Create modal** (560px) — fields: name (required) · category `Select` (incl. "Custom keyword…") · custom keyword (shown only for Custom) · country + state side-by-side · city OR "Scrape entire {state}" checkbox · live query-preview chip. Submit → `POST /api/campaigns` → redirect to `/googlemaps/[id]`.
- **Edit modal** (580px) — same fields pre-filled, **plus** an optional **Client email** field (validated). Split footer: "Archive campaign" ghost button on the left; Cancel + "Save changes" (disabled until dirty) on the right. Submit → `PUT /api/campaigns/[id]`.
- `POST /api/campaigns` and `PUT /api/campaigns/[id]` validate server-side: name 1–255, keyword 1–500, country/state required, `notify_email` is a valid email or empty.
- Keyword is derived as `"{category label} in {city or state}"`.

**Test notes:** Integration test asserts POST creates a row (201 + new ID) and PUT updates fields.

---

### Slice 1.10 — Campaign Detail page (shell)

**Status:** COMPLETED — 2026-05-21

Reference: `prototype/screens-detail.jsx` (`CampaignDetailPage`), `DESIGN_SCREENS.md` → Screen 6.

- Route: `apps/web/app/googlemaps/[id]/page.tsx`.
- "‹ All campaigns" back link.
- Header: campaign name + status `Badge` · keyword in quotes · "USA › State › City" breadcrumb.
- Action buttons: `[Run campaign]` *(disabled in Phase 1, wired in Phase 2)* · `[Export]` chip menu *(disabled in Phase 1, wired in Phase 4)* · `[Edit]` chip (opens Edit modal) · `[Archive]` chip.
- 4 `StatCard`s: Total / New / Contacted / Conversion (computed from leads — all 0 in Phase 1).
- Leads toolbar: "Leads" heading + search `Input` + status filter `Select`.
- Empty leads table inside a `Card` — columns: checkbox · Business · Phone · Email · Website · Notes · Added · Status. Empty state: "No leads yet. Run the campaign to start scraping (available in Phase 2)."

**Test notes:** Smoke — page renders for an existing campaign ID.

---

### Slice 1.11 — Pause / Archive / Restore

**Status:** COMPLETED — 2026-05-21

- The campaign update endpoint (`PUT /api/campaigns/[id]`) accepts `{ status?: CampaignStatus, ... }`.
- Pause toggles `ACTIVE ⇄ PAUSED`. Archive sets `ARCHIVED`. Restore sets back to `ACTIVE`.
- Wired from the card overflow menu, the card pause button, and the Edit modal's archive button.
- Cards/list update optimistically via TanStack Query; each action fires a toast.

**Test notes:** Integration test exercises all three transitions.

---

### Slice 1.12 — Manager dashboard (`/`)

**Status:** COMPLETED — 2026-05-21

Reference: `prototype/dashboard.jsx` (`DashboardPage`, `BlockTimerCard`, `TrendBars`, `WinningLeadRow`), `DESIGN_SCREENS.md` → Screen 1.

- Route: `apps/web/app/page.tsx`.
- `PageHeader`: "Outrich Manager" + subtitle + "Open scraper" button → `/googlemaps`.
- **Three KPI rows**, each 4 `StatCard`s:
  - *Outreach funnel* — Total leads · Contacted · Replied · Closed (`tone="ink"`).
  - *Earnings* — Conversion % · Total earned · This month · Monthly avg (with `TrendBars`).
  - *Campaign health* — Total run time · Avg completion · Avg dupes % · Block cooldown (`BlockTimerCard`, live per-second countdown).
- Global `RunHistoryCard` with `showCampaign` column.
- **Winning Leads table** — all `CLOSED` leads, Raised column, `tfoot` filtered total, search + campaign filter, `BulkActionsBar`.
- All values are **computed from the four tables** — no new tables. In Phase 1 the dashboard reads whatever exists (likely zeros / empty until Phase 2 produces leads); the `raised` and block-cooldown surfaces stay quiet until there's data.

**Test notes:** Smoke — dashboard renders without error against an empty DB.

> **Scope note:** This is the off-plan addition from the design pass. It's placed in Phase 1 because it's pure read-side UI over the existing schema. If time-constrained, it may be deferred — tell Claude to "skip 1.12 for now" and it will move it to a Phase 4 follow-up.

---

### Slice 1.13 — Vitest setup + first integration test

**Status:** COMPLETED — 2026-05-21

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

- `npm run dev` starts the Next.js app; the admin shell renders on all three routes.
- `/` shows the Manager dashboard; `/googlemaps` lists campaigns; `/googlemaps/[id]` shows campaign detail.
- You can create, edit, view, pause, archive, and restore campaigns through the UI.
- Every page visually matches the prototype in light and dark mode.
- `npm run test` passes (unit + integration).
- Master plan progress table updated to `COMPLETED`.
