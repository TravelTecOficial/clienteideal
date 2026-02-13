import {
  createContext,
  useContext,
  useRef,
  useMemo,
  type ReactNode,
} from "react"
import { useAuth } from "@clerk/clerk-react"
import {
  createSupabaseClient,
  type SupabaseClient,
} from "@/lib/supabase"

const SupabaseContext = createContext<SupabaseClient | null>(null)

interface SupabaseProviderProps {
  children: ReactNode
}

/**
 * Provider que cria um cliente Supabase autenticado com o JWT do Clerk.
 * Usa o token de sessão padrão (Third-Party Auth). O token precisa ter claim role: "authenticated".
 * Configure em Clerk: Sessions > Customize session token > { "role": "authenticated" }
 * Configure em Supabase: Authentication > Third-Party Auth > Add Clerk (domain: artistic-stingray-67.clerk.accounts.dev)
 * RLS usa auth.jwt() ->> 'sub' para validar o usuário.
 */
export function SupabaseProvider({ children }: SupabaseProviderProps) {
  const { getToken } = useAuth()
  const clientRef = useRef<SupabaseClient | null>(null)

  const client = useMemo(() => {
    if (!clientRef.current) {
      clientRef.current = createSupabaseClient(async () => {
        // Token de sessão (sem template) = Supabase Third-Party Auth valida via JWKS do Clerk
        const token = await getToken()
        return token ?? null
      })
    }
    return clientRef.current
  }, [getToken])

  return (
    <SupabaseContext.Provider value={client}>
      {children}
    </SupabaseContext.Provider>
  )
}

export function useSupabaseClient(): SupabaseClient {
  const client = useContext(SupabaseContext)
  if (!client) {
    throw new Error(
      "useSupabaseClient deve ser usado dentro de SupabaseProvider"
    )
  }
  return client
}
