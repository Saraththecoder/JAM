import { Redis } from '@upstash/redis';
import { Ratelimit } from '@upstash/ratelimit';

const url = process.env.UPSTASH_REDIS_REST_URL;
const token = process.env.UPSTASH_REDIS_REST_TOKEN;

export const redis =
  url && token && url.trim() !== '' && token.trim() !== ''
    ? new Redis({ url, token })
    : null;

if (!redis && process.env.NODE_ENV === 'production') {
  console.warn(
    JSON.stringify({
      level: 'warn',
      context: 'rate-limit.config',
      message:
        'UPSTASH_REDIS_REST_URL/TOKEN are missing. Using a process-local fallback; this is not reliable across serverless instances.',
      timestamp: new Date().toISOString(),
    })
  );
}

export interface RateLimitResult {
  success: boolean;
  remaining: number;
  reset: number;
}

interface Bucket {
  count: number;
  resetTime: number;
}

// Bounded in-memory fallback for local development. It is intentionally
// cleared periodically and is not a substitute for Upstash in production.
const tracker = new Map<string, Bucket>();
const MAX_TRACKER_ENTRIES = 10_000;
let lastSweep = 0;

function sweep(now: number): void {
  if (now - lastSweep < 60_000 && tracker.size < MAX_TRACKER_ENTRIES) return;
  lastSweep = now;

  for (const [key, bucket] of tracker) {
    if (now > bucket.resetTime) tracker.delete(key);
  }

  if (tracker.size >= MAX_TRACKER_ENTRIES) {
    const oldestKey = tracker.keys().next().value;
    if (oldestKey) tracker.delete(oldestKey);
  }
}

function fallbackRateLimit(
  prefix: string,
  key: string,
  limit: number,
  windowMs: number
): RateLimitResult {
  const now = Date.now();
  sweep(now);

  const compositeKey = `${prefix}:${key}`;
  const record = tracker.get(compositeKey);

  if (!record || now > record.resetTime) {
    tracker.set(compositeKey, { count: 1, resetTime: now + windowMs });
    return { success: true, remaining: limit - 1, reset: now + windowMs };
  }

  if (record.count >= limit) {
    return { success: false, remaining: 0, reset: record.resetTime };
  }

  record.count += 1;
  return { success: true, remaining: limit - record.count, reset: record.resetTime };
}

function parseWindow(window: string): number {
  const match = /^(\d+)\s*(s|m|h|d)$/.exec(window.trim());
  if (!match) return 60_000;

  const amount = Number(match[1]);
  const unit = match[2];
  const multipliers: Record<string, number> = {
    s: 1000,
    m: 60_000,
    h: 3_600_000,
    d: 86_400_000,
  };
  return amount * multipliers[unit];
}

export function createRateLimiter(
  prefix: string,
  requests: number,
  window: `${number} s` | `${number} m` | `${number} h` | `${number} d` = '60 s'
) {
  const windowMs = parseWindow(window);

  if (!redis) {
    return {
      limit: async (identifier: string): Promise<RateLimitResult> =>
        fallbackRateLimit(prefix, identifier, requests, windowMs),
    };
  }

  return new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(requests, window),
    prefix,
    analytics: true,
  });
}

export const createLetterLimiter = createRateLimiter('ratelimit:create-letter', 10, '60 s');
export const createUserLimiter = createRateLimiter('ratelimit:create-user', 10, '60 s');
export const bulkCreateUsersLimiter = createRateLimiter('ratelimit:bulk-create-users', 3, '60 s');
export const deleteUserLimiter = createRateLimiter('ratelimit:delete-user', 5, '60 s');
export const accountDeletionLimiter = createRateLimiter('ratelimit:account-deletion', 3, '1 h');
export const aiGenerationLimiter = createRateLimiter('ratelimit:ai-generation', 10, '60 s');
export const uploadSignatureLimiter = createRateLimiter('ratelimit:upload-signature', 10, '60 s');
export const letterActionLimiter = createRateLimiter('ratelimit:letter-action', 20, '60 s');
export const approveLetterLimiter = createRateLimiter('ratelimit:approve-letter', 10, '60 s');
export const notifyLimiter = createRateLimiter('ratelimit:notify', 15, '60 s');
export const downloadLetterLimiter = createRateLimiter('ratelimit:download-letter', 20, '60 s');
export const pushSubscriptionLimiter = createRateLimiter('ratelimit:push-subscription', 10, '60 s');
export const generalApiLimiter = createRateLimiter('ratelimit:general-api', 30, '60 s');

/**
 * @deprecated Use a named limiter instead. Kept as an async wrapper so
 * callers cannot accidentally rely on process-local state in production.
 */
export async function rateLimit(
  ip: string,
  limit = 10,
  windowMs = 60_000
): Promise<RateLimitResult> {
  return fallbackRateLimit('legacy', ip, limit, windowMs);
}
