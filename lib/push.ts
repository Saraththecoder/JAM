import webpush from 'web-push';
import { createAdminClient } from '@/lib/supabase/server';

// Default VAPID keys for development fallback
const DEFAULT_VAPID_PUBLIC_KEY = 'BHQ3EcqUAHhEnZJFSFuXJa2GtNQ6MXvXKVMHmqCfaz87edOrDKAm1pJYF5KCHo9MH2PlTaJInrNQ_kiEc3Jz9AY';
const DEFAULT_VAPID_PRIVATE_KEY = 'j9rjr9aFF18O0C_ZTW21ASlxg0hGDJ-szMtYPxNl-jo';
const DEFAULT_VAPID_SUBJECT = 'mailto:admin@aits-tpt.edu.in';

const publicKey = process.env.NEXT_PUBLIC_VAPID_KEY || DEFAULT_VAPID_PUBLIC_KEY;
const privateKey = process.env.VAPID_PRIVATE_KEY || DEFAULT_VAPID_PRIVATE_KEY;
const subject = process.env.VAPID_SUBJECT || DEFAULT_VAPID_SUBJECT;

try {
  webpush.setVapidDetails(subject, publicKey, privateKey);
} catch (e) {
  console.warn('Web Push VAPID initialization warning:', e);
}

export interface PushPayload {
  title: string;
  body: string;
  url?: string;
  tag?: string;
}

export async function sendPushNotification(userId: string, payload: PushPayload) {
  try {
    const adminClient = createAdminClient();

    // 1. Fetch user's registered device push subscriptions
    const { data: subscriptions, error } = await adminClient
      .from('push_subscriptions')
      .select('id, endpoint, p256dh, auth')
      .eq('user_id', userId);

    if (error || !subscriptions || subscriptions.length === 0) {
      return { success: false, count: 0, error: 'No active push subscriptions found' };
    }

    const payloadString = JSON.stringify(payload);
    let successCount = 0;

    // 2. Dispatch push notification to each registered device
    for (const sub of subscriptions) {
      const pushSub = {
        endpoint: sub.endpoint,
        keys: {
          p256dh: sub.p256dh,
          auth: sub.auth,
        },
      };

      try {
        await webpush.sendNotification(pushSub, payloadString);
        successCount++;
      } catch (err: any) {
        console.error(`Web Push send error for sub ${sub.id}:`, err?.statusCode || err?.message);
        
        // Remove stale/expired subscriptions (404 Not Found or 410 Gone)
        if (err?.statusCode === 404 || err?.statusCode === 410) {
          await adminClient.from('push_subscriptions').delete().eq('id', sub.id);
        }
      }
    }

    return { success: true, count: successCount };
  } catch (error: any) {
    console.error('Unexpected error in sendPushNotification:', error);
    return { success: false, error: error?.message || 'Internal Server Error' };
  }
}
