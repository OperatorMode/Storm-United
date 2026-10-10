import Link from "next/link";
import { SidelnrLink } from "./SidelnrLink";

export const CONTACT_EMAIL = "hello@sidelnr.app";

// Shared layout for the privacy policy, terms and features pages.
export function LegalPage({ title, updated, children }: { title: string; updated: string; children: React.ReactNode }) {
  return (
    <div className="mx-auto max-w-2xl px-4 pb-16 pt-[calc(env(safe-area-inset-top)+1.5rem)]">
      <SidelnrLink className="" />
      <h1 className="mt-4 text-2xl font-semibold">{title}</h1>
      <p className="mt-1 text-sm text-zinc-500">Last updated {updated}</p>
      <div className="legal mt-6 space-y-4 text-[15px] leading-relaxed text-zinc-800 [&_h2]:mt-8 [&_h2]:text-lg [&_h2]:font-semibold [&_a]:underline [&_li]:ml-5 [&_li]:list-disc [&_ul]:space-y-1">
        {children}
      </div>
    </div>
  );
}

// Small print links for page footers.
export function LegalLinks({ className = "" }: { className?: string }) {
  return (
    <p className={`text-center text-xs ${className}`}>
      <Link href="/features" className="underline">
        Features &amp; Functions
      </Link>{" "}
      ·{" "}
      <Link href="/privacy" className="underline">
        Privacy
      </Link>{" "}
      ·{" "}
      <Link href="/terms" className="underline">
        Terms
      </Link>{" "}
      · <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>
    </p>
  );
}
