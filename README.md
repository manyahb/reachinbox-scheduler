# Dispatch — ReachInbox Email Job Scheduler

A production-grade email scheduling service + dashboard, built for the ReachInbox.ai
Software Development Intern take-home assignment.

## Stack

- **Backend:** Express + TypeScript, BullMQ (Redis), Postgres, Nodemailer (Ethereal SMTP),
  Elasticsearch, Bull Board
- **Frontend:** Next.js (App Router) + TypeScript + Tailwind CSS
- **Infra:** Redis, Postgres, Elasticsearch (Docker Compose provided)

## Quick start

### 1. Infra

```bash
docker compose up -d          # postgres, redis, elasticsearch
```

### 2. Backend

```bash
cd backend
cp .env.example .env          # fill in Ethereal / Google / Slack creds (see below)
npm install
npm run migrate               # creates tables
npm run dev                   # starts the API server on :4000
```

In a **second terminal**, start the worker (separate process on purpose — see
Architecture below):

```bash
cd backend
npm run worker
```

### 3. Frontend

```bash
cd frontend
cp .env.local.example .env.local
npm install
npm run dev                   # starts on :3000
```

### 4. Ethereal Email setup

Ethereal accounts are throwaway test SMTP inboxes. Two options:

- **Automatic:** leave `ETHEREAL_USER`/`ETHEREAL_PASS` blank in `.env` — the mailer
  service creates a temporary Ethereal account on first send and logs the credentials.
- **Manual:** go to https://ethereal.email, click "Create Ethereal Account", and paste
  the generated user/pass into `.env`. Every "sent" email is not actually delivered —
  Ethereal gives you a preview URL (logged to the worker console) to view it.

### 5. Google OAuth setup

