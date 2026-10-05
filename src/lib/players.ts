// The squad. First name + last initial only — this repo is public, so no
// surnames, parent names, emails or phone numbers live here.
export type Player = { id: string; name: string };

export const PLAYERS: Player[] = [
  { id: "benjamin", name: "Benjamin B." },
  { id: "brooklyn", name: "Brooklyn L." },
  { id: "erik", name: "Erik J." },
  { id: "khushmeet", name: "Khushmeet G." },
  { id: "rayygan", name: "Rayygan K." },
  { id: "ryan", name: "Ryan L." },
  { id: "viaan", name: "Viaan V." },
  { id: "zane", name: "Zane B." },
];

// Voter identities: one per family, plus the coach.
export const COACH_ID = "coach";

export function playerName(id: string): string {
  if (id === COACH_ID) return "Coach";
  return PLAYERS.find((p) => p.id === id)?.name ?? id;
}

export function isPlayerId(id: string): boolean {
  return PLAYERS.some((p) => p.id === id);
}

export function isVoterId(id: string): boolean {
  return id === COACH_ID || isPlayerId(id);
}
