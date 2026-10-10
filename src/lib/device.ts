import { randomUUID } from "crypto";
import { cookies } from "next/headers";
import { COOKIE_OPTS, DEVICE_COOKIE, currentDeviceId } from "./session";

/** This phone's private id, created the first time it's needed. Server actions only (it may set a cookie). */
export async function ensureDeviceId(): Promise<string> {
  const existing = await currentDeviceId();
  if (existing) return existing;
  const id = randomUUID();
  (await cookies()).set(DEVICE_COOKIE, id, COOKIE_OPTS);
  return id;
}
