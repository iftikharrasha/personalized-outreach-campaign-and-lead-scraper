# PROJECT PLAN — Personal Lead Generation Scraper & Campaign Manager

> **This is the master source of truth.** It defines the vision, decisions, phases, and how you work with Claude to build this. Implementation details live in the per-phase micro-documents linked below.

---

## 0. Quick Navigation

| Document | Purpose |
|---|---|
| **PROJECT_PLAN.md** *(this file)* | High-level vision, decisions, phase index, working protocol, implementation checklist |
| [design/DESIGN_SYSTEM.md](./design/DESIGN_SYSTEM.md) | Wise-inspired design language — colors, typography, spacing, components |
| [design/DESIGN_SCREENS.md](./design/DESIGN_SCREENS.md) | Screen-by-screen layout specs and wireframes |
| [design/prototype/](./design/prototype/) | The approved working prototype — the visual contract for the build |
| [implementation/PHASE_0_PREREQUISITES.md](./implementation/PHASE_0_PREREQUISITES.md) | One-time setup the user must do before any coding |
| [implementation/PHASE_1_FOUNDATION.md](./implementation/PHASE_1_FOUNDATION.md) | Database, Prisma schema, Next.js shell, basic campaign CRUD |
| [implementation/PHASE_2_SCRAPER.md](./implementation/PHASE_2_SCRAPER.md) | Playwright worker, Google Maps extraction, dedupe, lead insertion |
| [implementation/PHASE_3_RELIABILITY.md](./implementation/PHASE_3_RELIABILITY.md) | Block detection, smart waits, worker crash recovery, run status polling |
| [implementation/PHASE_4_POLISH.md](./implementation/PHASE_4_POLISH.md) | Bulk actions, notes, search/filter, CSV export, toasts |
| [implementation/PHASE_5_QA_AND_HARDENING.md](./implementation/PHASE_5_QA_AND_HARDENING.md) | Data flow parity tests, MVP definition-of-done, manual QA checklist |

---

## 1. What We're Building

A personal lead operating system that runs entirely on **localhost**. The user creates campaigns (e.g., "Restaurants in San Diego"), the system scrapes business data (name, phone, website) from Google Maps, and the user manages those leads through a clean UI with status tracking, notes, deduplication, and CSV export.

**Target user:** one person doing manual outreach. **Target scale:** 200–400 quality leads per week.

### What This Is NOT

- Not Apollo, Clay, or ZoomInfo
- Not an automated outreach tool
- Not a real-time API service
- Not a cloud-hosted SaaS

### What This IS

- A focused internal lead operating system
- A learning project that actually gets used
- A foundation that can grow with source adapters
- A single-user tool that prioritizes organization over scale

---

## 2. Locked Decisions (Do Not Change)

These came from real constraints and honest assessment. **Non-negotiable for MVP.**

| # | Decision | Reason |
|---|----------|--------|
| 1 | 1 campaign = 1 search keyword | Simpler code. Multi-query is v2. |
| 2 | No email scraping in MVP | Visiting each site turns a 12-min scrape into 3 hours. Call the phone instead. |
| 3 | No resume/pause for scrapes (only **cancel** is supported) | Resume state management is 8+ hours of code. Lose ≤30 leads, re-run. |
| 4 | No IP rotation | Costs money or adds complexity. Accept blocks, wait, retry. |
| 5 | Manual run only, no scheduling | Simpler architecture. |
| 6 | No authentication, single user | No sessions, no passwords, no permission logic. |
| 7 | TypeScript everywhere | Compile-time safety across web + worker boundary. |
| 8 | PostgreSQL as job queue (no Redis) | Simpler infra for localhost. |
| 9 | Single concurrent browser page for MVP | One campaign = one keyword = one search. No reason to parallelize yet. |

> **Note on Decision 3:** The UI has a **"Stop Scraping"** button — this **cancels** a run (marks it CANCELLED, discards the open browser). It is NOT pause/resume. Already-saved leads stay in the database.

---

## 3. Technology Stack (Fixed)

