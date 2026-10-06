"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";

// Forget this phone: removes the teams it joined and the children it picked.
// (A coach's Manager's Corner sign-in is separate and stays.)
export async function forgetThisPhone() {
  const store = await cookies();
  for (const c of store.getAll()) {
    if (/^su_(voter|join)_/.test(c.name) || c.name === "su_voter") store.delete(c.name);
  }
  revalidatePath("/", "layout");
}
