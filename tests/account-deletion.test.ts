import { describe, expect, it } from 'vitest';
import { accountDeletionRequestSchema } from '../lib/validation';

describe('accountDeletionRequestSchema', () => {
  it('accepts an empty request', () => {
    expect(accountDeletionRequestSchema.safeParse({}).success).toBe(true);
  });

  it('trims and accepts a short reason', () => {
    const parsed = accountDeletionRequestSchema.parse({ reason: '  Leaving the college.  ' });
    expect(parsed.reason).toBe('Leaving the college.');
  });

  it('rejects an oversized reason', () => {
    expect(accountDeletionRequestSchema.safeParse({ reason: 'x'.repeat(1001) }).success).toBe(false);
  });
});
