import Link from "next/link";

// "Can't find your team?": the league comes first. Anyone signed in can add it
// with a link to the league's website; then the team is in its draw.
export function AddLeagueCallout({ learnHow, className = "" }: { learnHow?: React.ReactNode; className?: string }) {
  return (
    <div className={`rounded-2xl border-2 border-accent bg-white p-4 text-zinc-950 ${className}`}>
      <div className="font-semibold">Can’t find your team?</div>
      <p className="mt-1 text-sm text-zinc-600">
        Then your league isn’t on Sidelnr yet. Add it with a link to its website: the draw, results and ladder come in by
        themselves, and then your team is in it. It takes a minute.
      </p>
      <div className="mt-3 flex items-center gap-4">
        <Link href="/account/leagues/new" className="rounded-xl bg-accent px-4 py-2 text-sm font-semibold text-on-accent">
          Add your league
        </Link>
        {learnHow}
      </div>
    </div>
  );
}
