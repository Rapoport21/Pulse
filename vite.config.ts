import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
    const env = loadEnv(mode, '.', '');
    // Default to relative so the bundle works for Capacitor (WKWebView) and
    // any static host. GH Pages CI explicitly sets VITE_BASE=/Pulse/ to keep
    // deployment absolute at https://rapoport21.github.io/Pulse/.
    const base = process.env.VITE_BASE ?? './';
    return {
      base,
      server: {
        port: 3000,
        host: '0.0.0.0',
      },
      plugins: [react()],
      define: {
        // Legacy fallbacks — kept for any third-party code still reading process.env.
        // App code should prefer import.meta.env.VITE_GEMINI_API_KEY.
        'process.env.API_KEY': JSON.stringify(
          env.VITE_GEMINI_API_KEY || env.GEMINI_API_KEY || ''
        ),
        'process.env.GEMINI_API_KEY': JSON.stringify(
          env.VITE_GEMINI_API_KEY || env.GEMINI_API_KEY || ''
        ),
      },
      resolve: {
        alias: {
          '@': path.resolve(__dirname, '.'),
        }
      }
    };
});
