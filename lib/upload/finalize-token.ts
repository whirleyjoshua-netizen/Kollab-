import { createHmac, timingSafeEqual } from 'crypto';

const TOKEN_TTL_MS = 5 * 60 * 1000; // 5 minutes — generous for slow uploads

function secret(): string {
  const s = process.env.FINALIZE_SECRET;
  if (!s) throw new Error('FINALIZE_SECRET env var is not set');
  return s;
}

/**
 * Build a token tied to (videoId, expiry). Expiry is encoded into the
 * token so verification doesn't need server state.
 */
export function issueFinalizeToken(videoId: string): string {
  const expiry = Date.now() + TOKEN_TTL_MS;
  const payload = `${videoId}.${expiry}`;
  const sig = createHmac('sha256', secret()).update(payload).digest('hex');
  return `${expiry}.${sig}`;
}

/**
 * Verify a token issued for videoId. Returns true if signature matches
 * and expiry is in the future.
 */
export function verifyFinalizeToken(videoId: string, token: string): boolean {
  const [expiryStr, providedSig] = token.split('.');
  if (!expiryStr || !providedSig) return false;
  const expiry = Number(expiryStr);
  if (!Number.isFinite(expiry) || expiry < Date.now()) return false;

  const payload = `${videoId}.${expiry}`;
  const expectedSig = createHmac('sha256', secret()).update(payload).digest('hex');

  const a = Buffer.from(providedSig, 'hex');
  const b = Buffer.from(expectedSig, 'hex');
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}
