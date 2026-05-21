# Lead Scraper

A personal lead operating system. Create campaigns, scrape business data from Google Maps, and manage leads through a clean UI — runs entirely on localhost.

---

## Project Structure

```
docs/
├── PROJECT_PLAN.md              # Master plan — vision, decisions, phases, implementation checklist
├── design/
│   ├── DESIGN_SYSTEM.md         # Colors, typography, spacing, components (Wise-inspired + Tailwind)
│   ├── DESIGN_SCREENS.md        # Screen-by-screen layout specs and wireframes
│   └── screens/                 # Exported mockup screenshots from Claude Design
└── implementation/
    ├── PHASE_0_PREREQUISITES.md
    ├── PHASE_1_FOUNDATION.md
    ├── PHASE_2_SCRAPER.md
    ├── PHASE_3_RELIABILITY.md
    ├── PHASE_4_POLISH.md
    └── PHASE_5_QA_AND_HARDENING.md
```

---

## How This Project Gets Built

**Two layers, in order:**

**Layer 1 — Design.** `DESIGN_SYSTEM.md` and `DESIGN_SCREENS.md` are given to Claude Design to produce high-fidelity mockups. Approved screenshots are saved into `docs/design/screens/`. No code is written yet.

**Layer 2 — Implementation.** Claude Code reads the design system, references the screens folder for visual targets, and implements each phase in order using the phase docs in `docs/implementation/`.

---

## Getting Started

### Prerequisites (do this once)

1. Install **Node.js 20 LTS** — [nodejs.org](https://nodejs.org)
2. Install **PostgreSQL 15+** — [postgresql.org](https://www.postgresql.org/download/windows)
3. Create the database:
   ```powershell
   createdb -U postgres lead_scraper
   ```
4. Clone this repo and open it in your editor.

See `docs/implementation/PHASE_0_PREREQUISITES.md` for full details.

### Running the app

```powershell
# Terminal 1 — web app
npm run dev

# Terminal 2 — background scraper worker
npm run worker
```

App runs at `http://localhost:3000`.

---

## Working with Claude Code

Tell Claude Code which phase or slice to work on:

- `"go all at once on phase 1"` — implements the whole phase
- `"do slices 1, 2, 3 in phase 2"` — implements specific slices
- `"do the next slice"` — picks up where it left off
- `"status"` — reports what's done, in progress, or blocked

Claude Code will pause and ask you when it needs a database password, a `.env` value, or confirmation before a migration.
