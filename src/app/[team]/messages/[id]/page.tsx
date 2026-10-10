import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getTeam } from "@/lib/teams";
import { canView, dmIdentities } from "@/lib/session";
import { teamTz } from "@/lib/league";
import { blocksBy, getConversation, markRead, memberLabel, membersOf, messagesIn } from "@/lib/dms";
import { teamLabels } from "@/lib/people";
import { JoinGate } from "@/components/JoinGate";
import { DmThread } from "./DmThread";
import { SidelnrLink } from "@/components/SidelnrLink";

// One private conversation: the messages, a box to write, and Leave (groups)
// or Block (one-to-one).
export default async function ConversationPage({ params }: PageProps<"/[team]/messages/[id]">) {
  const { team: teamId, id } = await params;
  const team = await getTeam(teamId);
  if (!team) notFound();
  if (!(await canView(team))) return <JoinGate team={team} />;
  const ids = await dmIdentities(team);
  const conv = ids?.length ? await getConversation(team.id, id) : null;
  if (!ids?.length || !conv) redirect(`/${team.id}/messages`);
  const members = await membersOf([conv.id]);
  const me = members.find((m) => ids.includes(m.member) && !m.left_at)?.member;
  if (!me) redirect(`/${team.id}/messages`);

  const [messages, tz, blocked, labels] = await Promise.all([messagesIn(conv.id), teamTz(team), blocksBy(team.id, ids), teamLabels(team.id)]);
  await markRead(conv.id, me);
  const active = members.filter((m) => !m.left_at);
  const others = active.filter((m) => m.member !== me).map((m) => m.member);
  const names = Object.fromEntries([...new Set([...members.map((m) => m.member), ...messages.map((m) => m.author)])].map((m) => [m, memberLabel(labels, m)]));
  const title = conv.name ?? (others.map((o) => names[o]).join(", ") || "Just you");

  return (
    <div className="mx-auto flex min-h-dvh max-w-md flex-col bg-zinc-50">
      <header className="jersey sticky top-0 z-10 px-4 pb-3 pt-[calc(env(safe-area-inset-top)+0.75rem)]">
        <div className="flex items-center justify-between gap-3">
          <SidelnrLink className="" />
          <Link href={`/${team.id}/messages`} className="text-sm font-medium text-on-team/70">
            ← Messages
          </Link>
        </div>
        <h1 className="mt-1 truncate text-lg font-semibold">{title}</h1>
        {conv.is_group && <p className="truncate text-xs text-on-team/60">{["You", ...others.map((o) => names[o])].join(", ")}</p>}
      </header>
      <DmThread
        teamId={team.id}
        conversationId={conv.id}
        me={me}
        isGroup={conv.is_group}
        other={conv.is_group ? null : (others[0] ?? null)}
        otherBlocked={!conv.is_group && !!others[0] && blocked.includes(others[0])}
        blocked={blocked}
        names={names}
        initial={messages}
        tz={tz}
      />
    </div>
  );
}
