import Link from "next/link";

// The way back to the Sidelnr home page (the hub: My Activities, your teams,
// leagues and events), in the same spot on every page: top left. It says
// "Sidelnr" rather than "Home" because a team's tab bar has its own Home (the
// team's page). Always Sidelnr red with white text, with a thin white ring so it
// stands out on any team colour (red ones included) and on plain pages.
export function SidelnrLink({ className = "mb-3" }: { className?: string }) {
  return (
    <Link
      href="/"
      aria-label="Sidelnr home"
      className={`inline-flex items-center gap-1.5 rounded-full bg-[#e5334b] py-1.5 pl-2.5 pr-3.5 text-sm font-bold tracking-tight text-white shadow-md ring-2 ring-white/80 ${className}`}
    >
      <svg viewBox="0 0 24 24" aria-hidden className="size-4" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z" />
      </svg>
      <span>
        Sidelnr.
      </span>
    </Link>
  );
}
