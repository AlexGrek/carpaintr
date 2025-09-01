import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { writeFileSync } from 'fs';
import path from 'path';
import { VitePWA } from 'vite-plugin-pwa';

const appVersion = new Date().toISOString();

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss(), VitePWA({
    registerType: 'autoUpdate',
    includeAssets: ['favicon.ico', 'apple-touch-icon.png', 'masked-icon.svg'],
    manifest: {
      name: 'Autolab',
      short_name: 'Autolab',
      description: 'Your app description here',
      theme_color: '#ffffff',
      icons: [
        {
          src: 'pwa-192x192.png',
          sizes: '192x192',
          type: 'image/png'
        },
        {
          src: 'pwa-512x512.png',
          sizes: '512x512',
          type: 'image/png'
        }
      ]
    }
  })],
  build: {
    rollupOptions: {
      plugins: [
        {
          name: 'emit-version',
          buildStart() {
            writeFileSync(
              path.resolve(__dirname, 'public/version.json'),
              JSON.stringify({ appVersion }, null, 2)
            );
          },
        },
      ],
    },
    outDir: 'dist',
  },
  define: {
    __APP_VERSION__: JSON.stringify(appVersion),
  },
  server: {
    proxy: {
      '/api': {
        target: 'http://localhost:8080',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api/, '/api')
      }
    }
  }
})
