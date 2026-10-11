import Link from "next/link";

// The way back to the Sidelnr home page (the hub: My Activities, your teams,
// leagues and events), in the same spot on every page: top left. It says
// "Sidelnr" rather than "Home" because a team's tab bar has its own Home (the
// team's page). Takes the text colour of where it sits, so it works on the
// team colours and on plain pages alike.
export function SidelnrLink({ className = "mb-3" }: { className?: string }) {
  return (
    <Link
      href="/"
      aria-label="Sidelnr home"
      className={`inline-flex items-center gap-1.5 rounded-full border border-current/25 bg-current/10 py-1.5 pl-2.5 pr-3.5 text-sm font-bold tracking-tight ${className}`}
    >
      <svg viewBox="0 0 24 24" aria-hidden className="size-4" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z" />
      </svg>
      <span>
        Sidelnr<span className="text-accent">.</span>
      </span>
    </Link>
  );
}
