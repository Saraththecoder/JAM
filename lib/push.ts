import webpush from 'web-push';
import { createAdminClient } from '@/lib/supabase/server';
import { logError, logInfo } from '@/lib/api';

const publicKey = process.env.NEXT_PUBLIC_VAPID_KEY?.trim();
const privateKey = process.env.VAPID_PRIVATE_KEY?.trim();
const subject = process.env.VAPID_SUBJECT?.trim() || 'mailto:admin@aits-tpt.edu.in';

let configured = false;

if (publicKey && privateKey) {
  try {
    webpush.setVapidDetails(subject, publicKey, privateKey);
    configured = true;
  } catch (error) {
    logError('webpush.setVapidDetails', error);
  }
} else {
  logInfo('webpush.config_disabled', { message: 'VAPID keys are not configured.' });
}

export interface PushPayload {
  title: string;
  body: string;
  url?: string;
  tag?: string;
}

export function isAllowedPushEndpoint(endpoint: string): boolean {
  try {
    const url = new URL(endpoint);
    if (url.protocol !== 'https:' || url.username || url.password) return false;

    const host = url.hostname.toLowerCase();
    return (
      host === 'fcm.googleapis.com' ||
      host === 'updates.push.services.mozilla.com' ||
      host.endsWith('.push.services.mozilla.com') ||
      host.endsWith('.notify.windows.com') ||
      host === 'web.push.apple.com' ||
      host.endsWith('.push.apple.com')
    );
  } catch {
    return false;
  }
}

function getStatusCode(error: unknown): number | undefined {
  if (typeof error === 'object' && error !== null && 'statusCode' in error) {
    const statusCode = (error as { statusCode?: unknown }).statusCode;
    return typeof statusCode === 'number' ? statusCode : undefined;
  }
  return undefined;
}

export async function sendPushNotification(userId: string, payload: PushPayload) {
  if (!configured) {
    return { success: false, count: 0, error: 'Push notifications are not configured.' };
  }

  try {
    const adminClient = createAdminClient();

    const { data: subscriptions, error } = await adminClient
      .from('push_subscriptions')
      .select('id, endpoint, p256dh, auth')
      .eq('user_id', userId);

    if (error || !subscriptions || subscriptions.length === 0) {
      return { success: false, count: 0, error: 'No active push subscriptions found.' };
    }

    const payloadString = JSON.stringify(payload);
    let successCount = 0;

    for (const sub of subscriptions) {
      if (!isAllowedPushEndpoint(sub.endpoint)) {
        await adminClient.from('push_subscriptions').delete().eq('id', sub.id);
        continue;
      }

      try {
        await webpush.sendNotification(
          {
            endpoint: sub.endpoint,
            keys: {
              p256dh: sub.p256dh,
              auth: sub.auth,
            },
          },
          payloadString
        );
        successCount += 1;
      } catch (error) {
        const statusCode = getStatusCode(error);
        logError('webpush.sendNotification', error);

        if (statusCode === 404 || statusCode === 410) {
          await adminClient.from('push_subscriptions').delete().eq('id', sub.id);
        }
      }
    }

    return { success: true, count: successCount };
  } catch (error) {
    logError('sendPushNotification', error);
    return { success: false, count: 0, error: 'Failed to send push notification.' };
  }
}
