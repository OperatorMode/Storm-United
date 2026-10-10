import { notFound } from "next/navigation";
import { SidelnrLink } from "@/components/SidelnrLink";
import { JoinGate } from "@/components/JoinGate";
import { TabBar } from "@/components/TabBar";
import { NotificationSettings } from "@/components/NotificationSettings";
import { ChatThread } from "./ChatThread";
import { getTeam } from "@/lib/teams";
import { teamLabels } from "@/lib/people";
import { canView, chatAuthor, isTeamAdmin } from "@/lib/session";
import { listChat } from "@/lib/messages";
import { tabData } from "@/lib/tabs";
import { pushPublicKey } from "@/lib/push";
import { teamTz } from "@/lib/league";

export default async function ChatPage({ params }: PageProps<"/[team]/chat">) {
  const team = await getTeam((await params).team);
  if (!team) notFound();
  if (!(await canView(team))) return <JoinGate team={team} />;

  const [me, coach, messages, tabs, tz] = await Promise.all([
    chatAuthor(team),
    isTeamAdmin(team),
    listChat(team.id),
    tabData(team),
    teamTz(team),
  ]);
  // Names for everyone who ever posted: people ("Leo's Dad"), the coach, and
  // older posts by a family ("Leo's parent"), incl. players who've left.
  const names = await teamLabels(team.id);

  return (
    <div className="mx-auto flex min-h-dvh max-w-md flex-col">
      <header className="jersey sticky top-0 z-10 px-4 pb-4 pt-[calc(env(safe-area-inset-top)+1rem)]">
        <SidelnrLink />
        <div className="text-xs uppercase tracking-widest text-on-team/50">{team.name}</div>
        <h1 className="mt-0.5 text-xl font-semibold">Team chat</h1>
      </header>

      <div className="px-4 pt-3">
        <NotificationSettings teamId={team.id} vapidKey={pushPublicKey()} />
      </div>

      <ChatThread teamId={team.id} me={me} isCoach={coach} names={names} initial={messages} tz={tz} />

      <TabBar teamId={team.id} active="chat" {...tabs} />
    </div>
  );
}
