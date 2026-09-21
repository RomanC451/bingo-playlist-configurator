import { formatPlaylistTrackLabel, matchCellToPlaylistLabel, playlistTrackLabels } from "./match";
import { isFreeCell } from "./normalize";
import type {
  BingoCard,
  CheatSheetEvent,
  CheatSheetResult,
  CheatSheetSongEvent,
  PlaylistTrack,
  UnmatchedCell,
  WinRules,
} from "./types";

type PatternState = {
  lineCount: number;
  diagonalCount: number;
  full: boolean;
};

function emptyMarked(size: number): boolean[][] {
  return Array.from({ length: size }, () => Array.from({ length: size }, () => false));
}

function patternState(marked: boolean[][]): PatternState {
  const size = marked.length;
  let lineCount = 0;
  let diagonalCount = 0;
  let full = true;

  for (let i = 0; i < size; i++) {
    if (marked[i]!.every(Boolean)) lineCount += 1;
    if (marked.every((row) => row[i])) lineCount += 1;
  }

  if (marked.every((row, i) => row[i])) diagonalCount += 1;
  if (marked.every((row, i) => row[size - 1 - i])) diagonalCount += 1;

  for (const row of marked) {
    if (!row.every(Boolean)) {
      full = false;
      break;
    }
  }

  return {
    lineCount,
    diagonalCount,
    full,
  };
}

function hasEnabledWinRule(rules: WinRules): boolean {
  return rules.lines > 0 || rules.diagonals > 0 || rules.fullCard;
}

function pushCountEvents(
  events: CheatSheetEvent[],
  cardNumber: number,
  previousCount: number,
  nextCount: number,
  maxCount: number,
  firstAchieved: Set<string>,
  keyPrefix: string,
  labelFor: (count: number) => string,
) {
  if (maxCount <= 0) return;
  const from = Math.min(previousCount, maxCount);
  const to = Math.min(nextCount, maxCount);
  for (let count = from + 1; count <= to; count++) {
    events.push({
      cardNumber,
      label: withFirst(firstAchieved, `${keyPrefix}:${count}`, labelFor(count)),
    });
  }
}

function lineLabel(count: number): string {
  return count === 1 ? "1-LINE" : `${count}-LINES`;
}

function diagonalLabel(count: number): string {
  return count === 1 ? "1-DIAGONAL" : `${count}-DIAGONALS`;
}

function withFirst(firstAchieved: Set<string>, key: string, label: string): string {
  if (firstAchieved.has(key)) return label;
  firstAchieved.add(key);
  return `FIRST ${label}`;
}

function humanizeWinCore(core: string): string {
  if (core === "FULL-CARD") return "full-card";
  const match = core.match(/^(\d+)-(LINE|LINES|DIAGONAL|DIAGONALS)$/);
  if (!match) return core.toLowerCase();
  const count = match[1]!;
  const kind = match[2]!;
  const word =
    kind === "LINE"
      ? "line"
      : kind === "LINES"
        ? "lines"
        : kind === "DIAGONAL"
          ? "diagonal"
          : "diagonals";
  return `${count} ${word}`;
}

export function displayWinLabel(label: string): { isFirst: boolean; text: string } {
  const isFirst = label.startsWith("FIRST ");
  const core = isFirst ? label.slice("FIRST ".length) : label;
  const readable = humanizeWinCore(core);
  return {
    isFirst,
    text: isFirst ? `first ${readable}` : readable,
  };
}

function eventsForTransition(
  cardNumber: number,
  previous: PatternState,
  next: PatternState,
  firstAchieved: Set<string>,
  rules: WinRules,
): CheatSheetEvent[] {
  const events: CheatSheetEvent[] = [];

  pushCountEvents(
    events,
    cardNumber,
    previous.lineCount,
    next.lineCount,
    rules.lines,
    firstAchieved,
    "line",
    lineLabel,
  );
  pushCountEvents(
    events,
    cardNumber,
    previous.diagonalCount,
    next.diagonalCount,
    rules.diagonals,
    firstAchieved,
    "diagonal",
    diagonalLabel,
  );

  if (rules.fullCard && next.full && !previous.full) {
    events.push({
      cardNumber,
      label: withFirst(firstAchieved, "full-card", "FULL-CARD"),
    });
  }

  return events;
}

