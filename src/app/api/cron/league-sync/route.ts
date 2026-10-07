import { listCompetitionRows } from "@/lib/store";
import { listFixtures } from "@/lib/fixtures";
import { syncCompetitionFeed } from "@/lib/feeds";
import { dueChecks } from "@/lib/sync-schedule";

// Runs every 15 minutes (vercel.json "crons"): reads leagues linked to a
// website again, but only when one of their games is due a check (after the
// game, 12 hours and 48 hours later, until its result and the ladder are in).
// Vercel calls it with "Authorization: Bearer $CRON_SECRET".
export const maxDuration = 300;

const BUDGET_MS = 240_000; // leave room for the last read to finish

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return Response.json({ error: "Not allowed." }, { status: 401 });
  }
  const started = Date.now();
  const results: Record<string, string> = {};
  for (const c of await listCompetitionRows()) {
    if (c.feed_type !== "web" || !c.feed_url) continue;
    if (Date.now() - started > BUDGET_MS) {
      results[c.id] = "next run"; // out of time: picked up 15 minutes from now
      continue;
    }
    try {
      const due = dueChecks(c, await listFixtures(c.id));
      if (!due.fixtures && !due.ladder) continue;
      const res = await syncCompetitionFeed(c.id, false, due);
      results[c.id] = `${due.fixtures ? `fixtures ${res.errors[0] ?? res.count}` : ""}${due.ladder ? " ladder" : ""}`.trim();
    } catch (err) {
      console.error("league sync failed for", c.id, err);
      results[c.id] = err instanceof Error ? err.message : "failed";
    }
  }
  return Response.json({ ok: true, results });
}
