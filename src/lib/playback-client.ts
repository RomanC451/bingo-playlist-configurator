import {
  errorMessageFromBody,
  externalErrorFromBody,
  rateLimitWaitTime,
} from "@/lib/api-errors";
import { errorToast } from "@/lib/error-toast";

let rateLimitedUntil = 0;

export function isPlaybackRateLimited() {
  return Date.now() < rateLimitedUntil;
}

export function applyPlaybackRateLimit(retryAfterSeconds?: number) {
  const waitMs = (retryAfterSeconds ?? 30) * 1000;
  rateLimitedUntil = Date.now() + waitMs;
}

function showRateLimitToast(body: unknown) {
  const wait = rateLimitWaitTime(body);
  errorToast(
    "Too many requests",
    wait === "Try again later" ? wait : `Try again in ${wait}`,
  );
}

/** Handle a failed playback API response. Optionally shows a toast. */
export function reportPlaybackError(
  res: Response,
  body: unknown,
  fallback: string,
  options?: { toast?: boolean },
): string {
  const message = errorMessageFromBody(body, fallback);

  if (res.status === 429) {
    applyPlaybackRateLimit(externalErrorFromBody(body)?.retryAfterSeconds);
    if (options?.toast !== false) {
      showRateLimitToast(body);
    }
    return message;
  }

  if (options?.toast !== false) {
    errorToast(message);
  }

  return message;
}
