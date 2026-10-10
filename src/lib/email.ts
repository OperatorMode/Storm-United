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
    console.error("RESEND_API_KEY is not set, email not sent");
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

/** A league announcement for team managers. */
export function leagueMessageEmail(league: string, body: string, link: string) {
  const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const text = `Announcement from ${league} for team managers:\n\n${body}\n\nOpen Sidelnr: ${link}`;
  const html = `<div style="font-family:system-ui,-apple-system,Segoe UI,sans-serif;max-width:480px;margin:0 auto;padding:24px;color:#09090b">
  <h1 style="font-size:22px;margin:0 0 4px">Sidelnr<span style="color:#e5334b">.</span></h1>
  <p style="margin:0 0 20px;color:#52525b">Announcement from <b>${esc(league)}</b> for team managers</p>
  <div style="white-space:pre-wrap;font-size:15px;line-height:1.5;border-left:3px solid #e5334b;padding-left:12px">${esc(body)}</div>
  <p style="margin:24px 0"><a href="${link}" style="background:#09090b;color:#fff;padding:12px 20px;border-radius:12px;text-decoration:none;font-weight:600;display:inline-block">Open Sidelnr</a></p>
  <p style="font-size:13px;color:#71717a">You get this because you manage a team in ${esc(league)} on Sidelnr.</p>
</div>`;
  return { subject: `${league}: announcement for team managers`, text, html };
}

/** The one-time code that proves someone can open a league's official inbox. */
export function leagueCodeEmail(league: string, code: string) {
  const text = `Your code to verify ${league} on Sidelnr: ${code}\n\nIt expires in 15 minutes. If you didn't ask for it, you can ignore this email: nothing changes without the code.`;
  const html = `<div style="font-family:system-ui,-apple-system,Segoe UI,sans-serif;max-width:420px;margin:0 auto;padding:24px;color:#09090b">
  <h1 style="font-size:22px;margin:0 0 4px">Sidelnr<span style="color:#e5334b">.</span></h1>
  <p style="margin:0 0 20px;color:#52525b">Verify ${league.replace(/[<>&]/g, "")} as an official league</p>
  <p>Your code:</p>
  <p style="font-size:32px;font-weight:700;letter-spacing:6px;margin:8px 0 20px">${code}</p>
  <p style="font-size:13px;color:#71717a">It expires in 15 minutes. If you didn’t ask for it, you can ignore this email: nothing changes without the code.</p>
</div>`;
  return { subject: `${code} is your Sidelnr league code`, text, html };
}

/** The second step into the owner page (/super). */
export function ownerCodeEmail(code: string) {
  const text = `Your Sidelnr owner code: ${code}\n\nIt expires in 10 minutes. If you didn't just enter the owner PIN, someone else did: change ADMIN_PIN in Vercel.`;
  const html = `<div style="font-family:system-ui,-apple-system,Segoe UI,sans-serif;max-width:420px;margin:0 auto;padding:24px;color:#09090b">
  <h1 style="font-size:22px;margin:0 0 4px">Sidelnr<span style="color:#e5334b">.</span></h1>
  <p style="margin:0 0 20px;color:#52525b">Owner page sign-in</p>
  <p style="font-size:32px;font-weight:700;letter-spacing:6px;margin:8px 0 20px">${code}</p>
  <p style="font-size:13px;color:#71717a">It expires in 10 minutes. If you didn’t just enter the owner PIN, someone else did: change ADMIN_PIN in Vercel.</p>
</div>`;
  return { subject: `${code} is your Sidelnr owner code`, text, html };
}

