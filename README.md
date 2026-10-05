# Storm United

Team app for Storm United (U10, TPP 6 A-Side League 2026): next game, attendance, 3-2-1 MVP voting and the live ladder. Mobile-first Next.js app, hosted on Vercel.

## How it works

- **Fixtures & ladder** come straight from the league site: the draw from `tpp-6aside.netlify.app/data.js`, results from the league's public Firebase feed. Nothing to enter by hand.
- **No logins.** Parents pick their child once ("I'm Zane's parent"), and a cookie remembers it on that phone.
- **Attendance:** each family marks Can play / Maybe / Can't make it for the next game, or any later game from the fixtures list.
- **MVP:** voting opens at kick-off and closes 48h later. Each family (and the coach) ranks a top 3 (3/2/1 points). You can't vote for your own child or for a player marked "Can't make it". After voting closes, each game's MVP is shown. **The season tally is only on `/admin`.**
- **`/admin`** (PIN): season MVP tally, votes per game (and who hasn't voted), backup score entry if the league is slow to post.

## Setup

1. Create a Supabase project and run `supabase/schema.sql` in the SQL editor.
2. In Vercel, set the env vars from `.env.example`: `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `ADMIN_PIN`.

## Local dev

```bash
npm install
npm run dev
```

Without Supabase env vars, local dev stores data in `.data/local-db.json`. Set `DEMO_NOW` (ISO timestamp, e.g. `2026-10-13T08:00:00+08:00`) to time-travel for testing; it's ignored in production.

Players are listed in `src/lib/players.ts` as first name + last initial only, because the repo is public.
