import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { cookies } from "next/headers";
import { Nav } from "@/components/nav";
import { BOARD_COOKIE, boardCookieMatches } from "@/lib/board-cookie";
import { createSupabaseServer } from "@/lib/supabase-server";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Villas at the Boulders — HOA Issue Tracker",
  description: "HOA work item, ARC request, and correspondence tracking dashboard",
  viewport: "width=device-width, initial-scale=1",
};

async function BoardNav() {
  const supabase = await createSupabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user?.email) return null;
  const jar = await cookies();
  try {
    const allowed = await boardCookieMatches(jar.get(BOARD_COOKIE)?.value, user.email);
    if (!allowed) return null;
  } catch {
    return null;
  }
  return <Nav />;
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-app-bg">
        <BoardNav />
        <main className="flex-1">{children}</main>
      </body>
    </html>
  );
}
