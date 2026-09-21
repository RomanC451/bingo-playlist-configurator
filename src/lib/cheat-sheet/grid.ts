import { SUPPORTED_GRID_SIZES, type PdfWord } from "./types";

export function kmeans1d(values: number[], k: number, iterations = 30): number[] {
  if (values.length === 0) return [];

  const sorted = [...values].sort((a, b) => a - b);
  const minimum = sorted[0]!;
  const maximum = sorted[sorted.length - 1]!;
  if (k === 1) return [(minimum + maximum) / 2];

  let centers = Array.from(
    { length: k },
    (_, i) => minimum + ((maximum - minimum) * i) / (k - 1),
  );

  for (let step = 0; step < iterations; step++) {
    const groups: number[][] = Array.from({ length: k }, () => []);
    for (const value of sorted) {
      let closest = 0;
      let closestDist = Infinity;
      for (let i = 0; i < k; i++) {
        const dist = Math.abs(value - centers[i]!);
        if (dist < closestDist) {
          closest = i;
          closestDist = dist;
        }
      }
      groups[closest]!.push(value);
    }

    const updated = groups.map((group, i) =>
      group.length ? group.reduce((sum, value) => sum + value, 0) / group.length : centers[i]!,
    );
    if (updated.every((value, i) => Math.abs(value - centers[i]!) < 1e-3)) {
      centers = updated;
      break;
    }
    centers = updated;
  }

  return [...centers].sort((a, b) => a - b);
}

export function nearestCenterDistance(value: number, centers: number[]): number {
  if (centers.length === 0) return 0;
  return Math.min(...centers.map((center) => Math.abs(value - center)));
}

export function closestCenterIndex(value: number, centers: number[]): number {
  let best = 0;
  let bestDist = Infinity;
  for (let i = 0; i < centers.length; i++) {
    const dist = Math.abs(value - centers[i]!);
    if (dist < bestDist) {
      best = i;
      bestDist = dist;
    }
  }
  return best;
}

export function inferGridSizeFromLayout(pageText: string): number | null {
  const lines = pageText.split(/\r?\n/);
  const cardLineIndex = lines.findIndex((line) => /card\s*#\s*\d+/i.test(line));
  if (cardLineIndex === -1) return null;

  const contentLines = lines.slice(cardLineIndex + 1);
  const blocks: string[][] = [];
  let current: string[] = [];
  let emptyStreak = 0;

  for (const line of contentLines) {
    if (line.trim()) {
      current.push(line);
      emptyStreak = 0;
      continue;
    }
    emptyStreak += 1;
    if (emptyStreak >= 2 && current.length) {
      blocks.push(current);
      current = [];
    }
  }
  if (current.length) blocks.push(current);

  return (SUPPORTED_GRID_SIZES as readonly number[]).includes(blocks.length)
    ? blocks.length
    : null;
}

export function inferGridSize(
  words: PdfWord[],
  candidates: readonly number[] = SUPPORTED_GRID_SIZES,
): number {
  const xValues = words.map((word) => word.x0);
  const yValues = words.map((word) => word.top);
  if (!xValues.length || !yValues.length) return 5;

  let bestSize = 5;
  let bestScore = Infinity;

  for (const size of candidates) {
    const xCenters = kmeans1d(xValues, size);
    const yCenters = kmeans1d(yValues, size);
    const cells = new Map<string, number>();
    for (const word of words) {
      const col = closestCenterIndex(word.x0, xCenters);
      const row = closestCenterIndex(word.top, yCenters);
      const key = `${row}:${col}`;
      cells.set(key, (cells.get(key) ?? 0) + 1);
    }

    const nonEmptyCells = [...cells.values()].filter((value) => value > 0).length;
    const emptyRatio = 1 - nonEmptyCells / (size * size);
    const xSpan = xValues.length > 1 ? Math.max(...xValues) - Math.min(...xValues) : 1;
    const ySpan = yValues.length > 1 ? Math.max(...yValues) - Math.min(...yValues) : 1;
    const xCompactness =
      xValues.reduce((sum, value) => sum + nearestCenterDistance(value, xCenters), 0) /
      (xValues.length * xSpan);
    const yCompactness =
      yValues.reduce((sum, value) => sum + nearestCenterDistance(value, yCenters), 0) /
      (yValues.length * ySpan);
    const score = xCompactness + yCompactness + emptyRatio * 1.2;
    if (score < bestScore) {
      bestScore = score;
      bestSize = size;
    }
  }

  return bestSize;
}
