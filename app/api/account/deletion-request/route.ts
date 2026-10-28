import { NextResponse, type NextRequest } from 'next/server';
import { createAdminClient } from '@/lib/supabase/server';
import { getAuth, getProfile, jsonError, logError, parseJson } from '@/lib/api';
import { accountDeletionLimiter } from '@/lib/rate-limit';
import { accountDeletionRequestSchema } from '@/lib/validation';
import { writeAuditLog } from '@/lib/audit';

export const dynamic = 'force-dynamic';

interface DeletionRequestRow {
  id: string;
  status: 'pending' | 'processed' | 'cancelled';
  reason: string | null;
  requested_at: string;
}

export async function GET() {
  try {
    const { user } = await getAuth();
    if (!user) return jsonError('Unauthorized.', 401);

    const admin = createAdminClient();
    const { data, error } = await admin
      .from('account_deletion_requests')
      .select('id, status, reason, requested_at')
      .eq('user_id', user.id)
      .order('requested_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) {
      logError('account.deletion-request.get', error);
      return jsonError('Unable to check your deletion request.', 500);
    }

    return NextResponse.json({ request: (data as DeletionRequestRow | null) ?? null });
  } catch (error) {
    logError('account.deletion-request.get', error);
    return jsonError('Unable to check your deletion request.', 500);
  }
}

export async function POST(request: NextRequest) {
  try {
    const { user } = await getAuth();
    if (!user) return jsonError('Unauthorized.', 401);

    const limit = await accountDeletionLimiter.limit(user.id);
    if (!limit.success) {
      return jsonError('Too many deletion requests. Please wait and try again.', 429);
    }

    const profile = await getProfile(user.id);
    if (!profile) return jsonError('Profile not found.', 404);

    const parsed = await parseJson(request, accountDeletionRequestSchema);
    if (!parsed.ok) return parsed.response;

    const admin = createAdminClient();

    const { data: existing, error: existingError } = await admin
      .from('account_deletion_requests')
      .select('id')
      .eq('user_id', user.id)
      .eq('status', 'pending')
      .maybeSingle();

    if (existingError) {
      logError('account.deletion-request.existing', existingError);
      return jsonError('Unable to create your deletion request.', 500);
    }

    if (existing) {
      return NextResponse.json({ success: true, requestId: existing.id, alreadyRequested: true });
    }

    const { data: created, error: insertError } = await admin
      .from('account_deletion_requests')
      .insert({
        user_id: user.id,
        department_id: profile.department_id,
        reason: parsed.data.reason || null,
      })
      .select('id')
      .single();

    if (insertError) {
      // A concurrent request won the unique-pending index. Treat it as success.
      if (insertError.code === '23505') {
        const { data: concurrent } = await admin
          .from('account_deletion_requests')
          .select('id')
          .eq('user_id', user.id)
          .eq('status', 'pending')
          .maybeSingle();
        if (concurrent) {
          return NextResponse.json({
            success: true,
            requestId: concurrent.id,
            alreadyRequested: true,
          });
        }
      }

      logError('account.deletion-request.insert', insertError);
      return jsonError('Unable to create your deletion request.', 500);
    }

    await writeAuditLog({
      actorId: user.id,
      action: 'account.deletion_requested',
      metadata: {
        requestId: created.id,
        departmentId: profile.department_id,
      },
    });

    return NextResponse.json({ success: true, requestId: created.id });
  } catch (error) {
    logError('account.deletion-request.post', error);
    return jsonError('Unable to create your deletion request.', 500);
  }
}