| Layer | Technology |
|---|---|
| Language | **TypeScript** (everywhere — web and worker) |
| Frontend | Next.js 14+ (App Router) |
| UI Components | shadcn/ui + Tailwind CSS |
| Database | PostgreSQL (local) |
| ORM | Prisma |
| Scraping | Playwright |
| Background Worker | Separate Node process (TypeScript, run via `tsx` or compiled) |
| Job Queue | PostgreSQL (`scrape_runs` table with `FOR UPDATE SKIP LOCKED`) |
| Server State | TanStack Query (React Query) for polling and caching |
| Testing | Vitest for unit + integration; Playwright fixtures for scraper |

---

## 3a. Design Pass — What Changed (read before building UI)

A design pass was completed in Claude Design. The approved prototype lives in [`design/prototype/`](./design/prototype/) and is the **visual contract** for the build. It evolved beyond the original plan in three deliberate ways — these are now part of the spec:

1. **New Manager dashboard at `/`.** A cross-campaign business cockpit: outreach funnel, freelance earnings (with monthly trend), scraper-health KPIs, a global run-history log, and a "Winning Leads" table tracking `$ raised` per closed deal. The app is now the operating layer of a freelance business, not just a scraper.
2. **Routes shifted.** The scraper moved under a `/googlemaps` prefix to make room for the dashboard and future source adapters:
   - `/` → Manager dashboard
   - `/googlemaps` → Campaigns list
   - `/googlemaps/[id]` → Campaign detail
3. **Admin-panel shell.** A collapsible inverted-palette sidebar (Manager · Google Maps Scraper · "Coming soon" Yelp/LinkedIn stubs) + breadcrumb header wrapping every page.

**Other design-driven additions:**
- `email` on leads is a **manual field** (entered after a prospect replies) surfaced as a table column + edit modal — not scraped. `email` stays NULL until the operator fills it in.
- `notify_email` (a.k.a. client email) — an optional contact/notification address per campaign, set in the Edit Campaign modal.
- `raised` on closed leads — a dollar amount feeding the dashboard earnings rollup.
- Run history is a first-class UI surface (per-campaign on detail, global on dashboard).

Visual decisions (colors, typography, components) are specified in [`design/DESIGN_SYSTEM.md`](./design/DESIGN_SYSTEM.md); screen structure and behavior in [`design/DESIGN_SCREENS.md`](./design/DESIGN_SCREENS.md).

---

## 4. Repository Layout

```
project-root/
├── docs/                          # This plan and all phase docs
│   ├── PROJECT_PLAN.md
│   ├── PHASE_0_PREREQUISITES.md
│   ├── PHASE_1_FOUNDATION.md
│   ├── PHASE_2_SCRAPER.md
│   ├── PHASE_3_RELIABILITY.md
│   ├── PHASE_4_POLISH.md
│   └── PHASE_5_QA_AND_HARDENING.md
├── prisma/
│   └── schema.prisma
├── apps/
│   ├── web/                       # Next.js app (TypeScript)
│   │   ├── app/                   # Routes (App Router)
│   │   │   ├── page.tsx           #   /                 → Manager dashboard
│   │   │   ├── googlemaps/
│   │   │   │   ├── page.tsx       #   /googlemaps        → Campaigns list
│   │   │   │   └── [id]/page.tsx  #   /googlemaps/[id]   → Campaign detail
│   │   │   └── api/               #   /api/*             → route handlers
│   │   ├── components/            # Sidebar, Header, StatCard, RunHistoryCard,
│   │   │                          #   BulkActionsBar, Select, modals, ui/* (shadcn)
│   │   └── lib/                   # Shared client/server utilities
│   └── scraper/                   # Background worker (TypeScript)
│       ├── index.ts               # Worker loop entry
│       ├── google-maps.ts         # Extraction logic
│       ├── dedupe.ts
│       └── db.ts
├── packages/
│   └── shared/                    # Types, normalization helpers shared by web + scraper
│       └── src/
├── tests/                         # ALL tests live here, mirroring app structure
│   ├── unit/
│   │   ├── dedupe.test.ts
│   │   ├── normalize.test.ts
│   │   └── ...
│   ├── integration/
│   │   ├── api-campaigns.test.ts  # Hits real DB
│   │   ├── api-leads.test.ts
│   │   └── data-flow.test.ts      # End-to-end: create campaign → mock scrape → assert leads
│   └── fixtures/
│       ├── google-maps-sample.html
│       └── ...
├── .env                           # Real values (gitignored)
├── .env.example                   # Template, committed
├── package.json
└── tsconfig.json
```

