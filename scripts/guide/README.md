# Guide screenshots

The pictures in `public/guide/` come from the local app with made-up data
(Riverside Rockets, Riverside Junior League). Nothing here touches the live site.

1. `python scripts/guide/demo-data.py` adds the demo team to `.data/local-db.json`.
2. Start the app locally on port 3100 (without Supabase, so it uses the local file).
3. `node scripts/guide/capture.mjs scripts/guide/shots-join.json public/guide`
   takes phone-sized screenshots (390x844 at 2x) in a throwaway headless Edge.

The owner pictures (`shots-owner.json`, for the "What Sidelnr's owner sees" page)
need the local server started with `ADMIN_PIN=guide-owner-pin` (the shots carry
the matching owner cookie). They only show the made-up demo data.
