# TPP 6 A-Side Team App

Team app for the TPP 6 A-Side League 2026: next game and meeting time, attendance (with goalie sign-up), 3-2-1 MVP voting and the live ladder. One mobile-first Next.js app hosts every team, each at its own link (e.g. `/storm-united`). Hosted on Vercel, data in Supabase.

## How it works

- **Fixtures & ladder** come straight from the league site: the draw from `tpp-6aside.netlify.app/data.js`, results from the league's public Firebase feed. A team only needs its name and division as they appear in the TPP draw.
- **No logins.** Parents open their team's link, enter the team's **join code** once (if the team has one), and pick their child ("I'm Zane's parent"). Cookies remember both on that phone.
- **Attendance:** Can play / Maybe / Can't make it per game, plus optional goalie sign-up (1st half / 2nd half / full game).
- **MVP:** voting opens at kick-off and closes 48h later. Each family ranks a top 3 (3/2/1 points), not their own child and not anyone marked out. Each game's MVP is shown after voting closes; **the season tally is admin-only.**
- **Installable:** each team's link installs as its own app with the team's name, colours and icon.

## Admin

- **`/<team>/admin`** — the team's admin PIN (or the super admin PIN): season MVP tally, goalie tally and assignment, votes per game, backup scores, and team settings (players, join code, meeting time, goalie sign-up).
- **`/super`** — the super admin PIN (`ADMIN_PIN` env var): add/edit/delete teams — pick the team from the TPP draw, set colours, upload a logo (or use the generated crest), players, team admin PIN and join code.

## Setup

1. Create a Supabase project. In the SQL editor run `supabase/schema.sql`, then `supabase/migrations/001_multi_team.sql` and `002_multi_team_keys.sql` in order.
2. In Vercel, set the env vars from `.env.example`: `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `ADMIN_PIN`.
3. Vercel's free (Hobby) plan is non-commercial — switch to Pro before charging teams.

## Local dev

```bash
npm install
npm run dev
```

Without Supabase env vars, local dev stores data in `.data/local-db.json` (seeded with Storm United) and uploaded logos in `public/uploads/`. Set `DEMO_NOW` (ISO timestamp, e.g. `2026-10-13T08:00:00+08:00`) to time-travel for testing; it's ignored in production.

Player names are first name + last initial only.
