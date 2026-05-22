# Lead Scraper

A personal lead operating system. Create campaigns, scrape business data from
Google Maps, and manage leads through a clean UI — runs entirely on localhost.

---

## What it does

- **Campaigns** — each campaign is one search keyword tied to a location.
- **Scraping** — a background worker drives a real browser through Google Maps,
  extracts business name, phone, website and address, and de-duplicates leads
  by domain and phone.
- **Lead management** — inline status edits, notes, manual emails, search,
  filter, sort, pagination, bulk actions, and CSV export.
- **Reliability** — block detection, run cancellation, and crash recovery so a
  scrape survives the real world.

---

## Quick start

A new machine should be running in well under 30 minutes.

### Prerequisites (once)

1. Install **Node.js 20 LTS** — [nodejs.org](https://nodejs.org)
2. Install **PostgreSQL 15+** — [postgresql.org](https://www.postgresql.org/download/windows)
3. Create the database:
   ```powershell
   createdb -U postgres lead_scraper
   ```

### Setup

```powershell
# 1. Install dependencies
npm install

# 2. Configure the database connection
#    Copy .env.example to .env and set DATABASE_URL with your postgres password.

# 3. Apply the schema and generate the Prisma client
npx prisma migrate dev

# 4. Install the browser the scraper drives (once)
npx playwright install chromium
```

### Run

```powershell
# Terminal 1 — web app
npm run dev

# Terminal 2 — background scraper worker
npm run worker
```

Open **http://localhost:3000**.

> The worker must be running for scrapes to execute. The web app queues a
> scrape; the worker claims and runs it.

---

## Routes

| Route               | Page                                                    |
|---------------------|---------------------------------------------------------|
| `/`                 | Manager dashboard — funnel, earnings, run history       |
| `/googlemaps`       | Campaign list — create, run, pause, archive campaigns   |
| `/googlemaps/[id]`  | Campaign detail — leads table, scrape controls, export  |

---

## Project structure

```
apps/
├── web/          # Next.js app — UI, API routes, dashboard
│   ├── app/      #   pages + /api route handlers
│   ├── components/
│   └── lib/
└── scraper/      # Background worker — Playwright + Google Maps extraction
    └── src/      #   worker loop, google-maps.ts, dedupe.ts, block-detection.ts
packages/
└── shared/       # Normalizers shared by web + scraper (domain/phone)
prisma/
└── schema.prisma # Campaign, Lead, ScrapeRun, LeadHistory models
tests/
├── unit/         # Pure-function tests (normalizers, block detection, dedupe)
└── integration/  # DB-backed tests (data-flow parity, races, performance)
docs/             # Project plan, design system, per-phase implementation specs
```

---

## Commands

| Command            | What it does                                    |
|--------------------|-------------------------------------------------|
| `npm run dev`      | Start the Next.js web app                       |
| `npm run worker`   | Start the background scraper worker             |
| `npm run test`     | Run the full test suite (unit + integration)    |
| `npx prisma studio`| Browse the database in a GUI                    |

> Integration tests require a running PostgreSQL database with the schema
> migrated.
