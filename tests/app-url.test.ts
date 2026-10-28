import { afterEach, describe, expect, it } from 'vitest';
import { getConfiguredAppUrl } from '../lib/app-url';

describe('getConfiguredAppUrl', () => {
  const originalAppUrl = process.env.NEXT_PUBLIC_APP_URL;
  const originalProductionUrl = process.env.VERCEL_PROJECT_PRODUCTION_URL;
  const originalVercelUrl = process.env.VERCEL_URL;

  afterEach(() => {
    if (originalAppUrl === undefined) delete process.env.NEXT_PUBLIC_APP_URL;
    else process.env.NEXT_PUBLIC_APP_URL = originalAppUrl;
    if (originalProductionUrl === undefined) delete process.env.VERCEL_PROJECT_PRODUCTION_URL;
    else process.env.VERCEL_PROJECT_PRODUCTION_URL = originalProductionUrl;
    if (originalVercelUrl === undefined) delete process.env.VERCEL_URL;
    else process.env.VERCEL_URL = originalVercelUrl;
  });

  it('prefers the explicit app URL and strips a trailing slash', () => {
    process.env.NEXT_PUBLIC_APP_URL = 'https://justaminuteaits.vercel.app/';
    delete process.env.VERCEL_PROJECT_PRODUCTION_URL;
    delete process.env.VERCEL_URL;
    expect(getConfiguredAppUrl()).toBe('https://justaminuteaits.vercel.app');
  });

  it('falls back to the Vercel production domain', () => {
    delete process.env.NEXT_PUBLIC_APP_URL;
    process.env.VERCEL_PROJECT_PRODUCTION_URL = 'justaminuteaits.vercel.app';
    delete process.env.VERCEL_URL;
    expect(getConfiguredAppUrl()).toBe('https://justaminuteaits.vercel.app');
  });

  it('returns null when no configured URL is available', () => {
    delete process.env.NEXT_PUBLIC_APP_URL;
    delete process.env.VERCEL_PROJECT_PRODUCTION_URL;
    delete process.env.VERCEL_URL;
    expect(getConfiguredAppUrl()).toBeNull();
  });
});
