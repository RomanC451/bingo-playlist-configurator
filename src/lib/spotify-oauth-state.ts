import { createHmac, randomBytes, timingSafeEqual } from "crypto";

const STATE_TTL_MS = 10 * 60 * 1000;

function getSecret(): string {
  const secret = process.env.AUTH_SECRET;
  if (!secret) throw new Error("AUTH_SECRET must be set");
  return secret;
}

function sign(payload: string): string {
  return createHmac("sha256", getSecret()).update(payload).digest("base64url");
}

export function createSpotifyOAuthState(userId: string, redirectUri: string): string {
  const payload = Buffer.from(
    JSON.stringify({
      userId,
      redirectUri,
      expires: Date.now() + STATE_TTL_MS,
      nonce: randomBytes(16).toString("hex"),
    }),
  ).toString("base64url");

  return `${payload}.${sign(payload)}`;
}

export function verifySpotifyOAuthState(
  state: string,
): { userId: string; redirectUri: string } | null {
  const dotIndex = state.lastIndexOf(".");
  if (dotIndex === -1) return null;

  const payload = state.slice(0, dotIndex);
  const signature = state.slice(dotIndex + 1);
  const expected = sign(payload);

  try {
    const sigBuf = Buffer.from(signature);
    const expectedBuf = Buffer.from(expected);
    if (sigBuf.length !== expectedBuf.length) return null;
    if (!timingSafeEqual(sigBuf, expectedBuf)) return null;
  } catch {
    return null;
  }

  try {
    const data = JSON.parse(Buffer.from(payload, "base64url").toString()) as {
      userId?: string;
      redirectUri?: string;
      expires?: number;
    };
    if (!data.userId || !data.redirectUri || !data.expires || Date.now() > data.expires) {
      return null;
    }
    return { userId: data.userId, redirectUri: data.redirectUri };
  } catch {
    return null;
  }
}
