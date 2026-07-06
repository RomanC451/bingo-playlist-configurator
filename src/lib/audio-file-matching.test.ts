import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  detectAssignmentConflicts,
  fuzzyMatchAudioFiles,
  getFileId,
  normalizeAudioLabel,
  scoreFileTrackMatch,
} from "./audio-file-matching.ts";

function mockFile(name: string) {
  return new File(["x"], name, { type: "audio/mpeg", lastModified: 1 });
}

const tracks = [
  { id: "t1", trackName: "Bohemian Rhapsody", artistName: "Queen" },
  { id: "t2", trackName: "Under Pressure", artistName: "Queen" },
];

describe("normalizeAudioLabel", () => {
  it("strips extension and punctuation", () => {
    assert.equal(
      normalizeAudioLabel("Queen - Bohemian Rhapsody (Remaster).mp3"),
      "queen bohemian rhapsody remaster",
    );
  });
});

describe("scoreFileTrackMatch", () => {
  it("scores artist-title filenames highly", () => {
    const score = scoreFileTrackMatch(
      mockFile("Queen - Bohemian Rhapsody.mp3"),
      tracks[0],
    );
    assert.ok(score >= 0.55);
  });
});

describe("fuzzyMatchAudioFiles", () => {
  it("assigns obvious matches", () => {
    const files = [mockFile("Queen - Bohemian Rhapsody.mp3")];
    const result = fuzzyMatchAudioFiles(files, tracks);
    assert.equal(result.assignments.t1, getFileId(files[0]));
    assert.equal(result.unmatchedClipIds.length, 1);
  });

  it("flags duplicate track candidates", () => {
    const files = [
      mockFile("Queen - Bohemian Rhapsody.mp3"),
      mockFile("Queen - Bohemian Rhapsody (Live).mp3"),
    ];
    const result = fuzzyMatchAudioFiles(files, tracks);
    assert.ok(
      result.conflicts.some((conflict) => conflict.type === "duplicate_track"),
    );
  });
});

describe("detectAssignmentConflicts", () => {
  it("detects one file on two tracks", () => {
    const fileId = getFileId(mockFile("a.mp3"));
    const conflicts = detectAssignmentConflicts({
      t1: fileId,
      t2: fileId,
    });
    assert.equal(conflicts.length, 1);
  });
});
