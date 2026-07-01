import { NextResponse } from "next/server";
import { z } from "zod";
import { internalError, spotifyErrorResponse } from "@/lib/api-errors";
import { requireAuth } from "@/lib/api-auth";
import { getActiveTeamId } from "@/lib/active-team";
import { prisma } from "@/lib/db";
import {
  getPlaylistInfo,
  getPlaylistTracks,
  SpotifyApiError,
} from "@/lib/spotify";
import { extractPlaylistId, isPlayableAudioTrack } from "@/lib/spotify-types";
import { requireTeamMember, teamAccessResponse } from "@/lib/team-auth";
import {
  buildSessionsUserReviewProgressMap,
  trackClipProposalInclude,
} from "@/lib/track-review";
import { loadActiveTrackEditLocksForSessions } from "@/lib/track-edit-lock-db";

const createSessionSchema = z.object({
  name: z.string().min(1).max(200),
  playlistInput: z.string().min(1),
  defaultClipDurationMs: z.union([
    z.literal(15000),
    z.literal(30000),
    z.literal(45000),
  ]),
  teamId: z.string().optional(),
});

export async function GET(request: Request) {
  const { session, error } = await requireAuth();
  if (error) return error;

  const userId = session!.user!.id;
  const { searchParams } = new URL(request.url);
  const teamIdParam = searchParams.get("teamId");
  const teamId = teamIdParam ?? (await getActiveTeamId(userId));

  if (!teamId) {
    return NextResponse.json([]);
  }

  try {
    await requireTeamMember(teamId, userId);

    const sessions = await prisma.bingoSession.findMany({
      where: { teamId },
      orderBy: { updatedAt: "desc" },
      include: {
        user: { select: { name: true, email: true } },
        trackClips: {
          take: 1,
          orderBy: { position: "asc" },
          select: { albumArtUrl: true },
        },
        _count: { select: { trackClips: true } },
      },
    });

    const sessionIds = sessions.map((session) => session.id);
    const [clips, reviews, locksByClipId] =
      sessionIds.length === 0
        ? [[], [], new Map()]
        : await Promise.all([
            prisma.trackClip.findMany({
              where: { sessionId: { in: sessionIds } },
              include: trackClipProposalInclude,
            }),
            prisma.trackClipReview.findMany({
              where: {
                userId,
                trackClip: { sessionId: { in: sessionIds } },
              },
              select: {
                trackClipId: true,
                userId: true,
                versionId: true,
                verdict: true,
                comment: true,
              },
            }),
            loadActiveTrackEditLocksForSessions(sessionIds),
          ]);

    const reviewProgressBySession = buildSessionsUserReviewProgressMap(clips, reviews, {
      currentUserId: userId,
      locksByClipId,
    });

    return NextResponse.json(
      sessions.map(
        ({ user, trackClips, spotifyPlaylistImageUrl, ...session }) => ({
          ...session,
          ownerName: user.name ?? user.email.split("@")[0],
          playlistImageUrl:
            spotifyPlaylistImageUrl ?? trackClips[0]?.albumArtUrl ?? null,
          userReviewProgress: reviewProgressBySession.get(session.id) ?? {
            reviewed: 0,
            remaining: session._count.trackClips,
            total: session._count.trackClips,
          },
        }),
      ),
    );
  } catch (err) {
    const response = teamAccessResponse(err);
    if (response) return response;
    throw err;
  }
}

export async function POST(request: Request) {
  const { session, error } = await requireAuth();
  if (error) return error;

  const userId = session!.user!.id;

  try {
    const body = await request.json();
    const parsed = createSessionSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid input" }, { status: 400 });
    }

    const teamId = parsed.data.teamId ?? (await getActiveTeamId(userId));

    if (!teamId) {
      return NextResponse.json(
        { error: "Create or join a team first, then select it as active." },
        { status: 400 },
      );
    }

    await requireTeamMember(teamId, userId);

    const spotifyConnection = await prisma.spotifyConnection.findUnique({
      where: { teamId },
    });

    if (!spotifyConnection) {
      return NextResponse.json(
        { error: "This team has no Spotify account linked" },
        { status: 400 },
      );
    }

    const playlistId = extractPlaylistId(parsed.data.playlistInput);
    if (!playlistId) {
      return NextResponse.json(
        { error: "Invalid playlist URL or ID" },
        { status: 400 },
      );
    }

    const [playlistInfo, tracks] = await Promise.all([
      getPlaylistInfo(teamId, playlistId),
      getPlaylistTracks(teamId, playlistId),
    ]);

    const playableTracks = tracks.filter((item) =>
      isPlayableAudioTrack(item.track),
    );
    if (playableTracks.length === 0) {
      return NextResponse.json(
        {
          error:
            "No playable audio tracks found in this playlist. Music videos, podcasts, and unavailable tracks are skipped.",
        },
        { status: 400 },
      );
    }

    const bingoSession = await prisma.bingoSession.create({
      data: {
        userId,
        teamId,
        name: parsed.data.name,
        spotifyPlaylistId: playlistId,
        spotifyPlaylistName: playlistInfo.name,
        spotifyPlaylistImageUrl: playlistInfo.imageUrl,
        defaultClipDurationMs: parsed.data.defaultClipDurationMs,
        trackClips: {
          create: playableTracks.map((item, index) => ({
            spotifyTrackId: item.track.id,
            trackName: item.track.name,
            artistName: item.track.artists.map((a) => a.name).join(", "),
            albumArtUrl: item.track.album.images[0]?.url ?? null,
            durationMs: item.track.duration_ms,
            position: index,
            startMs: 0,
            endMs: Math.min(
              parsed.data.defaultClipDurationMs,
              item.track.duration_ms,
            ),
          })),
        },
      },
      include: {
        _count: { select: { trackClips: true } },
      },
    });

    return NextResponse.json(bingoSession, { status: 201 });
  } catch (err) {
    if (err instanceof SpotifyApiError) {
      return spotifyErrorResponse(err);
    }
    const response = teamAccessResponse(err);
    if (response) return response;
    return internalError("Failed to create session");
  }
}
