import { NextResponse } from "next/server";
import { consumeLoginToken, upsertManager } from "@/lib/accounts";
import { COOKIE_OPTS, MANAGER_COOKIE, managerSessionValue } from "@/lib/session";

// Landing point of the emailed sign-in link: /auth/verify?token=…&next=/path
export async function GET(request: Request) {
  const url = new URL(request.url);
  // Redirect back to the host the browser used (request.url can carry the
  // server's bind address behind a proxy).
  const host = request.headers.get("x-forwarded-host") ?? request.headers.get("host") ?? url.host;
  const proto = request.headers.get("x-forwarded-proto") ?? url.protocol.replace(":", "");
  const base = `${proto}://${host}`;

  const token = url.searchParams.get("token") ?? "";
  const nextParam = url.searchParams.get("next") ?? "";
  const next = nextParam.startsWith("/") && !nextParam.startsWith("//") ? nextParam : "/account";

  const email = token ? await consumeLoginToken(token) : null;
  if (!email) return NextResponse.redirect(`${base}/login?expired=1`);

  const manager = await upsertManager(email);
  const res = NextResponse.redirect(`${base}${next}`);
  res.cookies.set(MANAGER_COOKIE, managerSessionValue(manager.id), COOKIE_OPTS);
  return res;
}
