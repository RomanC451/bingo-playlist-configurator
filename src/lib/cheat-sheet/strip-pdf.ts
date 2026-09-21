import { PDFDocument } from "pdf-lib";
import { CHEAT_SHEET_STOP_MARKER, SONG_LIST_MARKER, type PdfPageContent } from "./types";

export function keepPageIndexesWithoutDefaultCheatSheet(pages: PdfPageContent[]): number[] {
  const keep: number[] = [];
  let inDefaultCheatSheet = false;

  for (let index = 0; index < pages.length; index++) {
    const text = pages[index]!.text;
    if (text.includes(SONG_LIST_MARKER)) {
      inDefaultCheatSheet = false;
      keep.push(index);
      continue;
    }
    if (inDefaultCheatSheet || text.includes(CHEAT_SHEET_STOP_MARKER)) {
      inDefaultCheatSheet = true;
      continue;
    }
    keep.push(index);
  }

  return keep;
}

export async function stripDefaultCheatSheetPages(
  data: Uint8Array,
  pages: PdfPageContent[],
): Promise<Uint8Array> {
  const keep = keepPageIndexesWithoutDefaultCheatSheet(pages);
  if (keep.length === 0 || keep.length === pages.length) {
    return data;
  }

  const source = await PDFDocument.load(Uint8Array.from(data));
  const output = await PDFDocument.create();
  const copied = await output.copyPages(source, keep);
  for (const page of copied) {
    output.addPage(page);
  }
  return output.save();
}
