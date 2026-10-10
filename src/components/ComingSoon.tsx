import Link from "next/link";
import { SidelnrLink } from "./SidelnrLink";

// A page for a part of Sidelnr that isn't open yet.
export function ComingSoonPage({ title, text }: { title: string; text: string }) {
  return (
    <div className="mx-auto max-w-md space-y-4 p-4 pb-10">
      <SidelnrLink className="text-zinc-900" />
      <section className="rounded-2xl border border-zinc-200 bg-white p-6 text-center shadow-sm">
        <div className="text-xs font-semibold uppercase tracking-wide text-accent">Coming soon</div>
        <h1 className="mt-1 text-xl font-semibold">{title}</h1>
        <p className="mt-2 text-sm text-zinc-600">{text}</p>
        <Link href="/" className="mt-4 inline-block rounded-xl bg-zinc-900 px-4 py-2 text-sm font-semibold text-white">
          Back home
        </Link>
      </section>
    </div>
  );
}
