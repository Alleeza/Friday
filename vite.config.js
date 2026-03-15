import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const anthropicApiKey = env.ANTHROPIC_API_KEY ?? process.env.ANTHROPIC_API_KEY ?? '';
  const configureClaudeProxy = (proxy) => {
    proxy.on('proxyReq', (proxyReq) => {
      // Anthropic rejects requests that still look like direct browser CORS calls.
      proxyReq.removeHeader('origin');
      proxyReq.removeHeader('referer');
    });
  };

  return {
    plugins: [react()],
    resolve: {
      dedupe: ['react', 'react-dom'],
    },
    server: {
      proxy: {
        '/api/claude/messages': {
          target: 'https://api.anthropic.com',
          changeOrigin: true,
          rewrite: () => '/v1/messages',
          configure: configureClaudeProxy,
          headers: {
            'x-api-key': anthropicApiKey,
            'anthropic-version': '2023-06-01',
          },
        },
        '/api/claude/models': {
          target: 'https://api.anthropic.com',
          changeOrigin: true,
          rewrite: () => '/v1/models',
          configure: configureClaudeProxy,
          headers: {
            'x-api-key': anthropicApiKey,
            'anthropic-version': '2023-06-01',
          },
        },
        '/api/ollama': {
          target: 'http://127.0.0.1:11434',
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/api\/ollama/, ''),
        },
        '/api/project-state': {
          target: 'http://127.0.0.1:3001',
          changeOrigin: true,
        },
        '/api/planner-debug': {
          target: 'http://127.0.0.1:3001',
          changeOrigin: true,
        },
        '/api/published-project': {
          target: 'http://127.0.0.1:3001',
          changeOrigin: true,
        },
      },
    },
  };
});
