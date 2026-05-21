# Screen Specifications

This documents every screen in the approved prototype. The working prototype in [`prototype/`](./prototype/) is the **visual contract** — open `prototype/index.html` to see it live. This doc explains structure, behavior, and the routes; refer to `DESIGN_SYSTEM.md` for colors, type, spacing.

> **Note — this evolved beyond `PROJECT_PLAN.md`.** During the design pass two things were added that the original plan did not have:
> 1. A **Manager dashboard** at `/` (cross-campaign business cockpit).
> 2. The scraper moved under a **`/googlemaps`** route prefix.
>
> Both are intentional and are now part of the spec. `PROJECT_PLAN.md` §3 and the implementation phase docs have been updated to match.

---

## Routes

| URL | Page | Prototype source |
|---|---|---|
| `/` | Outrich Manager dashboard | `dashboard.jsx` → `DashboardPage` |
| `/googlemaps` | Campaigns list | `screens.jsx` → `CampaignListPage` |
| `/googlemaps/[id]` | Campaign detail | `screens-detail.jsx` → `CampaignDetailPage` |

---

## Global Shell

An **admin-panel layout**: collapsible left sidebar + top header + main content. Wraps every page (`app.jsx`).

### Sidebar — inverted palette

The sidebar deliberately inverts the theme: **dark (`ink`) in light mode, light (`canvas`) in dark mode.**

- Width: **240px expanded / 64px collapsed** (icon-only), 200ms transition.
- **Logo block** at top: Outrich logo mark + "Outrich" / "Lead Scraper" wordmark.
- **Workspace nav group:**
  - **Outrich Manager** (layout icon) → `/`
  - **Google Maps Scraper** (map-pin icon) → `/googlemaps`
- **Coming soon group** (v2, disabled, `cursor-not-allowed`): **Yelp**, **LinkedIn** — each with a small `v2` pill.
- Active nav item: `primary`-tinted background + a 3px `primary` left-edge bar.
- **Account row** at the bottom: avatar ("YA"), "You / localhost", and the **collapse toggle** (chevrons-left button, flips when collapsed).
- The sidebar publishes its width as a CSS variable `--sidebar-w` so the floating `BulkActionsBar` can center against the content area.

### Header

- Sticky, 64px, `bg-canvas/90` with backdrop blur, bottom `border-line`.
- **Left:** mobile menu button (hidden on desktop) + **breadcrumb**.
  - Home → `Outrich Manager`
  - List → `Google Maps Scraper / Campaigns`
  - Detail → `Google Maps Scraper / Campaigns / {campaign name}`
- **Right:** dark-mode toggle (sun/moon, circular button).

---

## Screen 1 — Manager Dashboard (`/`)

A cross-campaign cockpit. The operator runs their freelance business from here, not just the scraper. *(Off the original plan — added during design.)*

**Page header:** title "Outrich Manager", subtitle "`N` campaigns · `N` closed deals · `$X` earned to date", action button **Open scraper** → `/googlemaps`.

**Row 1 — Outreach funnel** (section label "Across all campaigns"). Four `StatCard`s:
- Total leads · Contacted (% of total) · Replied (% of total + % of contacted) · **Closed** (`tone="ink"` — inverted dark card).

**Row 2 — Earnings** (section label "From closed leads"). Four `StatCard`s:
- Conversion % · Total earned (avg deal size) · This month (▲ % vs last month) · Monthly avg (with a 6-month `TrendBars` mini bar chart in the `sub` slot).

**Row 3 — Campaign health** (section label "Performance of the scraper itself"). Four `StatCard`s:
- Total run time · Avg. completion (minutes/run) · Avg. dupes % · **Block cooldown** — a live countdown timer (`BlockTimerCard`) ticking every second; shows "Clear to run" in `positive` green when no block is active, or a yellow `HH:MM:SS` countdown when Google rate-limited.

**Run history** — global `RunHistoryCard` with `showCampaign` (adds a Campaign column linking back to detail). Subtitle counts completed/failed/cancelled.

**Winning Leads table** — every `CLOSED` lead across all campaigns, with a **Raised ($)** column. Columns: checkbox · Business (+ campaign sub-link) · Phone · Website · Notes · Raised · Added. Has a search input + campaign filter `Select`. A `tfoot` shows the filtered total raised. A `BulkActionsBar` offers Export / Generate invoice batch / Remove.

---

## Screen 2 — Campaign List (`/googlemaps`)

Lists all campaigns in a responsive card grid.

**Page header:** title "Campaigns", subtitle "`N` active · `N` leads scraped", action button **New Campaign** (primary, opens Create modal).

**Filter row:** a search `Input` ("Search campaigns…") on the left + status `Tabs` on the right — **All / Active / Paused / Archived**, each with a count.

**Card grid:** `grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-6`.

### Campaign Card

- Header: campaign **name** (17px semibold) + **keyword** (13px mute) + an overflow `Menu` (Edit / Duplicate / Archive-or-Restore) that appears on hover.
- **Location pill** ("USA · CA · San Diego", map-pin icon) + **StatusDot** (Active green / Paused yellow / Archived gray).
- **Two-up stats:** big numbers for **Leads** and **Contacted**.
- **Progress bar** + "Outreach progress `N`%".
- **Footer line:** "Last run `2h ago` · **+47 new**" (the +N in `positive` green).
- **Buttons:** `Open` (secondary) · `Run` (primary, play icon, disabled when paused) · a ghost pause/resume icon button. Archived cards show only `Open` + `Restore`.

