// Per-team colours. Text on the team's main colour is picked automatically
// (white on dark colours, near-black on light ones like yellow or white).

function luminance(hex: string): number {
  const m = hex.replace("#", "").match(/^([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i);
  if (!m) return 0;
  const [r, g, b] = m.slice(1).map((c) => {
    const v = parseInt(c, 16) / 255;
    return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

export function isHexColor(s: string): boolean {
  return /^#[0-9a-f]{6}$/i.test(s);
}

export function onColor(hex: string): string {
  return luminance(hex) > 0.4 ? "#0a0a0a" : "#ffffff";
}

export function themeVars(primary: string, accent: string): React.CSSProperties {
  return {
    "--team-primary": primary,
    "--team-on": onColor(primary),
    "--team-accent": accent,
    "--team-on-accent": onColor(accent),
  } as React.CSSProperties;
}
