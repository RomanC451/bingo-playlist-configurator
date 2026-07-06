import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  GUESS_CHOICE_DISTRACTOR_COUNT,
  buildGuessChoicesForClip,
  summarizeGuessMetrics,
} from "@/lib/clip-guess";
import { computeTimeToGuessMs } from "@/lib/clip-guess-shared";

function makeClips(count: number) {
  return Array.from({ length: count }, (_, index) => ({
    id: `clip-${index + 1}`,
    trackName: `Track ${index + 1}`,
    artistName: `Artist ${index + 1}`,
  }));
}

describe("buildGuessChoicesForClip", () => {
  it("includes the current clip and up to 23 distractors", () => {
    const clips = makeClips(30);
    const choices = buildGuessChoicesForClip(clips, "clip-5", "guest-1");

    assert.equal(choices.length, 1 + GUESS_CHOICE_DISTRACTOR_COUNT);
    assert.ok(choices.some((choice) => choice.id === "clip-5"));
    assert.equal(new Set(choices.map((choice) => choice.id)).size, choices.length);
  });

  it("returns every other clip when the playlist is smaller than 24 tracks", () => {
    const clips = makeClips(10);
    const choices = buildGuessChoicesForClip(clips, "clip-2", "guest-1");

    assert.equal(choices.length, 10);
    assert.ok(choices.some((choice) => choice.id === "clip-2"));
  });

  it("returns stable choices for the same guest and clip", () => {
    const clips = makeClips(30);
    const first = buildGuessChoicesForClip(clips, "clip-8", "guest-1");
    const second = buildGuessChoicesForClip(clips, "clip-8", "guest-1");

    assert.deepEqual(
      first.map((choice) => choice.id),
      second.map((choice) => choice.id),
    );
  });
});

describe("computeTimeToGuessMs", () => {
  it("uses the full clip duration when the clip was replayed", () => {
    assert.equal(computeTimeToGuessMs(1, 30_000, 12_000), 30_000);
  });

  it("uses elapsed time when the clip was not replayed", () => {
    assert.equal(computeTimeToGuessMs(0, 30_000, 12_000), 12_000);
  });

  it("caps elapsed time at the clip duration", () => {
    assert.equal(computeTimeToGuessMs(0, 30_000, 45_000), 30_000);
  });
});

describe("summarizeGuessMetrics", () => {
  it("returns null summaries for empty input", () => {
    assert.deepEqual(summarizeGuessMetrics([]), {
      min: null,
      max: null,
      average: null,
    });
  });

  it("computes min, max, and average", () => {
    assert.deepEqual(summarizeGuessMetrics([2, 0, 4]), {
      min: 0,
      max: 4,
      average: 2,
    });
  });
});
