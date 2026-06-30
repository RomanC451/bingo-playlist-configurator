import { NextResponse } from "next/server";
import { z } from "zod";
import { internalError, spotifyErrorResponse } from "@/lib/api-errors";
import { requireAuth } from "@/lib/api-auth";
import { attachPlaybackRanges } from "@/lib/track-summaries";
import { resolvePlaybackRange } from "@/lib/clip-selection";
import { prisma } from "@/lib/db";
import {
  asSpotifyApiError,
  getDevices,
  getPlaybackState,
  pauseActivePlayback,
  startClipPlayback,
} from "@/lib/spotify";
import { requireSessionAccess, teamAccessResponse } from "@/lib/team-auth";

function playbackErrorResponse(err: unknown) {
  const spotifyErr = asSpotifyApiError(err);
  if (spotifyErr) {
    return spotifyErrorResponse(spotifyErr);
  }

  const message = err instanceof Error ? err.message : "Playback failed";
  return internalError(message);
}

const playSchema = z.object({
  clipId: z.string(),
  deviceId: z.string().optional(),
  action: z.enum(["play", "pause", "preview"]).default("play"),
  positionMs: z.number().int().min(0).optional(),
  clipStartMs: z.number().int().min(0).optional(),
  clipEndMs: z.number().int().min(1).optional(),
});

type RouteContext = { params: Promise<{ sessionId: string }> };

async function loadSessionWithPlaybackClips(sessionId: string) {
  const bingoSession = await prisma.bingoSession.findUnique({
    where: { id: sessionId },
    include: {
      trackClips: {
        orderBy: { position: "asc" },
        include: {
          proposals: {
            include: { user: { select: { name: true, email: true } } },
          },
          votes: true,
        },
      },
    },
  });

  if (!bingoSession) return null;

  const enrichedClips = attachPlaybackRanges(bingoSession.trackClips);

  return {
    ...bingoSession,
    trackClips: enrichedClips.map((clip) => ({
      id: clip.id,
      spotifyTrackId: clip.spotifyTrackId,
      trackName: clip.trackName,
      artistName: clip.artistName,
      albumArtUrl: clip.albumArtUrl,
      durationMs: clip.durationMs,
      position: clip.position,
      startMs: clip.playbackStartMs,
      endMs: clip.playbackEndMs,
      defaultStartMs: clip.startMs,
      defaultEndMs: clip.endMs,
      playbackRange: clip.playbackRange,
    })),
  };
}

export async function GET(request: Request, context: RouteContext) {
  const { session, error } = await requireAuth();
  if (error) return error;

  const { sessionId } = await context.params;
  const { searchParams } = new URL(request.url);
  const playerOnly = searchParams.get("scope") === "player";

  try {
    await requireSessionAccess(sessionId, session!.user!.id);

    if (playerOnly) {
      const playback = await getPlaybackState(session!.user!.id);
      return NextResponse.json({ playback });
    }

    const bingoSession = await loadSessionWithPlaybackClips(sessionId);
    if (!bingoSession) {
      return NextResponse.json({ error: "Session not found" }, { status: 404 });
    }

    const [playback, devices] = await Promise.all([
      getPlaybackState(session!.user!.id),
      getDevices(session!.user!.id),
    ]);

    return NextResponse.json({
      session: bingoSession,
      playback,
      devices: devices.devices,
      hasActiveDevice: devices.devices.some((d) => d.is_active),
    });
  } catch (err) {
    const response = teamAccessResponse(err);
    if (response) return response;
    return playbackErrorResponse(err);
  }
}

export async function POST(request: Request, context: RouteContext) {
  const { session, error } = await requireAuth();
  if (error) return error;

  const { sessionId } = await context.params;
  const userId = session!.user!.id;

  try {
    await requireSessionAccess(sessionId, userId);

    const rawSession = await prisma.bingoSession.findUnique({
      where: { id: sessionId },
      include: {
        trackClips: {
          orderBy: { position: "asc" },
          include: {
            proposals: {
              include: { user: { select: { name: true, email: true } } },
            },
            votes: true,
          },
        },
      },
    });

    if (!rawSession) {
      return NextResponse.json({ error: "Session not found" }, { status: 404 });
    }

    const body = await request.json();
    const parsed = playSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid input" }, { status: 400 });
    }

    const clipRow = rawSession.trackClips.find((c) => c.id === parsed.data.clipId);
    if (!clipRow) {
      return NextResponse.json({ error: "Clip not found" }, { status: 404 });
    }

    const playbackRange = resolvePlaybackRange(
      { startMs: clipRow.startMs, endMs: clipRow.endMs },
      clipRow.proposals,
      clipRow.votes,
    );

    const rangeStart = parsed.data.clipStartMs ?? playbackRange.startMs;
    const rangeEnd = parsed.data.clipEndMs ?? playbackRange.endMs;

    if (parsed.data.action === "pause") {
      await pauseActivePlayback(userId, parsed.data.deviceId);
      return NextResponse.json({ success: true });
    }

    const startMs = parsed.data.positionMs ?? rangeStart;
    const seekMs = Math.max(
      rangeStart,
      Math.min(startMs, Math.max(rangeStart, rangeEnd - 1)),
    );

    await startClipPlayback(
      userId,
      `spotify:track:${clipRow.spotifyTrackId}`,
      seekMs,
      parsed.data.deviceId,
      { skipPlayabilityCheck: seekMs > rangeStart },
    );

    let playback = null;
    try {
      playback = await getPlaybackState(userId);
    } catch {
      // Play succeeded; player state may lag behind.
    }

    return NextResponse.json({
      success: true,
      clip: {
        id: clipRow.id,
        spotifyTrackId: clipRow.spotifyTrackId,
        trackName: clipRow.trackName,
        artistName: clipRow.artistName,
        startMs: playbackRange.startMs,
        endMs: playbackRange.endMs,
        playbackRange,
      },
      playback,
    });
  } catch (err) {
    const response = teamAccessResponse(err);
    if (response) return response;
    return playbackErrorResponse(err);
  }
}