> **Why a `packages/shared` folder?** Normalization logic (domain stripping, phone digit-only) MUST be identical between the web layer (for displaying/comparing) and the scraper layer (for inserting). Putting it in a shared package guarantees parity.

---

## 5. Phase Overview & Progress Tracker

| Phase | Doc | Delivers | Status | Last Updated |
|---|---|---|---|---|
| 0 | [PHASE_0_PREREQUISITES.md](./PHASE_0_PREREQUISITES.md) | Local environment ready (Node, PostgreSQL, Playwright browsers) | NOT STARTED | – |
| 1 | [PHASE_1_FOUNDATION.md](./PHASE_1_FOUNDATION.md) | Schema migrated; campaigns CRUD UI works; project boots | NOT STARTED | – |
| 2 | [PHASE_2_SCRAPER.md](./PHASE_2_SCRAPER.md) | Worker scrapes Google Maps end-to-end and writes leads | NOT STARTED | – |
| 3 | [PHASE_3_RELIABILITY.md](./PHASE_3_RELIABILITY.md) | Block detection, smart waits, run cancel, polling | NOT STARTED | – |
| 4 | [PHASE_4_POLISH.md](./PHASE_4_POLISH.md) | Bulk actions, search/filter, notes, CSV export, toasts | NOT STARTED | – |
| 5 | [PHASE_5_QA_AND_HARDENING.md](./PHASE_5_QA_AND_HARDENING.md) | Data-flow parity tests pass; MVP DoD met | NOT STARTED | – |

**Status values:** `NOT STARTED`, `IN PROGRESS`, `BLOCKED`, `COMPLETED`. Claude updates this table after finishing each phase. Within each phase doc, individual slices have their own status.

---

## 6. MVP Definition of Done

The system ships when **all** of these are true. Each is owned by a phase doc; the QA doc verifies them end-to-end.

### Shell & Dashboard *(Phase 1)*
- Admin shell: collapsible sidebar (Manager · Google Maps Scraper) + breadcrumb header
- Manager dashboard at `/` — outreach funnel, earnings, scraper-health KPIs, global run history, Winning Leads table

### Campaign Management *(Phase 1)*
- Create campaign with name, category, keyword, country/state/city
- Edit campaign (incl. optional client/notify email) — Edit Campaign modal
- View campaign list at `/googlemaps` with cards showing stats
- View campaign detail page at `/googlemaps/[id]` with leads table
- Archive / restore campaigns

### Scraping *(Phase 2)*
- "Run" button triggers a scrape from the campaign detail page
- Worker extracts name, phone, website, address from Google Maps
- Worker handles scrolling to load 60+ results
- New leads appear in UI within 5 seconds of being saved (3s polling)
- Duplicate detection prevents adding the same business twice within a campaign

### Reliability *(Phase 3)*
- Scrape stops gracefully when Google shows a block page
- "Stop Scraping" button cancels a running scrape
- Worker survives a Playwright crash without leaving runs stuck in RUNNING
- Run status polling is reliable (no flicker, no infinite loop)

### Lead Management *(Phase 4)*
- Change lead status inline (portaled dropdown — instant persist + toast)
- Add / edit notes per lead via modal (with `lead_history` audit trail row written)
- Add / edit a lead's email manually via modal (emails are never scraped)
- Filter leads by status
- Search leads by name / phone / email / notes
- Bulk update status
- Bulk delete with confirmation

### Export *(Phase 4)*
- Export all leads to CSV
- Export filtered leads to CSV
- Export selected leads to CSV

