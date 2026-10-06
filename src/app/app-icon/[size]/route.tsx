import { ImageResponse } from "next/og";

const SIZES = new Set([32, 64, 180, 192, 512]);

// The Sidelnr app icon: "S." on black (placeholder until the logo is final).
// Maskable icons get extra padding because Android crops them.
export async function GET(request: Request, ctx: RouteContext<"/app-icon/[size]">) {
  const size = Number((await ctx.params).size);
  if (!SIZES.has(size)) return new Response("Not found", { status: 404 });
  const maskable = new URL(request.url).searchParams.has("maskable");
  const font = size * (maskable ? 0.5 : 0.66);
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#0a0a0a",
          color: "#ffffff",
          fontSize: font,
          fontWeight: 900,
          letterSpacing: -font * 0.04,
        }}
      >
        S<span style={{ color: "#e5334b" }}>.</span>
      </div>
    ),
    { width: size, height: size },
  );
}
