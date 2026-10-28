import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/server';
import { getAuth, getProfile, isHod, jsonError, logError } from '@/lib/api';

export const dynamic = 'force-dynamic';

interface RequestRow {
  id: string;
  user_id: string;
  reason: string | null;
  requested_at: string;
}

interface ProfileRow {
  id: string;
  full_name: string;
  roll_number: string | null;
  designation: string | null;
  role: 'student' | 'faculty';
}

export async function GET() {
  try {
    const { user } = await getAuth();
    if (!user) return jsonError('Unauthorized.', 401);

    const profile = await getProfile(user.id);
    if (!isHod(profile) || !profile.department_id) {
      return jsonError('Only an approved HOD can view deletion requests.', 403);
    }

    const admin = createAdminClient();
    const { data: requests, error: requestsError } = await admin
      .from('account_deletion_requests')
      .select('id, user_id, reason, requested_at')
      .eq('department_id', profile.department_id)
      .eq('status', 'pending')
      .order('requested_at', { ascending: true })
      .limit(100);

    if (requestsError) {
      logError('admin.deletion-requests.list', requestsError);
      return jsonError('Unable to load deletion requests.', 500);
    }

    const rows = (requests as RequestRow[] | null) ?? [];
    if (rows.length === 0) return NextResponse.json({ requests: [] });

    const ids = [...new Set(rows.map((row) => row.user_id))];
    const { data: profiles, error: profilesError } = await admin
      .from('profiles')
      .select('id, full_name, roll_number, designation, role')
      .in('id', ids);

    if (profilesError) {
      logError('admin.deletion-requests.profiles', profilesError);
      return jsonError('Unable to load deletion requests.', 500);
    }

    const profileMap = new Map(
      ((profiles as ProfileRow[] | null) ?? []).map((row) => [row.id, row])
    );

    return NextResponse.json({
      requests: rows.map((row) => ({
        ...row,
        profile: profileMap.get(row.user_id) ?? null,
      })),
    });
  } catch (error) {
    logError('admin.deletion-requests', error);
    return jsonError('Unable to load deletion requests.', 500);
  }
}
