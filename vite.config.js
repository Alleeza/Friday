import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      // Proxy /api/claude → Anthropic API so the API key stays server-side.
      // Set ANTHROPIC_API_KEY in .env.local (never commit this file).
      '/api/claude': {
        target: 'https://api.anthropic.com',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/claude/, '/v1/messages'),
        headers: {
          'x-api-key': process.env.ANTHROPIC_API_KEY ?? '',
          'anthropic-version': '2023-06-01',
        },
      },
      // Proxy /api/ollama → local Ollama server to avoid browser CORS issues.
      '/api/ollama': {
        target: 'http://127.0.0.1:11434',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/ollama/, ''),
      },
      '/api/project-state': {
        target: 'http://127.0.0.1:3001',
        changeOrigin: true,
      },
    },
  },
});
