/**
 * Returns the canonical public URL for the app.
 *
 * `NEXT_PUBLIC_APP_URL` is the explicit override. On Vercel,
 * `VERCEL_PROJECT_PRODUCTION_URL` is available automatically and points at the
 * production domain, so the app still generates correct links when the explicit
 * variable has not been configured yet.
 */
export function getConfiguredAppUrl(): string | null {
  const explicit = process.env.NEXT_PUBLIC_APP_URL?.trim();
  if (explicit) {
    try {
      return new URL(explicit).origin;
    } catch {
      return null;
    }
  }

  const vercelHost =
    process.env.VERCEL_PROJECT_PRODUCTION_URL?.trim() || process.env.VERCEL_URL?.trim();
  if (!vercelHost) return null;

  try {
    const url = vercelHost.startsWith('http') ? vercelHost : `https://${vercelHost}`;
    return new URL(url).origin;
  } catch {
    return null;
  }
}
