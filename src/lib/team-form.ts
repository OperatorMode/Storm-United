import { deleteTeam, getTeamRow, listTeams, savePlayers, upsertTeam, uploadLogo, type TeamRow } from "./store";
import { competitionTeams, getCompetition } from "./league";
import { getTeam, hashSecret, joinCodeFields, mergePlayers, slugify } from "./teams";
import { isHexColor } from "./theme";

// Saving a team from the team form, shared by the super admin (/super) and
// managers (self-serve). Permission checks happen in the calling action.

// Paths that already mean something in the app and can't be team links.
const RESERVED = new Set(["super", "api", "brand", "icons", "uploads", "_next", "admin", "account", "login", "auth", "events", "me"]);
const MAX_LOGO_BYTES = 2 * 1024 * 1024;

export type TeamFormOptions = {
  editingId: string | null; // null = creating a new team
  lockCompetition: boolean; // keep the team's competition/draw name (managers editing)
  allowTakenTeam: boolean; // allow following a draw team another Sidelnr team already uses (super: demo teams)
};

export async function applyTeamForm(formData: FormData, opts: TeamFormOptions): Promise<{ id: string } | { error: string }> {
  const get = (k: string) => String(formData.get(k) ?? "").trim();

  const existing = opts.editingId ? await getTeam(opts.editingId) : null;
  if (opts.editingId && !existing) return { error: "Team not found." };

  const competitionId = opts.lockCompetition && existing?.competition_id ? existing.competition_id : get("competition_id");
  const leagueName = opts.lockCompetition && existing ? existing.league_name : get("league_name");
  const name = get("name") || leagueName;
  const id = existing?.id ?? slugify(get("slug") || name);
  const primary = get("primary_color");
  const accent = get("accent_color");

  const competition = await getCompetition(competitionId);
  if (!competition) return { error: "Pick a competition." };
  if (!(await competitionTeams(competition.id)).includes(leagueName)) {
    return { error: "Pick your team as it appears in the competition’s draw." };
  }
  if (!opts.allowTakenTeam) {
    const other = (await listTeams()).find(
      (t) => t.id !== id && t.competition_id === competition.id && t.league_name === leagueName,
    );
    if (other) return { error: `${leagueName} is already on Sidelnr. Ask its manager to add you in Manager’s Corner.` };
  }
  if (!id || RESERVED.has(id)) return { error: "Choose a different link name." };
  if (!existing && (await getTeamRow(id))) return { error: `The link /${id} is taken. Choose a different one.` };
  if (!isHexColor(primary) || !isHexColor(accent)) return { error: "Pick both colours." };

  let logoUrl = existing?.logo_url ?? null;
  const logo = formData.get("logo");
  if (formData.get("remove_logo") === "on") logoUrl = null;
  if (logo instanceof File && logo.size > 0) {
    if (!["image/png", "image/jpeg", "image/svg+xml"].includes(logo.type)) return { error: "Logo must be PNG, JPG or SVG." };
    if (logo.size > MAX_LOGO_BYTES) return { error: "Logo must be under 2 MB." };
    logoUrl = await uploadLogo(id, logo);
  }

  const players = mergePlayers(existing?.allPlayers ?? [], get("players").split("\n"));
  if (!players.some((p) => p.active)) return { error: "Add at least one player." };

  const adminPin = get("admin_pin");
  if (adminPin && adminPin.length < 4) return { error: "Manager PIN needs at least 4 characters." };
  const join = await joinCodeFields(id, { code: get("join_code"), clear: formData.get("clear_join") === "on" }, existing);
  if ("error" in join) return { error: join.error };
  const meet = Number(get("meet_minutes") || 30);
  if (!Number.isInteger(meet) || meet < 0 || meet > 120) return { error: "Meeting time must be 0–120 minutes." };

  const row: TeamRow = {
    id,
    name,
    league_name: leagueName,
    division: competition.source_key ?? competition.id, // legacy column
    competition_id: competition.id,
    primary_color: primary.toLowerCase(),
    accent_color: accent.toLowerCase(),
    logo_url: logoUrl,
    admin_pin_hash: adminPin ? hashSecret(adminPin) : (existing?.admin_pin_hash ?? null),
    ...join,
    meet_minutes: meet,
    goalie_enabled: formData.get("goalie_enabled") === "on",
  };
  await upsertTeam(row);
  await savePlayers(id, players);
  return { id };
}

export { deleteTeam };
