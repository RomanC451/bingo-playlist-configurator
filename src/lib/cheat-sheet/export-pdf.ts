import { PDFDocument, StandardFonts, type PDFFont, type PDFPage } from "pdf-lib";
import type { CheatSheetResult } from "./types";

const PAGE_WIDTH = 595.28;
const PAGE_HEIGHT = 841.89;
const MARGIN_LEFT = 45.4;
const MARGIN_RIGHT = 45.4;
const MARGIN_TOP = 61.5;
const MARGIN_BOTTOM = 50;
const TITLE_SIZE = 16;
const SUBTITLE_SIZE = 12;
const SECTION_SIZE = 12;
const SONG_SIZE = 10;
const WIN_SIZE = 9;
const LIST_SIZE = 10;
const CONTENT_WIDTH = PAGE_WIDTH - MARGIN_LEFT - MARGIN_RIGHT;
const WIN_INDENT = 73.7;
const LIST_NUMBER_X = 59.7;
const LIST_TEXT_X = 76.5;

function toWinAnsi(text: string): string {
  const romanian: Record<string, string> = {
    ă: "a",
    â: "a",
    î: "i",
    ș: "s",
    ş: "s",
    ț: "t",
    ţ: "t",
    Ă: "A",
    Â: "A",
    Î: "I",
    Ș: "S",
    Ş: "S",
    Ț: "T",
    Ţ: "T",
  };
  let cleaned = "";
  for (const char of text) {
    cleaned += romanian[char] ?? char;
  }
  return cleaned
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\u0000-\u00ff]/g, "?");
}

function wrapText(text: string, font: PDFFont, size: number, maxWidth: number): string[] {
  const safe = toWinAnsi(text);
  if (!safe) return [""];
  if (font.widthOfTextAtSize(safe, size) <= maxWidth) return [safe];

  const words = safe.split(/\s+/);
  const lines: string[] = [];
  let current = "";
  for (const word of words) {
    const next = current ? `${current} ${word}` : word;
    if (font.widthOfTextAtSize(next, size) <= maxWidth) {
      current = next;
      continue;
    }
    if (current) lines.push(current);
    if (font.widthOfTextAtSize(word, size) <= maxWidth) {
      current = word;
      continue;
    }
    let chunk = "";
    for (const char of word) {
      const trial = chunk + char;
      if (font.widthOfTextAtSize(trial, size) <= maxWidth) {
        chunk = trial;
      } else {
        if (chunk) lines.push(chunk);
        chunk = char;
      }
    }
    current = chunk;
  }
  if (current) lines.push(current);
  return lines.length ? lines : [""];
}

function trackTitle(name: string, artist: string): string {
  return artist ? `${name} - ${artist}` : name;
}

function drawCentered(
  page: PDFPage,
  text: string,
  y: number,
  font: PDFFont,
  size: number,
) {
  const safe = toWinAnsi(text);
  const width = font.widthOfTextAtSize(safe, size);
  page.drawText(safe, {
    x: Math.max(MARGIN_LEFT, (PAGE_WIDTH - width) / 2),
    y,
    size,
    font,
  });
}

export async function generateCheatSheetPdf(
  result: CheatSheetResult,
  playlistName?: string,
): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const regular = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);

  let page = doc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
  let y = PAGE_HEIGHT - MARGIN_TOP;

  const ensureSpace = (needed: number) => {
    if (y - needed >= MARGIN_BOTTOM) return;
    page = doc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
    y = PAGE_HEIGHT - MARGIN_TOP;
  };

  drawCentered(page, "BINGO MASTER CHEAT SHEET", y, bold, TITLE_SIZE);
  y -= 21.5;
  if (playlistName) {
    drawCentered(page, playlistName, y, regular, SUBTITLE_SIZE);
    y -= 19.8;
  }
  drawCentered(page, "Timeline of Wins", y, bold, SECTION_SIZE);
  y -= 33.4;

  if (!result.timeline.length) {
    page.drawText(toWinAnsi("No wins with the selected rules and playlist order."), {
      x: MARGIN_LEFT,
      y,
      size: SONG_SIZE,
      font: regular,
    });
  } else {
    for (const song of result.timeline) {
      const title = trackTitle(song.trackName, song.artistName);
      const songLines = wrapText(
        `Song #${song.songNumber}: "${title}"`,
        bold,
        SONG_SIZE,
        CONTENT_WIDTH,
      );
      const winLines = song.events.map((event) => ({
        text: `-> Card ${event.cardNumber} wins ${event.label}`,
        bold: event.label.startsWith("FIRST "),
      }));
      const blockHeight =
        songLines.length * 12 + winLines.length * 14.2 + 7.4;
      ensureSpace(blockHeight);

      for (const line of songLines) {
        page.drawText(line, { x: MARGIN_LEFT, y, size: SONG_SIZE, font: bold });
        y -= 12;
      }
      y -= 3.3;
      for (const win of winLines) {
        ensureSpace(14.2);
        const font = win.bold ? bold : regular;
        const wrapped = wrapText(win.text, font, WIN_SIZE, PAGE_WIDTH - WIN_INDENT - MARGIN_RIGHT);
        for (const line of wrapped) {
          page.drawText(line, { x: WIN_INDENT, y, size: WIN_SIZE, font });
          y -= 14.2;
        }
      }
      y -= 7.4;
    }
  }

  page = doc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
  y = PAGE_HEIGHT - MARGIN_TOP;
  drawCentered(page, "SONG LIST (Playlist Order)", y, bold, TITLE_SIZE);
  y -= 20.9;
  if (playlistName) {
    drawCentered(page, playlistName, y, regular, LIST_SIZE);
    y -= 31.2;
  }

  for (const song of result.songs) {
    const number = `${song.position}.`;
    const title = trackTitle(song.trackName, song.artistName);
    const titleWidth = PAGE_WIDTH - LIST_TEXT_X - MARGIN_RIGHT;
    const wrapped = wrapText(title, regular, LIST_SIZE, titleWidth);
    ensureSpace(wrapped.length * 17);
    page.drawText(toWinAnsi(number), {
      x: LIST_NUMBER_X,
      y,
      size: LIST_SIZE,
      font: regular,
    });
    for (const [index, line] of wrapped.entries()) {
      page.drawText(line, {
        x: LIST_TEXT_X,
        y: y - index * 17,
        size: LIST_SIZE,
        font: regular,
      });
    }
    y -= Math.max(17, wrapped.length * 17);
  }

  return doc.save();
}