/** New feedback, to the owner. */
export function feedbackEmail(kind: string, message: string, page: string | null, device: string | null, replyTo: string | null) {
  const esc = (v: string) => v.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const meta = [page && `Page: ${page}`, device && `Device: ${device}`, replyTo ? `Reply to: ${replyTo}` : "No reply email"]
    .filter(Boolean)
    .join("\n");
  const text = `${kind}\n\n${message}\n\n${meta}\n\nSee all feedback on the owner page: https://sidelnr.app/super`;
  const html = `<div style="font-family:system-ui,-apple-system,Segoe UI,sans-serif;max-width:520px;margin:0 auto;padding:24px;color:#09090b">
  <h1 style="font-size:22px;margin:0 0 4px">Sidelnr<span style="color:#e5334b">.</span></h1>
  <p style="margin:0 0 16px;color:#52525b">New feedback: ${esc(kind)}</p>
  <p style="white-space:pre-wrap;font-size:15px;line-height:1.5">${esc(message)}</p>
  <p style="white-space:pre-wrap;font-size:13px;color:#71717a">${esc(meta)}</p>
  <p style="font-size:13px"><a href="https://sidelnr.app/super">See all feedback on the owner page</a></p>
</div>`;
  return { subject: `Sidelnr feedback: ${kind}`, text, html };
}

/** A league asks for official access (or to claim an imported league): to the owner, who replies by email. */
export function leagueRequestEmail(league: string, competition: string, from: string, note: string, link: string | null) {
  const esc = (v: string) => v.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const text = `${league} (${competition}) asks for official access.\n\nFrom: ${from}\n${link ? `Website: ${link}\n` : ""}\n${note}\n\nReply to ${from} with your terms, then Approve or Decline on the owner page: https://sidelnr.app/super`;
  const html = `<div style="font-family:system-ui,-apple-system,Segoe UI,sans-serif;max-width:520px;margin:0 auto;padding:24px;color:#09090b">
  <h1 style="font-size:22px;margin:0 0 4px">Sidelnr<span style="color:#e5334b">.</span></h1>
  <p style="margin:0 0 16px;color:#52525b">Official league request</p>
  <p style="font-size:16px;font-weight:600;margin:0">${esc(league)} <span style="font-weight:400;color:#52525b">(${esc(competition)})</span></p>
  <p style="font-size:14px;margin:8px 0">From: <a href="mailto:${esc(from)}">${esc(from)}</a>${link ? `<br>Website: ${esc(link)}` : ""}</p>
  <p style="white-space:pre-wrap;font-size:15px;line-height:1.5;background:#f4f4f5;border-radius:12px;padding:12px">${esc(note)}</p>
  <p style="font-size:13px;color:#71717a">Reply to them with your terms, then Approve or Decline on the <a href="https://sidelnr.app/super">owner page</a>.</p>
</div>`;
  return { subject: `Official league request: ${league}`, text, html };
}

/** A week before the last game: get next season ready. */
export function seasonEndEmail(team: string, lastGame: string, link: string) {
  const esc = (v: string) => v.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const text = `The last game of the season for ${team} is ${lastGame}.\n\nGet next season ready in Manager's Corner: pick next season's competition, who's playing again, and what to take (training times, duty roster).\n\n${link}`;
  const html = `<div style="font-family:system-ui,-apple-system,Segoe UI,sans-serif;max-width:520px;margin:0 auto;padding:24px;color:#09090b">
  <h1 style="font-size:22px;margin:0 0 4px">Sidelnr<span style="color:#e5334b">.</span></h1>
  <p style="margin:0 0 16px;color:#52525b">The season ends soon</p>
  <p style="font-size:15px;line-height:1.5">The last game of the season for ${esc(team)} is <b>${esc(lastGame)}</b>.</p>
  <p style="font-size:15px;line-height:1.5">Get next season ready in Manager’s Corner: pick next season’s competition, who’s playing again, and what to take (training times, duty roster).</p>
  <p><a href="${esc(link)}" style="display:inline-block;background:#09090b;color:#fff;text-decoration:none;padding:12px 18px;border-radius:12px;font-weight:600">Open Manager’s Corner</a></p>
</div>`;
  return { subject: `${team}: the season ends soon`, text, html };
}
