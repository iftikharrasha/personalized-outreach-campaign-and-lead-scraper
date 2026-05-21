# PROJECT PLAN — Personal Lead Generation Scraper & Campaign Manager

> **This is the master source of truth.** It defines the vision, decisions, phases, and how you work with Claude to build this. Implementation details live in the per-phase micro-documents linked below.

---

## 0. Quick Navigation

| Document | Purpose |
|---|---|
| **PROJECT_PLAN.md** *(this file)* | High-level vision, decisions, phase index, working protocol, implementation checklist |
| [design/DESIGN_SYSTEM.md](./design/DESIGN_SYSTEM.md) | Wise-inspired design language — colors, typography, spacing, components |
| [design/DESIGN_SCREENS.md](./design/DESIGN_SCREENS.md) | Screen-by-screen layout specs and wireframes |
| [design/screens/](./design/screens/) | Exported mockup screenshots (populated after Claude Design session) |
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
│   │   ├── components/
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

### Campaign Management *(Phase 1)*
- Create campaign with name, keyword, country/state/city
- View campaign list with cards showing stats
- View campaign detail page with leads table
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
- Change lead status inline (instant persist + toast)
- Add / edit notes per lead (with `lead_history` audit trail row written)
- Filter leads by status
- Search leads by name / phone / notes
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

- **`campaigns`** — one row per search keyword. Holds name, keyword, location, status, cached `total_leads`.
- **`leads`** — one row per business. References `campaign_id` and `scrape_run_id`. Stores raw + normalized fields and outreach status.
- **`scrape_runs`** — one row per scrape attempt. Tracks lifecycle: `PENDING → RUNNING → COMPLETED | FAILED | CANCELLED`. Acts as the job queue.
- **`lead_history`** — audit trail. **A row is written when** (a) a lead's `status` changes, or (b) a lead's `notes` field changes. Not written on initial creation.

### Critical design rules

- **Normalized domain** (`abc.com`, no protocol/www/path) and **normalized phone** (digits only) are stored alongside the raw fields. Dedupe and lookups always use normalized values.
- **Uniqueness** is enforced at the database level per campaign: `UNIQUE(campaign_id, normalized_domain) WHERE normalized_domain IS NOT NULL` and the same for phone. Application-level dedupe is a fast path; the DB constraint is the safety net.
- **Polling interval is 3 seconds.** Pin this everywhere (UI hook, docs, tests).

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
| No emails in MVP | Call the phone number, or add v2 enrichment later. |
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

> **For Claude Code:** Before building each component, verify against the mockup in `docs/design/screens/`. Use this checklist as a quality gate per slice.

### Before starting any slice

- [ ] Read `docs/design/DESIGN_SYSTEM.md` — confirm color tokens, type scale, radius values
- [ ] Find the relevant mockup in `docs/design/screens/` and keep it open as reference
- [ ] Confirm Tailwind config has the locked palette (`#9fe870`, `#e8ebe6`, `#0e0f0c`, etc.)
- [ ] Confirm shadcn is initialized with neutral theme + CSS variables enabled

### Global shell (Slice 1.2)

- [ ] Left sidebar: 240px expanded / 64px collapsed, `canvas-soft` background
- [ ] Sidebar toggle button works (chevron, bottom of sidebar)
- [ ] Single nav item: Google Maps Scraper with map-pin icon
- [ ] Active nav item: `primary` green left border + `primary-pale` row background
- [ ] Header bar: 64px, white, 1px bottom border, logo left / theme toggle right
- [ ] Dark mode toggle stores preference in `localStorage`

### Campaign List page (Slice 1.6)

- [ ] Page background: `canvas-soft`
- [ ] 4 cards per row at ≥1280px, 2 at tablet
- [ ] Card: white, `rounded-[24px]`, 24px padding, 24px gap
- [ ] Card contents match DESIGN_SCREENS.md Screen 1 order (name → keyword → location → status dot → stats → progress bar → last run → buttons)
- [ ] Progress bar: 4px tall, `primary` green fill
- [ ] Status dot: 8px circle, correct color per status
- [ ] Filter tabs and search input above card grid
- [ ] [+ New Campaign] primary green button top-right
- [ ] Empty state: icon + heading + hint + button, centered

### Create Campaign modal (Slice 1.7)

- [ ] Width 520px, `rounded-[24px]`, 24px padding, white bg
- [ ] Inputs: 44px height, `rounded-[12px]`
- [ ] "Entire State" checkbox hides city input
- [ ] Keyword auto-fills from category dropdown selection
- [ ] Validation errors show in `negative` red below field
- [ ] [Cancel] secondary, [Create →] primary green

### Campaign Detail page (Slice 1.8)

- [ ] 4 stat cards: equal width, white, `rounded-[24px]`, large number (40px/900)
- [ ] Table: white card, `rounded-[24px]`, sticky header
- [ ] Table rows: 56px tall, hover `canvas-soft`
- [ ] Status badges: color-coded per status table in DESIGN_SCREENS.md
- [ ] Scrape-running banner: `warning` yellow bg, icon + count + [Stop] button
- [ ] Bulk action bar: visible only when rows selected, `canvas-soft` bg
- [ ] Run history: collapsible panel below table, chevron toggle

### Run Campaign modal (Slice 2.7)

- [ ] Radio option 1 selected by default
- [ ] Warning text visible only when option 2 is selected (negative red)
- [ ] [Start Scraping →]: primary green

### Inline status edit (Slice 4.1)

- [ ] Status badge is clickable (cursor-pointer)
- [ ] Dropdown appears in-place, 5 options
- [ ] On selection: optimistic update + toast

### Notes (Slice 4.2)

- [ ] Notes cell clickable → opens textarea or modal
- [ ] Save → toast + lead_history row written

### Toasts (all phases)

- [ ] Bottom-right, 16px from edges
- [ ] Success: `positive-pale` bg, auto-dismiss 3s
- [ ] Error: white card with `negative` left border, manual dismiss
- [ ] Warning: `warning`/20 bg, manual dismiss

### Before phase sign-off

- [ ] All pages match their mockup in `docs/design/screens/` (spacing, colors, radius, typography)
- [ ] Dark mode works for all components
- [ ] Focus rings visible on all interactive elements (keyboard navigation)
- [ ] No hardcoded hex values in components — all Tailwind classes
- [ ] No custom CSS except `globals.css` baseline
