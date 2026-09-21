export const SUPPORTED_GRID_SIZES = [3, 4, 5, 6] as const;
export const MAX_GENERATED_CARDS = 200;
export const CHEAT_SHEET_STOP_MARKER = "BINGO MASTER CHEAT SHEET";
export const SONG_LIST_MARKER = "SONG LIST (Playlist Order)";
export const MATCH_MIN_RATIO = 0.52;

/** Rows + columns on the largest supported grid (6×6). */
export const MAX_LINE_WINS = 12;
/** Main diagonal + anti-diagonal. */
export const MAX_DIAGONAL_WINS = 2;

export type WinRules = {
  /** 0 = off. N awards first to 1 line through first to N lines. */
  lines: number;
  /** 0 = off. N awards first to 1 diagonal through first to N diagonals. */
  diagonals: number;
  fullCard: boolean;
};

export type PdfWord = {
  text: string;
  x0: number;
  top: number;
};

export type PdfPageContent = {
  text: string;
  words: PdfWord[];
};

export type BingoCard = {
  cardNumber: number;
  songsMatrix: string[][];
};

export type PlaylistTrack = {
  name: string;
  artist: string;
};

export type CheatSheetEvent = {
  cardNumber: number;
  label: string;
};

export type CheatSheetSongEvent = {
  songNumber: number;
  trackName: string;
  artistName: string;
  events: CheatSheetEvent[];
};

export type UnmatchedCell = {
  cardNumber: number;
  row: number;
  col: number;
  cell: string;
};

export type CheatSheetResult = {
  cardCount: number;
  gridSize: number;
  rules: WinRules;
  cards: BingoCard[];
  unmatched: UnmatchedCell[];
  songs: Array<{ position: number; trackName: string; artistName: string }>;
  timeline: CheatSheetSongEvent[];
};
