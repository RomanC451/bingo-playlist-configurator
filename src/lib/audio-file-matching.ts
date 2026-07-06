export type MatchableTrack = {
  id: string;
  trackName: string;
  artistName: string;
};

export type MatchConflict = {
  type: "duplicate_track" | "ambiguous_file";
  fileId: string;
  clipId?: string;
  message: string;
};

export type FuzzyMatchResult = {
  /** clipId → fileId */
  assignments: Record<string, string>;
  unassignedFileIds: string[];
  unmatchedClipIds: string[];
  conflicts: MatchConflict[];
};

const MATCH_THRESHOLD = 0.55;
const AMBIGUITY_GAP = 0.08;

export function getFileId(file: Pick<File, "name" | "size" | "lastModified">) {
  return `${file.name}:${file.size}:${file.lastModified}`;
}

export function normalizeAudioLabel(value: string) {
  return value
    .toLowerCase()
    .replace(/\.mp3$/i, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

function tokenSet(value: string) {
  const normalized = normalizeAudioLabel(value);
  if (!normalized) return new Set<string>();
  return new Set(normalized.split(" ").filter(Boolean));
}

function jaccard(a: Set<string>, b: Set<string>) {
  if (a.size === 0 || b.size === 0) return 0;
  let intersection = 0;
  for (const token of a) {
    if (b.has(token)) intersection += 1;
  }
  const union = a.size + b.size - intersection;
  return union === 0 ? 0 : intersection / union;
}

function trackCandidates(track: MatchableTrack) {
  const title = normalizeAudioLabel(track.trackName);
  const artist = normalizeAudioLabel(track.artistName);
  const candidates = new Set<string>();
  if (title) candidates.add(title);
  if (artist && title) {
    candidates.add(`${artist} ${title}`);
    candidates.add(`${title} ${artist}`);
  }
  return [...candidates];
}

function filenameCandidates(filename: string) {
  const base = normalizeAudioLabel(filename);
  const candidates = new Set<string>();
  if (base) candidates.add(base);
  for (const part of filename.replace(/\.mp3$/i, "").split(/\s*[-–—|]\s*/)) {
    const normalized = normalizeAudioLabel(part);
    if (normalized) candidates.add(normalized);
  }
  return [...candidates];
}

export function scoreFileTrackMatch(
  file: Pick<File, "name">,
  track: MatchableTrack,
): number {
  const fileLabels = filenameCandidates(file.name);
  const trackLabels = trackCandidates(track);
  let best = 0;

  for (const fileLabel of fileLabels) {
    const fileTokens = tokenSet(fileLabel);
    for (const trackLabel of trackLabels) {
      const trackTokens = tokenSet(trackLabel);
      const score = jaccard(fileTokens, trackTokens);
      if (score > best) best = score;
      if (
        fileLabel.length >= 4 &&
        trackLabel.length >= 4 &&
        (fileLabel.includes(trackLabel) || trackLabel.includes(fileLabel))
      ) {
        best = Math.max(best, 0.85);
      }
    }
  }

  return best;
}

export function fuzzyMatchAudioFiles(
  files: File[],
  tracks: MatchableTrack[],
): FuzzyMatchResult {
  const fileIds = files.map(getFileId);
  const fileById = new Map(files.map((file) => [getFileId(file), file]));

  const pairs: Array<{ fileId: string; clipId: string; score: number }> = [];
  for (const file of files) {
    const fileId = getFileId(file);
    for (const track of tracks) {
      const score = scoreFileTrackMatch(file, track);
      if (score >= MATCH_THRESHOLD) {
        pairs.push({ fileId, clipId: track.id, score });
      }
    }
  }

  pairs.sort((a, b) => b.score - a.score);

  const assignments: Record<string, string> = {};
  const assignedFiles = new Set<string>();
  const assignedTracks = new Set<string>();
  const conflicts: MatchConflict[] = [];

  for (const pair of pairs) {
    if (assignedFiles.has(pair.fileId) || assignedTracks.has(pair.clipId)) {
      continue;
    }
    assignments[pair.clipId] = pair.fileId;
    assignedFiles.add(pair.fileId);
    assignedTracks.add(pair.clipId);
  }

  for (const file of files) {
    const fileId = getFileId(file);
    const matches = tracks
      .map((track) => ({
        clipId: track.id,
        score: scoreFileTrackMatch(file, track),
      }))
      .filter((entry) => entry.score >= MATCH_THRESHOLD)
      .sort((a, b) => b.score - a.score);

    if (matches.length >= 2 && matches[0].score - matches[1].score < AMBIGUITY_GAP) {
      conflicts.push({
        type: "ambiguous_file",
        fileId,
        message: `"${file.name}" matches multiple tracks — pick one manually.`,
      });
    }
  }

  const trackToFiles = new Map<string, string[]>();
  for (const file of files) {
    const fileId = getFileId(file);
    for (const track of tracks) {
      const score = scoreFileTrackMatch(file, track);
      if (score >= MATCH_THRESHOLD) {
        const list = trackToFiles.get(track.id) ?? [];
        list.push(fileId);
        trackToFiles.set(track.id, list);
      }
    }
  }

  for (const [clipId, matchingFileIds] of trackToFiles) {
    const unique = [...new Set(matchingFileIds)];
    if (unique.length > 1) {
      const fileNames = unique
        .map((id) => fileById.get(id)?.name ?? id)
        .join(", ");
      conflicts.push({
        type: "duplicate_track",
        fileId: unique[0],
        clipId,
        message: `Multiple files match this track (${fileNames}) — assign one manually.`,
      });
    }
  }

  const unassignedFileIds = fileIds.filter((id) => !assignedFiles.has(id));
  const unmatchedClipIds = tracks
    .map((track) => track.id)
    .filter((id) => !assignedTracks.has(id));

  return {
    assignments,
    unassignedFileIds,
    unmatchedClipIds,
    conflicts: dedupeConflicts(conflicts),
  };
}

function dedupeConflicts(conflicts: MatchConflict[]) {
  const seen = new Set<string>();
  return conflicts.filter((conflict) => {
    const key = `${conflict.type}:${conflict.fileId}:${conflict.clipId ?? ""}:${conflict.message}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export function detectAssignmentConflicts(
  assignments: Record<string, string | null | undefined>,
): MatchConflict[] {
  const fileToTrack = new Map<string, string>();
  const conflicts: MatchConflict[] = [];

  for (const [clipId, fileId] of Object.entries(assignments)) {
    if (!fileId) continue;
    const existing = fileToTrack.get(fileId);
    if (existing && existing !== clipId) {
      conflicts.push({
        type: "duplicate_track",
        fileId,
        clipId,
        message: "This file is assigned to more than one track.",
      });
    } else {
      fileToTrack.set(fileId, clipId);
    }
  }

  return dedupeConflicts(conflicts);
}

export function isMp3File(file: File) {
  const name = file.name.toLowerCase();
  return name.endsWith(".mp3") || file.type === "audio/mpeg" || file.type === "audio/mp3";
}
