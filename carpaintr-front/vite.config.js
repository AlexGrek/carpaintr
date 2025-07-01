import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { writeFileSync } from 'fs';
import path from 'path';

const appVersion = new Date().toISOString(); 

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
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
