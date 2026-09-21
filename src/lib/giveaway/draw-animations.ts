export const DRAW_ANIMATION_IDS = ["shuffle", "reel", "race", "spotlight"] as const;

export type DrawAnimationId = (typeof DRAW_ANIMATION_IDS)[number];

export const DRAW_ANIMATIONS: {
  id: DrawAnimationId;
  label: string;
  description: string;
  durationMs: number;
}[] = [
  {
    id: "shuffle",
    label: "Name shuffle",
    description: "Handles flash by and slow to a stop.",
    durationMs: 3200,
  },
  {
    id: "reel",
    label: "Slot reel",
    description: "A vertical reel of faces rolls onto the winner.",
    durationMs: 3800,
  },
  {
    id: "race",
    label: "Photo finish",
    description: "Faces sprint down the track. The winner hits the line first.",
    durationMs: 4200,
  },
  {
    id: "spotlight",
    label: "Spotlight",
    description: "A highlight jumps across the crowd, then locks on.",
    durationMs: 3600,
  },
];

export function isDrawAnimationId(value: unknown): value is DrawAnimationId {
  return DRAW_ANIMATION_IDS.includes(value as DrawAnimationId);
}

/** Maps stored ids, including the old prize wheel, onto a current animation. */
export function resolveDrawAnimationId(value: unknown): DrawAnimationId | null {
  if (value === "wheel") return "race";
  if (isDrawAnimationId(value)) return value;
  return null;
}

export function animationDuration(id: DrawAnimationId, reducedMotion: boolean): number {
  if (reducedMotion) return 180;
  return DRAW_ANIMATIONS.find((item) => item.id === id)?.durationMs ?? 3200;
}

export function easeOutCubic(t: number): number {
  const x = Math.min(1, Math.max(0, t));
  return 1 - (1 - x) ** 3;
}

export function shuffleCopy<T>(items: T[], random = Math.random): T[] {
  const next = [...items];
  for (let i = next.length - 1; i > 0; i -= 1) {
    const j = Math.floor(random() * (i + 1));
    const a = next[i]!;
    next[i] = next[j]!;
    next[j] = a;
  }
  return next;
}

/** Vertical strip with the winner in the middle window, plus names after so it does not look like the last slot won. */
export const REEL_AFTER_COUNT = 4;
export const REEL_CENTER_SLOT = 1;

export function buildReelStrip<T extends { id: string }>(
  pool: T[],
  winner: T,
  length = 28,
  random = Math.random,
): T[] {
  if (!pool.length) return [winner];
  const fillers = pool.filter((entry) => entry.id !== winner.id);
  const source = fillers.length ? fillers : pool;
  const shuffled = shuffleCopy(source, random);
  const before = Math.max(8, length);
  const strip: T[] = [];
  for (let i = 0; i < before; i += 1) {
    strip.push(shuffled[i % shuffled.length]!);
  }
  strip.push(winner);
  for (let i = 0; i < REEL_AFTER_COUNT; i += 1) {
    strip.push(shuffled[(before + i) % shuffled.length]!);
  }
  return strip;
}

export function reelLandingIndex(stripLength: number, afterCount = REEL_AFTER_COUNT): number {
  return Math.max(0, stripLength - afterCount - 1);
}

export function reelOffsetPx(
  winnerIndex: number,
  itemHeight: number,
  centerSlot = REEL_CENTER_SLOT,
): number {
  return Math.max(0, (winnerIndex - centerSlot) * itemHeight);
}

/**
 * Lanes for the race: keep every entry when the pool is small, otherwise
 * the winner plus a random sample so faces stay readable.
 */
export function buildRaceCast<T extends { id: string }>(
  pool: T[],
  winner: T,
  maxLanes = 6,
  random = Math.random,
): T[] {
  if (pool.length <= maxLanes) return pool;
  const others = shuffleCopy(
    pool.filter((entry) => entry.id !== winner.id),
    random,
  ).slice(0, maxLanes - 1);
  const insertAt = Math.floor(random() * (others.length + 1));
  return [...others.slice(0, insertAt), winner, ...others.slice(insertAt)];
}

/** How far along the track a lane is (0–1). The winner always finishes first. */
export function raceLaneProgress(
  progress: number,
  laneIndex: number,
  winnerIndex: number,
): number {
  const t = Math.min(1, Math.max(0, progress));
  const eased = easeOutCubic(t);
  const isWinner = laneIndex === winnerIndex;
  const finish = isWinner ? 1 : 0.62 + ((laneIndex * 13 + 7) % 24) / 100;
  const wobble = (1 - eased) * 0.1 * Math.sin(t * Math.PI * (6 + (laneIndex % 5)) + laneIndex);
  return Math.min(1, Math.max(0, eased * finish + wobble));
}

export function buildSpotlightCast<T extends { id: string }>(
  pool: T[],
  winner: T,
  maxFaces = 24,
  random = Math.random,
): T[] {
  if (pool.length <= maxFaces) return pool;
  const others = shuffleCopy(
    pool.filter((entry) => entry.id !== winner.id),
    random,
  ).slice(0, maxFaces - 1);
  return shuffleCopy([...others, winner], random);
}

export function buildSpotlightSequence(
  castLength: number,
  winnerIndex: number,
  steps = 36,
  random = Math.random,
): number[] {
  if (castLength <= 0) return [0];
  const safeWinner = Math.min(Math.max(0, winnerIndex), castLength - 1);
  const sequence: number[] = [];
  for (let i = 0; i < Math.max(2, steps) - 1; i += 1) {
    sequence.push(Math.floor(random() * castLength));
  }
  sequence.push(safeWinner);
  return sequence;
}

export function sequenceAtProgress(progress: number, sequence: number[]): number {
  if (!sequence.length) return 0;
  const eased = easeOutCubic(progress);
  const index = Math.min(sequence.length - 1, Math.floor(eased * sequence.length));
  return sequence[index]!;
}
