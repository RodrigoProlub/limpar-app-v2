import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['logo.jpeg', 'apple-touch-icon.png'],
      manifest: {
        name: 'LimpAr Auto - Gestão Comercial',
        short_name: 'LimpAr Auto',
        description: 'Sistema de gestão comercial e carteira de visitas da LimpAr Auto',
        theme_color: '#14181F',
        background_color: '#14181F',
        display: 'standalone',
        start_url: '/',
        icons: [
          { src: '/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: '/icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: '/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        // cacheia a casca do app para abrir mais rapido e funcionar offline
        // para navegacao basica; dados do Supabase continuam exigindo internet.
        globPatterns: ['**/*.{js,css,html,png,jpeg,svg,ico}'],
      },
    }),
  ],
})
