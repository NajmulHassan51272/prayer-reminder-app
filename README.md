# Prayer Reminder App

A group-based prayer time reminder and tracking app.

- Users sign up and either **create a group** (they become that group's admin)
  or **join a group with its permanent code**.
- Each group holds **up to 30 members**, and each user belongs to **at most one
  group at a time**.
- Prayer times are calculated **per person, based on their own city** (not
  shared per group) using the free [Aladhan API](https://aladhan.com/prayer-times-api).
  Because the app asks the API fresh for "today's" times every day instead of
  storing a fixed time, it **automatically follows the daily shift in sunset**
  — nothing needs to be manually updated every 2–3 days.
- Every 5 minutes, a background scheduler checks each user's own local prayer
  times and:
  1. Sends a **"Time for [Prayer]"** email right when it starts.
  2. Sends a **"Did you pray?"** follow-up email (default: 45 minutes later)
     with signed **Yes / No** links.
  3. Auto-marks a prayer **"missed"** if there's still no response after a
     set window (default: 3 hours).
- Group admins get a dashboard showing every member's status for each of the
  5 daily prayers, plus an all-time completion percentage, a **today's
  completion summary per prayer** (e.g. "Fajr: 8/12 completed"), and can
  remove members or drill into any member's full history.
- Every member's dashboard shows a **live countdown to the next prayer**
  (e.g. "Dhuhr in 1 hour 23 minutes"), and a **"✅ Prayed" / "❌ Not yet"**
  button under each prayer time so members can mark themselves directly in
  the app — not just via the email links.

## Tech stack

Node.js + Express, SQLite (via `better-sqlite3`, no separate database server
needed), EJS templates, `node-cron` for scheduling, `nodemailer` for email,
`moment-timezone` for accurate timezone math.

## 1. Install

```bash
cd prayer-app
npm install
```

## 2. Configure environment variables

```bash
cp .env.example .env
```

Then open `.env` and fill in real values:

- `SESSION_SECRET` / `TOKEN_SECRET` — any long random strings. Generate one with:
  ```bash
  node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
  ```
- `BASE_URL` — the public URL people will use once deployed (used inside
  email links so the Yes/No buttons work). Keep it as `http://localhost:3000`
  while testing locally.
- `SMTP_*` and `EMAIL_FROM` — your email provider's SMTP credentials. Any of
  these work fine:
  - **Gmail**: use an [App Password](https://support.google.com/accounts/answer/185833),
    not your normal password.
  - **Resend**, **SendGrid**, or **Mailtrap** (great for testing without
    emailing real people) also work over SMTP.
- `PRAYER_CALC_METHOD` — defaults to `1` (University of Islamic Sciences,
  Karachi), the standard default for Pakistan. Full list of methods is on
  the Aladhan docs page linked above if you want to change it.
- `FOLLOWUP_DELAY_MINUTES` / `MISSED_AFTER_MINUTES` — tune how long to wait
  before the follow-up email and before auto-marking a prayer missed.

## 3. Run it

```bash
npm start
```

Visit `http://localhost:3000`. The SQLite database file is created
automatically at `data/app.db` the first time you run it.

## 4. Try it out

1. Sign up as a user (this becomes your account).
2. Create a group — you become that group's admin and get a permanent code.
3. Sign up a second test account (different email) and join using that code.
4. Visit `/admin` (only visible to the group's creator) to see every
   member's prayer status and the option to remove a member.
5. Wait for the scheduler tick (runs every 5 minutes), or temporarily lower
   `FOLLOWUP_DELAY_MINUTES`/change the cron interval in
   `src/services/scheduler.js` while testing so you don't have to wait long
   for reminder/follow-up emails to fire.

## Notes on deployment

- This currently uses **cookie-based sessions**, so it needs to run as a
  **single long-lived server process** (not a "serverless"/stateless
  platform where the process can restart mid-request) — a small VPS,
  Render, Railway, or similar all work well.
- The scheduler (`node-cron`) runs *inside* the same process, so as long as
  the server is kept running continuously, reminders keep firing. If you
  deploy somewhere that sleeps/spins down idle apps, reminders will be
  missed while it's asleep — pick a host that keeps the process alive
  (or a "keep-alive"/uptime-ping add-on).
- Outbound internet access to `api.aladhan.com` is required for prayer
  times to load — check your hosting provider allows outbound HTTPS
  requests if times don't show up.

## Project structure

```
src/
  server.js              → app entry point, mounts routes + starts scheduler
  db.js                  → SQLite schema + connection
  middleware/auth.js      → login/admin guards
  routes/
    auth.js               → signup / login / logout
    group.js               → create/join/leave group, admin remove-member
    dashboard.js           → member dashboard + admin dashboard
    response.js             → handles the Yes/No email links
  services/
    prayerTimes.js         → Aladhan API integration + daily caching
    scheduler.js           → the every-5-minutes reminder/follow-up/missed job
    email.js                → SMTP sending + email templates
  utils/token.js           → signed tokens for the Yes/No email links
views/                    → EJS page templates
public/style.css          → styling
```