**Empty state:** centered — map-pin circle icon, "No campaigns yet", explanatory copy, "Create your first campaign" primary button.

---

## Screen 3 — Create Campaign Modal

Width 560px. Opens from the New Campaign button (list page) or card menu.

Fields:
- **Campaign name** — text, required.
- **What to scrape** — `Select` of categories (Restaurants, Dentists, Personal Injury Lawyers, Plumbers, Cafes & Coffee Shops, Gyms & Fitness, Auto Repair Shops, **Custom keyword…**).
- **Custom keyword** — text, shown only when category = Custom.
- **Country** + **State / Region** — two `Select`s side by side; changing country resets state.
- **City** — text, hidden when "Scrape entire {state}" checkbox is on.
- **Scrape entire {state}** — checkbox.
- **Google Maps query preview** — a live soft chip showing the derived keyword (`"{category} in {location}"`).

Footer: Cancel (ghost) + **Create campaign** (primary, arrow icon). Validation errors render in `negative` red under each field.

---

## Screen 4 — Edit Campaign Modal

Width 580px. Opens from the detail page or card menu. Mirrors Create, pre-filled, **plus**:

- **Client email** field — divider-separated, optional. Hint: "We don't scrape emails from Google Maps — add it here once the prospect shares it." Validated as an email.
- Footer is split: **Archive campaign** (ghost, left, hovers to `negative`) on one side; Cancel + **Save changes** (primary, disabled until the form is dirty) on the other.

> **Data note:** the campaign-level email is `notifyEmail` / `clientEmail` in the prototype data — a single optional contact/notification address per campaign.

---

## Screen 5 — Run Campaign Modal

Width 520px. Opens from the Run button (card or detail page).

- A read-only **Keyword** chip.
- Two `RadioCard` options:
  - **Add new leads only** (default) — duplicates by website/phone are skipped.
  - **Replace all leads** (`danger`) — deletes all existing leads first.
- When "Replace all" is selected, a red destructive-warning callout appears spelling out that statuses, notes, and history will be permanently deleted.
- Footer: Cancel (ghost) + **Start scraping** (primary, play icon).

---

## Screen 6 — Campaign Detail (`/googlemaps/[id]`)

**Back link:** "‹ All campaigns" → list.

**Header:** campaign name (32–36px) + status `Badge` (Active/Paused/Archived) · keyword in quotes · location breadcrumb "USA › State › City". Action buttons on the right:
- **Run campaign** (primary) — becomes **Stop scraping** (destructive) while a scrape is running.
- **Export** (`chip`, dropdown `Menu`: all / filtered / selected leads).
- **Edit** (`chip`) · **Archive** (`chip`).

**Scraping banner** (only while running): yellow `warning` card — sparkles icon, "Scraping in progress…", live "`N` leads found · ~3s polling", and an **indeterminate** progress bar.

**Stat cards** (`grid-cols-2 lg:grid-cols-4`): Total leads · New (% of total) · Contacted · Conversion % ("replied + closed / total").

**Leads toolbar:** "Leads" heading + "`N` of `N` shown" · search `Input` ("Search by name, phone, notes…") · status filter `Select` (All statuses + NEW/CONTACTED/REPLIED/IGNORED/CLOSED).

**Leads table** (inside a Card):
- Columns: **checkbox · Business · Phone · Email · Website · Notes · Added · Status** (status is right-aligned, far right).
- **Phone** is a `tel:` link. **Website** is an external link.
- **Email** — manually entered. If present, shows the address (click to edit via `EmailModal`); if absent, a faint "Add email" affordance appears on row hover.
- **Notes** — preview text; click opens `NotesModal`. Empty shows "Add note" on hover.
- **Status** — a `Badge` + chevron; clicking opens a **portaled dropdown** to change status inline; the chosen status persists and shows a toast.
- Selected rows tint with `primary-pale`.
- **Pagination footer:** "Showing X–Y of Z", page-size `Select` (10/25/50/100), prev/next, "Page N of M".

**Run history:** per-campaign `RunHistoryCard` (this campaign's runs only), with a note that all runs are visible on the Manager dashboard.

**Bulk action bar:** floating `BulkActionsBar` when rows are selected — Set status (menu) · Export · Delete.

**Modals:** `NotesModal` (textarea, "Saved changes are tracked in lead_history"), `EmailModal` (email input with validation).

---

## Screen 7 — Toasts

Bottom-right, stacked, fade-in:

| Type | Treatment | Dismiss |
|---|---|---|
| Success | white card, check icon | auto after 3s |
| Warning | yellow accent | manual |
| Error | white card, `negative` left border | manual |

Triggered on: campaign created/updated/paused/archived, scrape started/cancelled, lead status/notes/email saved, CSV export, worker errors.

---

## Behavior Contracts (must hold in the real build)

These come straight from the prototype and `PROJECT_PLAN.md` — honor them in implementation:

- **Polling interval: 3 seconds** for run status / new leads.
- **Stop Scraping = CANCEL**, not pause/resume. Already-saved leads stay.
- Lead status changes write to a **`lead_history`** audit trail.
- Dedupe is by **normalized domain + normalized phone**, enforced at the DB level.
- **Email is never scraped** — it is a manual field on leads (and an optional `notifyEmail` on campaigns).
- Run statuses are **COMPLETED / FAILED / CANCELLED**; a run also passes through PENDING → RUNNING.
- Dark mode persists to `localStorage`.
