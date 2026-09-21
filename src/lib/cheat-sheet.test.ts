import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { extractBingoCardsFromPages, extractCardFromPage, extractSongListFromPages, parseTrackLabel } from "./cheat-sheet/extract.ts";
import { closestCenterIndex, inferGridSize, kmeans1d, nearestCenterDistance } from "./cheat-sheet/grid.ts";
import { matchCellToPlaylistLabel } from "./cheat-sheet/match.ts";
import { isFreeCell, normalizeCellText } from "./cheat-sheet/normalize.ts";
import { keepPageIndexesWithoutDefaultCheatSheet } from "./cheat-sheet/strip-pdf.ts";
import {
  CHEAT_SHEET_STOP_MARKER,
  SONG_LIST_MARKER,
  MAX_DIAGONAL_WINS,
  type BingoCard,
  type PlaylistTrack,
} from "./cheat-sheet/types.ts";
import { buildCheatSheet, displayWinLabel, formatCheatSheetText } from "./cheat-sheet/wins.ts";

describe("cheat-sheet normalize", () => {
  it("collapses whitespace in cell text", () => {
    assert.equal(normalizeCellText("  Don't   Stop  "), "Don't Stop");
  });

  it("detects FREE squares", () => {
    assert.equal(isFreeCell("FREE"), true);
    assert.equal(isFreeCell(" free "), true);
    assert.equal(isFreeCell("Freed From Desire"), false);
  });
});

describe("cheat-sheet grid", () => {
  it("clusters 1d values", () => {
    const centers = kmeans1d([10, 11, 50, 51, 52], 2, 50);
    assert.equal(centers.length, 2);
    assert.ok(centers[0]! < centers[1]!);
  });

  it("returns empty centers for empty input", () => {
    assert.deepEqual(kmeans1d([], 3), []);
  });

  it("computes nearest center distance", () => {
    assert.equal(nearestCenterDistance(5, []), 0);
    assert.equal(nearestCenterDistance(5, [1, 10]), 4);
  });

  it("picks the closest center index", () => {
    assert.equal(closestCenterIndex(5.5, [1, 10]), 0);
    assert.equal(closestCenterIndex(9, [1, 10]), 1);
  });

  it("infers a 5x5 from clustered words", () => {
    const words = [];
    for (let row = 0; row < 5; row++) {
      for (let col = 0; col < 5; col++) {
        words.push({ text: `${row}-${col}`, x0: col * 100, top: row * 100 });
      }
    }
    assert.equal(inferGridSize(words), 5);
  });
});

describe("cheat-sheet extract", () => {
  it("builds a card matrix from positioned words", () => {
    const words = [];
    for (let row = 0; row < 3; row++) {
      for (let col = 0; col < 3; col++) {
        words.push({
          text: `R${row}C${col}`,
          x0: 50 + col * 80,
          top: 100 + row * 40,
        });
      }
    }
    const card = extractCardFromPage({ text: "Card # 7", words }, 3);
    assert.ok(card);
    assert.equal(card.cardNumber, 7);
    assert.equal(card.songsMatrix[0]![0], "R0C0");
    assert.equal(card.songsMatrix[2]![2], "R2C2");
  });

  it("ignores slogan and Card #N headers when building the grid", () => {
    const card = extractCardFromPage(
      {
        text: "BINGO MUZICAL\nCard #1\nSong A",
        words: [
          { text: "BINGO MUZICAL. Te distrezi.", x0: 140, top: 61 },
          { text: "Card #1", x0: 266, top: 81 },
          { text: "Song A", x0: 50, top: 143 },
        ],
      },
      1,
    );
    assert.ok(card);
    assert.equal(card.cardNumber, 1);
    assert.equal(card.songsMatrix[0]![0], "Song A");
  });

  it("stops before an existing cheat sheet page", () => {
    function pageForCard(cardNumber: number) {
      const words = [{ text: "Card", x0: 10, top: 10 }];
      for (let row = 0; row < 3; row++) {
        for (let col = 0; col < 3; col++) {
          words.push({
            text: `R${row}C${col}`,
            x0: 50 + col * 80,
            top: 100 + row * 40,
          });
        }
      }
      return { text: `Card # ${cardNumber}`, words };
    }

    const cards = extractBingoCardsFromPages([
      pageForCard(1),
      { text: CHEAT_SHEET_STOP_MARKER, words: [] },
      pageForCard(2),
    ]);
    assert.equal(cards.length, 1);
    assert.equal(cards[0]!.cardNumber, 1);
  });
});

