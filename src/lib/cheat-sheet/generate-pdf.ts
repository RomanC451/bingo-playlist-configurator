import { extractPlaylistId } from "@/lib/spotify-types";
import type { PlaylistTrack } from "./types";
import { MAX_GENERATED_CARDS, SUPPORTED_GRID_SIZES } from "./types";

export const MUSIC_BINGO_API_BASE = "https://musicbingogenerator.com/wp-json/music-bingo/v1";

const BROWSER_HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36",
  "Accept-Language": "en-US,en;q=0.9",
  "Sec-CH-UA": '"Chromium";v="148", "Google Chrome";v="148", "Not/A)Brand";v="99"',
  "Sec-CH-UA-Mobile": "?0",
  "Sec-CH-UA-Platform": '"Windows"',
};

export class PlaylistGenerationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PlaylistGenerationError";
  }
}

export type GridSize = (typeof SUPPORTED_GRID_SIZES)[number];

export type PlaylistGenerationOptions = {
  playlistUrl: string;
  gridSize: GridSize;
  numberOfCards: number;
  includeArtistName: boolean;
  freeCenterSpace: boolean;
};

export type GeneratedPlaylistPdf = {
  pdfBytes: Uint8Array;
  playlistName: string;
  playlistImageUrl: string | null;
  tracks: PlaylistTrack[];
};

export type GeneratePlaylistPdfDeps = {
  fetch?: typeof fetch;
  timeoutMs?: number;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

export function toSpotifyPlaylistUrl(input: string): string | null {
  const id = extractPlaylistId(input);
  if (!id) return null;
  return `https://open.spotify.com/playlist/${id}`;
}

export function isOddGrid(gridSize: number): boolean {
  return gridSize % 2 === 1;
}

function asString(value: unknown): string {
  return typeof value === "string" ? value : value == null ? "" : String(value);
}

export function tracksFromGeneratorPayload(tracks: unknown): PlaylistTrack[] {
  if (!Array.isArray(tracks)) return [];
  const parsed: PlaylistTrack[] = [];
  for (const item of tracks) {
    if (!isRecord(item)) continue;
    const name = asString(item.name).trim();
    if (!name) continue;
    parsed.push({ name, artist: asString(item.artist).trim() });
  }
  return parsed;
}

function truncateDetail(raw: string): string {
  return raw.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim().slice(0, 240);
}

async function postJson(
  fetchFn: typeof fetch,
  url: string,
  payload: unknown,
  timeoutMs: number,
): Promise<unknown> {
  let response: Response;
  try {
    response = await fetchFn(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        Origin: "https://musicbingogenerator.com",
        Referer: "https://musicbingogenerator.com/",
        ...BROWSER_HEADERS,
      },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(timeoutMs),
    });
  } catch (err) {
    if (err instanceof PlaylistGenerationError) throw err;
    if (err instanceof Error && (err.name === "TimeoutError" || err.name === "AbortError")) {
      throw new PlaylistGenerationError(
        "Timed out generating bingo cards. Try fewer cards or try again.",
      );
    }
    throw new PlaylistGenerationError("Could not reach the bingo card generator.");
  }

  const raw = await response.text();
  if (!response.ok) {
    const detail = truncateDetail(raw);
    throw new PlaylistGenerationError(
      detail
        ? `Bingo card generator error (${response.status}): ${detail}`
        : `Bingo card generator error (${response.status})`,
    );
  }

  try {
    return JSON.parse(raw) as unknown;
  } catch {
    throw new PlaylistGenerationError("Bingo card generator returned invalid JSON.");
  }
}

