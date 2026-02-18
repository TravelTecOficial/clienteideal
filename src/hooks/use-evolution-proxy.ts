import { useState, useCallback } from "react"
import { useAuth } from "@clerk/clerk-react"
import { SUPABASE_URL, SUPABASE_ANON_KEY } from "@/lib/supabase"

export type EvolutionAction =
  | "create"
  | "connect"
  | "connectionState"
  | "fetchInstances"
  | "logout"

interface EvolutionProxyOptions {
  instanceName?: string
}

interface UseEvolutionProxyReturn {
  execute: (
    action: EvolutionAction,
    options?: EvolutionProxyOptions
  ) => Promise<{ data: unknown; error: string | null }>
  isLoading: boolean
  error: string | null
}

/**
 * Hook para chamar a Edge Function evolution-proxy.
 * A API Key nunca é exposta ao cliente; a Edge Function lê do banco.
 */
export function useEvolutionProxy(): UseEvolutionProxyReturn {
  const { getToken } = useAuth()
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const execute = useCallback(
    async (
      action: EvolutionAction,
      options?: EvolutionProxyOptions
    ): Promise<{ data: unknown; error: string | null }> => {
      setIsLoading(true)
      setError(null)
      try {
        const token = await getToken()
        const url = `${SUPABASE_URL}/functions/v1/evolution-proxy-fix3`
        const res = await fetch(url, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
          },
          body: JSON.stringify({
            action,
            instanceName: options?.instanceName?.trim() || undefined,
            token: token || undefined,
          }),
        })

        const rawText = await res.text()
        const data = (() => {
          try {
            return JSON.parse(rawText) as { error?: string; message?: string } | null
          } catch {
            return null
          }
        })()
        if (!res.ok) {
          const errMsg = data?.error ?? (data as { message?: string })?.message ?? `Erro ${res.status}`
          setError(errMsg)
          return { data: null, error: errMsg }
        }

        if (data?.error) {
          setError(data.error)
          return { data: null, error: data.error }
        }

        return { data, error: null }
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err)
        setError(msg)
        return { data: null, error: msg }
      } finally {
        setIsLoading(false)
      }
    },
    [getToken]
  )

  return { execute, isLoading, error }
}
