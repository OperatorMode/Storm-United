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

export function playerName(id: string): string {
  return PLAYERS.find((p) => p.id === id)?.name ?? id;
}

export function isPlayerId(id: string): boolean {
  return PLAYERS.some((p) => p.id === id);
}
