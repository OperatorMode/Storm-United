import { notFound } from "next/navigation";
import { JoinGate } from "@/components/JoinGate";
import { TabBar } from "@/components/TabBar";
import { NotificationSettings } from "@/components/NotificationSettings";
import { ChatThread } from "./ChatThread";
import { firstName, getTeam } from "@/lib/teams";
import { canView, chatAuthor, currentVoter, isTeamAdmin } from "@/lib/session";
import { listChat } from "@/lib/messages";
import { tabData } from "@/lib/tabs";
import { pushPublicKey } from "@/lib/push";

export default async function ChatPage({ params }: PageProps<"/[team]/chat">) {
  const team = await getTeam((await params).team);
  if (!team) notFound();
  if (!(await canView(team))) return <JoinGate team={team} />;

  const [me, voter, coach, messages] = await Promise.all([
    chatAuthor(team),
    currentVoter(team),
    isTeamAdmin(team),
    listChat(team.id),
  ]);
  const tabs = await tabData(team.id, voter);
  // Names for every family that ever posted (incl. players who've left).
  const names = Object.fromEntries(team.allPlayers.map((p) => [p.id, `${firstName(p.name)}'s parent`]));

  return (
    <div className="mx-auto flex min-h-dvh max-w-md flex-col">
      <header className="jersey sticky top-0 z-10 px-4 pb-4 pt-[calc(env(safe-area-inset-top)+1rem)]">
        <div className="text-xs uppercase tracking-widest text-on-team/50">{team.name}</div>
        <h1 className="mt-0.5 text-xl font-semibold">Team chat</h1>
      </header>

      <div className="px-4 pt-3">
        <NotificationSettings teamId={team.id} vapidKey={pushPublicKey()} />
      </div>

      <ChatThread teamId={team.id} me={me} isCoach={coach} names={names} initial={messages} />

      <TabBar teamId={team.id} active="chat" {...tabs} />
    </div>
  );
}
