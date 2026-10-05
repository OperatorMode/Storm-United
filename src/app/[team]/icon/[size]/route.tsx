import { ImageResponse } from "next/og";
import { getTeam } from "@/lib/teams";
import { initials, logoSrc } from "@/lib/brand";
import { onColor } from "@/lib/theme";

const SIZES = new Set([32, 64, 180, 192, 512]);

// App icon: the team's logo on its main colour. Maskable icons get extra
// padding because Android crops them to a circle/squircle.
export async function GET(request: Request, ctx: RouteContext<"/[team]/icon/[size]">) {
  const { team: id, size: raw } = await ctx.params;
  const size = Number(raw);
  const team = await getTeam(id);
  if (!team || !SIZES.has(size)) return new Response("Not found", { status: 404 });

  const maskable = new URL(request.url).searchParams.has("maskable");
  const inner = Math.round(size * (maskable ? 0.7 : size <= 64 ? 1 : 0.88));
  const on = onColor(team.primary_color);

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: size <= 64 ? "transparent" : team.primary_color,
        }}
      >
        {team.logo_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={new URL(logoSrc(team), request.url).toString()} width={inner} height={inner} alt="" />
        ) : (
          <div
            style={{
              width: inner,
              height: inner,
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              borderRadius: inner * 0.22,
              border: `${Math.max(2, inner * 0.04)}px solid ${on}`,
              background: team.primary_color,
              color: on,
              fontSize: inner * 0.42,
              fontWeight: 800,
            }}
          >
            {initials(team.name)}
            <div style={{ width: inner * 0.2, height: Math.max(2, inner * 0.035), background: team.accent_color }} />
          </div>
        )}
      </div>
    ),
    { width: size, height: size },
  );
}