async function downloadPdf(
  fetchFn: typeof fetch,
  url: string,
  timeoutMs: number,
): Promise<Uint8Array> {
  let response: Response;
  try {
    response = await fetchFn(url, {
      method: "GET",
      headers: {
        Accept: "application/pdf,*/*",
        Referer: "https://musicbingogenerator.com/",
        Origin: "https://musicbingogenerator.com",
        ...BROWSER_HEADERS,
      },
      signal: AbortSignal.timeout(timeoutMs),
    });
  } catch (err) {
    if (err instanceof Error && (err.name === "TimeoutError" || err.name === "AbortError")) {
      throw new PlaylistGenerationError("Timed out downloading the generated bingo cards PDF.");
    }
    throw new PlaylistGenerationError("Could not download the generated bingo cards PDF.");
  }

  if (!response.ok) {
    throw new PlaylistGenerationError(
      `Could not download the generated bingo cards PDF (${response.status}).`,
    );
  }

  return new Uint8Array(await response.arrayBuffer());
}

export async function generatePlaylistPdf(
  options: PlaylistGenerationOptions,
  deps: GeneratePlaylistPdfDeps = {},
): Promise<GeneratedPlaylistPdf> {
  const fetchFn = deps.fetch ?? fetch;
  const timeoutMs = Math.max(1_000, deps.timeoutMs ?? 120_000);
  const playlistUrl = toSpotifyPlaylistUrl(options.playlistUrl);
  if (!playlistUrl) {
    throw new PlaylistGenerationError("Enter a valid Spotify playlist URL or ID.");
  }
  if (!SUPPORTED_GRID_SIZES.includes(options.gridSize)) {
    throw new PlaylistGenerationError("Choose a grid size of 3×3, 4×4, 5×5, or 6×6.");
  }
  if (!Number.isInteger(options.numberOfCards) || options.numberOfCards < 1) {
    throw new PlaylistGenerationError("Number of cards must be at least 1.");
  }
  if (options.numberOfCards > MAX_GENERATED_CARDS) {
    throw new PlaylistGenerationError(`Number of cards cannot exceed ${MAX_GENERATED_CARDS}.`);
  }

  const playlistResponse = await postJson(
    fetchFn,
    `${MUSIC_BINGO_API_BASE}/playlist-from-url`,
    { playlist_url: playlistUrl },
    timeoutMs,
  );
  if (!isRecord(playlistResponse)) {
    throw new PlaylistGenerationError("Could not extract playlist/tracks from the generator.");
  }

  const playlist = isRecord(playlistResponse.playlist) ? playlistResponse.playlist : {};
  const tracks = Array.isArray(playlistResponse.tracks) ? playlistResponse.tracks : [];
  const parsedTracks = tracksFromGeneratorPayload(tracks);
  if (!playlist.id || parsedTracks.length === 0) {
    throw new PlaylistGenerationError(
      "Could not read this Spotify playlist. Make sure the playlist is public and try again.",
    );
  }

  const generationPayload = {
    card_count: options.numberOfCards,
    free_space: Boolean(options.freeCenterSpace && isOddGrid(options.gridSize)),
    grid_size: options.gridSize,
    include_artist: Boolean(options.includeArtistName),
    playlist_id: playlist.id,
    playlist_image: playlist.image ?? "",
    playlist_name: playlist.name ?? "",
    playlist_snapshot_id: playlist.snapshot_id ?? "",
    tracks,
  };

  const generationResponse = await postJson(
    fetchFn,
    `${MUSIC_BINGO_API_BASE}/generate-pdf`,
    generationPayload,
    timeoutMs,
  );
  if (!isRecord(generationResponse)) {
    throw new PlaylistGenerationError("Bingo card generator did not return a valid PDF.");
  }

  const pdfUrl = asString(generationResponse.pdf_url).trim();
  if (!generationResponse.success || !pdfUrl) {
    throw new PlaylistGenerationError("Bingo card generator did not return a valid PDF.");
  }

  const pdfBytes = await downloadPdf(fetchFn, pdfUrl, timeoutMs);
  if (!pdfBytes.byteLength) {
    throw new PlaylistGenerationError("Generated PDF URL returned, but the file was empty.");
  }

  return {
    pdfBytes,
    playlistName: asString(playlist.name).trim() || "Playlist",
    playlistImageUrl: asString(playlist.image).trim() || null,
    tracks: parsedTracks,
  };
}