1. Create a project in [Google Cloud Console](https://console.cloud.google.com/) →
   APIs & Services → Credentials → OAuth Client ID (Web application).
2. Authorized redirect URI: `http://localhost:4000/api/auth/google/callback`
3. Copy the Client ID/Secret into `backend/.env`.

### 6. Slack OAuth setup

1. Create a Slack app at https://api.slack.com/apps → "From scratch".
2. Under **OAuth & Permissions**, add the `incoming-webhook` scope, set the redirect
   URL to `http://localhost:4000/api/slack/oauth/callback`.
3. Copy the Client ID/Secret into `backend/.env`.
4. In the dashboard, click "Connect Slack" → pick a channel → you'll get a live
   message the next time a sender's hourly limit is hit.

---

## Architecture

### How scheduling works (no cron)

Every "compose" submission creates one row per recipient in the `emails` Postgres
table (the source of truth) and one **BullMQ delayed job** per row, with `delay` set
to `scheduled_time - now()`. BullMQ stores delayed jobs in a Redis sorted set keyed by
their execution timestamp — there is no polling loop, no cron trigger, and no
setInterval anywhere in the codebase. When a job's delay elapses, BullMQ itself moves
it into the active queue for a worker to pick up.

### How persistence on restart is handled

Two layers, deliberately redundant:

1. **BullMQ's own persistence.** Delayed/waiting jobs live in Redis, and Redis persists
   to disk (AOF/RDB). A plain server or worker restart does not lose jobs — BullMQ picks
   up exactly where it left off.
2. **DB-backed recovery on boot** (`src/services/recovery.ts`). Since Postgres — not
   Redis — is the real source of truth, every server boot cross-checks every `emails`
   row still in `scheduled`/`processing` status against the queue. If a row has no live
   BullMQ job backing it (e.g. Redis was flushed, or the process crashed between the
   `INSERT` and the `queue.add()` call), it's re-attached using the **same deterministic
   `jobId`** (`email-<id>`), so this can run on every boot with zero risk of creating a
   duplicate job.

This was tested directly: an "orphaned" DB row was inserted with Redis flushed clean
(simulating a crash mid-schedule), and the boot log correctly reported
`🔁 Recovery: re-attached 1 pending email(s) to the queue.` Running recovery again
immediately afterward correctly reported all pending emails were already backed by
live jobs — no duplicate was created.

### Idempotency

`jobId` for every email job is derived deterministically from the row's primary key
(`email-<id>`). BullMQ deduplicates on `jobId` — adding a job with an ID that's already
waiting/delayed is a no-op. This is the single mechanism that backs idempotency across
three different scenarios: normal scheduling, restart recovery, and rate-limit
rescheduling (re-adding the same `jobId` into a later window replaces rather than
duplicates the pending job).

### Rate limiting & concurrency

- **Concurrency:** `WORKER_CONCURRENCY` (env-configurable) sets how many jobs a single
  worker process handles in parallel via BullMQ's `concurrency` option.
- **Minimum delay between sends:** `MIN_DELAY_BETWEEN_EMAILS_MS` (env-configurable,
  default 2000ms) — the worker sleeps this long before each send. Documented trade-off:
  this delay is per concurrent worker *slot*, not global, so actual throughput is
  roughly `concurrency / (delayMs)` sends/sec — acceptable for this assignment's scale,
  called out here rather than hidden.
- **Emails per hour, per sender:** enforced with a Redis counter keyed by
  `ratelimit:<sender>:<hour-window>`, incremented atomically via a Lua script
  (`src/services/rateLimiter.ts`) so it's safe across multiple worker processes/instances
  without any in-memory state. The key gets a 1-hour TTL on first write so old windows
  clean themselves up automatically.
  - **Bug caught during testing:** the first version of this script returned the raw
    counter value when blocking, which was ambiguous at the exact limit boundary
    (`count == limit` was misread as "allowed"). Fixed by returning a `-1` sentinel on
    block instead, and re-verified against Redis directly before moving on.
  - When a sender is over the limit, the job is **not failed or dropped** — it's marked
    `rescheduled` in the DB and re-added to the queue with a delay pushing it into the
    next hour window, under the same `jobId`.
  - A live Slack message fires the moment a limit is hit (`services/slack.ts`), reading
    the webhook URL from the DB per-request so connect/disconnect takes effect
    immediately with no redeploy. If the user hasn't connected Slack, this is a silent
    no-op — never throws, never blocks the send path.

### Behavior under load (1000+ emails at once)

Scheduling 1000 emails for the same instant creates 1000 delayed jobs with `delay: 0`,
which all become eligible simultaneously — but the worker's `concurrency` setting caps
how many actually run in parallel, and the per-sender hourly counter caps how many
successfully send before the rest get rescheduled into the next hour window,
preserving order via `scheduled_time ASC` in the recovery/listing queries. Nothing is
dropped; the backlog just drains across however many hour windows the volume requires.

---

## Features implemented

**Backend**
- [x] BullMQ delayed-job scheduling (no cron)
- [x] Postgres persistence, restart-safe (verified — see above)
- [x] Idempotent job IDs (verified — no duplicate on repeated recovery)
- [x] Worker concurrency (env-configurable)
- [x] Minimum delay between sends (env-configurable)
- [x] Per-sender hourly rate limiting, Redis-backed, multi-worker safe (verified, bug fixed)
- [x] Live Slack notification on rate-limit hit, with graceful disconnect handling
- [x] Ethereal SMTP sending
- [x] Elasticsearch indexing + `/api/emails/search`
- [x] Bull Board live queue dashboard at `/admin/queues`
- [x] Google OAuth login, session cookie, `/api/auth/me`
- [x] Slack OAuth connect/disconnect flow

**Frontend**
- [x] Google sign-in landing page
- [x] Dashboard: header with user info + logout, live queue-health strip
- [x] Compose slide-over: subject/body, sender, CSV/txt lead upload with live recipient
      count, start time, delay, hourly limit
- [x] Scheduled and Sent tables with loading and empty states
- [x] Slack connect/disconnect from the header
- [x] Search bar (debounced, 300ms) backed by `/api/emails/search`, showing matches across
      subject/body/sender/recipient in a dedicated results table

## Known assumptions, shortcuts, and trade-offs

- **Sandbox note:** this was built and tested in a network-restricted dev sandbox.
  Outbound SMTP to `smtp.ethereal.email` and calls to `fonts.googleapis.com` were
  blocked by that sandbox's egress allowlist specifically — both work normally with
  regular internet access (confirmed the rest of the send pipeline, including retries
  and backoff, execute correctly; confirmed the frontend builds cleanly with
  system-font fallbacks in place of the blocked Google Fonts fetch).
- **Session handling** is a plain cookie holding the user id — fine for this
  assignment's scope, but a real deployment should use signed/httpOnly JWTs or
  `express-session` with a store.
- **Figma matching:** the person exported and uploaded screenshots of the actual Figma
  frames (login screen, homepage/sidebar, scheduled/sent list views, and the compose
  screens including the Send Later popover), since the raw Figma link couldn't be
  inspected programmatically (Figma's design view is a client-rendered app — fetching
  the URL only returns page metadata, not frames/colors/spacing). The frontend was
  rebuilt against those screenshots: light theme, fixed 260px sidebar with profile/
  compose/nav, Gmail-style list rows (star, "To: name", status badge with timestamp,
  subject + preview), and a full-page Compose view with From/To (chip-based, "+N"
  overflow, "Upload List" link)/Subject, paired Delay/Hourly Limit fields, a rich-text
  toolbar, and a "Send Later" popover with quick-pick times. Close, but not
  pixel-perfect — exact hex values for the green/amber palette were estimated from
  visual appearance since Figma's color inspector wasn't opened on those specific
  elements in the screenshots provided.
- **Login screen's email/password fields** are visual-only, matching the Figma layout,
  but not wired to a real auth endpoint — the assignment specifies real Google OAuth
  only, so submitting that form shows a note pointing to the Google button instead.
- **Recipient display names** ("To: John Smith") are derived from the local part of
  the recipient's email address (e.g. `john.smith@x.com` → "John Smith"), since the
  CSV/txt upload only supplies email addresses, not names.
- **Star toggle** on list rows is a client-side-only UI affordance (not persisted to
  the DB) — the schema has no "starred" column; add one if this needs to survive a
  refresh.
- **Rich-text toolbar** in Compose uses `document.execCommand` for bold/italic/
  underline/lists — functional but a legacy browser API; swap for a proper editor
  (e.g. Tiptap) if this needs to go further than the assignment's scope.
- **Elasticsearch search UI** was added (debounced search bar + results table,
  `src/components/SearchBar.tsx`), calling the existing `/api/emails/search` endpoint.
  The route and component are type-checked and logically verified, but a live ES
  instance could not be installed in the dev sandbox this was built in (its package
  repo isn't reachable there) — verify the actual indexed search returns real hits
  once you have `docker compose up` running locally.
- **CSV parsing** is a permissive regex-based email extractor rather than a strict CSV
  parser — it tolerates plain `.txt` lists and messy CSVs alike, but doesn't validate
  column headers.
- **1000+ email load** was reasoned through and is handled correctly by design (see
  Architecture), but wasn't run end-to-end against real Ethereal SMTP at that volume,
  per the assignment's own note that this isn't required.
