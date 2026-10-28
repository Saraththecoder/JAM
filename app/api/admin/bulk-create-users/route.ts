import { NextResponse, type NextRequest } from 'next/server';
import { getAuth, getProfile, isHod, jsonError, logError, parseJson } from '@/lib/api';
import { bulkCreateUsersLimiter } from '@/lib/rate-limit';
import { bulkCreateUsersSchema } from '@/lib/validation';
import { provisionUser } from '@/lib/users';

export async function POST(request: NextRequest) {
  try {
    const { user } = await getAuth();
    if (!user) return jsonError('Unauthorized.', 401);

    const limit = await bulkCreateUsersLimiter.limit(user.id);
    if (!limit.success) {
      return jsonError('Too many bulk imports. Please wait a minute and try again.', 429);
    }

    const profile = await getProfile(user.id);
    if (!isHod(profile)) {
      return jsonError('Only an approved HOD can import department accounts.', 403);
    }

    const parsed = await parseJson(request, bulkCreateUsersSchema);
    if (!parsed.ok) return parsed.response;

    const created: Array<{ index: number; id: string; email: string }> = [];
    const failed: Array<{ index: number; error: string }> = [];

    for (const [index, entry] of parsed.data.users.entries()) {
      const result = await provisionUser(entry, profile);
      if (result.success) {
        created.push({ index, id: result.user.id, email: result.user.email });
      } else {
        failed.push({ index, error: result.error });
      }
    }

    return NextResponse.json({
      success: failed.length === 0,
      created,
      failed,
      total: parsed.data.users.length,
    });
  } catch (error) {
    logError('admin.bulk-create-users', error);
    return jsonError('Unable to complete the bulk import. Please try again.', 500);
  }
}
