import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],

  build: {
    target: 'es2020',
    // Option 1: Use esbuild (faster, good compression)
    minify: 'esbuild',

    // Option 2: Use terser (slower, slightly better compression)
    // minify: 'terser', // Requires: npm install -D terser

    rollupOptions: {
      output: {
        // Aggressive code splitting for faster initial loads
        manualChunks: (id) => {
          // Vendor chunks
          if (id.includes('node_modules')) {
            if (id.includes('react') || id.includes('react-dom')) {
              return 'react-vendor'
            }
            if (id.includes('router')) {
              return 'router'
            }
            if (id.includes('ui') || id.includes('component')) {
              return 'ui-vendor'
            }
            return 'vendor'
          }

          // Feature-based chunks
          if (id.includes('/components/')) {
            return 'components'
          }
          if (id.includes('/hooks/')) {
            return 'hooks'
          }
          if (id.includes('/utils/')) {
            return 'utils'
          }
        }
      }
    },
    esbuild: {
      drop: ['console', 'debugger'],
      legalComments: 'none',
    }
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
