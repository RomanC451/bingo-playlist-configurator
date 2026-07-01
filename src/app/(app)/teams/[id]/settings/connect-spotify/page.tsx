import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { TeamAccessError } from "@/lib/team-auth";
import {
  buildTeamSpotifyAuthUrl,
  SpotifyConnectError,
} from "@/lib/spotify-connect";

type PageProps = {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ switch?: string }>;
};

export default async function ConnectTeamSpotifyPage({
  params,
  searchParams,
}: PageProps) {
  const session = await auth();
  const { id: teamId } = await params;
  const { switch: switchParam } = await searchParams;

  if (!session?.user?.id) {
    redirect(
      `/login?callbackUrl=${encodeURIComponent(`/teams/${teamId}/settings/connect-spotify`)}`,
    );
  }

  try {
    const authUrl = await buildTeamSpotifyAuthUrl({
      teamId,
      userId: session.user.id,
      switchAccount: switchParam === "1",
    });
    redirect(authUrl);
  } catch (err) {
    if (err instanceof SpotifyConnectError) {
      redirect(`/teams/${teamId}/settings?spotify_error=${err.code}`);
    }
    if (err instanceof TeamAccessError) {
      redirect(`/teams/${teamId}/settings?spotify_error=forbidden`);
    }
    throw err;
  }
}
