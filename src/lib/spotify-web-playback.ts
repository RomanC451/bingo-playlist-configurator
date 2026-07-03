import { SPOTIFY_API_BASE } from "@/lib/spotify-types";

const SDK_SCRIPT_URL = "https://sdk.scdn.co/spotify-player.js";

let scriptLoadPromise: Promise<void> | null = null;

export function loadSpotifyWebPlaybackSdk(): Promise<void> {
  if (typeof window === "undefined") {
    return Promise.reject(new Error("Spotify Web Playback SDK requires a browser"));
  }

  if (window.Spotify?.Player) {
    return Promise.resolve();
  }

  if (scriptLoadPromise) {
    return scriptLoadPromise;
  }

  scriptLoadPromise = new Promise((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>(
      `script[src="${SDK_SCRIPT_URL}"]`,
    );
    if (existing) {
      if (window.Spotify?.Player) {
        resolve();
        return;
      }
      existing.addEventListener("load", () => resolve(), { once: true });
      existing.addEventListener(
        "error",
        () => reject(new Error("Failed to load Spotify Web Playback SDK")),
        { once: true },
      );
      return;
    }

    window.onSpotifyWebPlaybackSDKReady = () => {
      resolve();
    };

    const script = document.createElement("script");
    script.src = SDK_SCRIPT_URL;
    script.async = true;
    script.addEventListener(
      "error",
      () => reject(new Error("Failed to load Spotify Web Playback SDK")),
      { once: true },
    );
    document.body.appendChild(script);
  });

  return scriptLoadPromise;
}

export async function putPlayTrack(
  accessToken: string,
  deviceId: string,
  trackUri: string,
  positionMs: number,
): Promise<void> {
  const response = await fetch(
    `${SPOTIFY_API_BASE}/me/player/play?device_id=${encodeURIComponent(deviceId)}`,
    {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        uris: [trackUri],
        position_ms: positionMs,
      }),
    },
  );

  if (response.ok || response.status === 204) {
    return;
  }

  let detail = response.statusText;
  try {
    const data = (await response.json()) as {
      error?: { message?: string };
    };
    detail = data.error?.message ?? detail;
  } catch {
    // ignore
  }

  if (response.status === 403) {
    throw new Error(
      detail.includes("Premium")
        ? detail
        : "Another playback may be active on the team Spotify account.",
    );
  }

  throw new Error(detail || `Playback failed (${response.status})`);
}

export function trackIdFromUri(trackUri: string): string {
  return trackUri.replace("spotify:track:", "");
}

export function trackUriFromId(trackId: string): string {
  return `spotify:track:${trackId}`;
}

export function webPlaybackStateToPlaybackState(
  state: Spotify.WebPlaybackState | null,
): {
  is_playing: boolean;
  progress_ms: number | null;
  item: { id: string } | null;
} | null {
  if (!state) return null;

  const track = state.track_window.current_track;
  return {
    is_playing: !state.paused,
    progress_ms: state.position,
    item: track ? { id: track.id } : null,
  };
}
