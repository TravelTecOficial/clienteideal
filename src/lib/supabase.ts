import { createClient, type SupabaseClient } from "@supabase/supabase-js"

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    "VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY são obrigatórios. Configure em .env"
  )
}

/** Cliente Supabase básico (sem autenticação). Não usar em rotas protegidas. */
export const supabase = createClient(supabaseUrl, supabaseAnonKey)

/** Tipo para criar cliente com token do Clerk (para RLS). */
export type GetTokenFn = () => Promise<string | null>

/**
 * Cria cliente Supabase que envia o JWT do Clerk em cada requisição.
 * Necessário para RLS funcionar com auth.uid() = Clerk user ID.
 * Use getToken({ template: 'supabase' }) se tiver template configurado no Clerk.
 */
export function createSupabaseClient(getToken: GetTokenFn): SupabaseClient {
  return createClient(supabaseUrl, supabaseAnonKey, {
    global: {
      fetch: async (url, options = {}) => {
        const token = await getToken()
        const headers = new Headers(options.headers as HeadersInit)
        if (token) {
          headers.set("Authorization", `Bearer ${token}`)
        }
        return fetch(url, { ...options, headers })
      },
    },
  })
}
