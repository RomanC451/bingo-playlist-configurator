const ALLOWED_HOST_SUFFIXES = [".cdninstagram.com", ".fbcdn.net"];
const ALLOWED_HOSTS = new Set(["cdninstagram.com", "fbcdn.net"]);

function isPrivateOrLocalHostname(hostname: string): boolean {
  const host = hostname.toLowerCase();
  if (host === "localhost" || host.endsWith(".localhost") || host.endsWith(".local")) {
    return true;
  }
  if (host === "0.0.0.0" || host === "::" || host === "::1") return true;
  if (/^127\./.test(host) || /^10\./.test(host) || /^192\.168\./.test(host) || /^169\.254\./.test(host)) {
    return true;
  }
  const match172 = host.match(/^172\.(\d{1,3})\./);
  if (match172) {
    const octet = Number(match172[1]);
    if (octet >= 16 && octet <= 31) return true;
  }
  return false;
}

export function isAllowedGiveawayImageUrl(raw: string): boolean {
  try {
    const url = new URL(raw);
    if (url.protocol !== "https:") return false;
    if (url.username || url.password) return false;
    const host = url.hostname.toLowerCase();
    if (isPrivateOrLocalHostname(host)) return false;
    if (ALLOWED_HOSTS.has(host)) return true;
    return ALLOWED_HOST_SUFFIXES.some((suffix) => host.endsWith(suffix));
  } catch {
    return false;
  }
}

export function giveawayAvatarSrc(thumbnailUrl: string | null): string | null {
  if (!thumbnailUrl || !isAllowedGiveawayImageUrl(thumbnailUrl)) return null;
  return `/api/tools/giveaway/avatar?url=${encodeURIComponent(thumbnailUrl)}`;
}