### Quality *(Phase 5)*
- Data-flow parity tests pass (`tests/integration/data-flow.test.ts`)
- Unit tests for normalization, dedupe, status transitions
- Manual QA checklist completed and signed off

---

## 7. How You Work With Claude (Working Protocol)

This is how you and Claude collaborate during the build. **Read this once before starting Phase 1.**

### 7.1 Commands you give Claude

- **"go all at once on phase N"** → Claude implements every slice in that phase in order, updating slice statuses as it goes.
- **"do slices 1, 2, 3 in phase N"** → Claude implements only those slices.
- **"do the next slice"** → Claude finds the next `NOT STARTED` slice in the current phase and implements it.
- **"status"** → Claude reads the phase docs and reports what's done, in progress, or blocked.
- You can give **extra context or instructions** at any time (e.g., "use lucide-react for icons", "skip toast for now"). Claude will honor that and may note it in the phase doc.

### 7.2 What Claude does between slices

1. Marks the slice `IN PROGRESS` in the phase doc.
2. Implements the slice (writes code, runs migrations, adds tests).
3. Verifies it works (typecheck, lint, run the relevant test).
4. Marks the slice `COMPLETED` with a one-line note about what changed.
5. If a slice is blocked because Claude needs something from you (a connection string, an API key, a manual install), Claude marks the slice `BLOCKED`, **pauses**, and tells you exactly what to do and which file to edit. No guessing, no placeholders.

### 7.3 When Claude must pause and ask you

Claude will stop and prompt you when:

- **Database needs to be created or migrated.** Claude tells you the exact commands to run (`createdb lead_scraper`, `npx prisma migrate dev`), and which line in `.env` to edit.
- **Playwright browsers need to be installed.** Claude tells you to run `npx playwright install chromium`.
- **A `.env` value needs to be set or rotated.** Claude points to the exact key.
- **A destructive operation is about to happen.** Schema reset, dropping tables, deleting files.
- **A locked decision would need to change** to proceed. Claude will surface the conflict instead of silently working around it.

### 7.4 Code conventions Claude follows

- TypeScript strict mode (`"strict": true` in `tsconfig.json`)
- No `any` unless explicitly justified
- Shared types live in `packages/shared`
- File names: kebab-case for routes, PascalCase for React components
- Tests mirror source structure under `tests/`
- Prisma migrations are committed (not `db push`)
- Tailwind classes inline (no separate CSS files except `globals.css`)

### 7.5 What you provide vs. what Claude builds

| You provide | Claude builds |
|---|---|
| PostgreSQL installation | Prisma schema, migrations, queries |
| `.env` values (DB URL, ports) | `.env.example` template |
| Manual click-through testing | Automated unit + integration tests |
| Decisions when a locked one conflicts | Code, UI, scraper logic, status updates |
| Final visual approval | Layouts, components, polish |

---

## 8. Data Model Summary

> Full column-by-column spec lives in [PHASE_1_FOUNDATION.md](./PHASE_1_FOUNDATION.md). Summary here so the master plan stays the source of truth for table-level decisions.

### Tables

- **`campaigns`** — one row per search keyword. Holds name, keyword, `category`, location, status, cached `total_leads`, and an optional `notify_email` (client/notification address, set in the Edit modal).
- **`leads`** — one row per business. References `campaign_id` and `scrape_run_id`. Stores raw + normalized fields, outreach status, manual `email` and `notes`, and `raised` (dollar amount, set when a lead is CLOSED — feeds the dashboard earnings rollup).
- **`scrape_runs`** — one row per scrape attempt. Tracks lifecycle: `PENDING → RUNNING → COMPLETED | FAILED | CANCELLED`. Acts as the job queue. Records `new_leads_count`, `duplicate_count`, `duration`, `error_message`.
- **`lead_history`** — audit trail. **A row is written when** (a) a lead's `status` changes, or (b) a lead's `notes` field changes. Not written on initial creation.

### Critical design rules

