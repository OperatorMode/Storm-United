import webpush from "web-push";
import { COACH_AUTHOR, deletePushSub, getPushSubs } from "./messages";
import type { PushSubRow } from "./store";

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

type Payload = { title: string; body: string; url: string; icon: string; tag?: string };

/** Sends one notification to one phone; forgets phones the browser dropped. */
export async function sendPush(sub: PushSubRow, payload: Payload): Promise<void> {
  await sendPushTo(sub, payload, () => deletePushSub(sub.team_id, sub.endpoint));
}

/** Sends to any push address; `gone` runs when the browser has dropped it (404/410). */
export async function sendPushTo(
  sub: { endpoint: string; p256dh: string; auth: string },
  payload: Payload,
  gone: () => Promise<unknown>,
): Promise<void> {
  if (!ready()) return;
  try {
    await webpush.sendNotification({ endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } }, JSON.stringify(payload), {
      TTL: 60 * 60 * 24,
    });
  } catch (err) {
    const code = (err as { statusCode?: number }).statusCode;
    if (code === 404 || code === 410) await gone();
    else console.error("push failed", code, (err as Error).message);
  }
}

export const pushEnabled = () => ready();

// Notifies everyone in the team who opted in to `kind`, except the phone that
// sent it. Phones are told apart by their push address: several phones can
// share an author (every coach's phone is "coach", siblings' parents share a
// family), so skipping by author would silence other people too.
export async function notifyTeam(
  teamId: string,
  kind: "board" | "chat",
  payload: Payload,
  except: { endpoint: string | null; author: string | null },
): Promise<void> {
  if (!ready()) return;
  const subs = (await getPushSubs(teamId)).filter((s) => {
    if (!(kind === "board" ? s.notify_board : s.notify_chat)) return false;
    if (except.endpoint) return s.endpoint !== except.endpoint;
    // Sender's phone unknown (notifications off there): skip only a family's own phones.
    return !except.author || except.author === "coach" || s.author_id !== except.author;
  });
  await Promise.allSettled(subs.map((s) => sendPush(s, { ...payload, tag: `${teamId}-${kind}` })));
}

/** Notifies only the team's managers: the phones used in Manager's Corner (league messages). */
export async function notifyManagers(teamId: string, payload: Payload): Promise<void> {
  if (!ready()) return;
  const subs = (await getPushSubs(teamId)).filter((s) => s.author_id === COACH_AUTHOR && s.notify_board);
  await Promise.allSettled(subs.map((s) => sendPush(s, { ...payload, tag: `${teamId}-league` })));
}

export function preview(text: string, max = 120): string {
  const one = text.replace(/\s+/g, " ").trim();
  return one.length > max ? `${one.slice(0, max - 1)}…` : one;
}
