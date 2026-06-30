import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/api-auth";
import { prisma } from "@/lib/db";
import { getSpotifyProfile, SpotifyApiError } from "@/lib/spotify";
import { getSpotifyClientId, getSpotifyRedirectUri, isSpotifyConfigured, resolveSpotifyRedirectUri } from "@/lib/spotify-config";

export async function GET() {
  const { session, error } = await requireAuth();
  if (error) return error;

  const userId = session!.user!.id;

  const connection = await prisma.spotifyConnection.findUnique({
    where: { userId },
    select: { spotifyUserId: true, expiresAt: true },
  });

  const clientId = getSpotifyClientId();
  const clientIdHint = clientId
    ? `${clientId.slice(0, 8)}…${clientId.slice(-4)}`
    : null;

  let account: {
    id: string;
    displayName: string | null;
    email: string | null;
    imageUrl: string | null;
    product: string | null;
  } | null = null;

  if (connection) {
    try {
      const profile = await getSpotifyProfile(userId);
      account = {
        id: profile.id,
        displayName: profile.display_name,
        email: profile.email ?? null,
        imageUrl: profile.images?.[0]?.url ?? null,
        product: profile.product ?? null,
      };
    } catch (err) {
      account = {
        id: connection.spotifyUserId,
        displayName: null,
        email: null,
        imageUrl: null,
        product: null,
      };
      if (err instanceof SpotifyApiError && err.message === "not_allowlisted") {
        return NextResponse.json({
          linked: true,
          configured: isSpotifyConfigured(),
          spotifyUserId: connection.spotifyUserId,
          expiresAt: connection.expiresAt,
          clientIdHint,
          redirectUri: resolveSpotifyRedirectUri(),
          account,
          profileError: "not_allowlisted",
        });
      }
    }
  }

  return NextResponse.json({
    linked: !!connection,
    configured: isSpotifyConfigured(),
    spotifyUserId: connection?.spotifyUserId ?? null,
    expiresAt: connection?.expiresAt ?? null,
    clientIdHint,
    redirectUri: resolveSpotifyRedirectUri(),
    account,
  });
}
