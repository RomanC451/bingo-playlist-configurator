import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { LandingPage } from "@/components/LandingPage";
import { auth } from "@/lib/auth";

export const metadata: Metadata = {
  title: "Bingo Playlist Configurator by COTE Foundation",
  description:
    "Turn any Spotify playlist into a polished music bingo game. Configure clips, collaborate with your team, and run bingo night.",
};

export default async function RootPage() {
  const session = await auth();

  if (session?.user?.id) {
    redirect("/dashboard");
  }

  return <LandingPage />;
}
