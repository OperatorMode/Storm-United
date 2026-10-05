import type { TeamRow } from "./store";
import { onColor } from "./theme";

// A team's logo: its uploaded one, or a generated crest in its colours.
export function logoSrc(team: Pick<TeamRow, "id" | "logo_url">): string {
  return team.logo_url ?? `/${team.id}/crest.svg`;
}

export function initials(name: string): string {
  const words = name.split(/\s+/).filter(Boolean);
  return (words.length > 1 ? words.slice(0, 2).map((w) => w[0]) : [name.slice(0, 2)]).join("").toUpperCase();
}

const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);

// Same shield as the Storm United crest, with the team's initials in place of
// the bolt and its name on the banner.
export function generatedCrest(team: Pick<TeamRow, "name" | "primary_color" | "accent_color">): string {
  const p = team.primary_color;
  const on = onColor(p);
  const shield = "M256 34 L446 92 V246 C446 362 366 444 256 482 C146 444 66 362 66 246 V92 Z";
  const name = team.name.toUpperCase();
  const size = Math.min(34, Math.floor(560 / Math.max(name.length, 8)));
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
  <defs><clipPath id="s"><path d="${shield}"/></clipPath></defs>
  <path d="${shield}" fill="${p}"/>
  <g clip-path="url(#s)"><rect x="0" y="340" width="512" height="70" fill="${on}"/></g>
  <path d="${shield}" fill="none" stroke="${on}" stroke-width="14" stroke-linejoin="round"/>
  <text x="264" y="292" text-anchor="middle" font-family="Arial Black, Arial, Helvetica, sans-serif" font-weight="900" font-size="150" fill="${team.accent_color}">${esc(initials(team.name))}</text>
  <text x="256" y="284" text-anchor="middle" font-family="Arial Black, Arial, Helvetica, sans-serif" font-weight="900" font-size="150" fill="${on}">${esc(initials(team.name))}</text>
  <text x="256" y="${375 + size / 3}" text-anchor="middle" font-family="Arial Black, Arial, Helvetica, sans-serif" font-weight="900" font-size="${size}" fill="${p}">${esc(name)}</text>
  <rect x="236" y="424" width="40" height="5" rx="2.5" fill="${team.accent_color}"/>
</svg>`;
}
