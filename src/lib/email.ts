// Transactional email via Resend (RESEND_API_KEY). Without a key, local dev
// prints the email to the server log instead; production reports it as unsent.

const FROM = process.env.EMAIL_FROM ?? "Sidelnr <login@sidelnr.app>";

export async function sendEmail(to: string, subject: string, text: string, html: string): Promise<boolean> {
  const key = process.env.RESEND_API_KEY;
  if (!key) {
    if (process.env.NODE_ENV !== "production" || !process.env.VERCEL) {
      console.log(`\n[email to ${to}] ${subject}\n${text}\n`);
      return true;
    }
    console.error("RESEND_API_KEY is not set — email not sent");
    return false;
  }
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from: FROM, to, subject, text, html }),
    });
    if (!res.ok) console.error("Resend error", res.status, await res.text());
    return res.ok;
  } catch (err) {
    console.error("Resend request failed", err);
    return false;
  }
}

export function loginEmail(link: string) {
  const text = `Tap this link to sign in to Sidelnr:\n\n${link}\n\nIt works once and expires in 15 minutes. If you didn't ask for it, you can ignore this email.`;
  const html = `<div style="font-family:system-ui,-apple-system,Segoe UI,sans-serif;max-width:420px;margin:0 auto;padding:24px;color:#09090b">
  <h1 style="font-size:22px;margin:0 0 4px">Sidelnr<span style="color:#e5334b">.</span></h1>
  <p style="margin:0 0 20px;color:#52525b">Your team, on the sideline.</p>
  <p>Tap the button to sign in to Manager’s Corner.</p>
  <p style="margin:24px 0"><a href="${link}" style="background:#09090b;color:#fff;padding:12px 20px;border-radius:12px;text-decoration:none;font-weight:600;display:inline-block">Sign in to Sidelnr</a></p>
  <p style="font-size:13px;color:#71717a">The link works once and expires in 15 minutes. If you didn’t ask for it, you can ignore this email.</p>
</div>`;
  return { subject: "Your Sidelnr sign-in link", text, html };
}

// Email sign-in is offered only once email can actually be sent (local dev
// prints emails to the log, so it's always on there).
export function emailEnabled(): boolean {
  return !!process.env.RESEND_API_KEY || !process.env.VERCEL;
}