- **Normalized domain** (`abc.com`, no protocol/www/path) and **normalized phone** (digits only) are stored alongside the raw fields. Dedupe and lookups always use normalized values.
- **Uniqueness** is enforced at the database level per campaign: `UNIQUE(campaign_id, normalized_domain) WHERE normalized_domain IS NOT NULL` and the same for phone. Application-level dedupe is a fast path; the DB constraint is the safety net.
- **`email` is manual, never scraped.** It stays NULL until the operator fills it in via the lead's Email modal (after a prospect shares it).
- **Polling interval is 3 seconds.** Pin this everywhere (UI hook, docs, tests).
- The **Manager dashboard** (`/`) reads aggregate/derived data across all campaigns — outreach funnel counts, earnings from `raised`, scraper-health KPIs, and a global view of `scrape_runs`. No new tables are required for it; it is computed from the four tables above.

---

## 9. Environment Configuration

A `.env.example` is committed; a real `.env` is git-ignored. Claude will create both during Phase 0/1.

```env
# Database
DATABASE_URL="postgresql://postgres:password@localhost:5432/lead_scraper"

# Web
NEXT_PUBLIC_APP_URL="http://localhost:3000"

# Scraper
SCRAPER_HEADLESS=true
SCROLL_DELAY_MIN_MS=3000
SCROLL_DELAY_MAX_MS=8000
MAX_RESULTS_PER_SEARCH=100
POLL_INTERVAL_MS=3000

# User-agent pool (JSON array of strings)
USER_AGENTS='["Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 ...","..."]'
```

> The user fills in real values when Claude prompts them during Phase 0 and Phase 1.

---

## 10. Known Limitations & Risks

| Limitation | Reality |
|---|---|
| Google Maps will eventually block you | Accept, wait 1–24h, retry. Not fatal for personal use. |
| Emails are not scraped | The `email` field is manual — filled in after a prospect replies. Automated email enrichment is still a v2 item. |
| Single machine, single user | Can't share campaigns or run from two laptops. |
| Manual runs only | You must be at your computer (but you can leave it running overnight). |
| Practical ceiling ~200–400 leads/week | If you need more, v2 (multi-query, IP rotation). |

---

## 11. Future Enhancements (Explicitly Out of MVP)

### v2

- Resume/pause for scrapes
- Email enrichment (visit websites to extract emails)
- Multi-query campaigns
- Source adapters: Yelp, YellowPages, LinkedIn Company Pages
- Scheduled runs

### v3

- Proxy rotation (residential proxies)
- Outreach tracking (templates, call logs)
- Dashboard charts (leads over time, conversion rate)
- Tagging system

---

## 12. Document Maintenance

- Each phase doc has its own status and slice tracker — keep both up to date.
- The progress table in Section 5 of this doc is the single board view.
- If a locked decision (Section 2) needs to change, **update this doc first**, then proceed.
- Claude is expected to update statuses as it works. The user is expected to skim the phase doc before saying "go".

---

*End of master plan. Implementation details live in the phase documents linked in Section 0.*

---

## 13. Implementation Checklist

> **For Claude Code:** The approved prototype in [`design/prototype/`](./design/prototype/) is the visual contract. Open `prototype/index.html` (or read the `.jsx` files) and match it. The prototype components (`StatCard`, `RunHistoryCard`, `BulkActionsBar`, portaled `Select`, `Button`, `Badge`, `Card`, modals) map 1:1 to the shadcn components you build. Use this checklist as a per-slice quality gate.

### Before starting any slice

- [ ] Read [`design/DESIGN_SYSTEM.md`](./design/DESIGN_SYSTEM.md) — color tokens, type scale, radius, component variants
- [ ] Read the relevant section of [`design/DESIGN_SCREENS.md`](./design/DESIGN_SCREENS.md)
- [ ] Open the matching prototype source in `design/prototype/` and keep it as reference
- [ ] Copy the Tailwind color block verbatim from `DESIGN_SYSTEM.md` into `tailwind.config`
- [ ] Confirm shadcn is initialized; `darkMode: 'class'`

### Global shell

