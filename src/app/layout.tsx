import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { ClearAppBadge } from "@/components/ClearAppBadge";
import { HomeOnReturn } from "@/components/HomeOnReturn";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

// Team pages override these (name, icon, install manifest) in [team]/layout.tsx.
export const metadata: Metadata = {
  title: "Sidelnr",
  description: "Sidelnr, the team app for junior football: fixtures, attendance, MVP votes, team chat and the ladder.",
  icons: { icon: "/app-icon/64", apple: "/app-icon/180" },
  appleWebApp: { capable: true, title: "Sidelnr", statusBarStyle: "black-translucent" },
};

export const viewport: Viewport = {
  themeColor: "#0a0a0a",
  width: "device-width",
  initialScale: 1,
  // Lets the installed iPhone app draw under the status bar; the header pads for it.
  viewportFit: "cover",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable} antialiased`}>
      <body className="min-h-dvh font-sans">
        {children}
        <ClearAppBadge />
        <HomeOnReturn />
      </body>
    </html>
  );
}
