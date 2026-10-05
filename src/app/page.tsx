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
      <div className="text-xs uppercase tracking-widest opacity-60">TPP 6 A-Side League</div>
      <h1 className="text-3xl font-semibold">Team App</h1>
      <p className="max-w-xs text-sm opacity-70">
        Fixtures, attendance, MVP votes and the ladder for your team. Ask your coach or team manager for your team’s link.
      </p>
      <Link href="/super" className="mt-6 text-xs underline opacity-50">
        Admin
      </Link>
    </div>
  );
}
