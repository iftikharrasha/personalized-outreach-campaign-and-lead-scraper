# Screen Specifications

Reference `DESIGN_SYSTEM.md` for all color, typography, spacing, and shape decisions.

---

## Global Shell

The app uses an **admin panel layout**: a collapsible left sidebar + a top header bar + a main content area. This shell wraps every page.

```
┌──────┬────────────────────────────────────────────────────┐
│ Logo                         [Search / actions]  [Avatar] │  ← Header bar (sticky, 64px tall)
│      │────────────────────────────────────────────────────│
│ Side │                                                    │
│ bar  │           Main content area                        │
│ Nav  │                                                    │
│ items│                                                    │
│      │                                                    │
└──────┴────────────────────────────────────────────────────┘
```

**Sidebar**
- Background: `canvas-soft` (`#e8ebe6`)
- Width: 240px expanded, 64px collapsed (icon-only)
- Toggle: chevron button at bottom of sidebar
- Currently one nav item: **Google Maps Scraper** (with map-pin icon)
- Active nav item: left border `primary` green + `primary-pale` background row
- Logo at top: app name or logo mark

**Header bar**
- Background: `canvas` (white)
- 1px bottom border (`border` color)
- Left: hamburger/toggle icon + logo text
- Right: theme toggle (sun/moon icon)

---

## Screen 1: Campaign List (`/`)

The main dashboard — lists all campaigns in a card grid.

```
┌──────┬────────────────────────────────────────────────────────────────┐
│      │  Lead Scraper                                    🌙            │
│ Sidebar ──────────────────────────────────────────────────────────────│
│      │                                                                │
│  🗺  │  Campaigns                                [+ New Campaign]     │
│  GMaps│                                                               │
│      │  [Search campaigns...]   All  Active  Paused  Archived        │
│      │                                                                │
│      │  ┌────────────┐  ┌────────────┐  ┌────────────┐  ┌──────────┐│
│      │  │ San Diego  │  │ LA Lawyers │  │ Chicago    │  │ NY       ││
│      │  │restaurants │  │ personal   │  │ dentists   │  │ cafes    ││  ← 4 per row
│      │  │            │  │ injury     │  │            │  │          ││
│      │  │ USA•CA•SD  │  │ USA•CA•LA  │  │ USA•IL•CHI │  │ USA•NY   ││
│      │  │ ● Active   │  │ ● Active   │  │ ● Active   │  │○ Archived││
│      │  │            │  │            │  │            │  │          ││
│      │  │ 142 leads  │  │ 89 leads   │  │ 201 leads  │  │ 55 leads ││
│      │  │ 45 cont.   │  │ 23 cont.   │  │ 78 cont.   │  │ 20 cont. ││
│      │  │ ▓▓▓░░ 32%  │  │ ▓▓░░░ 26% │  │ ▓▓▓▓░ 39% │  │▓▓▓▓░ 36%││
│      │  │            │  │            │  │            │  │          ││
│      │  │ Last: 2h   │  │ Last: 1d   │  │ Last: 3d   │  │ Last: 1w ││
│      │  │ +47 new    │  │ +52 new    │  │ +28 new    │  │ +14 new  ││
│      │  │            │  │            │  │            │  │          ││
│      │  │[Open][Run] │  │[Open][Run] │  │[Open][Run] │  │  [Open]  ││
│      │  │[Pause]     │  │[Pause]     │  │[Pause]     │  │[Restore] ││
│      │  └────────────┘  └────────────┘  └────────────┘  └──────────┘│
│      │                                                                │
└──────┴────────────────────────────────────────────────────────────────┘
```

**Layout**
- Page background: `canvas-soft`
- Cards: 4 per row on large screens (≥1280px), 2 per row on tablet, 1 on mobile
- Card background: white (`canvas`), `rounded-[24px]`, no shadow (surface contrast handles elevation)
- Card padding: 24px
- Gap between cards: 24px

