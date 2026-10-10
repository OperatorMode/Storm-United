import Link from "next/link";
import { notFound } from "next/navigation";
import { SidelnrLink } from "@/components/SidelnrLink";
import { JoinGate } from "@/components/JoinGate";
import { TabBar } from "@/components/TabBar";
import { getTeam } from "@/lib/teams";
import { canView, dmIdentities, isPlayerSelf } from "@/lib/session";
import { tabData } from "@/lib/tabs";
import { teamTz } from "@/lib/league";
import { COACH, blocksBy, conversationsFor, lastMessages, memberLabel, membersOf, unreadCounts } from "@/lib/dms";
import { formatTime, formatWeekday, isoDateIn } from "@/lib/time";
import { NewMessage } from "./NewMessage";

// Private messages, like WhatsApp: every conversation this family is in, the
// newest first, with its last message and how many are unread.
export default async function MessagesPage({ params }: PageProps<"/[team]/messages">) {
  const team = await getTeam((await params).team);
  if (!team) notFound();
  if (!(await canView(team))) return <JoinGate team={team} />;

  const [ids, self, tabs, tz] = await Promise.all([dmIdentities(team), isPlayerSelf(team), tabData(team), teamTz(team)]);
  const convs = ids?.length ? await conversationsFor(team.id, ids) : [];
  const convIds = convs.map((c) => c.id);
  const blocked = ids?.length ? await blocksBy(team.id, ids) : [];
  const [members, last, unread] = await Promise.all([membersOf(convIds), lastMessages(convIds), ids?.length ? unreadCounts(convIds, ids, blocked) : ({} as Record<string, number>)]);

  const title = (convId: string, name: string | null) => {
    if (name) return name;
    const others = members.filter((m) => m.conversation_id === convId && !ids?.includes(m.member)).map((m) => memberLabel(team, m.member));
    return others.join(", ") || "Just you";
  };
  const today = isoDateIn(new Date(), tz);
  const when = (iso: string) => (isoDateIn(iso, tz) === today ? formatTime(new Date(iso), tz) : formatWeekday(new Date(iso), tz).split(" ").slice(0, 3).join(" "));
  // Families to message: everyone in the squad except this phone's own, plus the coach.
  const families = [
    ...(ids?.includes(COACH) ? [] : [{ id: COACH, label: "Coach" }]),
    ...team.players.filter((p) => !ids?.includes(p.id) && !blocked.includes(p.id)).map((p) => ({ id: p.id, label: memberLabel(team, p.id) })),
  ];

  return (
    <div className="mx-auto min-h-dvh max-w-md pb-24">
      <header className="jersey px-4 pb-4 pt-[calc(env(safe-area-inset-top)+1rem)]">
        <SidelnrLink />
        <div className="text-xs uppercase tracking-widest text-on-team/50">{team.name}</div>
        <h1 className="mt-0.5 text-xl font-semibold">Messages</h1>
        <p className="mt-0.5 text-xs text-on-team/60">Private messages between families, and with the coach.</p>
      </header>

      <main className="space-y-4 px-4 pt-4">
        {self ? (
          <p className="rounded-2xl border border-zinc-200 bg-white p-4 text-sm text-zinc-600">
            Private messages are for parents and coaches. Players can talk to the whole team in the Chat.
          </p>
        ) : !ids?.length ? (
          <p className="rounded-2xl border border-zinc-200 bg-white p-4 text-sm text-zinc-600">
            <Link href={`/${team.id}`} className="font-medium underline">
              Pick your child on Home
            </Link>{" "}
            first, then you can message other families.
          </p>
        ) : (
          <>
            <NewMessage teamId={team.id} families={families} />
            {convs.length === 0 ? (
              <p className="py-8 text-center text-sm text-zinc-500">No messages yet. Start one above.</p>
            ) : (
              <ul className="divide-y divide-zinc-100 overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-sm">
                {convs.map((c) => {
                  const m = last[c.id];
                  const n = unread[c.id] ?? 0;
                  const hidden = m && blocked.includes(m.author);
                  return (
                    <li key={c.id}>
                      <Link href={`/${team.id}/messages/${c.id}`} className="flex items-center gap-3 px-4 py-3">
                        <span className={`grid size-10 shrink-0 place-items-center rounded-full text-sm font-semibold ${c.is_group ? "bg-zinc-900 text-white" : "bg-zinc-100 text-zinc-700"}`}>
                          {title(c.id, c.name).slice(0, 1)}
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="flex items-baseline justify-between gap-2">
                            <span className={`truncate ${n ? "font-semibold" : "font-medium"}`}>{title(c.id, c.name)}</span>
                            <span className={`shrink-0 text-xs ${n ? "font-semibold text-accent" : "text-zinc-400"}`}>{when(c.last_message_at)}</span>
                          </span>
                          <span className="flex items-center justify-between gap-2">
                            <span className="truncate text-sm text-zinc-500">
                              {!m
                                ? "No messages yet"
                                : m.removed
                                  ? "Message removed"
                                  : hidden
                                    ? "Message from a blocked family"
                                    : `${m.kind === "text" && c.is_group && !ids.includes(m.author) ? `${memberLabel(team, m.author)}: ` : ids.includes(m.author) ? "You: " : ""}${m.body}`}
                            </span>
                            {n > 0 && (
                              <span className="grid min-w-5 shrink-0 place-items-center rounded-full bg-accent px-1.5 text-[11px] font-semibold leading-5 text-on-accent">
                                {n}
                              </span>
                            )}
                          </span>
                        </span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            )}
          </>
        )}
      </main>

      <TabBar teamId={team.id} active="messages" {...tabs} />
    </div>
  );
}
