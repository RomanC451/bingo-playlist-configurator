import { requireSpotifyConfig } from "@/lib/spotify-config";
import { decrypt, encrypt } from "@/lib/encryption";
import { prisma } from "@/lib/db";
import {
  SPOTIFY_API_BASE,
  SPOTIFY_TOKEN_URL,
  type SpotifyAudioAnalysis,
  type SpotifyDevicesResponse,
  type SpotifyPlaybackState,
  type SpotifyPlaylistItemsResponse,
  type SpotifyPlaylistTrackItem,
  type SpotifyTokenResponse,
  type SpotifyTrackSummary,
  type SpotifyUserProfile,
  isPlayableAudioTrack,
  isWebPlayerDevice,
} from "@/lib/spotify-types";

class SpotifyApiError extends Error {
  constructor(
    message: string,
    public status: number,
    public detail?: string,
    public retryAfterSeconds?: number,
  ) {
    super(message);
    this.name = "SpotifyApiError";
  }
}

async function refreshAccessToken(refreshToken: string): Promise<SpotifyTokenResponse> {
  const { clientId, clientSecret } = requireSpotifyConfig();
  const body = new URLSearchParams({
    grant_type: "refresh_token",
    refresh_token: refreshToken,
  });

  const response = await fetch(SPOTIFY_TOKEN_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Authorization: `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString("base64")}`,
    },
    body,
  });

  if (!response.ok) {
    throw new SpotifyApiError("Failed to refresh Spotify token", response.status);
  }

  return response.json();
}

export async function getValidSpotifyAccessToken(teamId: string): Promise<string> {
  const connection = await prisma.spotifyConnection.findUnique({
    where: { teamId },
  });

  if (!connection) {
    throw new SpotifyApiError("Spotify account not linked", 401);
  }

  const now = new Date();
  if (connection.expiresAt > now) {
    return decrypt(connection.accessToken);
  }

  const refreshToken = decrypt(connection.refreshToken);
  const tokens = await refreshAccessToken(refreshToken);

  const expiresAt = new Date(Date.now() + tokens.expires_in * 1000);
  await prisma.spotifyConnection.update({
    where: { teamId },
    data: {
      accessToken: encrypt(tokens.access_token),
      refreshToken: encrypt(tokens.refresh_token ?? refreshToken),
      expiresAt,
    },
  });

  return tokens.access_token;
}

export async function requireTeamSpotifyConnection(teamId: string): Promise<void> {
  const connection = await prisma.spotifyConnection.findUnique({
    where: { teamId },
    select: { id: true },
  });
  if (!connection) {
    throw new SpotifyApiError("Spotify account not linked", 401);
  }
}

async function readSpotifyError(response: Response): Promise<string> {
  try {
    const data = (await response.json()) as {
      error?: string | { message?: string; status?: number };
      error_description?: string;
    };
    if (typeof data.error === "string") {
      return data.error_description ?? data.error;
    }
    if (data.error && typeof data.error === "object") {
      return data.error.message ?? JSON.stringify(data.error);
    }
    return JSON.stringify(data);
  } catch {
    return response.statusText || "Unknown error";
  }
}

function parseSpotifyFetchError(
  detail: string,
  status: number,
  path: string,
  retryAfterSeconds?: number,
): SpotifyApiError {
  if (status === 403 && path.includes("/playlists/")) {
    return new SpotifyApiError("playlist_access_denied", status, detail, retryAfterSeconds);
  }
  return new SpotifyApiError(detail || "Spotify API error", status, detail, retryAfterSeconds);
}

async function parseSpotifySuccessBody<T>(
  response: Response,
  path: string,
  method: string,
): Promise<T> {
  if (response.status === 204) {
    return undefined as T;
  }

  const text = await response.text();
  if (!text.trim()) {
    return undefined as T;
  }

  try {
    return JSON.parse(text) as T;
  } catch {
    // Player control PUTs often succeed with a non-JSON or empty body.
    if (method !== "GET") {
      return undefined as T;
    }
    throw new SpotifyApiError(
      `Invalid Spotify response for ${path}`,
      response.status,
      text.slice(0, 200),
    );
  }
}

