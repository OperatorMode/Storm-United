"use server";

import { after } from "next/server";
import { headers } from "next/headers";
import { addFeedback, FEEDBACK_KINDS, type FeedbackKind } from "@/lib/feedback";
import { feedbackEmail, sendEmail } from "@/lib/email";
import { deviceKind } from "@/lib/phones";
import { lockedMessage, recordFailure } from "@/lib/rate-limit";

const MAX_LENGTH = 2000;

export async function sendFeedback(input: { kind: string; message: string; email: string; page: string }) {
  const kind = (input.kind in FEEDBACK_KINDS ? input.kind : "other") as FeedbackKind;
  const message = input.message.trim();
  const email = input.email.trim();
  // Only a path on this site, never a full address.
  const page = input.page.startsWith("/") && !input.page.startsWith("//") ? input.page.slice(0, 200) : null;
  if (!message) return { error: "Write a message first." };
  if (message.length > MAX_LENGTH) return { error: `Keep it under ${MAX_LENGTH} characters.` };
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { error: "That email doesn’t look right." };

  // Up to 5 messages in a short time from one device.
  const locked = await lockedMessage("feedback", "send");
  if (locked) return { error: locked };
  await recordFailure("feedback", "send");

  const device = deviceKind((await headers()).get("user-agent"));
  await addFeedback({ kind, message, email: email || null, page, device });
  const owner = process.env.OWNER_EMAIL?.trim();
  if (owner) {
    after(async () => {
      const mail = feedbackEmail(FEEDBACK_KINDS[kind], message, page, device, email || null);
      await sendEmail(owner, mail.subject, mail.text, mail.html);
    });
  }
  return { ok: true };
}
