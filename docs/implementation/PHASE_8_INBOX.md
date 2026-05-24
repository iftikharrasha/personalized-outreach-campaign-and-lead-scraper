# Phase 8 — Inbox (Outreach Composer & Send History)

> **Goal:** Add an Inbox feature that lets the user send test emails to selected
> leads via MailHog SMTP, store each send as a threaded conversation under its
> originating campaign, and keep a permanent history of what was sent to whom.
> The system mimics a bulk-email workflow without actually sending bulk — the
> user copies the final recipient list to a real email client when ready to
> ship for production.

**Status:** NOT STARTED
**Last Updated:** –

**Prerequisites:** [Phase 6 (Email Enrichment)](./PHASE_6_EMAIL_ENRICHMENT.md) and [Phase 7 (Yelp)](./PHASE_7_YELP_API_ADAPTER.md) completed. Leads must have emails before they appear in Inbox flows.

---

## Slices

| # | Slice | Status |
|---|---|---|
| 8.1 | DB schema — `InboxThread`, `InboxRecipient`, `InboxMessage`, `InboxMessageRecipient` + migration | NOT STARTED |
| 8.2 | MailHog SMTP transport (`apps/web/lib/smtp.ts`) — nodemailer wrapper + env config | NOT STARTED |
| 8.3 | HTML file storage helpers (`apps/web/lib/inbox-storage.ts`) — write, read, delete files at `data/outreach-html/[messageId].html` | NOT STARTED |
| 8.4 | API routes — list threads, create thread (from selection), get thread, send message, delete message, search leads by email | NOT STARTED |
| 8.5 | State bridge — Zustand store for "pending selection" (volatile, cleared on refresh) | NOT STARTED |
| 8.6 | Campaign page — "Inbox" button in bulk actions bar + email-missing warning | NOT STARTED |
| 8.7 | Inbox layout — three-pane shell, campaigns rail, threads rail, main pane (route: `/inbox`, `/inbox/[campaignId]`, `/inbox/[campaignId]/[threadId]`) | NOT STARTED |
| 8.8 | Thread view — Gmail-style stacked messages, "New Message" composer, scroll-to-bottom, delete thread/message, copy recipients | NOT STARTED |
| 8.9 | Composer — Subject, From, To chips (with manual lead search), HTML drop/paste, 600 px live preview iframe, Send | NOT STARTED |
| 8.10 | Tests — SMTP wrapper, HTML file lifecycle, thread send + multi-recipient status, file cleanup on delete | NOT STARTED |

---

## What you (the user) must provide during Phase 8

