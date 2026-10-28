'use client';

/**
 * Remove this browser's push subscription before signing out. Without this,
 * the next person using a shared device could receive the previous user's
 * notifications.
 */
export async function clearPushSubscription(): Promise<void> {
  if (typeof window === 'undefined' || !('serviceWorker' in navigator)) return;

  try {
    const registration = await navigator.serviceWorker.getRegistration();
    const subscription = await registration?.pushManager.getSubscription();
    if (!subscription) return;

    await fetch('/api/push/subscribe', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ endpoint: subscription.endpoint }),
    }).catch(() => undefined);

    await subscription.unsubscribe().catch(() => undefined);
  } catch {
    // Sign-out should still succeed if the browser cannot clear the subscription.
  }
}
