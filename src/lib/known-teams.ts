import { cookies } from "next/headers";

/** Teams this phone has joined or picked a child in (from their cookies). */
export async function knownTeamIds(): Promise<string[]> {
  const ids = new Set<string>();
  for (const c of (await cookies()).getAll()) {
    const m = c.name.match(/^su_(?:voter|join|admin)_([a-z0-9-]+)$/);
    if (m) ids.add(m[1]);
    else if (c.name === "su_voter") ids.add("storm-united"); // before teams had their own links
  }
  return [...ids];
}
