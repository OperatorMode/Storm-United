import Link from "next/link";

// Top-left link from a team's pages back to the Sidelnr home page (My Player,
// other teams, managers). The tab bar's Home stays the team's own home.
export function SidelnrLink() {
  return (
    <Link href="/" className="mb-3 inline-flex items-center gap-1 text-xs font-semibold text-on-team/60">
      <svg viewBox="0 0 20 20" aria-hidden className="size-3.5">
        <path d="M12.5 5l-5 5 5 5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      Sidelnr<span className="text-accent">.</span>
    </Link>
  );
}
