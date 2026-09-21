import type { GiveawayComment, GiveawayEntry, GiveawayFilters } from "./types";

export function normalizeHandle(value: string): string {
  return value.replace(/^@/, "").trim().toLowerCase();
}

const MENTION_TAG = /(^|[^a-zA-Z0-9_])@[a-zA-Z0-9._]{1,30}\b/;

export function commentContainsTag(text: string): boolean {
  return MENTION_TAG.test(text);
}

export function eligibleEntries(
  comments: GiveawayComment[],
  filters: GiveawayFilters,
): GiveawayEntry[] {
  const filtered = comments.filter((comment) => {
    if (filters.requireTag && !commentContainsTag(comment.text)) return false;
    return normalizeHandle(comment.username).length > 0;
  });

  if (!filters.uniqueUsers) return filtered;

  const seen = new Set<string>();
  const unique: GiveawayEntry[] = [];
  for (const comment of filtered) {
    const key = normalizeHandle(comment.username);
    if (seen.has(key)) continue;
    seen.add(key);
    unique.push(comment);
  }
  return unique;
}

export type RandomInt = (maxExclusive: number) => number;

export function randomIntFromCrypto(maxExclusive: number): number {
  if (maxExclusive <= 0) {
    throw new Error("Cannot pick from an empty list");
  }
  const limit = Math.floor(0x100000000 / maxExclusive) * maxExclusive;
  const buffer = new Uint32Array(1);
  let value = 0;
  do {
    crypto.getRandomValues(buffer);
    value = buffer[0]!;
  } while (value >= limit);
  return value % maxExclusive;
}

export function pickWinner<T>(entries: T[], randomInt: RandomInt = randomIntFromCrypto): T {
  return pickOrderedWinners(entries, 1, randomInt)[0]!;
}

export function pickOrderedWinners<T>(
  entries: T[],
  count: number,
  randomInt: RandomInt = randomIntFromCrypto,
  distinctKey?: (entry: T) => string,
): T[] {
  if (!entries.length) {
    throw new Error("Cannot pick from an empty list");
  }
  const remaining = [...entries];
  const picked: T[] = [];
  const used = new Set<string>();
  const n = Math.min(Math.max(0, count), remaining.length);
  while (picked.length < n && remaining.length) {
    const index = randomInt(remaining.length);
    const entry = remaining.splice(index, 1)[0];
    if (!entry) break;
    if (distinctKey) {
      const key = distinctKey(entry);
      if (!key || used.has(key)) continue;
      used.add(key);
    }
    picked.push(entry);
  }
  return picked;
}
