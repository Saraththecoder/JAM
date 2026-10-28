import { NextResponse, type NextRequest } from 'next/server';
import { createAdminClient } from '@/lib/supabase/server';
import { getAuth, jsonError, logError, parseJson } from '@/lib/api';
import { pushSubscriptionLimiter } from '@/lib/rate-limit';
import { pushSubscribeSchema, pushUnsubscribeSchema } from '@/lib/validation';
import { isAllowedPushEndpoint } from '@/lib/push';

export async function POST(request: NextRequest) {
  try {
    const { user } = await getAuth();
    if (!user) return jsonError('Unauthorized.', 401);

    const limit = await pushSubscriptionLimiter.limit(user.id);
    if (!limit.success) {
      return jsonError('Too many push subscription requests. Please wait a minute and try again.', 429);
    }

    const parsed = await parseJson(request, pushSubscribeSchema);
    if (!parsed.ok) return parsed.response;

    const { endpoint, keys } = parsed.data.subscription;
    if (!isAllowedPushEndpoint(endpoint)) {
      return jsonError('Unsupported push service endpoint.', 400);
    }

    const admin = createAdminClient();
    const { data: existing, error: lookupError } = await admin
      .from('push_subscriptions')
      .select('user_id')
      .eq('endpoint', endpoint)
      .maybeSingle();

    if (lookupError) {
      logError('push.subscribe.lookup', lookupError);
      return jsonError('Unable to save the subscription. Please try again.', 500);
    }

    if (existing) {
      if (existing.user_id !== user.id) {
        return jsonError('This push subscription is already registered to another account.', 409);
      }

      const { error: updateError } = await admin
        .from('push_subscriptions')
        .update({ p256dh: keys.p256dh, auth: keys.auth })
        .eq('user_id', user.id)
        .eq('endpoint', endpoint);

      if (updateError) {
        logError('push.subscribe.update', updateError);
        return jsonError('Unable to save the subscription. Please try again.', 500);
      }
    } else {
      const { error: insertError } = await admin.from('push_subscriptions').insert({
        user_id: user.id,
        endpoint,
        p256dh: keys.p256dh,
        auth: keys.auth,
      });

      if (insertError) {
        logError('push.subscribe.insert', insertError);
        return jsonError('Unable to save the subscription. Please try again.', 500);
      }
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    logError('push.subscribe', error);
    return jsonError('Unable to save the subscription. Please try again.', 500);
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { user } = await getAuth();
    if (!user) return jsonError('Unauthorized.', 401);

    const limit = await pushSubscriptionLimiter.limit(user.id);
    if (!limit.success) {
      return jsonError('Too many push subscription requests. Please wait a minute and try again.', 429);
    }

    const parsed = await parseJson(request, pushUnsubscribeSchema);
    if (!parsed.ok) return parsed.response;

    const admin = createAdminClient();
    const { error: dbError } = await admin
      .from('push_subscriptions')
      .delete()
      .eq('user_id', user.id)
      .eq('endpoint', parsed.data.endpoint);

    if (dbError) {
      logError('push.unsubscribe', dbError);
      return jsonError('Unable to remove the subscription. Please try again.', 500);
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    logError('push.unsubscribe', error);
    return jsonError('Unable to remove the subscription. Please try again.', 500);
  }
}
