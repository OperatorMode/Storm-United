import { notFound } from "next/navigation";
import { SidelnrLink } from "@/components/SidelnrLink";
import { JoinGate } from "@/components/JoinGate";
import { TabBar } from "@/components/TabBar";
import { ChatThread } from "./ChatThread";
import { getTeam } from "@/lib/teams";
import { teamLabels } from "@/lib/people";
import { isEvent } from "@/lib/my-events";
import { canView, chatAuthor, familyAuthor, isTeamAdmin } from "@/lib/session";
import { listChat } from "@/lib/messages";
import { tabData } from "@/lib/tabs";
import { teamTz } from "@/lib/league";

export default async function ChatPage({ params }: PageProps<"/[team]/chat">) {
  const team = await getTeam((await params).team);
  if (!team) notFound();
  if (!(await canView(team))) return <JoinGate team={team} />;

  const [me, family, coach, messages, tabs, tz] = await Promise.all([
    chatAuthor(team),
    familyAuthor(team),
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
        <h1 className="mt-0.5 text-xl font-semibold">{isEvent(team) ? "Chat" : "Team chat"}</h1>
      </header>

      <ChatThread teamId={team.id} me={me} family={coach && family ? { id: family, label: names[family] ?? "Your family" } : null} isCoach={coach} names={names} initial={messages} tz={tz} event={isEvent(team)} />

      <TabBar teamId={team.id} active="chat" {...tabs} />
    </div>
  );
}
