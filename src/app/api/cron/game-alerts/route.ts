import { checkTeam } from "@/lib/game-alerts";
import { listTeams } from "@/lib/store";
import { getTeam } from "@/lib/teams";
import { pushEnabled } from "@/lib/push";
import { sendActivityReminders } from "@/lib/activity-reminders";
import { sendSeasonEndReminder } from "@/lib/season-end";

// Runs every 15 minutes (vercel.json "crons"). Vercel calls it with
// "Authorization: Bearer $CRON_SECRET"; anyone else is turned away.
export const maxDuration = 60;

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return Response.json({ error: "Not allowed." }, { status: 401 });
  }
  // A week before each team's last game, its managers get ready for next
  // season (email, plus a notification when push is set up).
  let seasonReminders = 0;
  for (const row of await listTeams()) {
    try {
      const team = await getTeam(row.id);
      if (team && (await sendSeasonEndReminder(team))) seasonReminders++;
    } catch (err) {
      console.error("season reminder failed for", row.id, err);
    }
  }
  if (!pushEnabled()) return Response.json({ ok: true, seasonReminders, skipped: "push not configured" });

  const results: Record<string, { changes: number; reminders: number } | string> = {};
  for (const row of await listTeams()) {
    try {
      const team = await getTeam(row.id);
      if (team) results[row.id] = await checkTeam(team);
    } catch (err) {
      console.error("game alerts failed for", row.id, err);
      results[row.id] = err instanceof Error ? err.message : "failed";
    }
  }
  // Family activities (My Activities): a day and an hour before.
  let activityReminders: number | string = 0;
  try {
    activityReminders = await sendActivityReminders();
  } catch (err) {
    console.error("activity reminders failed", err);
    activityReminders = err instanceof Error ? err.message : "failed";
  }
  return Response.json({ ok: true, seasonReminders, results, activityReminders });
}