function parseRetryAfterHeader(header: string | null): number | undefined {
  if (!header) return undefined;

  const asSeconds = Number.parseInt(header, 10);
  if (Number.isFinite(asSeconds) && asSeconds >= 0) {
    return asSeconds;
  }

  const asDate = Date.parse(header);
  if (Number.isFinite(asDate)) {
    return Math.max(0, Math.ceil((asDate - Date.now()) / 1000));
  }

  return undefined;
}

async function spotifyFetch<T>(
  teamId: string,
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const accessToken = await getValidSpotifyAccessToken(teamId);
  const method = (options.method ?? "GET").toUpperCase();
  const response = await fetch(`${SPOTIFY_API_BASE}${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
      ...options.headers,
    },
  });

  if (!response.ok) {
    const detail = await readSpotifyError(response);
    const retryAfterSeconds = parseRetryAfterHeader(response.headers.get("Retry-After"));
    throw parseSpotifyFetchError(
      detail,
      response.status,
      path,
      retryAfterSeconds,
    );
  }

  return parseSpotifySuccessBody<T>(response, path, method);
}

export async function exchangeSpotifyCode(
  code: string,
  redirectUri: string,
): Promise<SpotifyTokenResponse> {
  const { clientId, clientSecret } = requireSpotifyConfig();
  const body = new URLSearchParams({
    grant_type: "authorization_code",
    code,
    redirect_uri: redirectUri,
  });

  const response = await fetch(SPOTIFY_TOKEN_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Authorization: `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString("base64")}`,
    },
    body,
    cache: "no-store",
  });

  if (!response.ok) {
    const detail = await readSpotifyError(response);
    throw new SpotifyApiError(
      `Token exchange failed (${response.status}): ${detail}`,
      response.status,
    );
  }

  const tokens = (await response.json()) as SpotifyTokenResponse;
  if (!tokens.access_token) {
    throw new SpotifyApiError("Token exchange returned no access token", 500);
  }

  return tokens;
}

export async function revokeSpotifyRefreshToken(refreshToken: string): Promise<void> {
  const { clientId, clientSecret } = requireSpotifyConfig();
  const body = new URLSearchParams({
    token: refreshToken,
    token_type_hint: "refresh_token",
  });

  const response = await fetch("https://accounts.spotify.com/api/token/revoke", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Authorization: `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString("base64")}`,
    },
    body,
  });

  if (!response.ok) {
    throw new SpotifyApiError("Failed to revoke Spotify token", response.status);
  }
}

export async function fetchSpotifyProfileWithToken(
  accessToken: string,
): Promise<SpotifyUserProfile> {
  const response = await fetch(`${SPOTIFY_API_BASE}/me`, {
    headers: { Authorization: `Bearer ${accessToken.trim()}` },
    cache: "no-store",
  });

  if (!response.ok) {
    const detail = await readSpotifyError(response);
    if (response.status === 403) {
      throw new SpotifyApiError("not_allowlisted", response.status, detail);
    }
    throw new SpotifyApiError(
      `Profile fetch failed (${response.status}): ${detail}`,
      response.status,
      detail,
    );
  }

  return response.json();
}

export async function getSpotifyProfile(teamId: string): Promise<SpotifyUserProfile> {
  return spotifyFetch<SpotifyUserProfile>(teamId, "/me");
}

export async function getPlaylistTracks(
  teamId: string,
  playlistId: string,
): Promise<SpotifyPlaylistTrackItem[]> {
  const items: SpotifyPlaylistTrackItem[] = [];
  let path: string | null = `/playlists/${playlistId}/items?limit=50`;

  while (path) {
    const currentPath: string = path;
    const page = await spotifyFetch<SpotifyPlaylistItemsResponse>(teamId, currentPath);

    for (const entry of page.items) {
      const track = entry.item ?? entry.track;
      if (isPlayableAudioTrack(track)) {
        items.push({ track });
      }
    }

    path = page.next ? page.next.replace(SPOTIFY_API_BASE, "") : null;
  }

  return items;
}

export async function getPlaylistInfo(
  teamId: string,
  playlistId: string,
): Promise<{ id: string; name: string; imageUrl: string | null }> {
  const data = await spotifyFetch<{
    id: string;
    name: string;
    images?: { url: string }[];
  }>(teamId, `/playlists/${playlistId}?fields=id,name,images`);

  return {
    id: data.id,
    name: data.name,
    imageUrl: data.images?.[0]?.url ?? null,
  };
}

export async function getPlaybackState(teamId: string): Promise<SpotifyPlaybackState | null> {
  try {
    const state = await spotifyFetch<SpotifyPlaybackState>(teamId, "/me/player");
    return state ?? null;
  } catch (error) {
    if (error instanceof SpotifyApiError && error.status === 204) {
      return null;
    }
    throw error;
  }
}

function trackIdFromUri(trackUri: string): string {
  return trackUri.replace("spotify:track:", "");
}

async function waitForPlaybackTrack(
  teamId: string,
  trackId: string,
  attempts = 3,
  delayMs = 250,
): Promise<void> {
  for (let attempt = 0; attempt < attempts; attempt++) {
    if (attempt > 0) {
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
    try {
      const state = await getPlaybackState(teamId);
      if (state?.item?.id === trackId) {
        return;
      }
    } catch {
      // Ignore transient player-state read errors during verification.
    }
  }
}

export async function getDevices(teamId: string): Promise<SpotifyDevicesResponse> {
  return spotifyFetch<SpotifyDevicesResponse>(teamId, "/me/player/devices");
}

async function resolvePlaybackDeviceId(
  teamId: string,
  requestedDeviceId?: string,
): Promise<string | undefined> {
  const { devices } = await getDevices(teamId);
  if (devices.length === 0) return undefined;

  if (requestedDeviceId) {
    const match = devices.find((d) => d.id === requestedDeviceId);
    if (match) return match.id;
  }

  const isWebPlayer = isWebPlayerDevice;

  const activeNonWeb = devices.find((d) => d.is_active && !isWebPlayer(d.name));
  if (activeNonWeb) return activeNonWeb.id;

  const anyNonWeb = devices.find((d) => !d.is_restricted && !isWebPlayer(d.name));
  if (anyNonWeb) return anyNonWeb.id;

  const active = devices.find((d) => d.is_active);
  if (active) return active.id;

  const available = devices.find((d) => !d.is_restricted);
  return available?.id ?? devices[0]?.id;
}

async function requireConnectDevice(
  teamId: string,
  deviceId: string,
): Promise<string> {
  const { devices } = await getDevices(teamId);
  const device = devices.find((d) => d.id === deviceId);
  if (device && !isWebPlayerDevice(device.name)) {
    return deviceId;
  }

  const alternative = devices.find(
    (d) => !d.is_restricted && !isWebPlayerDevice(d.name),
  );
  if (alternative) {
    return alternative.id;
  }

  throw new SpotifyApiError(
    "Bingo playback requires the Spotify desktop or mobile app. Open Spotify on your computer or phone (not open.spotify.com in the browser), then press Play clip again.",
    403,
  );
}

export async function getTrack(
  teamId: string,
  trackId: string,
): Promise<SpotifyTrackSummary> {
  return spotifyFetch<SpotifyTrackSummary>(teamId, `/tracks/${trackId}`);
}

async function assertTrackPlayable(teamId: string, trackId: string): Promise<void> {
  const track = await getTrack(teamId, trackId);
  const trackName = track.name ?? trackId;
  if (!isPlayableAudioTrack(track)) {
    throw new SpotifyApiError(
      `"${trackName}" is not available for audio playback via Spotify Connect. Try the desktop or mobile Spotify app, or remove music videos and unavailable tracks from your playlist.`,
      403,
    );
  }
}

async function ignoreSpotifyError(err: unknown, ...statuses: number[]): Promise<void> {
  if (err instanceof SpotifyApiError && statuses.includes(err.status)) {
    return;
  }
  throw err;
}

export async function transferPlayback(
  teamId: string,
  deviceId: string,
  play = false,
): Promise<void> {
  await spotifyFetch(teamId, "/me/player", {
    method: "PUT",
    body: JSON.stringify({
      device_ids: [deviceId],
      play,
    }),
  });
}

export async function playTrackAtPosition(
  teamId: string,
  trackUri: string,
  positionMs: number,
  deviceId?: string,
): Promise<void> {
  const query = deviceId ? `?device_id=${encodeURIComponent(deviceId)}` : "";
  await spotifyFetch(teamId, `/me/player/play${query}`, {
    method: "PUT",
    body: JSON.stringify({
      uris: [trackUri],
      position_ms: positionMs,
    }),
  });
}

/** Start or switch clip playback with fresh device resolution and playback verification. */
export async function startClipPlayback(
  teamId: string,
  trackUri: string,
  positionMs: number,
  deviceId?: string,
  options?: { skipPlayabilityCheck?: boolean },
): Promise<void> {
  const trackId = trackIdFromUri(trackUri);
  let resolvedDeviceId = await resolvePlaybackDeviceId(teamId, deviceId);

  if (!resolvedDeviceId) {
    throw new SpotifyApiError(
      "No Spotify device available. Open the Spotify desktop or mobile app.",
      404,
    );
  }

  resolvedDeviceId = await requireConnectDevice(teamId, resolvedDeviceId);
  if (!options?.skipPlayabilityCheck) {
    await assertTrackPlayable(teamId, trackId);
  }

  try {
    await playTrackAtPosition(teamId, trackUri, positionMs, resolvedDeviceId);
  } catch (err) {
    if (!(err instanceof SpotifyApiError) || err.status !== 404) {
      throw err;
    }
    try {
      await transferPlayback(teamId, resolvedDeviceId, false);
    } catch (transferErr) {
      await ignoreSpotifyError(transferErr, 404, 403);
    }
    await playTrackAtPosition(teamId, trackUri, positionMs, resolvedDeviceId);
  }

  try {
    await waitForPlaybackTrack(teamId, trackId);
  } catch {
    // Spotify may be slow to report state; play command already succeeded.
  }
}

export async function pauseActivePlayback(
  teamId: string,
  deviceId?: string,
): Promise<void> {
  const resolvedDeviceId = await resolvePlaybackDeviceId(teamId, deviceId);
  if (!resolvedDeviceId) return;

  try {
    await pausePlayback(teamId, resolvedDeviceId);
  } catch (err) {
    await ignoreSpotifyError(err, 404, 403);
  }
}

export async function pausePlayback(teamId: string, deviceId?: string): Promise<void> {
  const query = deviceId ? `?device_id=${encodeURIComponent(deviceId)}` : "";
  await spotifyFetch(teamId, `/me/player/pause${query}`, { method: "PUT" });
}

export async function getAudioAnalysis(
  teamId: string,
  trackId: string,
): Promise<SpotifyAudioAnalysis> {
  return spotifyFetch<SpotifyAudioAnalysis>(teamId, `/audio-analysis/${trackId}`);
}

export function asSpotifyApiError(err: unknown): SpotifyApiError | null {
  if (err instanceof SpotifyApiError) return err;
  if (
    err instanceof Error &&
    err.name === "SpotifyApiError" &&
    typeof (err as SpotifyApiError).status === "number"
  ) {
    return err as SpotifyApiError;
  }
  return null;
}

export { SpotifyApiError };
