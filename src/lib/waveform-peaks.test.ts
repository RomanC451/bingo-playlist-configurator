import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { peaksFromChannelData } from "@/lib/waveform-peaks";

describe("peaksFromChannelData", () => {
  it("returns normalized peaks for a simple signal", () => {
    const samples = new Float32Array([0, 0.5, -1, 0.25, 0, 0.75, -0.25]);
    const peaks = peaksFromChannelData(samples, 3);

    assert.equal(peaks.length, 3);
    assert.equal(peaks[1], 1);
    assert.equal(peaks[0], 0.5);
    assert.equal(peaks[2], 0.75);
  });

  it("returns an empty array when there are no samples", () => {
    assert.deepEqual(peaksFromChannelData(new Float32Array(), 10), []);
  });
});
