import { closestCenterIndex, inferGridSize, inferGridSizeFromLayout, kmeans1d } from "./grid";
import { normalizeCellText } from "./normalize";
import {
  CHEAT_SHEET_STOP_MARKER,
  SONG_LIST_MARKER,
  type BingoCard,
  type PdfPageContent,
  type PdfWord,
  type PlaylistTrack,
} from "./types";

const CARD_NUMBER_PATTERN = /card\s*#\s*(\d+)/i;

function isCardHeaderWord(text: string): boolean {
  const normalized = text.trim().toLowerCase();
  return (
    normalized === "card" ||
    /^card\s*#?\s*\d+$/i.test(normalized) ||
    /^bingo muzical/i.test(normalized)
  );
}

function gridWords(words: PdfWord[]): PdfWord[] {
  const headerTops = words
    .filter((word) => isCardHeaderWord(word.text))
    .map((word) => word.top);
  const cutoffTop = headerTops.length ? Math.min(...headerTops) + 25 : 0;
  return words.filter(
    (word) => word.top > cutoffTop && word.text.trim() && !isCardHeaderWord(word.text),
  );
}

export function extractCardFromPage(
  page: PdfPageContent,
  forcedGridSize?: number | null,
): BingoCard | null {
  const cardMatch = page.text.match(CARD_NUMBER_PATTERN);
  if (!cardMatch) return null;

  const filteredWords = gridWords(page.words);
  if (!filteredWords.length) return null;

  const gridSize =
    forcedGridSize || inferGridSizeFromLayout(page.text) || inferGridSize(filteredWords);
  const columnCenters = kmeans1d(
    filteredWords.map((word) => word.x0),
    gridSize,
  );
  const rowCenters = kmeans1d(
    filteredWords.map((word) => word.top),
    gridSize,
  );
  if (columnCenters.length !== gridSize || rowCenters.length !== gridSize) return null;

  const cells = new Map<string, PdfWord[]>();
  for (const word of filteredWords) {
    const col = closestCenterIndex(word.x0, columnCenters);
    const row = closestCenterIndex(word.top, rowCenters);
    const key = `${row}:${col}`;
    const bucket = cells.get(key) ?? [];
    bucket.push(word);
    cells.set(key, bucket);
  }

  const songsMatrix: string[][] = [];
  let emptyCount = 0;
  for (let row = 0; row < gridSize; row++) {
    const matrixRow: string[] = [];
    for (let col = 0; col < gridSize; col++) {
      const bucket = [...(cells.get(`${row}:${col}`) ?? [])].sort(
        (a, b) => a.top - b.top || a.x0 - b.x0,
      );
      const cellText = normalizeCellText(bucket.map((word) => word.text).join(" "));
      if (!cellText) emptyCount += 1;
      matrixRow.push(cellText);
    }
    songsMatrix.push(matrixRow);
  }

  if (emptyCount > (gridSize * gridSize) / 2) return null;

  return {
    cardNumber: Number(cardMatch[1]),
    songsMatrix,
  };
}

export function extractBingoCardsFromPages(pages: PdfPageContent[]): BingoCard[] {
  const cards: BingoCard[] = [];
  let detectedGridSize: number | null = null;

  for (const page of pages) {
    if (page.text.includes(CHEAT_SHEET_STOP_MARKER)) break;

    if (detectedGridSize === null && CARD_NUMBER_PATTERN.test(page.text)) {
      const filteredWords = gridWords(page.words);
      detectedGridSize = inferGridSizeFromLayout(page.text) || inferGridSize(filteredWords);
    }

    const card = extractCardFromPage(page, detectedGridSize);
    if (card) cards.push(card);
  }

  return cards;
}

export function parseTrackLabel(label: string): PlaylistTrack {
  const cleaned = normalizeCellText(label);
  const separator = " - ";
  const index = cleaned.lastIndexOf(separator);
  if (index <= 0) return { name: cleaned, artist: "" };
  return {
    name: cleaned.slice(0, index).trim(),
    artist: cleaned.slice(index + separator.length).trim(),
  };
}

function wordsToLines(words: PdfWord[], yTolerance = 3): string[] {
  const sorted = [...words]
    .filter((word) => word.text.trim())
    .sort((a, b) => a.top - b.top || a.x0 - b.x0);
  const lines: { top: number; parts: PdfWord[] }[] = [];
  for (const word of sorted) {
    const last = lines.at(-1);
    if (last && Math.abs(word.top - last.top) <= yTolerance) {
      last.parts.push(word);
    } else {
      lines.push({ top: word.top, parts: [word] });
    }
  }
  return lines.map((line) =>
    normalizeCellText(line.parts.sort((a, b) => a.x0 - b.x0).map((word) => word.text).join(" ")),
  );
}

export function extractSongListFromPages(pages: PdfPageContent[]): {
  playlistName: string;
  tracks: PlaylistTrack[];
} {
  let collecting = false;
  let playlistName = "";
  const tracks: PlaylistTrack[] = [];

  for (const page of pages) {
    if (page.text.includes(SONG_LIST_MARKER)) collecting = true;
    if (!collecting) continue;

    for (const line of wordsToLines(page.words)) {
      if (!line) continue;
      if (line.includes(SONG_LIST_MARKER)) continue;
      if (line.includes(CHEAT_SHEET_STOP_MARKER)) continue;
      if (/^timeline of wins$/i.test(line)) continue;
      if (/^song #\d+/i.test(line)) continue;
      if (/^->\s*card\s+\d+/i.test(line)) continue;

      const numbered = line.match(/^(\d+)\.\s*(.*)$/);
      if (numbered) {
        const rest = numbered[2]!.trim();
        if (rest) tracks.push(parseTrackLabel(rest));
        continue;
      }

      if (!playlistName && tracks.length === 0) {
        playlistName = line;
      }
    }
  }

  return { playlistName, tracks };
}