export function buildCheatSheet(params: {
  cards: BingoCard[];
  tracks: PlaylistTrack[];
  rules: WinRules;
}): CheatSheetResult {
  const { cards, tracks, rules } = params;
  if (!cards.length) {
    throw new Error("No bingo cards found in the PDF.");
  }
  if (!hasEnabledWinRule(rules)) {
    throw new Error("Select at least one win rule.");
  }

  const gridSize = cards[0]!.songsMatrix.length;
  const labels = playlistTrackLabels(tracks, true);
  const unmatched: UnmatchedCell[] = [];
  const matchedLabels = cards.map((card) =>
    card.songsMatrix.map((row, rowIndex) =>
      row.map((cell, colIndex) => {
        if (isFreeCell(cell)) return "__FREE__";
        const matched = matchCellToPlaylistLabel(cell, labels);
        if (!matched) {
          unmatched.push({
            cardNumber: card.cardNumber,
            row: rowIndex,
            col: colIndex,
            cell,
          });
          return null;
        }
        return matched;
      }),
    ),
  );

  const marked = cards.map((card) => {
    const size = card.songsMatrix.length;
    const grid = emptyMarked(size);
    for (let row = 0; row < size; row++) {
      for (let col = 0; col < size; col++) {
        if (isFreeCell(card.songsMatrix[row]![col]!)) grid[row]![col] = true;
      }
    }
    return grid;
  });

  const previous = marked.map((grid) => patternState(grid));
  const firstAchieved = new Set<string>();
  const timeline: CheatSheetSongEvent[] = [];

  tracks.forEach((track, index) => {
    const playedLabel = formatPlaylistTrackLabel(track, true);
    const songEvents: CheatSheetEvent[] = [];

    cards.forEach((card, cardIndex) => {
      const grid = marked[cardIndex]!;
      const matches = matchedLabels[cardIndex]!;
      for (let row = 0; row < grid.length; row++) {
        for (let col = 0; col < grid.length; col++) {
          if (matches[row]![col] === playedLabel) {
            grid[row]![col] = true;
          }
        }
      }

      const next = patternState(grid);
      songEvents.push(
        ...eventsForTransition(
          card.cardNumber,
          previous[cardIndex]!,
          next,
          firstAchieved,
          rules,
        ),
      );
      previous[cardIndex] = next;
    });

    if (songEvents.length) {
      songEvents.sort((a, b) => a.cardNumber - b.cardNumber);
      timeline.push({
        songNumber: index + 1,
        trackName: track.name,
        artistName: track.artist,
        events: songEvents,
      });
    }
  });

  return {
    cardCount: cards.length,
    gridSize,
    rules,
    cards,
    unmatched,
    songs: tracks.map((track, index) => ({
      position: index + 1,
      trackName: track.name,
      artistName: track.artist,
    })),
    timeline,
  };
}

export function formatCheatSheetText(result: CheatSheetResult, playlistName?: string): string {
  const enabled = [
    result.rules.lines > 0 ? `lines to ${result.rules.lines}` : null,
    result.rules.diagonals > 0 ? `diagonals to ${result.rules.diagonals}` : null,
    result.rules.fullCard ? "full-card" : null,
  ].filter(Boolean);

  const lines: string[] = [
    "BINGO MASTER CHEAT SHEET",
    playlistName ? `Playlist: ${playlistName}` : "",
    `Cards: ${result.cardCount} · Grid: ${result.gridSize}x${result.gridSize} · Rules: ${enabled.join(", ")}`,
    "",
    "Timeline of Wins",
  ].filter((line) => line !== "");

  if (!result.timeline.length) {
    lines.push("No wins with the selected rules and playlist order.");
  }

  for (const song of result.timeline) {
    const title = song.artistName
      ? `${song.trackName} - ${song.artistName}`
      : song.trackName;
    lines.push(`Song #${song.songNumber}: "${title}"`);
    for (const event of song.events) {
      lines.push(`-> Card ${event.cardNumber} wins ${displayWinLabel(event.label).text}`);
    }
  }

  lines.push("", "SONG LIST (Playlist Order)");
  for (const song of result.songs) {
    const title = song.artistName
      ? `${song.trackName} - ${song.artistName}`
      : song.trackName;
    lines.push(`${song.position}. ${title}`);
  }

  if (result.unmatched.length) {
    lines.push("", "UNMATCHED CARD CELLS");
    lines.push("These squares did not match a playlist track and cannot complete on their own:");
    for (const cell of result.unmatched) {
      lines.push(
        `- Card ${cell.cardNumber} r${cell.row + 1}c${cell.col + 1}: ${cell.cell || "(empty)"}`,
      );
    }
  }

  return `${lines.join("\n")}\n`;
}
