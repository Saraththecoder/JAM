import { describe, expect, it } from 'vitest';
import { createRateLimiter } from '../lib/rate-limit';

describe('rate limiter fallback', () => {
  it('allows requests up to the limit and then blocks', async () => {
    const limiter = createRateLimiter(`test-${Date.now()}`, 2, '60 s');

    expect((await limiter.limit('same-user')).success).toBe(true);
    expect((await limiter.limit('same-user')).success).toBe(true);
    expect((await limiter.limit('same-user')).success).toBe(false);
    expect((await limiter.limit('other-user')).success).toBe(true);
  });
});
