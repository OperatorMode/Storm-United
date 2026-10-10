"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

// Opens "Send feedback", remembering which page it came from.
export function FeedbackLink({ className = "underline", children = "Send feedback" }: { className?: string; children?: React.ReactNode }) {
  const path = usePathname();
  const href = path && path !== "/feedback" ? `/feedback?from=${encodeURIComponent(path)}` : "/feedback";
  return (
    <Link href={href} className={className}>
      {children}
    </Link>
  );
}
