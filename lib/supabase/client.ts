'use client';

import { createBrowserClient } from '@supabase/ssr';

type BrowserClient = ReturnType<typeof createBrowserClient>;

let browserClient: BrowserClient | null = null;

/**
 * Return a single browser client for the lifetime of the tab. Creating a new
 * client in every render causes effects keyed on `supabase` to loop.
 */
export const createClient = (): BrowserClient => {
  if (browserClient) return browserClient;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !key) {
    throw new Error('Supabase browser configuration is missing.');
  }

  browserClient = createBrowserClient(url, key);
  return browserClient;
};
