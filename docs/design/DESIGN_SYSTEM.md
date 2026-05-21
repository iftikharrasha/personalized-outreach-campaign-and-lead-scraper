# Design System

This project uses a **Wise-inspired design language** — calm, functional, Scandinavian-leaning with generous whitespace, rounded surfaces, and a single lime-green accent as the primary CTA color. The implementation stack is **Tailwind CSS + shadcn/ui**; all visual decisions below map directly to Tailwind utilities or shadcn theme tokens.

---

## Colors

| Token | Hex | Use |
|---|---|---|
| `primary` | `#9fe870` | Primary CTA buttons, active nav indicator, brand accent — the sole identity color |
| `primary-hover` | `#cdffad` | Hover/active state on primary elements |
| `primary-pale` | `#e2f6d5` | Badge backgrounds, soft tint surfaces |
| `canvas` | `#ffffff` | Card interiors, modal backgrounds |
| `canvas-soft` | `#e8ebe6` | Page background, hero bands, sidebar |
| `ink` | `#0e0f0c` | Default text, headings, icon fills |
| `body` | `#454745` | Secondary body text |
| `mute` | `#868685` | Captions, placeholders, fine print |
| `positive` | `#2ead4b` | Success states |
| `warning` | `#ffd11a` | Caution, scrape-blocked banners |
| `negative` | `#d03238` | Destructive actions, errors |
| `border` | `#e2e8e0` | Subtle dividers, input borders |

**Rule:** `primary` green is reserved exclusively for CTAs. Never use it as a success indicator — use `positive` for that.

---

## Typography

Two faces only:

| Face | Role | Weight |
|---|---|---|
| **Inter** (or Manrope 800/900 for display) | All display headings | 900 for hero, 600 for sub-display |
| **Inter** | Body, labels, nav, captions | 400 default, 600 for emphasis |

| Scale | Size | Weight | Use |
|---|---|---|---|
| Display XL | 40px | 900 | Page-level hero headings |
| Display MD | 32px | 600 | Section headings |
| Display SM | 24px | 600 | Card headings, modal titles |
| Body LG | 20px | 400 | Lead paragraphs |
| Body MD | 16px | 400 | Default body, table cells |
| Body SM | 14px | 400 | Secondary content, badges |
| Caption | 12px | 400 | Fine print, hints |
| Button | 16px | 600 | Button labels |

---

## Spacing

Base unit: **4px**. All spacing is multiples of 4.

| Token | Value | Tailwind |
|---|---|---|
| xs | 4px | `p-1` |
| sm | 8px | `p-2` |
| md | 12px | `p-3` |
| lg | 16px | `p-4` |
| xl | 24px | `p-6` |
| 2xl | 32px | `p-8` |
| 3xl | 48px | `p-12` |

Card interior padding: `xl` (24px). Section gaps: `2xl` (32px). Page margin: `2xl` (32px).

---

## Shapes

| Token | Value | Use |
|---|---|---|
| `rounded-sm` | 8px | Inline badges, small pills |
| `rounded-md` | 12px | Form inputs |
| `rounded-lg` | 16px | Mid-size cards |
| `rounded-xl` | 24px | **Canonical card and button radius** — the brand's friendliness signature |
| `rounded-full` | 9999px | Status dots, circular icon buttons |

Never use sharp corners on cards or buttons.

---

## Elevation

Surface contrast is the primary elevation cue — no heavy drop shadows.

| Level | Treatment |
|---|---|
| Flat | No shadow, no border. Default. |
| Hairline | 1px solid `border` color. Inputs, tertiary buttons. |
| Card | White card on `canvas-soft` background. The surface contrast IS the elevation. |

---

## Components (Tailwind + shadcn mapping)

**Button — Primary**
`bg-[#9fe870] text-[#0e0f0c] font-semibold rounded-[24px] px-6 py-3 hover:bg-[#cdffad]`

**Button — Secondary**
`bg-[#e8ebe6] text-[#0e0f0c] font-semibold rounded-[24px] px-6 py-3`

**Button — Destructive**
`bg-[#d03238] text-white font-semibold rounded-[24px] px-6 py-3`

**Card**
`bg-white rounded-[24px] p-6` sitting on `bg-[#e8ebe6]` canvas.

**Input**
`bg-white border border-[#e2e8e0] rounded-[12px] px-4 py-2 text-[#0e0f0c]`

**Badge — Positive**
`bg-[#e2f6d5] text-[#054d28] text-xs font-semibold rounded-full px-3 py-1`

**Badge — Warning**
`bg-[#ffd11a]/20 text-[#b86700] text-xs font-semibold rounded-full px-3 py-1`

**Badge — Negative**
`bg-red-100 text-[#a7000d] text-xs font-semibold rounded-full px-3 py-1`

---

## Do's and Don'ts

**Do**
- Use `#9fe870` for every primary action.
- Use `rounded-[24px]` on all buttons and cards.
- Use `canvas-soft` (`#e8ebe6`) as the page/sidebar background; white for cards inside it.
- Use `positive` green (`#2ead4b`) for success feedback, never the brand `primary`.

**Don't**
- Don't introduce a second accent color.
- Don't use sharp corners on buttons or cards.
- Don't place the green CTA on a green background.
- Don't use drop shadows where surface contrast does the job.
