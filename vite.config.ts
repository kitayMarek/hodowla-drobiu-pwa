import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icons/*.png', 'favicon.ico'],
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],
        runtimeCaching: [
          {
            urlPattern: /^https?:\/\//,
            handler: 'NetworkFirst',
            options: {
              cacheName: 'app-cache',
              networkTimeoutSeconds: 3,
            },
          },
        ],
      },
      manifest: {
        name: 'Hodowla Drobiu – Menadżer Farmy',
        short_name: 'Hodowla PL',
        description: 'System zarządzania hodowlą drobiu – offline-first PWA',
        theme_color: '#15803d',
        background_color: '#f0fdf4',
        display: 'standalone',
        orientation: 'any',
        lang: 'pl',
        start_url: '/',
        scope: '/',
        icons: [
          {
            src: 'icons/icon-192x192.png',
            sizes: '192x192',
            type: 'image/png',
          },
          {
            src: 'icons/icon-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any maskable',
          },
        ],
        categories: ['productivity', 'business'],
        shortcuts: [
          {
            name: 'Dashboard',
            url: '/',
            icons: [{ src: 'icons/icon-96x96.png', sizes: '96x96' }],
          },
          {
            name: 'Stada',
            url: '/stada',
            icons: [{ src: 'icons/icon-96x96.png', sizes: '96x96' }],
          },
        ],
      },
    }),
  ],
  resolve: {
    alias: {
      '@': '/src',
    },
  },
});