- [ ] Sidebar: 240px expanded / 64px collapsed, **inverted palette** (`bg-ink` in light, `bg-canvas` in dark)
- [ ] Two workspace nav items: **Outrich Manager** (`/`) and **Google Maps Scraper** (`/googlemaps`)
- [ ] "Coming soon" group: Yelp + LinkedIn, disabled, with `v2` pills
- [ ] Active nav item: 3px `primary` left bar + `primary`-tinted row
- [ ] Account row at sidebar bottom with collapse toggle
- [ ] Header: 64px, sticky, breadcrumb on the left, dark-mode toggle on the right
- [ ] Dark mode toggles a `dark` class on `<html>`, persists to `localStorage` (`outrich-dark`)

### Manager dashboard — `/`

- [ ] PageHeader: "Outrich Manager" + subtitle + "Open scraper" button
- [ ] Three KPI rows (Outreach funnel · Earnings · Campaign health), each 4 `StatCard`s
- [ ] "Closed" stat card uses `tone="ink"` (inverted dark card)
- [ ] Monthly-trend mini bar chart inside the "Monthly avg" card
- [ ] Block-cooldown card: live per-second countdown; "Clear to run" green state when no block
- [ ] Global `RunHistoryCard` with `showCampaign` column
- [ ] Winning Leads table: Raised column + `tfoot` filtered total + `BulkActionsBar`

### Campaign list — `/googlemaps`

- [ ] Page background `canvas-soft`, content `max-w-[1480px]`
- [ ] Card grid `grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-6`
- [ ] Campaign card: name + keyword + overflow menu · location pill + StatusDot · two-up Leads/Contacted stats · progress bar · "Last run · +N new" footer · Open/Run/pause buttons
- [ ] Search input + status `Tabs` (All/Active/Paused/Archived with counts)
- [ ] Empty state: map-pin circle icon, heading, copy, "Create your first campaign" button

### Create / Edit Campaign modals

- [ ] Create: 560px; Edit: 580px; both `rounded-card`
- [ ] Category `Select` (incl. "Custom keyword…"); custom field appears only for Custom
- [ ] Country + State side-by-side; "Scrape entire {state}" checkbox hides City
- [ ] Live Google-Maps-query preview chip
- [ ] Validation errors in `negative` red under each field
- [ ] Edit modal adds the optional **Client email** field + an "Archive campaign" ghost button; Save is disabled until the form is dirty

### Campaign detail — `/googlemaps/[id]`

- [ ] Header: name + status badge + keyword + location breadcrumb
- [ ] Action buttons: Run campaign (primary, becomes destructive "Stop scraping" while running) · Export (`chip` menu) · Edit (`chip`) · Archive (`chip`)
- [ ] Scraping banner: `warning` yellow card, sparkles icon, live count, **indeterminate** progress bar
- [ ] 4 `StatCard`s: Total / New / Contacted / Conversion
- [ ] Leads table columns: checkbox · Business · Phone · **Email** · Website · Notes · Added · **Status** (right-aligned)
- [ ] Status badge: portaled inline dropdown to change status
- [ ] Email + Notes cells open their respective modals; empty cells show "Add email" / "Add note" on row hover
- [ ] Pagination footer: range text + page-size `Select` (10/25/50/100) + prev/next
- [ ] Per-campaign `RunHistoryCard`
- [ ] `BulkActionsBar` when rows selected: Set status · Export · Delete

### Run Campaign modal

- [ ] Read-only keyword chip
- [ ] Two `RadioCard`s; "Add new leads only" selected by default
- [ ] "Replace all leads" shows a red destructive-warning callout
- [ ] Start scraping = primary button

### Toasts (all phases)

- [ ] Bottom-right, stacked, fade-in
- [ ] Success auto-dismisses after 3s; warning + error are manual; error has a `negative` left border

### Before phase sign-off

- [ ] Every page matches the prototype (spacing, colors, radius, typography) in both light and dark
- [ ] Focus rings visible on all interactive elements
- [ ] Colors come from Tailwind tokens — no hardcoded hex in components
- [ ] No custom CSS except the `globals.css` baseline (keyframes, scrollbar, focus ring)
