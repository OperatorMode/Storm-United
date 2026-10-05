import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { LoginForm } from "./LoginForm";
import { currentManager } from "@/lib/session";

export const metadata: Metadata = { title: "Sign in · Sidelnr", robots: { index: false } };

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  const params = await searchParams;
  const next = typeof params.next === "string" ? params.next : "/account";
  // Only skip the form for a real, existing account (a stale cookie for a
  // deleted account would otherwise bounce between here and /account forever).
  if (await currentManager()) redirect(next.startsWith("/") && !next.startsWith("//") ? next : "/account");
  return (
    <div className="jersey min-h-dvh px-4 pt-[calc(env(safe-area-inset-top)+3rem)]">
      <div className="mx-auto max-w-sm space-y-6">
        <div className="text-center">
          <h1 className="text-4xl font-bold tracking-tight">
            Sidelnr<span className="text-accent">.</span>
          </h1>
          <p className="mt-1 text-sm opacity-80">Manager sign-in</p>
        </div>
        <section className="rounded-2xl bg-white p-5 text-zinc-950 shadow-lg">
          {params.expired && (
            <p className="mb-3 rounded-xl bg-amber-50 px-3 py-2 text-sm text-amber-900">
              That sign-in link has expired or was already used. Request a new one below.
            </p>
          )}
          <LoginForm next={next} />
        </section>
      </div>
    </div>
  );
}
