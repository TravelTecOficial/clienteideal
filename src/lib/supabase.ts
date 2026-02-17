import { createClient, type SupabaseClient } from "@supabase/supabase-js"

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    "VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY são obrigatórios. Configure em .env"
  )
}

/** URL do projeto Supabase (para chamadas diretas a Edge Functions). */
export const SUPABASE_URL = supabaseUrl

/** Chave anon do Supabase (para invocar Edge Functions sem JWT de usuário no header). */
export const SUPABASE_ANON_KEY = supabaseAnonKey

/** Tipo para criar cliente com token do Clerk (para RLS). */
export type GetTokenFn = () => Promise<string | null>

/**
 * Cria cliente Supabase que injeta o JWT do Clerk em cada requisição.
 * O token (template "supabase") é enviado em Authorization: Bearer <jwt>.
 * RLS policies usam auth.jwt() ->> 'sub' para validar o usuário.
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
