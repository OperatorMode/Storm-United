import Link from "next/link";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

// Team pages live at /<team>. There's deliberately no public list of teams —
// parents get their team's link (and join code) from their coach.
export default async function Landing() {
  // Returning parents (and apps installed before teams had their own links,
  // which open at "/") go straight to their team.
  const all = (await cookies()).getAll();
  const known = all.find((c) => /^su_(voter|join)_[a-z0-9-]+$/.test(c.name));
  if (known) redirect(`/${known.name.replace(/^su_(voter|join)_/, "")}`);
  if (all.some((c) => c.name === "su_voter")) redirect("/storm-united");

  return (
    <div className="jersey flex min-h-dvh flex-col items-center justify-center gap-4 p-6 text-center">
      <h1 className="text-4xl font-bold tracking-tight">
        Sidelnr<span className="text-accent">.</span>
      </h1>
      <p className="text-sm font-medium opacity-80">Your team, on the sideline.</p>
      <p className="max-w-xs text-sm opacity-60">
        Fixtures, attendance, MVP votes, team chat and the ladder — all in one place. Ask your coach or team manager for
        your team’s link.
      </p>
      <div className="mt-2 text-xs uppercase tracking-widest opacity-40">Now running in the TPP 6 A-Side League</div>
      <Link href="/super" className="mt-6 text-xs underline opacity-50">
        Admin
      </Link>
    </div>
  );
}
