export const SPOTIFY_SCOPES = [
  "playlist-read-private",
  "playlist-read-collaborative",
  "user-read-email",
  "user-read-private",
  "user-read-playback-state",
  "user-modify-playback-state",
  "user-read-currently-playing",
  "streaming",
].join(" ");

/** Scopes required for in-browser Web Playback SDK preview. */
export const WEB_PLAYBACK_SCOPES = ["streaming", "user-read-private"] as const;

export function hasStreamingScope(scope: string | null | undefined): boolean {
  if (!scope) return false;
  const granted = new Set(scope.split(/\s+/));
  return WEB_PLAYBACK_SCOPES.every((required) => granted.has(required));
}

export const SPOTIFY_AUTH_URL = "https://accounts.spotify.com/authorize";
export const SPOTIFY_TOKEN_URL = "https://accounts.spotify.com/api/token";
export const SPOTIFY_API_BASE = "https://api.spotify.com/v1";

export interface SpotifyTokenResponse {
  access_token: string;
  token_type: string;
  scope: string;
  expires_in: number;
  refresh_token?: string;
}

export interface SpotifyTrackSummary {
  id: string;
  name: string;
  duration_ms: number;
  type?: string;
  is_playable?: boolean;
  is_local?: boolean;
  preview_url?: string | null;
  artists: { name: string }[];
  album: {
    images: { url: string }[];
  };
}

export interface SpotifyPlaylistItemEntry {
  /** Feb 2026+ playlist items API */
  item?: SpotifyTrackSummary | null;
  /** Legacy playlist tracks API (extended quota mode) */
  track?: SpotifyTrackSummary | null;
}

export interface SpotifyPlaylistItemsResponse {
  items: SpotifyPlaylistItemEntry[];
  next: string | null;
}

/** Normalized playlist row used by the app */
export interface SpotifyPlaylistTrackItem {
  track: SpotifyTrackSummary;
}

export interface SpotifyPlaybackState {
  is_playing: boolean;
  progress_ms: number | null;
  item: {
    id: string;
    name: string;
    duration_ms: number;
    artists: { name: string }[];
  } | null;
  device: {
    id: string;
    name: string;
    is_active: boolean;
  } | null;
}

export interface SpotifyDevicesResponse {
  devices: {
    id: string;
    name: string;
    type: string;
    is_active: boolean;
    is_restricted: boolean;
  }[];
}

export function isWebPlayerDevice(name: string): boolean {
  return /web player/i.test(name);
}

export function isPlayableAudioTrack(
  track: SpotifyTrackSummary | null | undefined,
): track is SpotifyTrackSummary {
  if (!track?.id) return false;
  if (track.type && track.type !== "track") return false;
  if (track.is_local) return false;
  if (track.is_playable === false) return false;
  if (!track.duration_ms || track.duration_ms <= 0) return false;
  return true;
}

export interface SpotifyUserProfile {
  id: string;
  display_name: string | null;
  email?: string;
  images?: { url: string }[];
  product?: string;
}

export interface SpotifyAudioAnalysis {
  track: {
    duration: number;
  };
  segments: {
    start: number;
    duration: number;
    loudness_max: number;
  }[];
}

export function extractPlaylistId(input: string): string | null {
  const trimmed = input.trim();
  if (/^[a-zA-Z0-9]{22}$/.test(trimmed)) return trimmed;
  const match = trimmed.match(/playlist\/([a-zA-Z0-9]{22})/);
  return match?.[1] ?? null;
}

import { getSpotifyClientId, getSpotifyRedirectUri } from "@/lib/spotify-config";

export function buildSpotifyAuthUrl(state: string, redirectUri?: string): string {
  const clientId = getSpotifyClientId();
  if (!clientId) {
    throw new Error("SPOTIFY_NOT_CONFIGURED");
  }

  const params = new URLSearchParams({
    client_id: clientId,
    response_type: "code",
    redirect_uri: redirectUri ?? getSpotifyRedirectUri(),
    scope: SPOTIFY_SCOPES,
    state,
    show_dialog: "true",
  });
  return `${SPOTIFY_AUTH_URL}?${params.toString()}`;
}
