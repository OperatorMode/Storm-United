import type { Metadata, Viewport } from "next";
import { notFound } from "next/navigation";
import { getTeam } from "@/lib/teams";
import { themeVars } from "@/lib/theme";

export async function generateMetadata({ params }: LayoutProps<"/[team]">): Promise<Metadata> {
  const team = await getTeam((await params).team);
  if (!team) return {};
  return {
    title: team.name,
    description: `${team.name}: fixtures, attendance, MVP votes and the ladder.`,
    manifest: `/${team.id}/manifest.webmanifest`,
    icons: { icon: `/${team.id}/icon/64`, apple: `/${team.id}/icon/180` },
    appleWebApp: { capable: true, title: team.name, statusBarStyle: "black-translucent" },
  };
}

export async function generateViewport({ params }: LayoutProps<"/[team]">): Promise<Viewport> {
  const team = await getTeam((await params).team);
  return { themeColor: team?.primary_color ?? "#0a0a0a" };
}

export default async function TeamLayout({ children, params }: LayoutProps<"/[team]">) {
  const team = await getTeam((await params).team);
  if (!team) notFound();
  return <div style={themeVars(team.primary_color, team.accent_color)}>{children}</div>;
}
