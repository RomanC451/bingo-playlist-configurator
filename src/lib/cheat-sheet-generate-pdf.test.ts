import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  MUSIC_BINGO_API_BASE,
  PlaylistGenerationError,
  generatePlaylistPdf,
  toSpotifyPlaylistUrl,
  tracksFromGeneratorPayload,
} from "./cheat-sheet/generate-pdf.ts";

describe("cheat-sheet playlist URL", () => {
  it("normalizes a Spotify playlist URL or ID", () => {
    assert.equal(
      toSpotifyPlaylistUrl("https://open.spotify.com/playlist/3yYwRjnNEWtG4FvdYX97kN?si=abc"),
      "https://open.spotify.com/playlist/3yYwRjnNEWtG4FvdYX97kN",
    );
    assert.equal(
      toSpotifyPlaylistUrl("3yYwRjnNEWtG4FvdYX97kN"),
      "https://open.spotify.com/playlist/3yYwRjnNEWtG4FvdYX97kN",
    );
    assert.equal(toSpotifyPlaylistUrl("not a playlist"), null);
  });
});

describe("cheat-sheet generator tracks", () => {
  it("keeps name and artist from the generator payload", () => {
    assert.deepEqual(
      tracksFromGeneratorPayload([{ id: "t1", name: "Song", artist: "Artist" }, { name: "  " }]),
      [{ name: "Song", artist: "Artist" }],
    );
  });
});

describe("cheat-sheet generatePlaylistPdf", () => {
  const options = {
    playlistUrl: "https://open.spotify.com/playlist/3yYwRjnNEWtG4FvdYX97kN",
    gridSize: 5 as const,
    numberOfCards: 2,
    includeArtistName: true,
    freeCenterSpace: true,
  };

  const playlistResponse = {
    playlist: { id: "p1", name: "Test mix", image: "https://img.example/p.png", snapshot_id: "s1" },
    tracks: [{ id: "t1", name: "Song", artist: "Artist" }],
  };

  it("fetches tracks, posts generate-pdf, and downloads bytes", async () => {
    const posted: Array<{ url: string; payload: unknown }> = [];
    const fetchMock: typeof fetch = async (input, init) => {
      const url = String(input);
      if (url === `${MUSIC_BINGO_API_BASE}/playlist-from-url`) {
        posted.push({ url, payload: JSON.parse(String(init?.body)) });
        return new Response(JSON.stringify(playlistResponse), {
          status: 200,
          headers: { "content-type": "application/json" },
        });
      }
      if (url === `${MUSIC_BINGO_API_BASE}/generate-pdf`) {
        posted.push({ url, payload: JSON.parse(String(init?.body)) });
        return new Response(JSON.stringify({ success: true, pdf_url: "https://example.com/out.pdf" }), {
          status: 200,
          headers: { "content-type": "application/json" },
        });
      }
      if (url === "https://example.com/out.pdf") {
        return new Response(new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d]), { status: 200 });
      }
      throw new Error(`unexpected fetch ${url}`);
    };

    const result = await generatePlaylistPdf(options, { fetch: fetchMock, timeoutMs: 5_000 });
    assert.equal(result.playlistName, "Test mix");
    assert.equal(result.playlistImageUrl, "https://img.example/p.png");
    assert.deepEqual(result.tracks, [{ name: "Song", artist: "Artist" }]);
    assert.equal(Buffer.from(result.pdfBytes).toString("latin1"), "%PDF-");
    assert.deepEqual(posted[0], {
      url: `${MUSIC_BINGO_API_BASE}/playlist-from-url`,
      payload: { playlist_url: "https://open.spotify.com/playlist/3yYwRjnNEWtG4FvdYX97kN" },
    });
    assert.deepEqual(posted[1]?.payload, {
      card_count: 2,
      free_space: true,
      grid_size: 5,
      include_artist: true,
      playlist_id: "p1",
      playlist_image: "https://img.example/p.png",
      playlist_name: "Test mix",
      playlist_snapshot_id: "s1",
      tracks: playlistResponse.tracks,
    });
  });

  it("turns off free space for even grids", async () => {
    let generatePayload: Record<string, unknown> | null = null;
    const fetchMock: typeof fetch = async (input, init) => {
      const url = String(input);
      if (url.endsWith("playlist-from-url")) {
        return new Response(JSON.stringify(playlistResponse), { status: 200 });
      }
      if (url.endsWith("generate-pdf")) {
        generatePayload = JSON.parse(String(init?.body)) as Record<string, unknown>;
        return new Response(JSON.stringify({ success: true, pdf_url: "https://example.com/out.pdf" }), {
          status: 200,
        });
      }
      return new Response(new Uint8Array([1, 2, 3]), { status: 200 });
    };

    await generatePlaylistPdf(
      { ...options, gridSize: 4, freeCenterSpace: true },
      { fetch: fetchMock, timeoutMs: 5_000 },
    );
    assert.equal(generatePayload?.free_space, false);
    assert.equal(generatePayload?.grid_size, 4);
  });

  it("rejects an empty playlist response", async () => {
    const fetchMock: typeof fetch = async () =>
      new Response(JSON.stringify({ playlist: {}, tracks: [] }), { status: 200 });
    await assert.rejects(
      () => generatePlaylistPdf(options, { fetch: fetchMock, timeoutMs: 5_000 }),
      (err: unknown) => {
        assert.ok(err instanceof PlaylistGenerationError);
        assert.match(err.message, /public/i);
        return true;
      },
    );
  });

  it("rejects a generate-pdf response without pdf_url", async () => {
    const fetchMock: typeof fetch = async (input) => {
      const url = String(input);
      if (url.endsWith("playlist-from-url")) {
        return new Response(JSON.stringify(playlistResponse), { status: 200 });
      }
      return new Response(JSON.stringify({ success: false }), { status: 200 });
    };
    await assert.rejects(
      () => generatePlaylistPdf(options, { fetch: fetchMock, timeoutMs: 5_000 }),
      (err: unknown) => {
        assert.ok(err instanceof PlaylistGenerationError);
        assert.match(err.message, /valid PDF/i);
        return true;
      },
    );
  });

  it("wraps generator HTTP errors", async () => {
    const fetchMock: typeof fetch = async () =>
      new Response("<html>nope</html>", { status: 502 });
    await assert.rejects(
      () => generatePlaylistPdf(options, { fetch: fetchMock, timeoutMs: 5_000 }),
      (err: unknown) => {
        assert.ok(err instanceof PlaylistGenerationError);
        assert.match(err.message, /502/);
        return true;
      },
    );
  });
});