**Campaign card contents (top to bottom)**
- Campaign name — 16px semibold, `ink`
- Keyword — 13px, `mute`
- Location badge — 12px rounded-full pill, `canvas-soft` bg, `body` text (e.g., "USA • CA • San Diego")
- Status dot + label — 8px circle + 12px label (green ● Active, yellow ● Paused, gray ○ Archived)
- Stats row — "142 leads · 45 contacted" in 12px `body`
- Progress bar — 4px tall, 100% card width, `primary` green fill on `border` track
- Last run line — "Last: 2h ago · +47 new" in 12px `mute`
- Buttons row — [Open] [Run] [Pause/Restore] as small secondary buttons

**Top of page**
- Page title "Campaigns" — 32px semibold
- [+ New Campaign] primary button — top-right
- Search input below title — full-width or 320px, searches campaign name/keyword
- Filter tabs below search — All / Active / Paused / Archived

**Empty state (no campaigns)**
- Centered on content area: large map-pin icon (64px, `mute`), "No campaigns yet" heading (24px), hint text (14px `mute`), [+ New Campaign] primary button

---

## Screen 2: Create Campaign Modal

```
┌────────────────────────────────────────────┐
│  New Campaign                           ✕  │
├────────────────────────────────────────────┤
│  Campaign Name                             │
│  [________________________________]        │
│  e.g., "San Diego Restaurants"             │
│                                            │
│  What to scrape?                           │
│  [Restaurants ▼]                           │
│                                            │
│  [If Custom selected]                      │
│  Custom keyword                            │
│  [________________________________]        │
│                                            │
│  Country              State               │
│  [United States ▼]    [California ▼]      │
│                                            │
│  City                                      │
│  [________________________________]        │
│  ☐ Entire State                            │
│                                            │
│  ─────────────────────────────────────    │
│                  [Cancel]  [Create →]      │
└────────────────────────────────────────────┘
```

- Modal width: 520px, padding 24px, `rounded-[24px]`, white bg
- Backdrop: semi-transparent `ink` overlay
- Input height: 44px, `rounded-[12px]`
- Field gap: 16px
- Dropdown "What to scrape": Restaurants / Dentists / Lawyers / Custom — auto-fills keyword
- "Entire State" checkbox hides the city input
- Validation: name and keyword required, error in `negative` red below field
- [Cancel]: secondary button; [Create →]: primary green button

---

## Screen 3: Campaign Detail (`/campaigns/[id]`)

```
┌──────┬────────────────────────────────────────────────────────────────┐
│      │  Lead Scraper                                    🌙            │
│ Side ──────────────────────────────────────────────────────────────────│
│ bar  │                                                                │
│      │  San Diego Restaurants                   ● ACTIVE             │
│      │  restaurants in San Diego                                      │
│      │  USA › CA › San Diego                                         │
│      │                         [Run Campaign] [Export ▼] [Edit] [Archive]│
│      │                                                                │
│      │  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐     │
│      │  │  Total   │  │   New    │  │Contacted │  │Conversion│     │
│      │  │   142    │  │   42     │  │   78     │  │  38%     │     │
│      │  └──────────┘  └──────────┘  └──────────┘  └──────────┘     │
│      │                                                                │
│      │  [Search leads...]                    [Status: All ▼]         │
│      │                                                                │
│      │  ☐  Business Name    Phone       Website      Status   Notes  │
│      │  ─────────────────────────────────────────────────────────── │
│      │  ☐  Pizza Hut        555-1234    pizzahut.com  NEW     [–]   │
│      │  ☐  Joe's Diner      555-5678    –             NEW     [note]│
│      │  ☐  Taco Bell        555-9012    tacobell.com  CONTACTED ✓  │
│      │  ...                                                          │
│      │                                                                │
│      │  Showing 1–25 of 142    [25 ▼]    ◄ 1  2  3 ►               │
│      │                                                                │
│      │  [If scraping]                                                 │
│      │  ⚡ Scraping in progress… 47 leads found    [Stop Scraping]   │
│      │                                                                │
│      │  [If selection active]                                         │
│      │  Selected (5)  [Set Status ▼]  [Delete]  [Export Selected]   │
│      │                                                                │
│      │  ▼ Run History                                                 │
│      │  ┌──────────────────────────────────────────────────────────┐ │
│      │  │ Started   Finished   Status      New   Dupes   Error    │ │
│      │  │ 1d ago    1d ago     COMPLETED   42    8       —        │ │
│      │  │ 3d ago    3d ago     FAILED      0     0       Rate limit│ │
│      │  └──────────────────────────────────────────────────────────┘ │
└──────┴────────────────────────────────────────────────────────────────┘
```

