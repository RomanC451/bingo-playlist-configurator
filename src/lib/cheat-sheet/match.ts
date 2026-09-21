import { comparisonText, normalizeCellText, titleComparisonKey } from "./normalize";
import { MATCH_MIN_RATIO, type PlaylistTrack } from "./types";

function lcsLength(a: string, b: string): number {
  const n = a.length;
  const m = b.length;
  if (!n || !m) return 0;

  let prev = new Array<number>(m + 1).fill(0);
  let curr = new Array<number>(m + 1).fill(0);

  for (let i = 1; i <= n; i++) {
    curr[0] = 0;
    for (let j = 1; j <= m; j++) {
      curr[j] = a[i - 1] === b[j - 1] ? prev[j - 1]! + 1 : Math.max(prev[j]!, curr[j - 1]!);
    }
    [prev, curr] = [curr, prev];
  }

  return prev[m]!;
}

export function sequenceMatcherRatio(a: string, b: string): number {
  if (!a && !b) return 1;
  if (!a || !b) return 0;
  return (2 * lcsLength(a, b)) / (a.length + b.length);
}

export function formatPlaylistTrackLabel(track: PlaylistTrack, includeArtist: boolean): string {
  const name = normalizeCellText(track.name || "");
  if (!name) return "";
  if (!includeArtist) return name;
  const artist = normalizeCellText(track.artist || "");
  return artist ? `${name} - ${artist}` : name;
}

export function playlistTrackLabels(tracks: PlaylistTrack[], includeArtist: boolean): string[] {
  const labels: string[] = [];
  const seen = new Set<string>();
  for (const track of tracks) {
    const label = formatPlaylistTrackLabel(track, includeArtist);
    if (!label) continue;
    const folded = label.toLowerCase();
    if (seen.has(folded)) continue;
    seen.add(folded);
    labels.push(label);
  }
  return labels;
}

export function matchScore(cell: string, label: string): number {
  const left = comparisonText(cell);
  const right = comparisonText(label);
  if (!left || !right) return 0;

  const scores = [sequenceMatcherRatio(left, right)];
  if (left.includes(right) || right.includes(left)) scores.push(0.92);

  const leftTitle = titleComparisonKey(cell);
  const rightTitle = titleComparisonKey(label);
  if (leftTitle && rightTitle) {
    scores.push(sequenceMatcherRatio(leftTitle, rightTitle));
    if (leftTitle.includes(rightTitle) || rightTitle.includes(leftTitle)) scores.push(0.9);
  }

  return Math.max(...scores);
}

export function matchCellToPlaylistLabel(cell: string, labels: string[]): string | null {
  if (!cell || !labels.length) return null;

  let bestLabel: string | null = null;
  let bestScore = 0;
  for (const label of labels) {
    const score = matchScore(cell, label);
    if (score > bestScore) {
      bestScore = score;
      bestLabel = label;
    }
  }

  if (!bestLabel || bestScore < MATCH_MIN_RATIO) return null;
  return bestLabel;
}
