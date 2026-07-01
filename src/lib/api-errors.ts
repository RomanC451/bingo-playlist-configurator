import { NextResponse } from "next/server";
import type { SpotifyApiError } from "@/lib/spotify";

export type ApiErrorSource = "internal" | "spotify";

export type ExternalService = "spotify";

export interface ApiErrorPayload {
  error: string;
  source: ApiErrorSource;
  /** Set when `source` is an external integration. */
  service?: ExternalService;
  /** Raw upstream message when available. */
  detail?: string;
  /** HTTP status returned by the external service. */
  upstreamStatus?: number;
  /** From Spotify Retry-After header (seconds). */
  retryAfterSeconds?: number;
  /** When Spotify rate limiting ends (approximate). */
  retryAt?: string;
}

export function apiErrorJson(
  payload: ApiErrorPayload,
  status: number,
): NextResponse<ApiErrorPayload> {
  return NextResponse.json(payload, { status });
}

export function internalError(message: string, status = 500): NextResponse<ApiErrorPayload> {
  return apiErrorJson({ error: message, source: "internal" }, status);
}

export function formatRetryAfterSeconds(seconds?: number): string | null {
  if (seconds == null || seconds <= 0) return null;
  if (seconds < 90) return `${seconds} seconds`;

  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);

  if (hours > 0 && minutes > 0) return `${hours}h ${minutes}m`;
  if (hours > 0) return `${hours} hour${hours === 1 ? "" : "s"}`;
  return `${minutes} minute${minutes === 1 ? "" : "s"}`;
}

/** How long to wait until a Spotify rate limit resets (for toasts). */
export function rateLimitWaitTime(data: unknown): string {
  const external = externalErrorFromBody(data);

  const fromSeconds = formatRetryAfterSeconds(external?.retryAfterSeconds);
  if (fromSeconds) {
    return fromSeconds;
  }

  if (external?.retryAt) {
    const remainingMs = new Date(external.retryAt).getTime() - Date.now();
    if (!Number.isNaN(remainingMs) && remainingMs > 0) {
      return formatRetryAfterSeconds(Math.ceil(remainingMs / 1000)) ?? "Try again later";
    }
  }

  return "Try again later";
}

function spotifyFriendlyMessage(err: SpotifyApiError): string {
  if (err.message === "playlist_access_denied") {
    return "Only playlists you created or collaborate on can be imported. Spotify editorial playlists and other users' playlists are not available in development mode.";
  }
  if (err.status === 404) {
    return err.message.includes("device")
      ? err.message
      : "No active Spotify device. Open Spotify on a device and try again.";
  }
  if (err.status === 403) {
    return "Playback control denied. Ensure Spotify Premium and an active device.";
  }
  if (err.status === 429) {
    const wait = formatRetryAfterSeconds(err.retryAfterSeconds);
    const waitHint = wait
      ? `Try again in about ${wait}.`
      : "Try again later.";
    return `Spotify rate limit exceeded — too many API requests were sent in a short time. ${waitHint} Leave the page idle; repeated requests can extend the block.`;
  }
  return err.detail ?? err.message;
}

export function spotifyErrorResponse(err: SpotifyApiError): NextResponse<ApiErrorPayload> {
  const retryAt =
    err.retryAfterSeconds != null
      ? new Date(Date.now() + err.retryAfterSeconds * 1000).toISOString()
      : undefined;

  return apiErrorJson(
    {
      error: spotifyFriendlyMessage(err),
      source: "spotify",
      service: "spotify",
      detail: err.detail ?? err.message,
      upstreamStatus: err.status,
      retryAfterSeconds: err.retryAfterSeconds,
      retryAt,
    },
    err.status,
  );
}

export function isApiErrorPayload(value: unknown): value is ApiErrorPayload {
  if (!value || typeof value !== "object") return false;
  const record = value as Record<string, unknown>;
  return typeof record.error === "string" && typeof record.source === "string";
}

export function formatApiErrorMessage(payload: Partial<ApiErrorPayload>, fallback = "Request failed"): string {
  if (!payload.error) return fallback;

  if (payload.source === "spotify") {
    return payload.error.startsWith("Spotify") ? payload.error : `Spotify: ${payload.error}`;
  }

  return payload.error;
}

export function errorMessageFromBody(data: unknown, fallback = "Request failed"): string {
  if (isApiErrorPayload(data)) {
    return formatApiErrorMessage(data, fallback);
  }
  if (data && typeof data === "object" && typeof (data as { error?: unknown }).error === "string") {
    return (data as { error: string }).error;
  }
  return fallback;
}

export function externalErrorFromBody(data: unknown): ApiErrorPayload | null {
  if (!isApiErrorPayload(data)) return null;
  if (data.source === "spotify") return data;
  return null;
}
