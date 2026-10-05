import Link from "next/link";
import { cookies } from "next/headers";
import { JoinTeamForm, ManagerSignInForm } from "./LandingForms";
import { getTeam } from "@/lib/teams";
import { logoSrc } from "@/lib/brand";

// Landing page. There's deliberately no public list of teams: parents join
// with the code from their coach, managers sign in with code/name + PIN.
// Teams this phone has used before are offered as one-tap shortcuts.
export default async function Landing() {
  const all = (await cookies()).getAll();
  const ids = new Set(
    all.flatMap((c) => {
      const m = c.name.match(/^su_(?:voter|join|admin)_([a-z0-9-]+)$/);
      return m ? [m[1]] : c.name === "su_voter" ? ["storm-united"] : [];
    }),
  );
  const known = (await Promise.all([...ids].map((id) => getTeam(id)))).filter((t) => t !== null);

  return (
    <div className="jersey min-h-dvh px-4 pb-10 pt-[calc(env(safe-area-inset-top)+2.5rem)]">
      <div className="mx-auto max-w-sm space-y-6">
        <div className="text-center">
          <h1 className="text-4xl font-bold tracking-tight">
            Sidelnr<span className="text-accent">.</span>
          </h1>
          <p className="mt-1 text-sm font-medium opacity-80">Your team, on the sideline.</p>
        </div>

        {known.length > 0 && (
          <div className="space-y-2">
            {known.map((t) => (
              <Link
                key={t.id}
                href={`/${t.id}`}
                className="flex items-center gap-3 rounded-2xl bg-white p-3 text-zinc-950 shadow-lg"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={logoSrc(t)} alt="" className="size-10 shrink-0 object-contain" />
                <span className="flex-1 font-semibold">{t.name}</span>
                <span className="text-sm text-zinc-500">Continue →</span>
              </Link>
            ))}
          </div>
        )}

        <section className="rounded-2xl bg-white p-5 text-zinc-950 shadow-lg">
          <h2 className="font-semibold">Join your team</h2>
          <p className="mb-3 mt-0.5 text-sm text-zinc-500">Enter the team code from your coach.</p>
          <JoinTeamForm />
        </section>

        <section className="rounded-2xl bg-white/95 p-5 text-zinc-950 shadow-lg">
          <h2 className="font-semibold">Manager’s Corner</h2>
          <p className="mb-3 mt-0.5 text-sm text-zinc-500">For coaches and team managers.</p>
          <ManagerSignInForm />
        </section>

        <p className="text-center text-xs opacity-50">
          Fixtures, attendance, MVP votes, team chat and the ladder — now running in the TPP 6 A-Side League.
        </p>
      </div>
    </div>
  );
}
