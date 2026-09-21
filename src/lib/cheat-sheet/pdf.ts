import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { extractBingoCardsFromPages, extractSongListFromPages } from "./extract";
import type { BingoCard, PdfPageContent, PdfWord, PlaylistTrack } from "./types";

type PdfJsTextItem = {
  str?: string;
  transform?: number[];
  hasEOL?: boolean;
};

type PdfJsModule = {
  GlobalWorkerOptions: { workerSrc: string };
  getDocument: (src: { data: Uint8Array; useSystemFonts?: boolean }) => {
    promise: Promise<{
      numPages: number;
      getPage: (pageNumber: number) => Promise<{
        getViewport: (params: { scale: number }) => { height: number };
        getTextContent: () => Promise<{ items: Array<PdfJsTextItem | { str?: undefined }> }>;
      }>;
      cleanup?: (keepLoadedFonts?: boolean) => Promise<void>;
      destroy?: () => Promise<void>;
    }>;
    destroy?: () => Promise<void>;
  };
};

let workerReady = false;

async function loadPdfJs(): Promise<PdfJsModule> {
  const pdfjs = (await import("pdfjs-dist/legacy/build/pdf.mjs")) as PdfJsModule;
  if (!workerReady) {
    const workerPath = join(
      process.cwd(),
      "node_modules/pdfjs-dist/legacy/build/pdf.worker.mjs",
    );
    pdfjs.GlobalWorkerOptions.workerSrc = pathToFileURL(workerPath).href;
    workerReady = true;
  }
  return pdfjs;
}

function pageFromTextItems(
  items: Array<PdfJsTextItem | { str?: undefined }>,
  pageHeight: number,
): PdfPageContent {
  const words: PdfWord[] = [];
  const textParts: string[] = [];

  for (const item of items) {
    if (!("str" in item) || typeof item.str !== "string") continue;
    const text = item.str;
    if (text.trim()) {
      const x0 = item.transform?.[4] ?? 0;
      const y = item.transform?.[5] ?? 0;
      words.push({
        text,
        x0,
        top: pageHeight - y,
      });
    }
    textParts.push(text);
    if ("hasEOL" in item && item.hasEOL) textParts.push("\n");
  }

  return {
    text: textParts.join(""),
    words,
  };
}

export type ExtractedBingoPdf = {
  cards: BingoCard[];
  tracks: PlaylistTrack[];
  playlistName: string;
  pages: PdfPageContent[];
};

export function extractFromPages(pages: PdfPageContent[]): Omit<ExtractedBingoPdf, "pages"> {
  const cards = extractBingoCardsFromPages(pages);
  const songList = extractSongListFromPages(pages);
  return {
    cards,
    tracks: songList.tracks,
    playlistName: songList.playlistName || "Playlist",
  };
}

export async function readBingoPdfPages(data: Uint8Array): Promise<PdfPageContent[]> {
  const pdfjs = await loadPdfJs();
  const copy = Uint8Array.from(data);
  const loadingTask = pdfjs.getDocument({ data: copy, useSystemFonts: true });
  const document = await loadingTask.promise;

  try {
    const pages: PdfPageContent[] = [];
    for (let pageNumber = 1; pageNumber <= document.numPages; pageNumber++) {
      const page = await document.getPage(pageNumber);
      const viewport = page.getViewport({ scale: 1 });
      const content = await page.getTextContent();
      pages.push(pageFromTextItems(content.items, viewport.height));
    }
    return pages;
  } finally {
    try {
      await document.cleanup?.();
    } catch {
      // Ignore worker teardown errors after a successful parse.
    }
    try {
      await loadingTask.destroy?.();
    } catch {
      // Ignore worker teardown errors after a successful parse.
    }
  }
}

export async function extractBingoPdf(data: Uint8Array): Promise<ExtractedBingoPdf> {
  const pages = await readBingoPdfPages(data);
  return { pages, ...extractFromPages(pages) };
}
