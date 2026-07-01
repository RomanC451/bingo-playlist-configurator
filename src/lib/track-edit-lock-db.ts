import { prisma } from "@/lib/db";
import type { TrackEditingBy } from "@/lib/track-edit-lock";

export const LOCK_TTL_MS = 90_000;

function formatUserName(user: { name: string | null; email: string }) {
  return user.name ?? user.email.split("@")[0];
}

function mapLockUser(user: {
  id: string;
  name: string | null;
  email: string;
  image: string | null;
}): TrackEditingBy {
  return {
    userId: user.id,
    name: formatUserName(user),
    image: user.image,
  };
}

function lockExpiresAt(from = Date.now()) {
  return new Date(from + LOCK_TTL_MS);
}

function isLockActive(expiresAt: Date, now = new Date()) {
  return expiresAt > now;
}

export class TrackEditLockedError extends Error {
  editingBy: TrackEditingBy;

  constructor(editingBy: TrackEditingBy) {
    super(`${editingBy.name} is editing this track`);
    this.name = "TrackEditLockedError";
    this.editingBy = editingBy;
  }
}

const lockUserSelect = {
  id: true,
  name: true,
  email: true,
  image: true,
} as const;

export async function acquireTrackEditLock(trackClipId: string, userId: string) {
  const now = new Date();
  const existing = await prisma.trackClipEditLock.findUnique({
    where: { trackClipId },
    include: { user: { select: lockUserSelect } },
  });

  if (existing && isLockActive(existing.expiresAt, now) && existing.userId !== userId) {
    throw new TrackEditLockedError(mapLockUser(existing.user));
  }

  const expiresAt = lockExpiresAt(now.getTime());
  await prisma.trackClipEditLock.upsert({
    where: { trackClipId },
    create: { trackClipId, userId, expiresAt },
    update: { userId, expiresAt },
  });

  return { expiresAt };
}

export async function refreshTrackEditLock(trackClipId: string, userId: string) {
  const now = new Date();
  const existing = await prisma.trackClipEditLock.findUnique({
    where: { trackClipId },
    include: { user: { select: lockUserSelect } },
  });

  if (!existing || !isLockActive(existing.expiresAt, now)) {
    return acquireTrackEditLock(trackClipId, userId);
  }

  if (existing.userId !== userId) {
    throw new TrackEditLockedError(mapLockUser(existing.user));
  }

  const expiresAt = lockExpiresAt(now.getTime());
  await prisma.trackClipEditLock.update({
    where: { trackClipId },
    data: { expiresAt },
  });

  return { expiresAt };
}

export async function releaseTrackEditLock(trackClipId: string, userId: string) {
  await prisma.trackClipEditLock.deleteMany({
    where: { trackClipId, userId },
  });
}

export async function loadActiveTrackEditLocksForSession(sessionId: string) {
  return loadActiveTrackEditLocksForSessions([sessionId]);
}

export async function loadActiveTrackEditLocksForSessions(sessionIds: string[]) {
  if (sessionIds.length === 0) {
    return new Map<string, TrackEditingBy>();
  }

  const now = new Date();
  const locks = await prisma.trackClipEditLock.findMany({
    where: {
      expiresAt: { gt: now },
      trackClip: { sessionId: { in: sessionIds } },
    },
    include: { user: { select: lockUserSelect } },
  });

  return new Map(
    locks.map((lock) => [lock.trackClipId, mapLockUser(lock.user)] as const),
  );
}

export async function getActiveTrackEditLock(trackClipId: string) {
  const now = new Date();
  const lock = await prisma.trackClipEditLock.findUnique({
    where: { trackClipId },
    include: { user: { select: lockUserSelect } },
  });

  if (!lock || !isLockActive(lock.expiresAt, now)) {
    return null;
  }

  return {
    editingBy: mapLockUser(lock.user),
    expiresAt: lock.expiresAt,
  };
}

export class TrackEditNotHeldError extends Error {
  constructor() {
    super("You must open the track editor to save changes");
    this.name = "TrackEditNotHeldError";
  }
}

export async function assertTrackEditableByUser(trackClipId: string, userId: string) {
  const lock = await getActiveTrackEditLock(trackClipId);
  if (!lock) {
    throw new TrackEditNotHeldError();
  }
  if (lock.editingBy.userId !== userId) {
    throw new TrackEditLockedError(lock.editingBy);
  }
}
