import path from 'path'
import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react-swc'

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const supabaseUrl = env.VITE_SUPABASE_URL?.replace(/\/$/, '')
  const chatProxyUrl = supabaseUrl
    ? `${supabaseUrl}/functions/v1/chat-conhecimento-proxy-fix2`
    : null

  let chatProxy: Record<string, unknown> = {}
  try {
    if (chatProxyUrl) {
      const urlObj = new URL(chatProxyUrl)
      chatProxy = {
        '/api/chat-conhecimento': {
          target: urlObj.origin,
          changeOrigin: true,
          rewrite: () => urlObj.pathname + urlObj.search,
          secure: urlObj.protocol === 'https:',
          configure: (proxy: { on: (e: string, fn: (...args: unknown[]) => void) => void }) => {
            proxy.on('proxyReq', (proxyReq: { setHeader: (k: string, v: string) => void }, req: { headers?: { authorization?: string } }) => {
              if (req.headers?.authorization) {
                proxyReq.setHeader('Authorization', req.headers.authorization)
              }
            })
          },
        },
      }
    }
  } catch {
    console.warn('[vite] VITE_SUPABASE_URL inválida. Configure em .env para o Chat de Conhecimento funcionar em localhost.')
  }

  return {
    plugins: [react()],
    resolve: {
      alias: {
        '@': path.resolve(process.cwd(), 'src'),
      },
    },
    server: {
      port: 3000,
      open: true,
      proxy: chatProxy,
    },
  }
})