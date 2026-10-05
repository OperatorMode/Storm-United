import { notFound } from "next/navigation";
import { JoinGate } from "@/components/JoinGate";
import { TabBar } from "@/components/TabBar";
import { NotificationSettings } from "@/components/NotificationSettings";
import { AckButton, AnnouncementComposer, DeleteAnnouncement } from "./BoardControls";
import { firstName, getTeam, playerName } from "@/lib/teams";
import { canView, currentVoter, isTeamAdmin } from "@/lib/session";
import { listAnnouncements } from "@/lib/messages";
import { formatWhen, tabData } from "@/lib/tabs";
import { pushPublicKey } from "@/lib/push";

export default async function BoardPage({ params }: PageProps<"/[team]/board">) {
  const team = await getTeam((await params).team);
  if (!team) notFound();
  if (!(await canView(team))) return <JoinGate team={team} />;

  const [voter, coach, announcements] = await Promise.all([
    currentVoter(team),
    isTeamAdmin(team),
    listAnnouncements(team.id),
  ]);
  const tabs = await tabData(team.id, voter);
  const families = team.players.length;

  return (
    <div className="mx-auto max-w-md pb-24">
      <header className="jersey px-4 pb-5 pt-[calc(env(safe-area-inset-top)+1.25rem)]">
        <div className="text-xs uppercase tracking-widest text-on-team/50">{team.name}</div>
        <h1 className="mt-1 text-2xl font-semibold">Message board</h1>
        <p className="mt-1 text-sm text-on-team/60">Updates from the coach. Tap “Got it” so they know you’ve seen it.</p>
      </header>

      <main className="mt-4 space-y-4 px-4">
        {coach && <AnnouncementComposer teamId={team.id} />}

        {!voter && !coach && announcements.length > 0 && (
          <p className="rounded-xl bg-amber-50 px-3 py-2 text-sm text-amber-900">Pick your child on the Home tab to tap “Got it”.</p>
        )}

        {announcements.length === 0 && (
          <p className="rounded-2xl border border-dashed border-zinc-300 p-6 text-center text-sm text-zinc-500">
            No messages from the coach yet.
          </p>
        )}

        {announcements.map((a) => {
          const acked = a.acks.filter((id) => team.players.some((p) => p.id === id));
          const waiting = team.players.filter((p) => !a.acks.includes(p.id));
          const mine = voter ? a.acks.includes(voter) : false;
          return (
            <article key={a.id} className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm">
              <div className="mb-2 flex items-center justify-between text-xs text-zinc-500">
                <span className="font-medium text-zinc-700">📣 Coach</span>
                <span>{formatWhen(a.created_at)}</span>
              </div>
              <p className="whitespace-pre-wrap break-words text-[15px] leading-relaxed">{a.body}</p>

              {voter && !coach && (
                <div className="mt-3">
                  <AckButton teamId={team.id} id={a.id} done={mine} />
                </div>
              )}

              {coach && (
                <div className="mt-3 border-t border-zinc-100 pt-3 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="font-medium text-zinc-700">
                      ✓ {acked.length}/{families} acknowledged
                    </span>
                    <DeleteAnnouncement teamId={team.id} id={a.id} />
                  </div>
                  {waiting.length > 0 && (
                    <div className="mt-1 text-zinc-500">
                      Waiting on: {waiting.map((p) => firstName(playerName(team, p.id))).join(", ")}
                    </div>
                  )}
                </div>
              )}
            </article>
          );
        })}

        <NotificationSettings teamId={team.id} vapidKey={pushPublicKey()} />
      </main>

      <TabBar teamId={team.id} active="board" {...tabs} />
    </div>
  );
}
