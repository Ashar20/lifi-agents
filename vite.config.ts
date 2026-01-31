import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
    const env = loadEnv(mode, '.', '');
    return {
      server: {
        port: 3000,
        host: '0.0.0.0',
      },
      plugins: [react()],
      define: {
        'import.meta.env.VITE_GEMINI_API_KEY': JSON.stringify(env.VITE_GEMINI_API_KEY),
        'import.meta.env.VITE_WALLET_CONNECT_PROJECT_ID': JSON.stringify(env.VITE_WALLET_CONNECT_PROJECT_ID),
        // Fix for buffer not defined in browser
        global: 'globalThis',
      },
      resolve: {
        alias: {
          '@': path.resolve(__dirname, '.'),
        }
      },
      optimizeDeps: {
        esbuildOptions: {
          // Node.js global to browser globalThis
          define: {
            global: 'globalThis'
          },
        }
      }
    };
});
