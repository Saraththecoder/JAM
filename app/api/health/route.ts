import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/server';
import { logError } from '@/lib/api';

export const dynamic = 'force-dynamic';

export async function GET() {
  let database: 'ok' | 'unavailable' = 'unavailable';

  try {
    const admin = createAdminClient();
    const [profileCheck, auditCheck] = await Promise.all([
      admin.from('profiles').select('is_hod').limit(1),
      admin.from('letter_audit_log').select('id').limit(1),
    ]);
    if (profileCheck.error) logError('health.profiles', profileCheck.error);
    if (auditCheck.error) logError('health.audit', auditCheck.error);
    if (!profileCheck.error && !auditCheck.error) database = 'ok';
  } catch (error) {
    logError('health.database', error);
  }

  const status = database === 'ok' ? 'ok' : 'degraded';

  return NextResponse.json(
    {
      status,
      timestamp: new Date().toISOString(),
      checks: {
        database,
        emailConfigured: Boolean(process.env.RESEND_API_KEY),
        pushConfigured: Boolean(process.env.NEXT_PUBLIC_VAPID_KEY && process.env.VAPID_PRIVATE_KEY),
        rateLimitConfigured: Boolean(
          process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN
        ),
        appUrlConfigured: Boolean(process.env.NEXT_PUBLIC_APP_URL),
      },
    },
    {
      status: database === 'ok' ? 200 : 503,
      headers: { 'Cache-Control': 'no-store' },
    }
  );
}
