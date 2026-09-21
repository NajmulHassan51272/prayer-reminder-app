# Prayer Reminder App

A group-based prayer-time reminder and tracking app, deployed on **Vercel** with
**Supabase** (PostgreSQL + Auth) as the database and authentication backend.

- Users sign up with their **name, email, and city**. Each person can either
  **create a group** (becoming its admin) or **join one** via an emailed
  invitation link.
- Each group holds **up to 30 members**, and each user belongs to **at most one
  group at a time**.
- Prayer times are calculated **per person, based on their own city** (not shared
  per group) using the free [Aladhan API](https://aladhan.com/prayer-times-api).
  The app asks the API fresh for each day's times instead of storing a fixed
  time, so it **automatically follows the daily shift in sunrise/sunset** — nothing
  needs to be updated by hand.
- On a repeating schedule (every 5 minutes), a scheduler checks each user's own
  local prayer times and sends **two emails per prayer — one before, one after**:
  1. **Before the prayer:** a "time to prepare" reminder (default: ~15 minutes
     ahead of the prayer time).
  2. **After the prayer:** a **"Did you pray?"** follow-up (default: 45 minutes
     later) with signed **Yes / No** links.
  3. Auto-marks a prayer **"missed"** if there's still no response after a set
     window (default: 3 hours).
- **Admin dashboard**: the group creator sees every member's status for each of
  the 5 daily prayers, an all-time completion percentage, a per-prayer "today"
  summary (e.g. "Fajr: 8/12 completed"), and can invite or remove members or
  drill into any member's full history.
- **Member dashboard**: a **live countdown to the next prayer** (with a
  sundial-style progress ring) and **"✅ Prayed" / "❌ Not yet"** buttons so
  members can mark prayers directly in the app — not just via email links.

## Tech stack

- **Runtime / framework:** Node.js + Express (runs as a single Vercel serverless
  function).
- **Database & Auth:** Supabase (PostgreSQL + Supabase Auth). All SQL lives in
  [`supabase/schema.sql`](supabase/schema.sql).
- **Templates:** EJS.
- **Scheduling:** Vercel Cron (and/or a GitHub Action) calling a secured HTTP
  endpoint — see [Cron & reminders](#cron--reminders).
- **Email:** `nodemailer` over SMTP.
- **Timezones:** `moment-timezone` for accurate per-city math.

## How it works on Vercel (serverless) — important

Vercel runs the app as **stateless serverless functions** that can cold-start on
any request. Two consequences are already handled in this codebase:

1. **Sessions are stored in Supabase, not in memory.**
   Login state lives in a `sessions` table (see
   [`src/sessionStore.js`](src/sessionStore.js)). If sessions were kept in RAM
   (the old `memorystore` approach), a user would be logged out or error every
   time a request hit a fresh/cold instance. The DB-backed store means your login
   persists across cold starts and redeploys.
2. **The scheduler cannot be an in-process `node-cron` loop**, because a
   serverless function doesn't stay running. Instead an external timer calls the
   `POST /api/cron/prayer-scheduler` endpoint on a schedule (see below).

## 1. Install

```bash
cd prayer-app
npm install
```

## 2. Configure Supabase

1. Create a project at [supabase.com](https://supabase.com).
2. Open the **SQL Editor** → **New Query**, paste the entire contents of
   [`supabase/schema.sql`](supabase/schema.sql), and **Run** it. This creates all
   tables **including the `sessions` table** required for login to work on
   Vercel, plus RLS policies.
   - If you deployed an earlier version of the schema and are updating, at minimum
     run this new part:
     ```sql
     CREATE TABLE IF NOT EXISTS sessions (
       sid TEXT PRIMARY KEY,
       sess JSONB NOT NULL,
       expire TIMESTAMP WITH TIME ZONE NOT NULL
     );
     CREATE INDEX IF NOT EXISTS idx_sessions_expire ON sessions(expire);
     ALTER TABLE sessions ENABLE ROW LEVEL SECURITY;
     ```
3. Grab three values from **Project Settings → API**:
   - `Project URL` → `SUPABASE_URL`
   - `anon` public key → `SUPABASE_ANON_KEY`
   - `service_role` secret key → `SUPABASE_SERVICE_ROLE_KEY`

> **Note on the data layer / RLS:** the backend is a *trusted server* that
> authenticates with cookie sessions and never forwards a per-user JWT to
> Supabase. For that reason `src/db.js`, `src/services/scheduler.js`, and
> `src/services/prayerTimes.js` all use the **service-role key**, which bypasses
> RLS. The anon key is used only for signing users in (`signInWithPassword`) in
> `src/routes/auth.js`. Do not switch the data layer back to the anon key — under
> RLS it silently returns **zero rows** and login/dashboards/scheduler all stop
> working.

## 3. Configure environment variables

Copy `.env.example` to `.env` and fill in real values:

| Variable | Purpose |
| --- | --- |
| `PORT` | Local dev port (ignored on Vercel). |
| `SESSION_SECRET` | Signs the session cookie. Any long random string. |
| `TOKEN_SECRET` | Signs the email Yes/No links. Any long random string. |
| `BASE_URL` | Public URL used inside email links (e.g. `https://your-app.vercel.app`). Use `http://localhost:3000` locally. |
| `SUPABASE_URL` / `SUPABASE_ANON_KEY` / `SUPABASE_SERVICE_ROLE_KEY` | From step 2. |
| `PRAYER_CALC_METHOD` | Aladhan method id (default `1` = Karachi). |
| `SMTP_HOST` / `SMTP_PORT` / `SMTP_SECURE` / `SMTP_USER` / `SMTP_PASS` / `EMAIL_FROM` | SMTP credentials for sending email. |
| `PRE_REMINDER_MINUTES` | Minutes **before** a prayer to send the "time to prepare" reminder (default 15). |
| `FOLLOWUP_DELAY_MINUTES` | Minutes **after** a prayer before the "Did you pray?" follow-up (default 45). |
| `MISSED_AFTER_MINUTES` | Minutes after a prayer before it's auto-marked missed (default 180). |
| `CRON_SECRET` | Shared secret that authorizes the scheduler endpoint. **Must be set in production.** |

Generate a secret with:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

> The `service_role` key and SMTP password are **secrets**. Keep them only in
> `.env` (gitignored) and in your host's environment-variable settings. Never
> commit them or expose them to the browser.

## 4. Run it locally

```bash
npm run dev     # or: npm start
```

Visit `http://localhost:3000` (or the `PORT` you set). Locally, if `CRON_SECRET`
is unset, the app starts an **internal `node-cron` scheduler** that ticks every 5
minutes, so you can watch reminders fire without configuring external cron.

## 5. Try it out

1. Sign up — you create your account.
2. Create a group — you become its admin.
3. Invite someone by email from the dashboard. New users get a signup link that
   auto-joins the group when they register; existing members are tracked right
   away.
4. Open `/admin` (visible only to the group creator) to see everyone's status.
5. To test reminders quickly, temporarily lower `FOLLOWUP_DELAY_MINUTES` and let
   the local 5-minute scheduler tick run.

## Cron & reminders

The scheduler logic is in [`src/services/scheduler.js`](src/services/scheduler.js).
Each **tick** runs `tick()`, which looks at narrow time windows (a prayer reminder
fires within ~10 minutes after its time; the follow-up within ~10 minutes of its
delay). That means **the tick must run at least every 5 minutes** or reminders
will be missed. Pick one (or both) of the following:

### Option A — Vercel Cron (`vercel.json`)
`vercel.json` defines a cron that hits `/api/cron/prayer-scheduler` every 5
minutes:
```json
"crons": [{ "path": "/api/cron/prayer-scheduler", "schedule": "*/5 * * * *" }]
```
> **Plan limit:** Vercel's Hobby plan only allows cron jobs **once per day**; the
> `*/5` schedule requires a **Pro** plan. On Hobby, use Option B.

Vercel automatically sends `Authorization: Bearer <CRON_SECRET>` on cron
requests **when a `CRON_SECRET` environment variable is set** on the project — so
set `CRON_SECRET` in Vercel's env settings.

### Option B — GitHub Action (works on any plan)
[`.github/workflows/run-scheduler.yml`](.github/workflows/run-scheduler.yml)
calls the same endpoint every 5 minutes. Add two repository secrets:
- `CRON_URL` = `https://your-app.vercel.app/api/cron/prayer-scheduler`
- `CRON_SECRET` = the same value set on Vercel.

### How the endpoint is secured
Both `src/server.js` (the route) and the handler reject requests unless the
`Authorization: Bearer` token matches `CRON_SECRET`, so only your scheduler can
trigger it.

## Deploying to Vercel

1. Push the repo to GitHub and import it in Vercel (the `vercel.json`
   `builds`/`routes` send all traffic to `src/server.js`).
2. Add all environment variables from step 3 in **Project → Settings →
   Environment Variables**, including a real `CRON_SECRET` and `BASE_URL` set to
   your Vercel domain.
3. Make sure the `sessions` table exists in Supabase (step 2) or logins will not
   persist.
4. Deploy. Outbound HTTPS to `api.aladhan.com` must be allowed for prayer times
   to load.

## Project structure

```
src/
  server.js               → Express app, session setup, cron endpoint (Vercel entry)
  sessionStore.js         → Supabase-backed express-session store (serverless logins)
  supabase.js             → Supabase clients (anon + service-role)
  db.js                   → data layer (uses the service-role client)
  middleware/auth.js      → login / admin guards
  routes/
    auth.js               → register / login / logout
    group.js              → create group, invite/leave/remove members
    dashboard.js          → member dashboard + admin dashboard + manual marking
    response.js           → handles the Yes/No email links
  services/
    prayerTimes.js        → Aladhan API integration + per-day caching
    scheduler.js          → reminder / follow-up / auto-missed tick
    email.js              → SMTP sending + email templates
  utils/token.js          → signed tokens for the Yes/No email links
api/cron.js               → (legacy) standalone cron handler, superseded by the
                            route in src/server.js
supabase/schema.sql       → all tables, indexes, RLS policies, sessions table
views/                    → EJS page templates
public/style.css          → styling
```
