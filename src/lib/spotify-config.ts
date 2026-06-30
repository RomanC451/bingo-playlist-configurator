export function getSpotifyClientId(): string | undefined {
  return process.env.SPOTIFY_CLIENT_ID?.trim() || undefined;
}

export function getSpotifyClientSecret(): string | undefined {
  return process.env.SPOTIFY_CLIENT_SECRET?.trim() || undefined;
}

export function getSpotifyRedirectUri(): string {
  return (
    process.env.SPOTIFY_REDIRECT_URI?.trim() ||
    "http://127.0.0.1:3000/api/spotify/callback"
  );
}

export function isLoopbackHostname(hostname: string): boolean {
  return hostname === "127.0.0.1" || hostname === "[::1]" || hostname === "::1";
}

export function isLoopbackRedirectUri(uri: string): boolean {
  try {
    return isLoopbackHostname(new URL(uri).hostname);
  } catch {
    return false;
  }
}

/** Spotify only allows HTTP redirect URIs on loopback — never LAN/VPN IPs like 100.x */
export function resolveSpotifyRedirectUri(): string {
  const configured = getSpotifyRedirectUri();
  if (isLoopbackRedirectUri(configured)) {
    return configured;
  }
  return "http://127.0.0.1:3000/api/spotify/callback";
}

export function canStartSpotifyOAuthFromOrigin(origin: string): boolean {
  try {
    const host = new URL(origin).hostname;
    return isLoopbackHostname(host) || host === "localhost";
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
