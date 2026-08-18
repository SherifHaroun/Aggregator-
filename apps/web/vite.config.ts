import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath, URL } from 'node:url';
import { defineConfig } from 'vite';


const API_TARGET = 'http://localhost:4000';

/**
 * When the API process is not running, the dev proxy answers with a plain-text
 * 500 that the client cannot parse. Reply with the same `ApiResponse` envelope
 * the real API uses instead, so the UI shows a clear, accurate message rather
 * than failing on an unreadable body.
 */
function apiUnreachableAsJson(proxy: { on: (event: string, handler: never) => void }) {
  (proxy.on as unknown as (event: string, handler: (err: Error, req: unknown, res: unknown) => void) => void)(
    'error',
    (error, _req, res) => {
      const response = res as {
        writableEnded?: boolean;
        writeHead?: (status: number, headers: Record<string, string>) => void;
        end?: (body: string) => void;
      };
      if (!response?.writeHead || response.writableEnded) return;
      // eslint-disable-next-line no-console
      console.error(`[vite-proxy] ${API_TARGET} unreachable: ${error.message}`);
      response.writeHead(503, { 'Content-Type': 'application/json' });
      response.end?.(
        JSON.stringify({
          ok: false,
          error: {
            code: 'API_UNREACHABLE',
            message:
              'The API server is not running. Start it with "npm run dev" from the repository root.',
          },
        }),
      );
    },
  );
}

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  server: {
    port: 5173,
    proxy: {
      // The client calls /api/... on its own origin; Vite forwards to the API.
      '/api': {
        target: API_TARGET,
        changeOrigin: true,
        configure: apiUnreachableAsJson,
      },
      // Uploaded company logos are served by the API.
      '/uploads': {
        target: API_TARGET,
        changeOrigin: true,
        configure: apiUnreachableAsJson,
      },
    },
  },
});
