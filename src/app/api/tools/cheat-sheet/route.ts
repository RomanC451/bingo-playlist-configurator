import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAuth } from "@/lib/api-auth";
import { internalError } from "@/lib/api-errors";
import { buildCheatSheet, formatCheatSheetText } from "@/lib/cheat-sheet";
import {
  PlaylistGenerationError,
  generatePlaylistPdf,
  toSpotifyPlaylistUrl,
} from "@/lib/cheat-sheet/generate-pdf";
import { extractFromPages, readBingoPdfPages } from "@/lib/cheat-sheet/pdf";
import { stripDefaultCheatSheetPages } from "@/lib/cheat-sheet/strip-pdf";
import {
  MAX_DIAGONAL_WINS,
  MAX_GENERATED_CARDS,
  MAX_LINE_WINS,
  SUPPORTED_GRID_SIZES,
  type PlaylistTrack,
  type WinRules,
} from "@/lib/cheat-sheet/types";

export const runtime = "nodejs";
export const maxDuration = 180;

const MAX_PDF_BYTES = 15 * 1024 * 1024;

const rulesSchema = z
  .object({
    lines: z.coerce.number().int().min(0).max(MAX_LINE_WINS),
    diagonals: z.coerce.number().int().min(0).max(MAX_DIAGONAL_WINS),
    fullCard: z.boolean(),
  })
  .refine((rules) => rules.lines > 0 || rules.diagonals > 0 || rules.fullCard, {
    message: "Select at least one win rule",
  });

const generationSchema = z.object({
  playlistUrl: z.string().min(1),
  gridSize: z.coerce.number().int().refine((value): value is (typeof SUPPORTED_GRID_SIZES)[number] =>
    (SUPPORTED_GRID_SIZES as readonly number[]).includes(value),
  ),
  cardCount: z.coerce.number().int().min(1).max(MAX_GENERATED_CARDS),
  includeArtist: z.boolean(),
  freeCenter: z.boolean(),
});

function asFile(value: FormDataEntryValue | null): File | null {
  return value instanceof File ? value : null;
}

function parseRules(rawRules: string): WinRules | null {
  try {
    return rulesSchema.parse(JSON.parse(rawRules));
  } catch {
    return null;
  }
}

function bytesToBase64(bytes: Uint8Array): string {
  return Buffer.from(bytes).toString("base64");
}

async function cheatSheetFromPdf(params: {
  pdfBytes: Uint8Array;
  rules: WinRules;
  fallbackTracks?: PlaylistTrack[];
  fallbackPlaylistName?: string;
  playlistImageUrl?: string | null;
  includeCardsPdf?: boolean;
}) {
  const pages = await readBingoPdfPages(params.pdfBytes);
  const extracted = extractFromPages(pages);
  const tracks = extracted.tracks.length ? extracted.tracks : (params.fallbackTracks ?? []);
  const playlistName =
    extracted.playlistName && extracted.playlistName !== "Playlist"
      ? extracted.playlistName
      : params.fallbackPlaylistName || extracted.playlistName || "Playlist";

  if (!extracted.cards.length) {
    return NextResponse.json(
      { error: "No bingo cards found in this PDF. Existing cheat-sheet pages are ignored." },
      { status: 400 },
    );
  }
  if (!tracks.length) {
    return NextResponse.json(
      {
        error:
          "No song list found in this PDF. Use a bingo-cards PDF that includes SONG LIST (Playlist Order).",
      },
      { status: 400 },
    );
  }

  const result = buildCheatSheet({
    cards: extracted.cards,
    tracks,
    rules: params.rules,
  });

  const cardsPdfBytes = params.includeCardsPdf
    ? await stripDefaultCheatSheetPages(params.pdfBytes, pages)
    : null;

  return NextResponse.json({
    playlistName,
    playlistImageUrl: params.playlistImageUrl ?? null,
    text: formatCheatSheetText(result, playlistName),
    cardsPdfBase64: cardsPdfBytes ? bytesToBase64(cardsPdfBytes) : undefined,
    ...result,
  });
}

export async function POST(request: Request) {
  const { error } = await requireAuth();
  if (error) return error;

  try {
    const formData = await request.formData();
    const source = String(formData.get("source") ?? "pdf");
    const parsedRules = parseRules(String(formData.get("rules") ?? ""));
    if (!parsedRules) {
      return NextResponse.json(
        { error: "Select at least one win rule: lines, diagonals, or full-card" },
        { status: 400 },
      );
    }

    if (source === "spotify") {
      let generation: z.infer<typeof generationSchema>;
      try {
        generation = generationSchema.parse(JSON.parse(String(formData.get("generation") ?? "")));
      } catch {
        return NextResponse.json(
          { error: "Enter a Spotify playlist URL and card options." },
          { status: 400 },
        );
      }

      if (!toSpotifyPlaylistUrl(generation.playlistUrl)) {
        return NextResponse.json(
          { error: "Enter a valid Spotify playlist URL or ID." },
          { status: 400 },
        );
      }

      const generated = await generatePlaylistPdf({
        playlistUrl: generation.playlistUrl,
        gridSize: generation.gridSize,
        numberOfCards: generation.cardCount,
        includeArtistName: generation.includeArtist,
        freeCenterSpace: generation.freeCenter,
      });

      if (generated.pdfBytes.byteLength > MAX_PDF_BYTES) {
        return NextResponse.json({ error: "Generated PDF is too large (15 MB max)" }, { status: 400 });
      }

      return cheatSheetFromPdf({
        pdfBytes: generated.pdfBytes,
        rules: parsedRules,
        fallbackTracks: generated.tracks,
        fallbackPlaylistName: generated.playlistName,
        playlistImageUrl: generated.playlistImageUrl,
        includeCardsPdf: true,
      });
    }

    const pdf = asFile(formData.get("pdf"));
    if (!pdf || pdf.size === 0) {
      return NextResponse.json({ error: "Upload a bingo cards PDF" }, { status: 400 });
    }
    if (pdf.size > MAX_PDF_BYTES) {
      return NextResponse.json({ error: "PDF is too large (15 MB max)" }, { status: 400 });
    }
    if (!pdf.type.includes("pdf") && !pdf.name.toLowerCase().endsWith(".pdf")) {
      return NextResponse.json({ error: "File must be a PDF" }, { status: 400 });
    }

    return cheatSheetFromPdf({
      pdfBytes: new Uint8Array(await pdf.arrayBuffer()),
      rules: parsedRules,
    });
  } catch (err) {
    if (err instanceof PlaylistGenerationError) {
      return NextResponse.json({ error: err.message }, { status: 400 });
    }
    if (err instanceof Error && /no bingo cards/i.test(err.message)) {
      return NextResponse.json({ error: err.message }, { status: 400 });
    }
    console.error(err);
    return internalError("Failed to generate cheat sheet");
  }
}
