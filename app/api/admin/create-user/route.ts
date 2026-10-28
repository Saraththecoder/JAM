import { NextResponse, type NextRequest } from 'next/server';
import { getAuth, getProfile, isHod, jsonError, logError, parseJson } from '@/lib/api';
import { createUserLimiter } from '@/lib/rate-limit';
import { createUserSchema } from '@/lib/validation';
import { provisionUser } from '@/lib/users';

export async function POST(request: NextRequest) {
  try {
    const { user } = await getAuth();
    if (!user) return jsonError('Unauthorized.', 401);

    const limit = await createUserLimiter.limit(user.id);
    if (!limit.success) {
      return jsonError('Too many account creation requests. Please wait a minute and try again.', 429);
    }

    const profile = await getProfile(user.id);
    if (!isHod(profile)) {
      return jsonError('Only an approved HOD can manage department accounts.', 403);
    }

    const parsed = await parseJson(request, createUserSchema);
    if (!parsed.ok) return parsed.response;

    const result = await provisionUser(parsed.data, profile);
    if (!result.success) {
      return jsonError(result.error, result.status);
    }

    return NextResponse.json({ success: true, user: result.user }, { status: 201 });
  } catch (error) {
    logError('admin.create-user', error);
    return jsonError('Unable to create the account. Please try again.', 500);
  }
}
