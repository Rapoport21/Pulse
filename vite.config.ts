import path from 'path';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(() => {
    // Default to relative so the bundle works for Capacitor (WKWebView) and
    // any static host. GH Pages CI explicitly sets VITE_BASE=/Pulse/ to keep
    // deployment absolute at https://rapoport21.github.io/Pulse/. Vercel
    // sets VITE_BASE=/ (see vercel.json) so assets resolve from root.
    const base = process.env.VITE_BASE ?? './';
    return {
      base,
      server: {
        port: 3000,
        host: '0.0.0.0',
      },
      plugins: [react()],
      // NOTE: the previous define() block that inlined the Gemini API
      // key into the client bundle has been removed. The key is now
      // server-only (api/gemini.ts reads process.env.GEMINI_API_KEY at
      // runtime on Vercel). Nothing Gemini-related is shipped to the
      // browser anymore — see lib/gemini.ts.
      resolve: {
        alias: {
          '@': path.resolve(__dirname, '.'),
        }
      }
    };
});
