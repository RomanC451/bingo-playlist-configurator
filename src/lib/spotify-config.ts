export function getSpotifyClientId(): string | undefined {
  return process.env.SPOTIFY_CLIENT_ID?.trim() || undefined;
}

export function getSpotifyClientSecret(): string | undefined {
  return process.env.SPOTIFY_CLIENT_SECRET?.trim() || undefined;
}

const DEFAULT_LOOPBACK_CALLBACK = "http://127.0.0.1:3000/api/spotify/callback";

export function getSpotifyRedirectUri(): string {
  return process.env.SPOTIFY_REDIRECT_URI?.trim() || DEFAULT_LOOPBACK_CALLBACK;
}

export function getSpotifyTeamSettingsUrl(teamId: string): string {
  try {
    const { protocol, host } = new URL(getSpotifyRedirectUri());
    return `${protocol}//${host}/teams/${teamId}/settings`;
  } catch {
    return `http://127.0.0.1:3000/teams/${teamId}/settings`;
  }
}

export function getSpotifyLinkFallbackUrl(teamId?: string): string {
  if (teamId) return getSpotifyTeamSettingsUrl(teamId);
  try {
    const { protocol, host } = new URL(getSpotifyRedirectUri());
    return `${protocol}//${host}/teams`;
  } catch {
    return "http://127.0.0.1:3000/teams";
  }
}

export function getSpotifyLoopbackLinkUrl(teamId?: string): string {
  try {
    const { protocol, host } = new URL(getSpotifyRedirectUri());
    const base = `${protocol}//${host}`;
    if (teamId) {
      return `${base}/teams/${teamId}/settings/connect-spotify`;
    }
    return `${base}/teams`;
  } catch {
    if (teamId) {
      return `http://127.0.0.1:3000/teams/${teamId}/settings/connect-spotify`;
    }
    return "http://127.0.0.1:3000/teams";
  }
}

export function isLoopbackHostname(hostname: string): boolean {
  return hostname === "127.0.0.1" || hostname === "[::1]" || hostname === "::1";
}

export function isLoopbackRedirectUri(uri: string): boolean {
  try {
    const hostname = new URL(uri).hostname;
    return isLoopbackHostname(hostname) || hostname === "localhost";
  } catch {
    return false;
  }
}

function isPrivateLanHostname(hostname: string): boolean {
  if (hostname.endsWith(".local")) return true;

  const parts = hostname.split(".").map(Number);
  if (parts.length !== 4 || parts.some((part) => Number.isNaN(part))) {
    return false;
  }

  const [a, b] = parts;
  if (a === 10) return true;
  if (a === 172 && b >= 16 && b <= 31) return true;
  if (a === 192 && b === 168) return true;
  if (a === 100 && b >= 64 && b <= 127) return true;
  return false;
}

export function isProductionHttpsOrigin(origin: string): boolean {
  try {
    const { protocol, hostname } = new URL(origin);
    return (
      protocol === "https:" &&
      !isLoopbackHostname(hostname) &&
      hostname !== "localhost" &&
      !isPrivateLanHostname(hostname)
    );
  } catch {
    return false;
  }
}

/** Resolve callback URL for the current request (HTTPS on Vercel, loopback for local dev). */
export function resolveSpotifyRedirectUri(request?: Request): string {
  const configured = process.env.SPOTIFY_REDIRECT_URI?.trim();

  if (request) {
    const origin = requestOrigin(request);
    if (isProductionHttpsOrigin(origin)) {
      if (configured?.startsWith("https://")) {
        return configured;
      }
      return `${origin}/api/spotify/callback`;
    }
  }

  if (configured) {
    return configured;
  }

  return DEFAULT_LOOPBACK_CALLBACK;
}

export function canStartSpotifyOAuthFromOrigin(
  origin: string,
  redirectUri: string,
): boolean {
  try {
    const originUrl = new URL(origin);
    const redirectUrl = new URL(redirectUri);
    const host = originUrl.hostname;

    if (isLoopbackHostname(host) || host === "localhost") {
      return isLoopbackRedirectUri(redirectUri);
    }

    return (
      originUrl.protocol === "https:" &&
      redirectUrl.origin === originUrl.origin &&
      redirectUrl.pathname === "/api/spotify/callback"
    );
  } catch {
    return false;
  }
}

export function requestOrigin(request: Request): string {
  const url = new URL(request.url);
  const forwardedHost = request.headers.get("x-forwarded-host");
  const forwardedProto = request.headers.get("x-forwarded-proto");
  if (forwardedHost) {
    const host = forwardedHost.split(",")[0]?.trim();
    if (host) {
      return `${forwardedProto ?? "http"}://${host}`;
    }
  }
  return url.origin;
}

export function originFromHeaders(headerList: Headers): string {
  const forwardedHost = headerList.get("x-forwarded-host");
  const forwardedProto = headerList.get("x-forwarded-proto");
  const host = forwardedHost?.split(",")[0]?.trim() ?? headerList.get("host");
  if (host) {
    return `${forwardedProto ?? "http"}://${host}`;
  }
  return "http://127.0.0.1:3000";
}

export function resolveSpotifyRedirectUriFromOrigin(origin: string): string {
  const configured = process.env.SPOTIFY_REDIRECT_URI?.trim();
  if (isProductionHttpsOrigin(origin)) {
    if (configured?.startsWith("https://")) {
      return configured;
    }
    return `${origin}/api/spotify/callback`;
  }
  if (configured) {
    return configured;
  }
  return DEFAULT_LOOPBACK_CALLBACK;
}

export function isSpotifyConfigured(): boolean {
  return !!(getSpotifyClientId() && getSpotifyClientSecret());
}

export function requireSpotifyConfig(): {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
} {
  const clientId = getSpotifyClientId();
  const clientSecret = getSpotifyClientSecret();
  const redirectUri = getSpotifyRedirectUri();

  if (!clientId || !clientSecret) {
    throw new Error("SPOTIFY_NOT_CONFIGURED");
  }

  return { clientId, clientSecret, redirectUri };
}
