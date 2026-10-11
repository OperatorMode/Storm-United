"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { listTeams } from "@/lib/store";
import { deletePushSub } from "@/lib/messages";
import { deleteHouseholdPush } from "@/lib/activity-reminders";
import { forgetDevice } from "@/lib/phones";
import { currentDeviceId } from "@/lib/session";

// Forget this phone: the teams it joined (codes, team PINs, the children it
// picked), its link to the family's activities, its notifications, and its
// place under "Who follows…" and Connected phones. A coach's account sign-in
// is separate and stays.
export async function forgetThisPhone(endpoint: string | null) {
  const store = await cookies();
  const device = await currentDeviceId();
  if (endpoint) {
    for (const t of await listTeams()) await deletePushSub(t.id, endpoint).catch(() => {});
    await deleteHouseholdPush(endpoint).catch(() => {});
  }
  if (device) await forgetDevice(device).catch(() => {});
  for (const c of store.getAll()) {
    if (/^su_(voter|join|self|admin)_/.test(c.name) || c.name === "su_voter" || c.name === "su_household") store.delete(c.name);
  }
  revalidatePath("/", "layout");
}
