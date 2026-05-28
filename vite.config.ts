import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { VueMcp } from 'vite-plugin-vue-mcp'
import { VitePWA } from 'vite-plugin-pwa'
import { fileURLToPath, URL } from 'node:url'

const base = process.env.VITE_BASE ?? '/'

export default defineConfig({
  // GitHub Pages では /braided/ がベースになる（VITE_BASE 環境変数で制御）
  base,

  plugins: [
    vue(),
    VueMcp(),
    VitePWA({
      registerType: 'autoUpdate',

      // Service Worker: アプリシェルをキャッシュ
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],
        // API 呼び出しはキャッシュしない（外部 AI サービス / ローカルサーバー）
        navigateFallback: 'index.html',
        runtimeCaching: [
          {
            // Google Fonts はキャッシュ
            urlPattern: /^https:\/\/fonts\.(googleapis|gstatic)\.com\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'google-fonts',
              expiration: { maxEntries: 10, maxAgeSeconds: 60 * 60 * 24 * 365 },
            },
          },
          {
            // AI API 呼び出しはキャッシュしない
            urlPattern: /^https:\/\/(api\.openai\.com|api\.anthropic\.com|generativelanguage\.googleapis\.com|api\.x\.ai)\/.*/i,
            handler: 'NetworkOnly',
          },
        ],
      },

      // Web App Manifest
      manifest: {
        name: 'Braided',
        short_name: 'Braided',
        description: 'Branch AI perspectives, weave the answer.',
        theme_color: '#1e1b2e',
        background_color: '#1e1b2e',
        display: 'standalone',
        orientation: 'portrait-primary',
        start_url: base,
        scope: base,
        icons: [
          { src: 'pwa-64x64.png',           sizes: '64x64',   type: 'image/png' },
          { src: 'pwa-192x192.png',          sizes: '192x192', type: 'image/png' },
          { src: 'pwa-512x512.png',          sizes: '512x512', type: 'image/png' },
          { src: 'maskable-icon-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
    }),
  ],

  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) }
  },
  server: {
    port: 5173,
    proxy: {
      '/api': { target: 'http://localhost:8765', changeOrigin: true }
    }
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true
  }
})
