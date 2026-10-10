import type { Metadata } from "next";
import { SidelnrLink } from "@/components/SidelnrLink";
import { FeedbackForm } from "./FeedbackForm";

export const metadata: Metadata = { title: "Send feedback · Sidelnr", robots: { index: false } };

// Ideas, bugs and anything else, straight to the developer.
export default async function FeedbackPage({ searchParams }: PageProps<"/feedback">) {
  const params = await searchParams;
  const from = typeof params.from === "string" ? params.from : "";
  const kind = typeof params.kind === "string" ? params.kind : "";
  return (
    <div className="mx-auto max-w-md px-4 pb-16 pt-[calc(env(safe-area-inset-top)+1.5rem)]">
      <SidelnrLink className="" />
      <h1 className="mt-4 text-2xl font-semibold">Send feedback</h1>
      <p className="mt-1 text-sm text-zinc-600">An idea for Sidelnr, or something not working? Tell the developer directly.</p>
      <div className="mt-6">
        <FeedbackForm from={from} initialKind={kind} />
      </div>
    </div>
  );
}
