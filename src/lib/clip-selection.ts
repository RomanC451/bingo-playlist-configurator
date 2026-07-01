export interface DefaultClipLike {
  startMs: number;
  endMs: number;
}

export interface SavedClipVersionLike {
  id: string;
  startMs: number;
  endMs: number;
  createdAt: Date;
  createdBy?: { name: string | null; email?: string };
}

export interface PlaybackRange {
  startMs: number;
  endMs: number;
  versionId?: string;
  editorName?: string;
  source: "saved" | "default";
}

export function resolvePlaybackRange(
  defaultClip: DefaultClipLike,
  currentVersion: SavedClipVersionLike | null | undefined,
): PlaybackRange {
  if (!currentVersion) {
    return {
      startMs: defaultClip.startMs,
      endMs: defaultClip.endMs,
      source: "default",
    };
  }

  const editorName =
    currentVersion.createdBy?.name ??
    currentVersion.createdBy?.email?.split("@")[0] ??
    "Team member";

  return {
    startMs: currentVersion.startMs,
    endMs: currentVersion.endMs,
    versionId: currentVersion.id,
    editorName,
    source: "saved",
  };
}

export function hasCustomClip(playbackRange: Pick<PlaybackRange, "source">): boolean {
  return playbackRange.source === "saved";
}

export function getLatestVersion<T extends { createdAt: Date }>(versions: T[]): T | null {
  if (versions.length === 0) return null;
  return [...versions].sort(
    (a, b) => b.createdAt.getTime() - a.createdAt.getTime(),
  )[0]!;
}
