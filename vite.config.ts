import path from 'path'
import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react-swc'

const DEFAULT_CHAT_WEBHOOK_URL = 'https://jobs.traveltec.com.br/webhook/consulta-chat'

/** Plugin que faz proxy de POST /api/chat-conhecimento para o webhook n8n (evita CORS e problemas com proxy padrão em POST) */
function chatProxyPlugin(chatWebhookUrl: string) {
  return {
    name: 'chat-proxy',
    enforce: 'pre', // Roda antes do core do Vite para interceptar POST antes do HTML fallback
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        if (req.url !== '/api/chat-conhecimento' && !req.url?.startsWith('/api/chat-conhecimento?')) return next()
        if (req.method !== 'POST') return next()
        const chunks: Buffer[] = []
        req.on('data', (chunk) => chunks.push(chunk))
        req.on('end', async () => {
          try {
            const body = Buffer.concat(chunks).toString()
            const auth = req.headers.authorization ?? ''
            const proxyRes = await fetch(chatWebhookUrl, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': auth,
              },
              body,
            })
            const data = await proxyRes.text()
            res.writeHead(proxyRes.status, {
              'Content-Type': proxyRes.headers.get('Content-Type') ?? 'application/json',
            })
            res.end(data)
          } catch (err) {
            console.error('[chat-proxy] Erro:', err)
            res.writeHead(502, { 'Content-Type': 'application/json' })
            res.end(JSON.stringify({ error: 'Proxy failed' }))
          }
        })
      })
    },
  }
}

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const chatWebhookUrl =
    env.N8N_CHAT_WEBHOOK_URL || env.VITE_N8N_CHAT_WEBHOOK_URL || DEFAULT_CHAT_WEBHOOK_URL

  return {
    plugins: [react(), chatProxyPlugin(chatWebhookUrl)],
    resolve: {
      alias: {
        '@': path.resolve(process.cwd(), 'src'),
      },
    },
    server: {
      port: 3000, // Define a porta fixa como 3000
      open: true, // Dica extra: isso abre o navegador automaticamente ao rodar o comando
    },
  }
})