| When | What | Why |
|---|---|---|
| Before Slice 8.2 | MailHog SMTP credentials in `.env` (`MAILHOG_SMTP_HOST`, `MAILHOG_SMTP_PORT`, `MAILHOG_SMTP_USER`, `MAILHOG_SMTP_PASS`, `MAILHOG_FROM_ADDRESS`) | nodemailer cannot connect without them. Free credentials from [mailhog.site](https://mailhog.site/) |
| Before Slice 8.7 | Confirm the prototype design once Claude Design produces it | Visual approval before front-end implementation |

---

## 1. What This Phase Delivers

A new top-level section called **Inbox**, reachable from the sidebar and from a
new **Inbox** action in the campaign-page bulk-action bar.

The Inbox is a **mail-client UI** with three vertical panes:

1. **Campaigns rail** — shows only campaigns that have at least one inbox
   thread (i.e. used for outreach at least once). Each row has the campaign
   name and a small inbox count.
2. **Threads rail** — for the active campaign, lists threads sorted by most
   recent message. Each row shows recipient summary, last subject, last sent
   date. A "+ New Compose" button at the top opens a blank thread with manual
   recipient search. A "Copy recipients" icon copies the active thread's email
   list to clipboard for pasting into Gmail/Outlook.
3. **Main pane** — the active thread. Messages stack vertically like Gmail
   conversation view. Scroll auto-pinned to bottom on open. A **New Message**
   button at the bottom expands an inline composer that re-uses the thread's
   recipient list. Top-right of each message has a delete button.

Sending a message:
- Subject, From (read-only — MailHog identity), To (chips), HTML body.
- Drop or paste HTML into the body area → live 600 px preview iframe renders
  immediately. Edit and re-paste to update.
- Press **Send** → nodemailer pushes to MailHog SMTP, response is recorded per
  recipient (sent / failed), HTML file written to `data/outreach-html/`, DB
  rows committed.

The user can later select the same or different leads from a campaign, click
Inbox, and a **new** thread is created (never matched/merged with existing).
"New Message" inside a thread re-uses the same recipient group — this is the
only way to add messages to an existing thread.

---

## 2. Why "Mimic Bulk" Instead of Real Bulk Send

| Factor | Real bulk send | MailHog mimic (chosen) |
|---|---|---|
| Deliverability risk | Real (spam, blocks, throttling) | None — captured by MailHog |
| Dev iteration speed | Slow (real SMTP, real recipients) | Instant |
| History tracking | Same | Same |
| Recipient privacy | Exposes real emails during dev | Safe |
| Path to production | Same nodemailer wrapper, swap SMTP creds | Same nodemailer wrapper, swap SMTP creds |
| Copy-to-clipboard workflow | Not needed | Needed (user pastes into Gmail/Outlook for real send) |

The **MailHog + clipboard** approach gives the user a permanent log of every
test outreach inside Outrich Manager, while letting them choose when and how
to send for real. When they're ready to do real sends, the same nodemailer
code path works against any SMTP server — only the env vars change.

---

## 3. The Thread Model

This is the most important conceptual decision in this phase. Read carefully.

### Threads anchor to a recipient group, not a subject

In Gmail, a thread groups messages by subject and reply chain. In our Inbox,
a thread groups messages by **the recipient list at thread creation time**.

```
Thread #1234 (Campaign "Dhaka poultry farms")
├── Recipients (snapshot): a@x.com, b@y.com, c@z.com
│
├── Message #1 (sent 2026-05-22)
│    Subject: "Quick question about your suppliers"
│    Body: <html>…</html>
│    Per-recipient: a@x.com=sent, b@y.com=sent, c@z.com=failed
│
├── Message #2 (sent 2026-05-25)
│    Subject: "Following up"
│    Body: <html>…</html>
│    Per-recipient: a@x.com=sent, b@y.com=sent, c@z.com=sent
│
└── Message #3 (sent 2026-05-28)
     …
```

### Why this model

- **Outreach reality:** when you contact a group of leads you usually send
  *several* messages to the same group over time (initial pitch, follow-up,
  bump, last attempt). Grouping by recipient list reflects how outreach
  actually flows.
- **No reply chain to model:** MailHog doesn't reply. There is no inbound.
  So Gmail-style subject threading would be arbitrary.
- **Predictable behaviour:** "New Message" always sends to the same group. The
  user is never surprised by who gets a follow-up.

### Coming from the campaign page = always a new thread

If the user selects leads A, B, C on the campaign page and clicks Inbox, we
create a new thread with recipients `{A, B, C}`. If they later select
`{A, B, C}` again and click Inbox, we create **another** new thread. We do
not try to match existing threads by recipient list overlap — that logic is
fragile (what if 2 of 3 match? what if an email changed since the original
thread?). Simple rule: campaign → Inbox button = new thread, every time.

### Adding messages to a thread

The **only** way to extend a thread is the "New Message" button inside the
open thread view. That composer is pre-populated with the thread's
recipients and is not editable — you can remove chips before sending, but
removed recipients are skipped for that single send, not removed from the
thread.

### Manual "New Compose" creates a one-off thread

The "+ New Compose" button at the top of the threads rail opens a blank
thread with an **empty** recipient list. The user searches leads by email or
business name (scoped to the active campaign) and adds chips manually. When
the first message is sent, the thread is persisted with those recipients as
its anchor group. Same rules apply afterward.

---

## 4. Data Model

### New tables

```prisma
model InboxThread {
  id          String           @id @default(uuid()) @db.Uuid
  campaignId  String           @map("campaign_id") @db.Uuid
  createdAt   DateTime         @default(now()) @map("created_at")
  updatedAt   DateTime         @updatedAt        @map("updated_at")

  campaign    Campaign         @relation(fields: [campaignId], references: [id], onDelete: Cascade)
  recipients  InboxRecipient[]
  messages    InboxMessage[]

  @@index([campaignId])
  @@index([updatedAt])
  @@map("inbox_threads")
}

model InboxRecipient {
  id        String       @id @default(uuid()) @db.Uuid
  threadId  String       @map("thread_id") @db.Uuid
  // Snapshot at thread creation — lead may be deleted later, this preserves the recipient list.
  leadId    String?      @map("lead_id") @db.Uuid  // null if added manually before lead existed (won't happen in practice)
  email     String       @db.VarChar(254)
  // Display name snapshot (business name at the time)
  name      String?      @db.VarChar(255)

  thread    InboxThread  @relation(fields: [threadId], references: [id], onDelete: Cascade)
  lead      Lead?        @relation(fields: [leadId], references: [id], onDelete: SetNull)

  @@unique([threadId, email])
  @@index([threadId])
  @@map("inbox_recipients")
}

model InboxMessage {
  id            String                    @id @default(uuid()) @db.Uuid
  threadId      String                    @map("thread_id") @db.Uuid
  subject       String                    @db.VarChar(998)         // RFC 5322 line-length cap
  fromAddress   String                    @map("from_address") @db.VarChar(254)
  // Path on disk relative to project root, e.g. "data/outreach-html/<id>.html"
  htmlFilePath  String?                   @map("html_file_path")
  // Optional plain-text fallback the user can fill in. Empty allowed.
  plainText     String?                   @map("plain_text")        // text type
  sentAt        DateTime?                 @map("sent_at")
  status        InboxMessageStatus        @default(DRAFT)
  errorMessage  String?                   @map("error_message")
  createdAt     DateTime                  @default(now()) @map("created_at")

  thread        InboxThread               @relation(fields: [threadId], references: [id], onDelete: Cascade)
  recipients    InboxMessageRecipient[]

  @@index([threadId])
  @@index([sentAt])
  @@map("inbox_messages")
}

model InboxMessageRecipient {
  id              String                       @id @default(uuid()) @db.Uuid
  messageId       String                       @map("message_id") @db.Uuid
  email           String                       @db.VarChar(254)
  status          InboxMessageRecipientStatus  @default(PENDING)
  smtpMessageId   String?                      @map("smtp_message_id")
  errorMessage    String?                      @map("error_message")

  message         InboxMessage                 @relation(fields: [messageId], references: [id], onDelete: Cascade)

  @@unique([messageId, email])
  @@index([messageId])
  @@map("inbox_message_recipients")
}

enum InboxMessageStatus {
  DRAFT       // composing, never sent — should be rare since we send immediately
  SENT        // SMTP accepted for at least one recipient
  PARTIAL     // some sent, some failed
  FAILED      // all recipients rejected
}

enum InboxMessageRecipientStatus {
  PENDING
  SENT
  FAILED
}
```

### Relations to add on existing models

```prisma
model Campaign {
  // … existing fields
  inboxThreads InboxThread[]
}

model Lead {
  // … existing fields
  inboxRecipients InboxRecipient[]
}
```

### Migration filename

`prisma/migrations/<timestamp>_add_inbox_tables/migration.sql`

### Why these specific choices

| Decision | Reason |
|---|---|
| Snapshot `email` and `name` on `InboxRecipient` | If a lead is deleted or its email changes later, the thread's recipient list stays stable. |
| `leadId` is nullable with `onDelete: SetNull` | Threads survive lead deletion; we just lose the link. |
| `InboxMessageRecipient` is a separate row per recipient | Per-recipient SMTP status (sent / failed / pending), needed for the per-recipient log you asked for. |
| `htmlFilePath` is nullable | A message may have only a plain-text body (no HTML). |
| `plainText` exists but is optional | nodemailer benefits from a plain-text alternative; we offer it but don't require it. |
| `status` on `InboxMessage` derived from recipients | A message's overall status is `SENT` if all recipients sent, `PARTIAL` if mixed, `FAILED` if none. We persist it on the message row for fast list rendering. |

---

## 5. File Storage

### Location

`data/outreach-html/[messageId].html` — relative to the **project root**,
not the `apps/web` working directory. Because Next.js dev/build runs from
the workspace root in this repo, `fs.writeFile("data/outreach-html/...", ...)`
resolves correctly.

The `data/` directory is created if missing on first write.

### Why outside `public/`

If we stored HTML under `public/outreach-html/`, Next.js would serve every
historical outreach email as a static asset at a guessable URL. That's a
leak we don't need on a localhost project that may later get deployed.
Serving via an authenticated-by-locality API route is safer:

```
GET /api/inbox/html/[messageId]
  → fs.readFile → Content-Type: text/html → response
```

The preview iframe loads `<iframe src="/api/inbox/html/[messageId]">` for
historical messages and `<iframe srcDoc={localHtmlString}>` while composing.

### Lifecycle

| Event | File action |
|---|---|
| Compose, paste HTML | Held in React state only, no file yet |
| Send | Write `data/outreach-html/<newMessageId>.html`, store path on `InboxMessage.htmlFilePath` |
| Delete message | Unlink file, then delete row (in that order — DB cascade handles recipients) |
| Delete thread | For each message in the thread, unlink file → then DB cascade deletes everything |
| File missing on read | Surface "HTML file not found" in the preview pane; don't crash; offer to delete the orphan message |

### Server-side guards

The API route that reads HTML files must:
- Resolve `messageId` against the DB before reading any file path
- Use `messageId` to derive the path — never accept a raw path from the client
- Reject path traversal attempts (`../`) by validating that `messageId` is a UUID

This is a localhost tool, but the patterns matter the day it gets deployed.

---

## 6. State Bridge — Selection → Inbox Navigation

The user's spec: **state in memory only**. If they refresh, the campaign's
inbox view still opens, but no leads are pre-selected. Manual search lets
them re-pick.

### Implementation: Zustand store

A new client store at `apps/web/lib/stores/pending-selection.ts`:

```ts
interface PendingSelection {
  campaignId: string;
  leads: { id: string; email: string; name: string }[];
}

interface State {
  pending: PendingSelection | null;
  set: (p: PendingSelection) => void;
  consume: () => PendingSelection | null;  // reads + clears
}
```

### Flow

1. On campaign page, user selects leads, clicks "Inbox" in bulk action bar.
2. Handler filters out leads without `email` (with a confirmation toast if
   any are dropped — see §7).
3. Handler calls `pendingSelection.set({ campaignId, leads })`.
4. Handler navigates to `/inbox/[campaignId]?intent=new-thread`.
5. The Inbox page on mount reads `?intent=new-thread`, calls
   `pendingSelection.consume()`. If non-null and `campaignId` matches, POSTs
   to `/api/inbox/threads` with the lead list. Otherwise opens the campaign's
   inbox shell with no pending thread.
6. On successful thread creation, redirect to
   `/inbox/[campaignId]/[newThreadId]`.

### Why Zustand and not URL params

- Long URLs with 50 lead IDs are ugly and risk URL length limits on some
  routers.
- `sessionStorage` survives refresh — the spec says it shouldn't.
- A Zustand store is purely in-memory, gone on refresh, exactly matching the
  requirement.

### Why not a draft DB row

- A draft row would persist across refresh (against spec).
- We avoid orphan rows if the user navigates away without sending.
- Thread creation is fast enough that we don't need a "pending draft" stage.

---

## 7. Email-Missing Pre-Flight Check

When the user clicks Inbox on the campaign page with leads selected, we
filter the selection to only those with non-empty `email`. Three cases:

| Case | UX |
|---|---|
| All selected have emails | Navigate immediately to Inbox; new thread starts. |
| Some have emails, some don't | Toast: "3 of 5 selected leads have no email and will be skipped. Continue?" with Confirm / Cancel. On confirm, proceed with the 3 that have emails. |
| None have emails | Toast (error): "None of the selected leads have an email. Use Find Email first." No navigation. |

This pre-flight prevents broken threads (a thread with zero recipients) and
sets the user up to fix the gap with Phase 6 enrichment.

---

## 8. SMTP Wrapper

### File

`apps/web/lib/smtp.ts`

### Surface

```ts
export interface SendInput {
  from:    string;
  to:      string;        // one recipient per call — we loop in the API route
  subject: string;
  html?:   string;
  text?:   string;
}

export interface SendResult {
  accepted:      string[];
  rejected:      string[];
  messageId?:    string;
  errorMessage?: string;
}

export async function sendOne(input: SendInput): Promise<SendResult>
```

### Behaviour

- Reads `MAILHOG_*` from `process.env` on first call, caches the transporter.
- Sends one email per call. The API route iterates over recipients and calls
  `sendOne` per recipient so per-recipient status is recorded accurately.
- Catches transport errors and returns them in `errorMessage` rather than
  throwing — the API route maps every recipient to a row regardless of
  outcome.
- The `from` address is always `process.env.MAILHOG_FROM_ADDRESS` — the
  caller passes it explicitly so the SMTP wrapper stays stateless.

### Why per-recipient calls instead of one BCC blast

Two reasons:

1. **Per-recipient status tracking.** A single nodemailer call with multiple
   recipients returns aggregate `accepted` / `rejected` arrays, but we want
   row-level confidence (and individual SMTP message IDs for MailHog).
2. **Mimics real outreach.** Real cold-outreach senders never BCC — each lead
   gets a unique envelope. Our test path should behave the same.

The downside is N round-trips for N recipients. At 50 recipients per thread
this is still under a second to MailHog.

---

## 9. API Routes

All routes live under `apps/web/app/api/inbox/`.

| Method | Path | Purpose |
|---|---|---|
| `GET` | `/api/inbox/campaigns` | List campaigns that have ≥1 thread, with inbox count |
| `GET` | `/api/inbox/threads?campaignId=<id>` | List threads for a campaign, newest first |
| `POST` | `/api/inbox/threads` | Create thread `{ campaignId, leadIds[] }` or `{ campaignId, recipients: [{email, name}] }` |
| `DELETE` | `/api/inbox/threads/[threadId]` | Delete a thread + all messages + files |
| `GET` | `/api/inbox/threads/[threadId]` | Thread detail (recipients + messages) |
| `POST` | `/api/inbox/threads/[threadId]/messages` | Send a new message `{ subject, html, text }` |
| `DELETE` | `/api/inbox/messages/[messageId]` | Delete one message + its file |
| `GET` | `/api/inbox/html/[messageId]` | Serve the HTML file for preview |
| `GET` | `/api/inbox/search?campaignId=<id>&q=<query>` | Manual lead search for compose-To (scoped to campaign, only leads with emails) |

### POST `/api/inbox/threads` (create)

Body:
```json
{ "campaignId": "...", "leadIds": ["...", "..."] }
```

Behaviour:
- Validates `campaignId` exists.
- Loads each lead, takes its `email` and `businessName`.
- Skips leads without an email (mirrors the pre-flight, defensive on server too).
- Rejects with 422 if all candidates filtered out.
- Creates `InboxThread` + N `InboxRecipient` rows in a single transaction.
- Returns the new thread with its recipients.

### POST `/api/inbox/threads/[threadId]/messages` (send)

Body:
```json
{
  "subject":    "Quick question",
  "html":       "<html>…</html>",
  "text":       "Plain fallback (optional)",
  "skipEmails": ["b@y.com"]
}
```

Behaviour:
1. Validate `threadId`, load its recipients.
2. Filter out `skipEmails`.
3. Create `InboxMessage` row with `status=DRAFT`, `htmlFilePath=null`.
4. If `html` non-empty, write `data/outreach-html/<messageId>.html`, update row with path.
5. For each remaining recipient, call `sendOne`, create
   `InboxMessageRecipient` row with `SENT` or `FAILED` + error.
6. Compute aggregate status (SENT / PARTIAL / FAILED), set `sentAt`, update
   the message row.
7. Bump thread `updatedAt` so it floats to the top of the threads rail.
8. Return the full message with per-recipient breakdown.

If step 4 fails (disk full, permissions), we abort before sending and delete
the empty message row so we never have a phantom thread bump.

### GET `/api/inbox/search`

Returns up to 25 leads in the campaign where:
- `email IS NOT NULL AND email != ""`
- `businessName` or `email` matches the query (case-insensitive `contains`)

Used by the "+ New Compose" recipient picker.

---

## 10. UI — Three-Pane Layout

### Route structure

| Route | Renders |
|---|---|
| `/inbox` | Three-pane shell. Campaigns rail populated. Threads + Main empty with a placeholder. |
| `/inbox/[campaignId]` | Campaigns rail (active row highlighted). Threads rail populated. Main shows "Select a thread or compose a new one." |
| `/inbox/[campaignId]/[threadId]` | All three panes populated. Main shows the active thread. |

### Sidebar interactions

- The existing app sidebar (Dashboard, Campaigns, Inbox, Yelp, etc.) stays.
- We add an **Inbox** item to the existing sidebar with a mail icon.
- When on any `/inbox/*` route, the existing sidebar collapses to icon-only
  width so the two extra rails fit comfortably. (Same trick mail clients use.)

### Campaigns rail (leftmost of the three new rails)

- Width ~220 px.
- Header: "Campaigns" (small label) and a refresh icon.
- Body: scrollable list. Each row:
  - Campaign name (one line, truncate)
  - Tiny meta: `<n> threads` and a relative date of last activity
  - Active row gets the primary tint and a left border accent
- Empty state: "No outreach yet. Send your first message from any campaign."

### Threads rail (middle)

- Width ~320 px.
- Header: campaign name + a **+ New Compose** primary button + a **Copy
  emails** icon button (copies the active thread's recipient list to
  clipboard, joined by commas, ready for a Gmail "To" field).
- Body: thread list, newest first. Each row:
  - Recipient preview: `Acme, Beta, +3` (first two names + count of rest)
  - Last subject line (truncate)
  - Per-thread badge: number of messages
  - Relative date
  - Active row tinted; hover row reveals a delete (trash) icon
- "Copy emails" copies the **active thread's** recipients — disabled if no
  active thread.

### Main pane (right)

Three states:

**State A — no thread selected.**
A friendly placeholder: "Select a thread or start a new compose."

**State B — viewing a thread.**

- Sticky header at the top:
  - Recipient chips (read-only here, scroll horizontally if many)
  - Right side: **Copy emails** button, **Delete thread** button (with
    confirm)
- Scrollable message stack, oldest at top, newest at bottom. Auto-scrolled
  to bottom on open (and on send).
- Each message card:
  - Top row: subject (large, bold) · relative time (right) · trash icon
    (right) · per-recipient status pill (`5 sent`, or `3 sent · 2 failed`)
  - Expandable per-recipient list (click the status pill to expand) showing
    each email and its outcome
  - Body preview: a fixed-width (≤ 600 px) iframe with `src=/api/inbox/html/<id>`
  - If only plain text exists, show it in a styled `<pre>` block
- Sticky footer with **+ New Message** button. Click expands into the inline
  composer (see Composer below) above the footer.

**State C — composing in a thread (extension of State B).**

The composer is expanded inline at the bottom, just above the footer button.
Composer details in §11.

### Empty / loading states

- Campaigns rail loading: 3 skeleton rows.
- Threads rail loading: 3 skeleton rows.
- Main pane loading: spinner centered.
- Threads rail when campaign has no threads (shouldn't normally happen since
  campaigns rail only lists campaigns with threads — guard with "No threads
  yet" anyway).

---

## 11. The Composer

### Structure

Same composer used in two places:

- **New thread (manual compose)** — opened from the "+ New Compose" button.
  Renders as a full-pane composer in Main with a "Discard" action.
- **New message (within thread)** — opened from the bottom "+ New Message"
  button. Renders inline above the footer.

### Fields, top to bottom

| Field | Notes |
|---|---|
| **From** | Read-only display. Shows `MAILHOG_FROM_ADDRESS`. Subtle gray text. |
| **To**  | Recipient chips. In new-thread compose, an input with a typeahead that hits `/api/inbox/search` scoped to the active campaign. Selecting a result adds a chip. Chips removable with ×. In new-message-in-thread compose, chips are pre-populated from the thread; user can remove for this send only. |
| **Subject** | Plain input, single line. Required. |
| **Body — HTML drop area** | A drag-and-drop zone that accepts plain text paste OR a dropped `.html` file. On paste/drop, the raw HTML is held in state and the preview iframe re-renders immediately. A "Clear" link below the preview wipes the HTML. The user can re-paste new HTML anytime; the previous HTML in state is replaced. |
| **Body — Preview** | Live iframe, `srcDoc={html}`, fixed width 600 px, height grows with content. Shown only when HTML is non-empty. |
| **Body — Plain text** (optional) | A `<textarea>` below the HTML preview, collapsed by default behind a "Add plain-text fallback" toggle. Recommended but not required. |
| **Send** | Primary button at the bottom-right of the composer. Disabled when To is empty or Subject is empty or both HTML and plain text are empty. While sending, shows a spinner; on success, the composer collapses and the new message appears in the stack. |

### HTML drop behaviour

- Accept: paste of HTML text, drop of `.html` file, drop of plain-text file.
- After drop, read file contents → put into state.
- Preview iframe re-renders within a frame — feels instant.
- Edit cycle: there is no in-place editor. To change, the user clicks "Clear"
  (or just pastes new HTML over) and re-drops/re-pastes. This matches your
  workflow ("if I want to change it I should be able to and paste again").

### Width clamp

The preview iframe is always exactly 600 px wide, centered, with a soft
shadow. This mirrors how marketing emails look in Gmail's preview.

### Why an iframe, not `dangerouslySetInnerHTML`

- iframes give style isolation — the email's CSS can't leak into Outrich's UI.
- iframes simulate the real email client environment more faithfully.
- The `srcDoc` attribute means no extra request and no XSS risk to our app.

---

## 12. Sidebar and Campaign-Page Integration

### App sidebar

Add an **Inbox** item between "Yelp" and any future items. Icon: `Inbox`
from lucide-react. Active when route starts with `/inbox`. Same active
treatment as the existing items.

### Campaign page — bulk-actions bar

The existing bar (after Phase 4 polish) has: Set status, Find Email, Export,
Edit, Delete.

Add a new action between **Find Email** and **Export**:

| Action | Icon | Behaviour |
|---|---|---|
| **Inbox** | `Send` (or `Inbox`) | Pre-flight email check (§7) → set Zustand store → navigate to `/inbox/[campaignId]?intent=new-thread` |

If zero selected leads have emails: action is disabled with a tooltip
"None of the selected leads have an email. Run Find Email first."

If some selected leads have no email: the click shows a confirm modal
(reusing the existing `bulk-delete` modal pattern) listing the count to be
skipped, with Cancel / Continue.

---

## 13. Edge Cases and Failure Modes

| Case | Handling |
|---|---|
| All recipients in a send fail | Message row created with `status=FAILED`. Thread still bumps. Per-recipient errors visible in the expandable list. User can resend via "New Message". |
| MailHog unreachable | `sendOne` returns `errorMessage` per recipient. Message gets `status=FAILED` for all. Toast: "SMTP unreachable — check MailHog credentials." |
| HTML file write fails | Message row not created; user sees an error toast. No DB pollution. |
| HTML file missing when reading later | Preview iframe shows a graceful "HTML body unavailable" placeholder. Message body considered lost; recipients/subject/status still readable. |
| User opens a thread for a campaign they no longer have access to | Doesn't apply — single-user localhost. But the API guards with `findUnique` so 404s surface cleanly. |
| User deletes the campaign | Cascade deletes threads, recipients, messages, message-recipients. HTML files become orphans. A startup cleanup job (or a one-shot script) sweeps orphan files — see §14. |
| User deletes a lead that's in a thread | `InboxRecipient.leadId` set to NULL; the email + name snapshot still works for display and resend. |
| Two concurrent sends to the same thread | Each gets a unique message ID; both write distinct files; both bump `updatedAt`; the thread view re-orders correctly. |
| Email pastes contain `<script>` or trackers | We render in an iframe with no extra sandbox attributes for now (the user is sending the HTML themselves). Future: add `sandbox` to the iframe to be safer. Out of scope for Phase 8. |

---

## 14. Orphan-File Cleanup (Out of Scope, Documented)

Not implemented in Phase 8. Documented here so it's not forgotten.

A small script `scripts/inbox-cleanup.ts`:
- Lists `data/outreach-html/*.html`
- For each, parses the messageId from the filename
- If no `InboxMessage` row exists for it, deletes the file
- Run manually when needed

This is post-Phase-8 polish.

---

## 15. Testing (Slice 8.10)

### Unit tests

- `lib/smtp.ts` — given a stub transporter, `sendOne` returns correct shape on success and on failure. (Mock the transporter; no real SMTP.)
- `lib/inbox-storage.ts` — write/read/delete roundtrip in a temp directory.
- `lib/inbox-status.ts` — aggregate status calculation: all-sent → SENT, mixed → PARTIAL, none → FAILED.

### Integration tests

- POST `/api/inbox/threads` with a campaign + leadIds → row inserted, recipients snapshotted.
- POST `/api/inbox/threads/:id/messages` against a stubbed `sendOne` → message + per-recipient rows created, file written.
- DELETE `/api/inbox/messages/:id` → row gone, file gone.
- DELETE `/api/inbox/threads/:id` → cascade gone, all files gone.

### Optional end-to-end (manual)

- Start MailHog dev account, set `.env`, create a campaign, scrape a few leads, run Find Email, select 2 with emails, click Inbox, send a message with HTML body. Verify:
  - Thread appears in threads rail.
  - Message visible in main pane with 600 px preview.
  - Per-recipient status both `SENT`.
  - MailHog dashboard shows both emails received with the correct HTML.

---

## 16. Out of Scope (Explicit)

Listed so they don't slip in:

- Real bulk send (this phase is MailHog-only).
- Inbound mail / replies (MailHog doesn't reply; no IMAP).
- Email scheduling / drip campaigns.
- Templates / variables / personalization tokens (every recipient gets the same body in this phase).
- A/B testing.
- Open / click tracking pixels.
- Attachments (HTML body only).
- Bouncebacks / list cleaning.
- Multi-user (single-user localhost only).

---

## 17. File Tree After Phase 8

```
apps/web/
├── app/
│   ├── api/
│   │   └── inbox/
│   │       ├── campaigns/route.ts
│   │       ├── threads/
│   │       │   ├── route.ts                       (POST create, GET list with ?campaignId=)
│   │       │   └── [threadId]/
│   │       │       ├── route.ts                   (GET detail, DELETE)
│   │       │       └── messages/route.ts          (POST send)
│   │       ├── messages/
│   │       │   └── [messageId]/route.ts           (DELETE)
│   │       ├── html/
│   │       │   └── [messageId]/route.ts           (GET serve file)
│   │       └── search/route.ts
│   └── inbox/
│       ├── layout.tsx                             (three-pane shell)
│       ├── page.tsx                               (campaigns rail only)
│       └── [campaignId]/
│           ├── page.tsx                           (campaigns + threads, no main thread)
│           └── [threadId]/page.tsx                (full view)
├── components/
│   └── inbox/
│       ├── campaigns-rail.tsx
│       ├── threads-rail.tsx
│       ├── thread-view.tsx
│       ├── message-card.tsx
│       ├── composer.tsx
│       ├── recipient-chips.tsx
│       ├── recipient-search.tsx                   (typeahead for new compose)
│       ├── html-drop-zone.tsx
│       └── html-preview.tsx                       (iframe wrapper)
└── lib/
    ├── smtp.ts
    ├── inbox-storage.ts
    ├── inbox-status.ts
    └── stores/
        └── pending-selection.ts                   (Zustand)

prisma/
├── schema.prisma                                  (4 new models, 1 enum, 2 relations)
└── migrations/
    └── <timestamp>_add_inbox_tables/migration.sql

data/                                              (created on first send)
└── outreach-html/
    └── *.html
```

---

## 18. Slice-by-Slice Dependencies

```
8.1 (schema)
 ├── 8.2 (SMTP) — independent, can parallel
 ├── 8.3 (file storage) — independent, can parallel
 └── 8.4 (API routes) — needs 8.1, 8.2, 8.3
      └── 8.5 (state bridge) — independent of 8.4 but used together
           └── 8.6 (campaign page button) — needs 8.5 + at least the POST thread API
                └── 8.7 (inbox shell layout) — needs 8.4
                     └── 8.8 (thread view) — needs 8.7
                          └── 8.9 (composer) — needs 8.4 + 8.8
                               └── 8.10 (tests) — last
```

8.2 and 8.3 can be built before 8.1's migration is applied (they don't touch
Prisma); we just can't *use* them until 8.4 lands.

---

## 19. Design-Prototype Handoff (for Claude Design)

When you (the user) drop this plan into Claude Design, the prototype should
deliver, in this order:

1. **The full three-pane Inbox layout** at three states:
   - empty `/inbox`
   - campaign selected `/inbox/[campaignId]` with no thread open
   - thread open `/inbox/[campaignId]/[threadId]` with 2 stacked messages
2. **The composer** as a standalone modal/pane mock — full and expanded
   states, with and without HTML pasted, with the 600 px preview iframe.
3. **The recipient picker typeahead** for "+ New Compose".
4. **The campaign-page bulk-action bar** with the new **Inbox** button
   inserted between Find Email and Export, plus the email-missing confirm
   modal.
5. **The sidebar** with Inbox item added.

All must match the existing Outrich theme tokens
(`canvas`, `ink`, `body`, `mute`, `line`, `primary`, `positive`, `negative`,
`warning`, dark mode variants). The composer's iframe preview is the only
fixed-width element — everything else fluid.

---

## 20. Acceptance Checklist

- [ ] `prisma migrate dev` applies the 4 new tables and enum cleanly.
- [ ] Sending to MailHog with 3 recipients results in 3 `InboxMessageRecipient` rows, all `SENT`, and 3 emails visible in MailHog inbox.
- [ ] The HTML file exists at `data/outreach-html/<messageId>.html` after a send and contains exactly what the user pasted.
- [ ] Deleting a message deletes the file from disk.
- [ ] Deleting a thread deletes all its message files.
- [ ] A campaign with zero threads does not appear in the campaigns rail.
- [ ] Selecting 5 leads on the campaign page (3 with emails, 2 without) and clicking Inbox shows a confirm modal mentioning the 2 skips, then creates a thread with 3 recipients.
- [ ] Refreshing the page on `/inbox/[campaignId]` clears the pre-selection but keeps the campaign view open.
- [ ] "+ New Compose" search returns only leads from the active campaign that have emails.
- [ ] "New Message" in a thread sends to the original recipients (minus any unchecked) and the new message appears at the bottom of the scroll stack.
- [ ] Copy-emails button puts a comma-separated list on the clipboard.
- [ ] The HTML preview iframe is exactly 600 px wide.
- [ ] All UI matches Outrich theme tokens in both light and dark mode.
