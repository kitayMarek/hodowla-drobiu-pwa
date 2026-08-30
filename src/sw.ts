/// <reference lib="webworker" />
import { cleanupOutdatedCaches, precacheAndRoute } from 'workbox-precaching';
import { registerRoute } from 'workbox-routing';
import { NetworkFirst } from 'workbox-strategies';

declare const self: ServiceWorkerGlobalScope;
// __WB_MANIFEST jest wstrzykiwany przez vite-pwa
// eslint-disable-next-line @typescript-eslint/no-explicit-any
precacheAndRoute((self as any).__WB_MANIFEST ?? []);
cleanupOutdatedCaches();

// Natychmiastowa aktywacja nowej wersji: bez tego (registerType 'autoUpdate' +
// injectManifest) nowy SW „czeka", a stary serwuje zacachowaną, starą index.html
// → użytkownik widzi tylko statyczny fallback do pełnego reloadu. skipWaiting +
// clients.claim sprawiają, że nowy deploy przejmuje kontrolę przy najbliższej nawigacji.
self.addEventListener('install', () => { self.skipWaiting(); });
self.addEventListener('activate', (event) => { event.waitUntil(self.clients.claim()); });

// Sieć – Network First dla wszystkich żądań HTTP
registerRoute(
  ({ url }) => url.protocol.startsWith('http'),
  new NetworkFirst({
    cacheName: 'app-cache',
    networkTimeoutSeconds: 3,
    plugins: [],
  })
);

// ── Push notifications ────────────────────────────────────────────────────────

self.addEventListener('push', (event) => {
  const data = event.data?.json() ?? {};
  const title: string = data.title ?? '🐔 Fermly';
  const options: NotificationOptions & { renotify?: boolean } = {
    body:    data.body  ?? 'Pamiętaj o wpisie dziennym!',
    icon:    '/icons/icon-192x192.png',
    badge:   '/icons/icon-96x96.png',
    tag:     'daily-reminder',
    renotify: true,
    data:    { url: data.url ?? '/szybki' },
  };
  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url: string = (event.notification.data as { url?: string })?.url ?? '/szybki';
  event.waitUntil(
    (self.clients as Clients).matchAll({ type: 'window' }).then(clientList => {
      // Jeśli aplikacja jest już otwarta – skieruj do właściwego URL
      for (const client of clientList) {
        if ('navigate' in client) {
          return (client as WindowClient).navigate(url).then(c => c?.focus());
        }
      }
      // Jeśli nie – otwórz nowe okno
      return (self.clients as Clients).openWindow(url);
    })
  );
});
