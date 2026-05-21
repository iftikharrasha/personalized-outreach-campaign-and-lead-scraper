# Design System

This is the canonical design language for the app, codenamed **Outrich**. It is **Wise-inspired** — calm, Scandinavian, generous whitespace, rounded surfaces, a single lime-green accent for primary actions. The stack is **Tailwind CSS + shadcn/ui**; every token below is already wired into the prototype's `tailwind.config` (`docs/design/prototype/index.html`) and should be copied verbatim into the real Next.js Tailwind config.

> **Source of truth for visuals:** the working prototype in [`prototype/`](./prototype/). When this doc and the prototype disagree, the prototype wins — it was reviewed and approved.

---

## Tailwind Config (copy verbatim)

```js
// tailwind.config — theme.extend
darkMode: 'class',
colors: {
  primary:        '#9fe870',
  'primary-hover':'#cdffad',
  'primary-pale': '#e2f6d5',
  canvas:         '#ffffff',
  'canvas-soft':  '#e8ebe6',
  ink:            '#0e0f0c',
  body:           '#454745',
  mute:           '#868685',
  positive:       '#2ead4b',
  warning:        '#ffd11a',
  negative:       '#d03238',
  line:           '#e2e8e0',
  // dark theme
  'd-canvas':     '#1f221c',
  'd-canvas-soft':'#14150f',
  'd-ink':        '#f6f7f3',
  'd-body':       '#b8bab5',
  'd-mute':       '#868685',
  'd-line':       '#2a2c27',
},
fontFamily: { sans: ['Inter', 'system-ui', 'sans-serif'] },
borderRadius: { card: '24px' },
```

---

## Colors

| Token | Light | Dark equivalent | Use |
|---|---|---|---|
| `primary` | `#9fe870` | same | Primary CTA buttons, active nav indicator — the sole brand accent |
| `primary-hover` | `#cdffad` | same | Hover state on primary buttons |
| `primary-pale` | `#e2f6d5` | same | Positive badge background, selected-row tint |
| `canvas` | `#ffffff` | `d-canvas` `#1f221c` | Card interiors, modal backgrounds |
| `canvas-soft` | `#e8ebe6` | `d-canvas-soft` `#14150f` | Page background, secondary buttons, soft chips |
| `ink` | `#0e0f0c` | `d-ink` `#f6f7f3` | Primary text, headings |
| `body` | `#454745` | `d-body` `#b8bab5` | Secondary body text |
| `mute` | `#868685` | `d-mute` `#868685` | Captions, placeholders, icons-at-rest |
| `line` | `#e2e8e0` | `d-line` `#2a2c27` | Borders, dividers, table row separators |
| `positive` | `#2ead4b` | same | Success states, "+N new" text, replied badge |
| `warning` | `#ffd11a` | same | Scrape-in-progress banner, paused status, block timer |
| `negative` | `#d03238` | same | Destructive actions, errors, failed runs |

**Rule:** `primary` lime-green is reserved exclusively for CTAs and the active-nav marker. Success feedback uses `positive` (a different, deeper green). Never mix them.

Dark-theme classes are written inline as `light-value dark:dark-value` — e.g. `bg-canvas dark:bg-d-canvas`, `text-ink dark:text-d-ink`. Dark mode is toggled via a `dark` class on `<html>` and persisted to `localStorage` (`outrich-dark`).

---

## Typography

**One font: Inter** (weights 400–900). No proprietary face — Inter at weight 900 carries the display role.

| Role | Size | Weight | Use |
|---|---|---|---|
| Page title | 32–36px | 700 (bold) | `<PageHeader>` h1 |
| Section heading | 20px | 600 | "Leads", "Winning Leads" |
| Section label | 15px | 600 | Dashboard row labels ("Outreach funnel") |
| Card heading | 17–22px | 600 | Campaign card name, modal titles |
| Stat value | 26–34px | 700 | `<StatCard>` numbers |
| Body | 14–15px | 400 | Default text, table cells |
| Body strong | 13–14px | 600 | Field labels, emphasis |
| Caption | 11–13px | 400 | Hints, "Added" column, breadcrumb |
| Eyebrow | 11px | 600 | Uppercase tracking-wider labels (table headers, "KEYWORD") |

---

## Spacing & Layout

Base unit **4px**. Common values: `4 · 8 · 12 · 16 · 24 · 32 · 48`.

- **Page content:** `px-8 py-10`, centered, `max-w-[1480px]`.
- **Card interior:** `p-6` (24px).
- **Card gap in grids:** `gap-6` / `gap-4`.
- **Detail page** uses `pb-32` to leave room for the floating bulk-action bar.

**Responsive grid breakpoints (campaign cards):**
`grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4` — 4-up only on the widest screens.
Stat cards: `grid-cols-2 lg:grid-cols-4`.

