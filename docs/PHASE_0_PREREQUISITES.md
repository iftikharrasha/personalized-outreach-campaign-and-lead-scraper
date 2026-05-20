# Phase 0 — Prerequisites & One-Time Setup

> **Goal:** Get your machine ready before any code is written. This phase is **done by you, not Claude**. Once everything here is checked off, tell Claude "Phase 0 done, start Phase 1."

**Status:** NOT STARTED
**Last Updated:** –

---

## Slices

| # | Slice | Status |
|---|---|---|
| 0.1 | Install Node.js 20 LTS or newer | NOT STARTED |
| 0.2 | Install PostgreSQL 15+ locally | NOT STARTED |
| 0.3 | Create the `lead_scraper` database | NOT STARTED |
| 0.4 | Confirm `git` is installed and repo is cloned | NOT STARTED |
| 0.5 | (Windows-specific) Confirm PowerShell can run scripts | NOT STARTED |
| 0.6 | Decide on an editor (VS Code recommended) | NOT STARTED |

---

## Slice 0.1 — Node.js

**Status:** NOT STARTED

- Install Node 20 LTS or newer from <https://nodejs.org>.
- Verify in PowerShell:
  ```powershell
  node --version
  npm --version
  ```
- Expected: `v20.x.x` or higher, `10.x.x` or higher.

---

## Slice 0.2 — PostgreSQL

**Status:** NOT STARTED

- Install PostgreSQL 15+ from <https://www.postgresql.org/download/windows/>.
- During install, **remember the password** you set for the `postgres` superuser. You'll paste it into `.env` later.
- Verify:
  ```powershell
  psql --version
  ```
- Expected: `psql (PostgreSQL) 15.x` or higher.

---

## Slice 0.3 — Create the database

**Status:** NOT STARTED

- Open PowerShell and run:
  ```powershell
  createdb -U postgres lead_scraper
  ```
  (You'll be prompted for the postgres password from Slice 0.2.)
- Verify:
  ```powershell
  psql -U postgres -l
  ```
- Expected: `lead_scraper` appears in the list.

> If `createdb` is not recognized, add PostgreSQL's `bin/` folder (e.g., `C:\Program Files\PostgreSQL\15\bin`) to your `PATH` environment variable.

---

## Slice 0.4 — Git & repo

**Status:** NOT STARTED

- This repo is already cloned to `e:\Github\personalized-outreach-campaign-and-lead-scraper`.
- Verify:
  ```powershell
  git --version
  git status
  ```

---

## Slice 0.5 — PowerShell execution policy (Windows)

**Status:** NOT STARTED

Some npm scripts run `.ps1` files. Allow them:

```powershell
Get-ExecutionPolicy
```

If it returns `Restricted`, run (as Administrator):

```powershell
Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser
```

---

## Slice 0.6 — Editor

**Status:** NOT STARTED

- VS Code recommended: <https://code.visualstudio.com>.
- Helpful extensions: **Prisma**, **Tailwind CSS IntelliSense**, **ESLint**.

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
