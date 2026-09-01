'use client';

import React, { useState, useEffect } from 'react';
import { Bell, BellOff, Loader2, Check } from 'lucide-react';

const DEFAULT_VAPID_PUBLIC_KEY = 'BHQ3EcqUAHhEnZJFSFuXJa2GtNQ6MXvXKVMHmqCfaz87edOrDKAm1pJYF5KCHo9MH2PlTaJInrNQ_kiEc3Jz9AY';

function urlBase64ToUint8Array(base64String: string) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

export default function PushNotificationToggle() {
  const [isSupported, setIsSupported] = useState<boolean>(false);
  const [isSubscribed, setIsSubscribed] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(true);
  const [statusText, setStatusText] = useState<string>('');

  useEffect(() => {
    async function checkSubscription() {
      if (typeof window === 'undefined') return;

      const supported = 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
      setIsSupported(supported);

      if (!supported) {
        setLoading(false);
        return;
      }

      try {
        const registration = await navigator.serviceWorker.register('/sw.js');
        const existingSub = await registration.pushManager.getSubscription();
        setIsSubscribed(!!existingSub);
      } catch (err) {
        console.error('Service worker subscription check error:', err);
      } finally {
        setLoading(false);
      }
    }

    checkSubscription();
  }, []);

  const handleToggle = async () => {
    if (!isSupported || loading) return;
    setLoading(true);
    setStatusText('');

    try {
      const registration = await navigator.serviceWorker.ready;

      if (isSubscribed) {
        // 1. Unsubscribe
        const existingSub = await registration.pushManager.getSubscription();
        if (existingSub) {
          await fetch('/api/push/subscribe', {
            method: 'DELETE',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ endpoint: existingSub.endpoint }),
          });
          await existingSub.unsubscribe();
        }
        setIsSubscribed(false);
        setStatusText('Notifications Disabled');
      } else {
        // 2. Request permission & Subscribe
        const permission = await Notification.requestPermission();
        if (permission !== 'granted') {
          alert('Notification permission was denied. Please allow notifications in your browser settings.');
          setLoading(false);
          return;
        }

        const vapidPublicKey = process.env.NEXT_PUBLIC_VAPID_KEY || DEFAULT_VAPID_PUBLIC_KEY;
        const convertedKey = urlBase64ToUint8Array(vapidPublicKey);

        const newSub = await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: convertedKey,
        });

        const res = await fetch('/api/push/subscribe', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ subscription: newSub }),
        });

        if (!res.ok) {
          throw new Error('Failed to save push subscription on server');
        }

        setIsSubscribed(true);
        setStatusText('Push Notifications Enabled! 🎉');
      }
    } catch (err: any) {
      console.error('Push notification toggle error:', err);
      alert(err.message || 'Could not update push notification settings.');
    } finally {
      setLoading(false);
      setTimeout(() => setStatusText(''), 3000);
    }
  };

  if (!isSupported) return null;

  return (
    <div className="relative inline-flex items-center gap-1.5">
      <button
        type="button"
        onClick={handleToggle}
        disabled={loading}
        title={isSubscribed ? 'Disable Push Notifications' : 'Enable Web Push Notifications'}
        className={`px-3 py-1.5 text-xs font-black rounded-xl border-2 border-black flex items-center gap-1.5 transition-all shadow-[2px_2px_0px_rgba(0,0,0,1)] active:translate-x-0 active:translate-y-0 active:shadow-none hover:translate-x-[-1px] hover:translate-y-[-1px] cursor-pointer ${
          isSubscribed 
            ? 'bg-neugreen text-black' 
            : 'bg-neuyellow text-black'
        }`}
      >
        {loading ? (
          <Loader2 className="w-3.5 h-3.5 animate-spin" />
        ) : isSubscribed ? (
          <>
            <Bell className="w-3.5 h-3.5 text-black fill-black" />
            <span className="hidden sm:inline">Push Active</span>
          </>
        ) : (
          <>
            <BellOff className="w-3.5 h-3.5 text-black" />
            <span className="hidden sm:inline">Enable Push</span>
          </>
        )}
      </button>

      {statusText && (
        <span className="absolute top-full mt-1.5 right-0 whitespace-nowrap bg-black text-white text-[10px] font-mono font-bold px-2.5 py-1 rounded-lg border-2 border-black shadow-[2px_2px_0px_rgba(0,0,0,1)] z-50 flex items-center gap-1 animate-fade-in">
          <Check className="w-3 h-3 text-emerald-400" /> {statusText}
        </span>
      )}
    </div>
  );
}
