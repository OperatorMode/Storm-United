import webpush from "web-push";
import { deletePushSub, getPushSubs } from "./messages";

// Web push. Keys come from env (VAPID_*); without them push is simply off and
// the app still shows unread badges in the tab bar.

export function pushPublicKey(): string | null {
  return process.env.VAPID_PUBLIC_KEY ?? null;
}

let configured = false;
function ready(): boolean {
  const pub = process.env.VAPID_PUBLIC_KEY;
  const priv = process.env.VAPID_PRIVATE_KEY;
  if (!pub || !priv) return false;
  if (!configured) {
    webpush.setVapidDetails(process.env.VAPID_SUBJECT ?? "https://sidelnr.app", pub, priv);
    configured = true;
  }
  return true;
}

// Notifies everyone in the team who opted in to `kind`, except the author's own devices.
export async function notifyTeam(
  teamId: string,
  kind: "board" | "chat",
  payload: { title: string; body: string; url: string; icon: string },
  exceptAuthor: string | null,
): Promise<void> {
  if (!ready()) return;
  const subs = (await getPushSubs(teamId)).filter(
    (s) => (kind === "board" ? s.notify_board : s.notify_chat) && (!exceptAuthor || s.author_id !== exceptAuthor),
  );
  const message = JSON.stringify({ ...payload, tag: `${teamId}-${kind}` });
  await Promise.allSettled(
    subs.map(async (s) => {
      try {
        await webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, message, {
          TTL: 60 * 60 * 24,
        });
      } catch (err) {
        // 404/410: the browser dropped this subscription — forget it.
        const code = (err as { statusCode?: number }).statusCode;
        if (code === 404 || code === 410) await deletePushSub(teamId, s.endpoint);
      }
    }),
  );
}

export function preview(text: string, max = 120): string {
  const one = text.replace(/\s+/g, " ").trim();
  return one.length > max ? `${one.slice(0, max - 1)}…` : one;
}
