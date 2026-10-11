"use server";

import { revalidatePath } from "next/cache";
import { ensureDeviceId } from "@/lib/device";
import { NAME_MAX, setDeviceName } from "@/lib/profile";

/** "Who are you?": this phone's user's name, across the app. */
export async function setMyName(name: string) {
  const clean = name.replace(/\s+/g, " ").trim().slice(0, NAME_MAX);
  if (clean.length < 2) return { error: "Type your first name." };
  await setDeviceName(await ensureDeviceId(), clean);
  revalidatePath("/", "layout");
  return { ok: true, name: clean };
}
