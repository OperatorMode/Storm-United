// Player names as the app keeps them: first name + last initial ("Sam T.").
// Shared by the squad finder (server) and file uploads (browser).

/** "LeBron James" -> "LeBron J."; a single name stays as is. */
export function shortName(full: string): string {
  const parts = full.replace(/\s+/g, " ").trim().split(" ");
  if (parts.length < 2) return parts[0] ?? "";
  const last = parts[parts.length - 1].replace(/[^\p{L}]/gu, "");
  return last ? `${parts[0]} ${last[0].toUpperCase()}.` : parts[0];
}

/** Full names → app names, without duplicates. Two "Sam J."s keep their full names so they can be told apart. */
export function squadNames(names: string[]): string[] {
  const full = [...new Set(names.map((p) => p.replace(/\s+/g, " ").trim()).filter(Boolean))];
  const count = new Map<string, number>();
  for (const p of full) count.set(shortName(p), (count.get(shortName(p)) ?? 0) + 1);
  return full.map((p) => (count.get(shortName(p))! > 1 ? p : shortName(p)));
}

/** Names from a CSV or text file: one per line, or a "name" column (or "first" + "last" columns). */
export function namesFromFile(text: string): string[] {
  const lines = text.replace(/^\uFEFF/, "").split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  if (!lines.length) return [];
  const sep = lines[0].includes("\t") ? "\t" : lines[0].includes(",") ? "," : lines[0].includes(";") ? ";" : null;
  if (!sep) return lines;
  const cells = (l: string) => l.split(sep).map((c) => c.trim().replace(/^"|"$/g, ""));
  const head = cells(lines[0]).map((h) => h.toLowerCase());
  const col = (re: RegExp) => head.findIndex((h) => re.test(h));
  const name = col(/^(player|full)?\s*name$|^player$/);
  const first = col(/^(first|given)/);
  const last = col(/^(last|sur|family)/);
  const rows = lines.slice(1).map(cells);
  if (name >= 0) return rows.map((r) => r[name] ?? "");
  if (first >= 0) return rows.map((r) => [r[first], last >= 0 ? r[last] : ""].filter(Boolean).join(" "));
  return lines.map((l) => cells(l)[0]); // no header: first column
}
