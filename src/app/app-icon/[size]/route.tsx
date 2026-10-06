import { ImageResponse } from "next/og";
import { appIconSvg } from "@/lib/app-icon";

const SIZES = new Set([32, 64, 180, 192, 512]);

// The Sidelnr app icon as a PNG at the sizes phones and browsers ask for.
// Maskable icons get extra padding because Android crops them.
export async function GET(request: Request, ctx: RouteContext<"/app-icon/[size]">) {
  const size = Number((await ctx.params).size);
  if (!SIZES.has(size)) return new Response("Not found", { status: 404 });
  const maskable = new URL(request.url).searchParams.has("maskable");
  const src = `data:image/svg+xml;base64,${Buffer.from(appIconSvg({ maskable })).toString("base64")}`;
  return new ImageResponse(
    (
      // eslint-disable-next-line @next/next/no-img-element
      <img src={src} width={size} height={size} alt="" />
    ),
    { width: size, height: size },
  );
}
