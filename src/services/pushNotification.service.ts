import { supabase, getAuthUser } from '@/lib/supabase';

// Klucz publiczny VAPID – wygenerowany raz dla tej aplikacji
const VAPID_PUBLIC_KEY = 'BLyyO8Ig3uL917bFnUH6hfRF3rJSqez6nv2nfziAtVD3azsyci9YKOpczWcvW41xLMfPGhQ_ZAbEx8m2JwIo5RM';

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = atob(base64);
  return Uint8Array.from([...rawData].map(char => char.charCodeAt(0)));
}

export const pushNotificationService = {
  /** Czy przeglądarka obsługuje Push API */
  isSupported(): boolean {
    return 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
  },

  /** Aktualna subskrypcja tego urządzenia w Supabase (null = brak) */
  async getSubscription(): Promise<{ remindNoon: boolean; remindEvening: boolean } | null> {
    const user = await getAuthUser();
    if (!user) return null;

    const reg = await navigator.serviceWorker.ready;
    const sub = await reg.pushManager.getSubscription();
    if (!sub) return null;

    const { data } = await supabase
      .from('push_subscriptions')
      .select('remind_noon, remind_evening')
      .eq('user_id', user.id)
      .eq('endpoint', sub.endpoint)
      .single();

    if (!data) return null;
    return { remindNoon: data.remind_noon, remindEvening: data.remind_evening };
  },

  /** Włącz powiadomienia push dla tego urządzenia */
  async subscribe(remindNoon: boolean, remindEvening: boolean): Promise<void> {
    const user = await getAuthUser();
    if (!user) throw new Error('Musisz być zalogowany');

    const permission = await Notification.requestPermission();
    if (permission !== 'granted') {
      throw new Error('Brak zgody na powiadomienia');
    }

    // Czekaj max 10 sekund na gotowość SW
    const reg = await Promise.race([
      navigator.serviceWorker.ready,
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('Service Worker nie odpowiada. Zamknij i otwórz aplikację ponownie.')), 10000)
      ),
    ]) as ServiceWorkerRegistration;
    const keyBytes = urlBase64ToUint8Array(VAPID_PUBLIC_KEY);
    const keyBuffer = keyBytes.buffer.slice(keyBytes.byteOffset, keyBytes.byteOffset + keyBytes.byteLength);
    const sub = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: new Uint8Array(keyBuffer as ArrayBuffer),
    });

    const json = sub.toJSON();
    const p256dh = json.keys?.p256dh ?? '';
    const authKey = json.keys?.auth ?? '';

    await supabase.from('push_subscriptions').upsert({
      user_id:         user.id,
      endpoint:        sub.endpoint,
      p256dh:          p256dh,
      auth_key:        authKey,
      remind_noon:     remindNoon,
      remind_evening:  remindEvening,
      timezone:        Intl.DateTimeFormat().resolvedOptions().timeZone,
    }, { onConflict: 'user_id,endpoint' });
  },

  /** Aktualizuj ustawienia (bez ponownego pytania o pozwolenie) */
  async updateSettings(remindNoon: boolean, remindEvening: boolean): Promise<void> {
    const user = await getAuthUser();
    if (!user) return;

    const reg = await navigator.serviceWorker.ready;
    const sub = await reg.pushManager.getSubscription();
    if (!sub) return;

    await supabase.from('push_subscriptions')
      .update({ remind_noon: remindNoon, remind_evening: remindEvening })
      .eq('user_id', user.id)
      .eq('endpoint', sub.endpoint);
  },

  /** Wyłącz powiadomienia – usuwa subskrypcję z Supabase i przeglądarki */
  async unsubscribe(): Promise<void> {
    const user = await getAuthUser();
    const reg = await navigator.serviceWorker.ready;
    const sub = await reg.pushManager.getSubscription();

    if (sub) {
      if (user) {
        await supabase.from('push_subscriptions')
          .delete()
          .eq('user_id', user.id)
          .eq('endpoint', sub.endpoint);
      }
      await sub.unsubscribe();
    }
  },
};
