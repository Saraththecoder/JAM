import { NextResponse, type NextRequest } from 'next/server';
import { getAppUrl, getAuth, jsonError, logError, parseJson } from '@/lib/api';
import { notifyLimiter } from '@/lib/rate-limit';
import { notifySchema } from '@/lib/validation';
import { notifyLetterEvent } from '@/lib/notifications';

export async function POST(request: NextRequest) {
  try {
    const { user } = await getAuth();
    if (!user) return jsonError('Unauthorized.', 401);

    const limit = await notifyLimiter.limit(user.id);
    if (!limit.success) {
      return jsonError('Too many notification requests. Please wait a minute and try again.', 429);
    }

    const parsed = await parseJson(request, notifySchema);
    if (!parsed.ok) return parsed.response;

    const result = await notifyLetterEvent({
      letterId: parsed.data.letterId,
      type: parsed.data.type,
      actorId: user.id,
      origin: getAppUrl(request),
    });

    if (!result.success) {
      logError('notify.route', result.error);
      return jsonError(result.error || 'Unable to send the notification.', 400);
    }

    return NextResponse.json({ success: true, pushCount: result.pushCount });
  } catch (error) {
    logError('notify.route', error);
    return jsonError('Unable to send the notification. Please try again.', 500);
  }
}
