/**
 * Token Blacklist — invalidates access tokens on logout.
 *
 * Uses an in-memory Map with TTL cleanup so revoked tokens cannot be
 * replayed within their remaining validity window.
 *
 * For multi-instance production deployments, replace with a shared
 * Redis store using the `redis` package already present in package.json.
 */

interface BlacklistEntry {
  expiresAt: number; // unix timestamp ms
}

const blacklist = new Map<string, BlacklistEntry>();

// Purge expired entries every 5 minutes to prevent memory leak
setInterval(() => {
  const now = Date.now();
  for (const [token, entry] of blacklist) {
    if (entry.expiresAt <= now) {
      blacklist.delete(token);
    }
  }
}, 5 * 60 * 1000);

/**
 * Add a token to the blacklist until it naturally expires.
 * @param token   The raw JWT access token string.
 * @param expMs   Remaining TTL in milliseconds (token exp - now).
 */
export function blacklistToken(token: string, expMs: number): void {
  if (expMs <= 0) return; // already expired — no need to track
  blacklist.set(token, { expiresAt: Date.now() + expMs });
}

/**
 * Check whether a token has been blacklisted (i.e. invalidated by logout).
 */
export function isTokenBlacklisted(token: string): boolean {
  const entry = blacklist.get(token);
  if (!entry) return false;
  if (entry.expiresAt <= Date.now()) {
    blacklist.delete(token);
    return false;
  }
  return true;
}
