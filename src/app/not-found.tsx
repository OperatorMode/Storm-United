import Link from "next/link";

// Shown for a team, league or page that isn't there, most often one that was
// just deleted and is still in the browser's back history.
export default function NotFound() {
  return (
    <div className="mx-auto flex min-h-[70vh] max-w-md flex-col items-center justify-center gap-4 p-6 text-center">
      <div className="text-5xl font-black tracking-tight">
        S<span className="text-accent">.</span>
      </div>
      <h1 className="text-xl font-semibold">This page isn’t here anymore</h1>
      <p className="text-sm text-zinc-500">
        The team, league or player it showed may have been deleted, or the link isn’t quite right.
      </p>
      <div className="w-full space-y-2 pt-2">
        <Link href="/" replace className="block rounded-xl bg-zinc-900 px-4 py-3 font-semibold text-white">
          Back Home
        </Link>
        <Link href="/me" replace className="block rounded-xl border border-zinc-300 px-4 py-3 font-semibold text-zinc-800">
          My Player
        </Link>
      </div>
    </div>
  );
}
