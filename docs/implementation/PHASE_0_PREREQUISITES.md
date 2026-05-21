# Phase 0 — Prerequisites & One-Time Setup

> **Goal:** Get your machine ready before any code is written. This phase is **done by you, not Claude**. Once everything here is checked off, tell Claude "Phase 0 done, start Phase 1."

**Status:** IN PROGRESS — only PostgreSQL install remains
**Last Updated:** 2026-05-21

---

## Slices

| # | Slice | Status |
|---|---|---|
| 0.1 | Install Node.js 20 LTS or newer | COMPLETED — Node v22.18.0, npm 10.9.3 |
| 0.2 | Install PostgreSQL 15+ locally (includes pgAdmin) | NOT STARTED — **action needed by you** |
| 0.3 | Create the `lead_scraper` database | NOT STARTED — blocked on 0.2 |
| 0.4 | Confirm `git` is installed and repo is cloned | COMPLETED — git 2.37.3, repo cloned |
| 0.5 | (Windows-specific) Confirm PowerShell can run scripts | COMPLETED — confirmed by user |
| 0.6 | Decide on an editor (VS Code recommended) | COMPLETED — VS Code |

---

## Slice 0.1 — Node.js

**Status:** COMPLETED — verified `node v22.18.0`, `npm 10.9.3` (well past the Node 20 LTS minimum).

---

## Slice 0.2 — PostgreSQL

**Status:** NOT STARTED — **this is the one thing you still need to do.**

PostgreSQL is not installed on this machine. The official Windows installer **bundles pgAdmin**, so installing PostgreSQL gives you the database server *and* the pgAdmin GUI you plan to use.

1. Download the installer from <https://www.postgresql.org/download/windows/> (use the EDB installer, PostgreSQL 15 or 16).
2. Run it. During setup:
   - Keep the default components (PostgreSQL Server, **pgAdmin 4**, Command Line Tools).
   - **Set a password for the `postgres` superuser and write it down** — Claude needs it for `.env` in Slice 1.4.
   - Keep the default port `5432`.
3. Verify in PowerShell:
   ```powershell
   & "C:\Program Files\PostgreSQL\16\bin\psql.exe" --version
   ```
   (Adjust `16` to `15` if you installed v15.)
- Expected: `psql (PostgreSQL) 16.x` or `15.x`.

> Optionally add `C:\Program Files\PostgreSQL\16\bin` to your `PATH` so `psql` works without the full path. Not required — pgAdmin and Prisma both work fine without it.

---

## Slice 0.3 — Create the `lead_scraper` database

**Status:** NOT STARTED — blocked on Slice 0.2.

You'll use **pgAdmin** for this:

1. Open **pgAdmin 4** (installed alongside PostgreSQL).
2. Expand **Servers → PostgreSQL** (enter the `postgres` password when prompted).
3. Right-click **Databases → Create → Database…**.
4. Name it exactly `lead_scraper`, leave the owner as `postgres`, click **Save**.

`lead_scraper` should now appear under Databases.

> CLI alternative, if you added `psql` to PATH: `createdb -U postgres lead_scraper`.

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

When you tell Claude "Phase 0 done, start Phase 1," have these ready to paste in:

1. PostgreSQL `postgres` user password (Claude will put it in `.env`).
2. Confirmation that `node --version` returned 20+.
3. Confirmation that `lead_scraper` database exists.

Claude will not start Phase 1 until those three are confirmed.

---

## Testing notes

No tests in this phase. Phase 1 introduces the test folder and the first integration test.
