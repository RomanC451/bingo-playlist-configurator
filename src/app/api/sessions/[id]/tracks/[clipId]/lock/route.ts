import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/api-auth";
import { prisma } from "@/lib/db";
import {
  acquireTrackEditLock,
  refreshTrackEditLock,
  releaseTrackEditLock,
  TrackEditLockedError,
} from "@/lib/track-edit-lock-db";
import { requireSessionAccess, teamAccessResponse } from "@/lib/team-auth";

type RouteContext = { params: Promise<{ id: string; clipId: string }> };

function lockedResponse(error: TrackEditLockedError) {
  return NextResponse.json(
    {
      error: error.message,
      editingBy: error.editingBy,
    },
    { status: 409 },
  );
}

async function ensureTrackInSession(sessionId: string, clipId: string) {
  return prisma.trackClip.findFirst({
    where: { id: clipId, sessionId },
    select: { id: true },
  });
}

export async function POST(_request: Request, context: RouteContext) {
  const { session, error } = await requireAuth();
  if (error) return error;

  const { id: sessionId, clipId } = await context.params;
  const userId = session!.user!.id;

  try {
    await requireSessionAccess(sessionId, userId);

    const clip = await ensureTrackInSession(sessionId, clipId);
    if (!clip) {
      return NextResponse.json({ error: "Track not found" }, { status: 404 });
    }

    const existing = await prisma.trackClipEditLock.findUnique({
      where: { trackClipId: clipId },
      select: { userId: true, expiresAt: true },
    });

    const now = new Date();
    const result =
      existing && existing.userId === userId && existing.expiresAt > now
        ? await refreshTrackEditLock(clipId, userId)
        : await acquireTrackEditLock(clipId, userId);

    const user = session!.user!;
    return NextResponse.json({
      editingBy: {
        userId,
        name: user.name ?? user.email!.split("@")[0],
        image: user.image ?? null,
      },
      expiresAt: result.expiresAt.toISOString(),
    });
  } catch (err) {
    if (err instanceof TrackEditLockedError) {
      return lockedResponse(err);
    }
    const response = teamAccessResponse(err);
    if (response) return response;
    throw err;
  }
}

export async function DELETE(_request: Request, context: RouteContext) {
  const { session, error } = await requireAuth();
  if (error) return error;

  const { id: sessionId, clipId } = await context.params;
  const userId = session!.user!.id;

  try {
    await requireSessionAccess(sessionId, userId);

    const clip = await ensureTrackInSession(sessionId, clipId);
    if (!clip) {
      return NextResponse.json({ error: "Track not found" }, { status: 404 });
    }

    await releaseTrackEditLock(clipId, userId);
    return NextResponse.json({ success: true });
  } catch (err) {
    const response = teamAccessResponse(err);
    if (response) return response;
    throw err;
  }
}
