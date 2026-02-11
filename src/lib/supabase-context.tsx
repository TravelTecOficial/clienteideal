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
 * Provider que cria um cliente Supabase autenticado com o token do Clerk.
 * Deve ser usado dentro de ClerkProvider para que RLS funcione com auth.uid().
 */
export function SupabaseProvider({ children }: SupabaseProviderProps) {
  const { getToken } = useAuth()
  const clientRef = useRef<SupabaseClient | null>(null)

  const client = useMemo(() => {
    if (!clientRef.current) {
      clientRef.current = createSupabaseClient(async () => {
        const token = await getToken({ template: "supabase" })
        return token ?? (await getToken()) ?? null
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
