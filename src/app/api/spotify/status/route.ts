import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/api-auth";
import { prisma } from "@/lib/db";
import { getSpotifyProfile, SpotifyApiError } from "@/lib/spotify";
import {
  canStartSpotifyOAuthFromOrigin,
  getSpotifyClientId,
  getSpotifyLinkFallbackUrl,
  getSpotifyLoopbackLinkUrl,
  isSpotifyConfigured,
  requestOrigin,
  resolveSpotifyRedirectUri,
} from "@/lib/spotify-config";
import { requireTeamMember, isTeamManager, teamAccessResponse } from "@/lib/team-auth";
import { teamSpotifyConnectPath } from "@/lib/spotify-connect";

function spotifyLinkFields(request: Request, teamId: string) {
  const redirectUri = resolveSpotifyRedirectUri(request);
  const origin = requestOrigin(request);
  const canLinkHere = canStartSpotifyOAuthFromOrigin(origin, redirectUri);
  const linkBase = teamSpotifyConnectPath(teamId);
  const switchPath = teamSpotifyConnectPath(teamId, true);
  return {
    redirectUri,
    canLinkHere,
    linkUrl: linkBase,
    switchUrl: switchPath,
    linkFallbackUrl: canLinkHere ? null : getSpotifyLinkFallbackUrl(teamId),
    loopbackLinkUrl: getSpotifyLoopbackLinkUrl(teamId),
  };
}

export async function GET(request: Request) {
  const { session, error } = await requireAuth();
  if (error) return error;

  const userId = session!.user!.id;
  const { searchParams } = new URL(request.url);
  const teamId = searchParams.get("teamId");

  if (!teamId) {
    return NextResponse.json({ error: "teamId is required" }, { status: 400 });
  }

  try {
    const membership = await requireTeamMember(teamId, userId);
    const canManage = isTeamManager(membership.role);

    const connection = await prisma.spotifyConnection.findUnique({
      where: { teamId },
      select: { spotifyUserId: true, expiresAt: true },
    });

    const clientId = getSpotifyClientId();
    const clientIdHint = clientId
      ? `${clientId.slice(0, 8)}…${clientId.slice(-4)}`
      : null;

    const linkFields = spotifyLinkFields(request, teamId);

    let account: {
      id: string;
      displayName: string | null;
      email: string | null;
      imageUrl: string | null;
      product: string | null;
    } | null = null;

    if (connection) {
      try {
        const profile = await getSpotifyProfile(teamId);
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
            canManage,
            spotifyUserId: connection.spotifyUserId,
            expiresAt: connection.expiresAt,
            clientIdHint,
            ...linkFields,
            account,
            profileError: "not_allowlisted",
          });
        }
      }
    }

    return NextResponse.json({
      linked: !!connection,
      configured: isSpotifyConfigured(),
      canManage,
      spotifyUserId: connection?.spotifyUserId ?? null,
      expiresAt: connection?.expiresAt ?? null,
      clientIdHint,
      ...linkFields,
      account,
    });
  } catch (err) {
    const response = teamAccessResponse(err);
    if (response) return response;
    throw err;
  }
}
