# Phase 0 — Prerequisites & One-Time Setup

> **Goal:** Get your machine ready before any code is written. This phase is **done by you, not Claude**. Once everything here is checked off, tell Claude "Phase 0 done, start Phase 1."

**Status:** COMPLETED — all slices done
**Last Updated:** 2026-05-21

---

## Slices

| # | Slice | Status |
|---|---|---|
| 0.1 | Install Node.js 20 LTS or newer | COMPLETED — Node v22.18.0, npm 10.9.3 |
| 0.2 | Install PostgreSQL 15+ locally (includes pgAdmin) | COMPLETED — PostgreSQL 17 installed, pgAdmin bundled |
| 0.3 | Create the `lead_scraper` database | COMPLETED — `lead_scraper` created in pgAdmin, owner `postgres` |
| 0.4 | Confirm `git` is installed and repo is cloned | COMPLETED — git 2.37.3, repo cloned |
| 0.5 | (Windows-specific) Confirm PowerShell can run scripts | COMPLETED — confirmed by user |
| 0.6 | Decide on an editor (VS Code recommended) | COMPLETED — VS Code |

---

## Slice 0.1 — Node.js

**Status:** COMPLETED — verified `node v22.18.0`, `npm 10.9.3` (well past the Node 20 LTS minimum).

---

## Slice 0.2 — PostgreSQL

**Status:** COMPLETED — PostgreSQL 17 installed on Windows, port `5432`, owner `postgres`. pgAdmin 4 bundled and accessible.

---

## Slice 0.3 — Create the `lead_scraper` database

**Status:** COMPLETED — `lead_scraper` database created in pgAdmin 4, owner `postgres`. Prisma Slice 1.4 migration subsequently created all 4 tables (`campaigns`, `leads`, `scrape_runs`, `lead_history`).

---

## Slice 0.4 — Git & repo

**Status:** COMPLETED — verified `git 2.37.3`; repo cloned to `e:\Github\personalized-outreach-campaign-and-lead-scraper`.

---

## Slice 0.5 — PowerShell execution policy (Windows)

**Status:** COMPLETED — confirmed by user; PowerShell runs scripts fine.

---

## Slice 0.6 — Editor

**Status:** COMPLETED — VS Code in use.

Recommended extensions (install when convenient): **Prisma**, **Tailwind CSS IntelliSense**, **ESLint**.

---

## What you give Claude after Phase 0

**All done — Phase 0 is complete.** All three items were confirmed and Phase 1 Slice 1.4 (first migration) has already run:

1. ✅ PostgreSQL `postgres` password provided — written to `.env` (git-ignored).
2. ✅ `node --version` = v22.18.0 (well past Node 20 LTS minimum).
3. ✅ `lead_scraper` database confirmed in pgAdmin; Prisma migration `20260521104448_init` created all 4 tables.

---

## Testing notes

No tests in this phase. Phase 1 introduces the test folder and the first integration test.
