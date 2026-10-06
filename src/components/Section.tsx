// A card that folds away: just its title (and a short note) until tapped.
// Used in Manager's Corner so a long page stays scannable.
export function Section({
  title,
  aside,
  open = false,
  children,
}: {
  title: string;
  aside?: React.ReactNode;
  open?: boolean;
  children: React.ReactNode;
}) {
  return (
    <details open={open} className="group rounded-2xl border border-zinc-200 bg-white shadow-sm">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-3 p-4 [&::-webkit-details-marker]:hidden">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-zinc-500">{title}</h2>
        <span className="flex items-center gap-2 text-xs text-zinc-500">
          {aside && <span className="text-right">{aside}</span>}
          <svg viewBox="0 0 20 20" aria-hidden className="size-4 shrink-0 text-zinc-400 transition-transform group-open:rotate-180">
            <path d="M5 7.5l5 5 5-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </span>
      </summary>
      <div className="px-4 pb-4">{children}</div>
    </details>
  );
}