describe("cheat-sheet song list", () => {
  it("parses title and artist from a song list label", () => {
    assert.deepEqual(parseTrackLabel("Freed From Desire - Gala, Molella, Phil Jay"), {
      name: "Freed From Desire",
      artist: "Gala, Molella, Phil Jay",
    });
    assert.deepEqual(parseTrackLabel("It Must Have Been Love - From the Film \"Pretty Woman\" - Roxette"), {
      name: "It Must Have Been Love - From the Film \"Pretty Woman\"",
      artist: "Roxette",
    });
  });

  it("reads numbered tracks from the SONG LIST page", () => {
    const parsed = extractSongListFromPages([
      { text: CHEAT_SHEET_STOP_MARKER, words: [{ text: CHEAT_SHEET_STOP_MARKER, x0: 10, top: 10 }] },
      {
        text: `${SONG_LIST_MARKER} Test mix 1. Hello - World 2. Second Song - Artist`,
        words: [
          { text: SONG_LIST_MARKER, x0: 100, top: 40 },
          { text: "Test mix", x0: 120, top: 70 },
          { text: "1.", x0: 60, top: 110 },
          { text: "Hello - World", x0: 80, top: 110 },
          { text: "2.", x0: 60, top: 140 },
          { text: "Second Song - Artist", x0: 80, top: 140 },
        ],
      },
    ]);
    assert.equal(parsed.playlistName, "Test mix");
    assert.deepEqual(parsed.tracks, [
      { name: "Hello", artist: "World" },
      { name: "Second Song", artist: "Artist" },
    ]);
  });

  it("skips default cheat-sheet pages including unmarked continuations", () => {
    assert.deepEqual(
      keepPageIndexesWithoutDefaultCheatSheet([
        { text: "Card #1", words: [] },
        { text: CHEAT_SHEET_STOP_MARKER, words: [] },
        { text: 'Song #24: "Dragostea din tei"', words: [] },
        { text: SONG_LIST_MARKER, words: [] },
      ]),
      [0, 3],
    );
  });

  it("reads the song list from a generated bingo-cards PDF", async () => {
    const { access, readFile } = await import("node:fs/promises");
    const sample = "D:/bingo-cards/tmp/spotify_import/spotify_5x5_20260909_120324.pdf";
    try {
      await access(sample);
    } catch {
      return;
    }
    const { extractBingoPdf } = await import("./cheat-sheet/pdf.ts");
    const extracted = await extractBingoPdf(new Uint8Array(await readFile(sample)));
    assert.equal(extracted.cards.length, 20);
    assert.equal(extracted.tracks.length, 34);
    assert.equal(extracted.tracks[0]!.name, "Freed From Desire");
    assert.equal(extracted.tracks[12]!.name, "Inima mea de 16 ani");
    assert.match(extracted.playlistName, /BINGO MUZICAL/i);
  });

  it("drops default cheat-sheet pages and keeps cards plus the song list", async () => {
    const { access, readFile } = await import("node:fs/promises");
    const sample = "D:/bingo-cards/tmp/spotify_import/spotify_5x5_20260909_120324.pdf";
    try {
      await access(sample);
    } catch {
      return;
    }
    const { extractBingoPdf } = await import("./cheat-sheet/pdf.ts");
    const { stripDefaultCheatSheetPages } = await import("./cheat-sheet/strip-pdf.ts");
    const original = new Uint8Array(await readFile(sample));
    const extracted = await extractBingoPdf(original);
    const stripped = await stripDefaultCheatSheetPages(original, extracted.pages);
    const strippedExtracted = await extractBingoPdf(stripped);

    assert.equal(extracted.pages.length, 23);
    assert.equal(strippedExtracted.pages.length, 21);
    assert.ok(extracted.pages.some((page) => page.text.includes(CHEAT_SHEET_STOP_MARKER)));
    assert.ok(strippedExtracted.pages.every((page) => !page.text.includes(CHEAT_SHEET_STOP_MARKER)));
    assert.ok(strippedExtracted.pages.some((page) => page.text.includes(SONG_LIST_MARKER)));
    assert.equal(strippedExtracted.cards.length, 20);
    assert.equal(strippedExtracted.tracks.length, 34);
  });
});

