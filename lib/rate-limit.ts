import { Redis } from '@upstash/redis';
import { Ratelimit } from '@upstash/ratelimit';

// Initialize single shared Redis client from environment variables
const url = process.env.UPSTASH_REDIS_REST_URL;
const token = process.env.UPSTASH_REDIS_REST_TOKEN;

export const redis = (url && token && url.trim() !== '' && token.trim() !== '')
  ? new Redis({ url, token })
  : null;

// Fallback in-memory rate limiter when Upstash Redis env variables are not yet configured
const tracker = new Map<string, { count: number; resetTime: number }>();

function fallbackRateLimit(prefix: string, key: string, limit: number, windowMs: number) {
  const compositeKey = `${prefix}:${key}`;
  const now = Date.now();
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

// Helper to create a rate limiter with Upstash sliding window (or fallback if unconfigured)
export function createRateLimiter(
  prefix: string,
  requests: number,
  window: `${number} s` | `${number} m` | `${number} h` | `${number} d` | string = '60 s'
) {
  if (!redis) {
    const windowMs = 60 * 1000;
    return {
      limit: async (identifier: string) => {
        return fallbackRateLimit(prefix, identifier, requests, windowMs);
      },
    };
  }

  return new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(requests, window as any),
    prefix,
    analytics: true,
  });
}

// Export specific limiters with isolated prefixes
export const createUserLimiter = createRateLimiter('ratelimit:create-user', 5, '60 s');
export const deleteUserLimiter = createRateLimiter('ratelimit:delete-user', 5, '60 s');
export const aiGenerationLimiter = createRateLimiter('ratelimit:ai-generation', 10, '60 s');
export const uploadSignatureLimiter = createRateLimiter('ratelimit:upload-signature', 10, '60 s');

// Legacy rateLimit export preserved for backward compatibility
export function rateLimit(ip: string, limit = 10, windowMs = 60 * 1000) {
  return fallbackRateLimit('legacy', ip, limit, windowMs);
}