---

## Shapes & Radius

| Token | Value | Use |
|---|---|---|
| `rounded-[10px]` | 10px | Small chrome (icon buttons, banner) |
| `rounded-[14px]` | 14px | Inputs, nav items, small buttons (`sm`), dropdowns, soft chips |
| `rounded-[18px]` | 18px | Medium buttons (`md`) |
| `rounded-card` (24px) | 24px | **Cards, modals, large buttons (`lg`)** — the brand's signature radius |
| `rounded-full` | 9999px | Badges, status dots, avatar, circular icon buttons |

Never use sharp corners on cards or buttons.

---

## Elevation

Surface contrast is the primary elevation cue — `canvas` white cards on a `canvas-soft` page. Shadows are used sparingly:

- **Cards:** flat, no shadow. The white-on-sage contrast IS the elevation.
- **Portaled dropdowns / popovers:** soft shadow `shadow-[0_18px_40px_-16px_rgba(0,0,0,0.25)]`.
- **Modals:** backdrop dim + the card's own radius; subtle shadow allowed.

---

## Core Components (shadcn mapping)

These are the shared primitives. Component names match the prototype's `ui.jsx` so prop/visual parity carries into the real shadcn-based build.

### Button — `variant` × `size`

| Variant | Style |
|---|---|
| `primary` | `bg-primary text-ink hover:bg-primary-hover` |
| `secondary` | `bg-canvas-soft text-ink hover:bg-line` |
| `chip` | `bg-canvas text-ink border border-line` — used for detail-page action buttons (Export, Edit, Archive) |
| `ghost` | transparent, `hover:bg-canvas-soft` |
| `destructive` | `bg-negative text-white` |
| `outline` | transparent + `border-line` |

Sizes: `sm` (`rounded-[14px]`), `md` (`rounded-[18px]`), `lg` (`rounded-card`).

### Badge — `tone`

`neutral` · `positive` · `warning` · `negative` · `purple` · `mute` · `primary` · `info`. Always `rounded-full`, semibold, optional leading `dot`.

**Lead status → tone:** NEW → `neutral` · CONTACTED → `warning` · REPLIED → `positive` · IGNORED → `mute` · CLOSED → `purple`.
**Run status → tone:** COMPLETED → `positive` · FAILED → `negative` · CANCELLED → `mute`.

### Card

`bg-canvas dark:bg-d-canvas rounded-card`. No border, no shadow.

### Input / Select / Checkbox / Textarea

White background, `border-line`, `rounded-[14px]`, focus ring `2px solid #9fe870 offset-2`. `<Select>` is a **portaled dropdown** — it must escape `overflow-hidden` parents (notably when used inside a Card's pagination footer).

### StatCard

`<StatCard label value sub icon tone valueClassName accent />`. `tone` is `canvas` (default white) | `primary` | `ink` (inverted dark card). Used on both the dashboard and the campaign detail stats row.

### RunHistoryCard / RunHistoryTable

Collapsible run-log card. Props: `runs`, `showCampaign` (adds a Campaign column for the dashboard's global view), `onOpenCampaign`. The per-campaign detail page passes campaign-filtered runs; the dashboard passes all runs.

### BulkActionsBar

Floating pill that appears when table rows are selected. `<BulkActionsBar count onClear actions={[...]} />` where actions are `menu | button | divider`. Centered against the content area (not the viewport) via a `--sidebar-w` CSS variable.

### Modal

Centered, `rounded-card`, backdrop dim, fade-in animation. Width is a prop (480 / 520 / 560 / 580).

### Layout shell — Sidebar + Header

Covered in detail in `DESIGN_SCREENS.md` → Global Shell.

---

## Motion

| Animation | Use |
|---|---|
| `fadein` (0.22s) | Toasts, dropdowns, scraping banner |
| `scalein` (0.18s) | Modals |
| `pulsegreen` (1.4s loop) | Live "scraping" status dot |
| `indeterm` (1.6s loop) | Indeterminate scraping progress bar |

Focus rings everywhere: `outline: 2px solid #9fe870; outline-offset: 2px`.

---

## Do's and Don'ts

**Do**
- Copy the Tailwind color block verbatim. These hex values are locked.
- Use `rounded-card` (24px) for cards, modals, and large buttons.
- Keep the sidebar **inverted** — dark in light theme, light in dark theme.
- Use `positive` green for success, `primary` green only for CTAs.
- Treat the prototype as the visual contract — match it.

**Don't**
- Don't introduce a second accent color.
- Don't use sharp corners on cards or buttons.
- Don't put the green CTA on a green background.
- Don't add drop shadows to cards — surface contrast handles elevation.