describe("cheat-sheet matching", () => {
  it("matches a title to a playlist label with artist", () => {
    const labels = ["Dancing Queen - ABBA"];
    assert.equal(matchCellToPlaylistLabel("Dancing Queen", labels), labels[0]);
  });

  it("returns null below the threshold", () => {
    assert.equal(matchCellToPlaylistLabel("xyz", ["Completely Different Song Title"]), null);
  });
});

function track(name: string, artist = "Artist"): PlaylistTrack {
  return { name, artist };
}

function card3(): BingoCard {
  return {
    cardNumber: 1,
    songsMatrix: [
      ["A", "B", "C"],
      ["D", "FREE", "E"],
      ["F", "G", "H"],
    ],
  };
}

describe("cheat-sheet wins", () => {
  it("reports first line, diagonal, and full-card from playlist order", () => {
    const result = buildCheatSheet({
      cards: [card3()],
      tracks: ["A", "B", "C", "E", "H", "D", "F", "G"].map((name) => track(name)),
      rules: { lines: 2, diagonals: 2, fullCard: true },
    });

    const labelsBySong = Object.fromEntries(
      result.timeline.map((song) => [song.songNumber, song.events.map((event) => event.label)]),
    );

    assert.deepEqual(labelsBySong[3], ["FIRST 1-LINE"]);
    assert.ok(labelsBySong[5]?.includes("FIRST 1-DIAGONAL"));
    assert.ok(labelsBySong[5]?.includes("FIRST 2-LINES"));
    assert.ok(result.timeline.some((song) => song.events.some((event) => event.label === "FIRST FULL-CARD")));
    assert.equal(result.unmatched.length, 0);
  });

  it("ignores disabled rules", () => {
    const result = buildCheatSheet({
      cards: [card3()],
      tracks: ["A", "B", "C", "E", "H", "D", "F", "G"].map((name) => track(name)),
      rules: { lines: 0, diagonals: 2, fullCard: false },
    });

    const labels = result.timeline.flatMap((song) => song.events.map((event) => event.label));
    assert.ok(labels.some((label) => label.includes("DIAGONAL")));
    assert.ok(!labels.some((label) => label.includes("LINE")));
    assert.ok(!labels.some((label) => label.includes("FULL-CARD")));
  });

  it("does not reuse a PDF cheat sheet — wins come from simulation", () => {
    const result = buildCheatSheet({
      cards: [card3()],
      tracks: [track("C"), track("B"), track("A")],
      rules: { lines: 1, diagonals: 0, fullCard: false },
    });
    assert.equal(result.timeline.length, 1);
    assert.equal(result.timeline[0]!.songNumber, 3);
    assert.equal(result.timeline[0]!.events[0]!.label, "FIRST 1-LINE");
  });

  it("formats a downloadable cheat sheet", () => {
    const result = buildCheatSheet({
      cards: [card3()],
      tracks: [track("A"), track("B"), track("C")],
      rules: { lines: 1, diagonals: 0, fullCard: false },
    });
    const text = formatCheatSheetText(result, "Test mix");
    assert.match(text, /BINGO MASTER CHEAT SHEET/);
    assert.match(text, /Timeline of Wins/);
    assert.match(text, /first 1 line/);
    assert.match(text, /SONG LIST/);
    assert.match(text, /lines to 1/);
  });

  it("exports an A4 cheat sheet PDF like the original", async () => {
    const result = buildCheatSheet({
      cards: [card3()],
      tracks: [track("A"), track("B"), track("C")],
      rules: { lines: 1, diagonals: 0, fullCard: false },
    });
    const { generateCheatSheetPdf } = await import("./cheat-sheet/export-pdf.ts");
    const bytes = await generateCheatSheetPdf(result, "Test mix");
    assert.equal(new TextDecoder().decode(bytes.slice(0, 5)), "%PDF-");

    const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
    const { pathToFileURL } = await import("node:url");
    const { join } = await import("node:path");
    pdfjs.GlobalWorkerOptions.workerSrc = pathToFileURL(
      join(process.cwd(), "node_modules/pdfjs-dist/legacy/build/pdf.worker.mjs"),
    ).href;
    const doc = await pdfjs.getDocument({ data: bytes, useSystemFonts: true }).promise;
    const pages: string[] = [];
    for (let i = 1; i <= doc.numPages; i++) {
      const page = await doc.getPage(i);
      const content = await page.getTextContent();
      pages.push(
        content.items.map((item) => ("str" in item && typeof item.str === "string" ? item.str : "")).join(""),
      );
    }
    const text = pages.join("\n");
    assert.ok(doc.numPages >= 2);
    assert.match(text, /BINGO MASTER CHEAT SHEET/);
    assert.match(text, /Timeline of Wins/);
    assert.match(text, /Song #3: "C - Artist"/);
    assert.match(text, /FIRST 1-LINE/);
    assert.match(text, /SONG LIST \(Playlist Order\)/);
    assert.match(text, /1\. A - Artist/);
  });

  it("renders first prizes in readable form", () => {
    assert.deepEqual(displayWinLabel("FIRST 1-LINE"), { isFirst: true, text: "first 1 line" });
    assert.deepEqual(displayWinLabel("FIRST 2-LINES"), { isFirst: true, text: "first 2 lines" });
    assert.deepEqual(displayWinLabel("2-LINES"), { isFirst: false, text: "2 lines" });
    assert.deepEqual(displayWinLabel("FIRST 1-DIAGONAL"), {
      isFirst: true,
      text: "first 1 diagonal",
    });
    assert.deepEqual(displayWinLabel("FIRST FULL-CARD"), { isFirst: true, text: "first full-card" });
  });

  it("does not count a diagonal as a line", () => {
    const result = buildCheatSheet({
      cards: [card3()],
      tracks: [track("A"), track("H")],
      rules: { lines: 2, diagonals: 0, fullCard: false },
    });
    assert.equal(result.timeline.length, 0);
  });

  it("awards a diagonal prize without a line prize", () => {
    const result = buildCheatSheet({
      cards: [card3()],
      tracks: [track("A"), track("H")],
      rules: { lines: 2, diagonals: 2, fullCard: false },
    });
    const labels = result.timeline.flatMap((song) => song.events.map((event) => event.label));
    assert.deepEqual(labels, ["FIRST 1-DIAGONAL"]);
  });

  it("awards first to 1 line and first to 2 lines when the cap is 2", () => {
    const result = buildCheatSheet({
      cards: [card3()],
      tracks: [track("A"), track("B"), track("E"), track("H"), track("C")],
      rules: { lines: 2, diagonals: 0, fullCard: false },
    });
    const last = result.timeline.at(-1);
    assert.equal(last?.songNumber, 5);
    assert.deepEqual(last?.events.map((event) => event.label), [
      "FIRST 1-LINE",
      "FIRST 2-LINES",
    ]);
  });

  it("stops at the selected line count", () => {
    const result = buildCheatSheet({
      cards: [card3()],
      tracks: [track("A"), track("B"), track("E"), track("H"), track("C")],
      rules: { lines: 1, diagonals: 0, fullCard: false },
    });
    const labels = result.timeline.flatMap((song) => song.events.map((event) => event.label));
    assert.deepEqual(labels, ["FIRST 1-LINE"]);
  });

  it("awards first to 1 and 2 diagonals when the cap is 2", () => {
    const result = buildCheatSheet({
      cards: [card3()],
      tracks: [track("A"), track("H"), track("C"), track("F")],
      rules: { lines: 0, diagonals: MAX_DIAGONAL_WINS, fullCard: false },
    });
    const labelsBySong = Object.fromEntries(
      result.timeline.map((song) => [song.songNumber, song.events.map((event) => event.label)]),
    );
    assert.deepEqual(labelsBySong[2], ["FIRST 1-DIAGONAL"]);
    assert.deepEqual(labelsBySong[4], ["FIRST 2-DIAGONALS"]);
  });
});

