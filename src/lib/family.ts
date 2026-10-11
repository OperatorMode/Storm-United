import { knownTeamIds } from "./known-teams";
import { getTeam, firstName, playerName } from "./teams";
import { isEvent } from "./my-events";
import { canView, currentChildren, currentDeviceId, currentHouseholdId } from "./session";
import { getDeviceName } from "./profile";
import { listActivities } from "./activities";

/**
 * The people in this phone's family, by first name, as My Activities knows
 * them: this phone's own name ("Who are you?"), the children it follows in its
 * teams, and everyone its activities are for. Used for "who's going" to an
 * event, so each person gets their own dot in My Activities.
 */
export async function familyPeople(): Promise<string[]> {
  const [deviceId, householdId] = await Promise.all([currentDeviceId(), currentHouseholdId()]);
  const me = await getDeviceName(deviceId);
  const kids: string[] = [];
  for (const id of await knownTeamIds()) {
    const team = await getTeam(id);
    if (!team || isEvent(team) || !(await canView(team))) continue;
    for (const c of await currentChildren(team)) kids.push(firstName(playerName(team, c)));
  }
  const persons = householdId ? (await listActivities(householdId, deviceId)).map((a) => a.person).filter((p) => p !== "Me") : [];
  return [...new Set([...(me ? [me] : []), ...kids, ...persons].filter(Boolean))];
}