**Header**
- Campaign name: 32px semibold, `ink`
- Keyword: 14px `mute`
- Breadcrumb: 12px `mute` with `›` separators
- Status badge: `rounded-full` pill, green bg for ACTIVE
- Action buttons: [Run Campaign] primary, [Export ▼] secondary dropdown, [Edit] ghost, [Archive] ghost

**Stat cards**
- 4 equal columns, white cards, `rounded-[24px]`, 24px padding
- Large number: 40px weight 900
- Label below: 12px `mute`

**Leads table**
- Background: white card, `rounded-[24px]`
- Header: sticky, 12px uppercase `mute` labels
- Rows: 56px tall, hover `canvas-soft` background
- Status badge: clickable — opens inline dropdown, color-coded by status
- Notes cell: click → opens edit modal or inline textarea
- Scrape-running banner: `warning` yellow background, icon + text + [Stop] button
- Bulk action bar: visible when rows selected, `canvas-soft` bg

**Status badge colors**
| Status | Background | Text |
|---|---|---|
| NEW | `#e8ebe6` | `#0e0f0c` |
| CONTACTED | `#ffd11a`/20 | `#b86700` |
| REPLIED | `#e2f6d5` | `#054d28` |
| IGNORED | `#f5f5f4` | `#868685` |
| CLOSED | `#f3e8ff` | `#6b21a8` |

**Run history**
- Collapsible panel below table, `rounded-[24px]` white card
- Arrow chevron to expand/collapse
- Failed rows: `negative` red text in Status column

---

## Screen 4: Run Campaign Modal

```
┌────────────────────────────────────────────┐
│  Run Campaign: San Diego Restaurants    ✕  │
├────────────────────────────────────────────┤
│  Keyword: "restaurants in San Diego"       │
│                                            │
│  ◉ Add new leads only                      │
│    Existing leads stay. Duplicates skipped.│
│                                            │
│  ○ Replace all leads                       │
│    Deletes all 142 existing leads first.   │
│    [Warning in negative red if selected]   │
│                                            │
│  ─────────────────────────────────────    │
│               [Cancel]  [Start Scraping →] │
└────────────────────────────────────────────┘
```

- Width: 520px, `rounded-[24px]`, padding 24px
- Keyword line: 14px `mute`, read-only
- Radio option 1 selected by default
- Warning text only appears when option 2 is selected
- [Start Scraping →]: primary green button

---

## Screen 5: Empty State

Shown inside the main content area when no campaigns exist.

- Centered vertically and horizontally in the content area
- Map-pin icon: 64px, `mute` color
- Heading: "No campaigns yet" — 24px semibold
- Sub-text: "Create your first campaign to start scraping leads" — 14px `mute`
- [+ New Campaign]: primary green button, centered below text

---

## Screen 6: Toast Notifications

Bottom-right corner, 16px from edges, stacked if multiple.

| Type | Background | Icon | Auto-dismiss |
|---|---|---|---|
| Success | `positive-pale` / white border | ✓ | 3s |
| Error | white, `negative` left border | ✕ | Manual |
| Warning | `warning`/20 bg | ⚠ | Manual + Dismiss button |

- Width: 320px, `rounded-[16px]`, 16px padding, soft shadow
- Font: 14px, `ink`
- Icon: 16px Lucide icon, left-aligned
