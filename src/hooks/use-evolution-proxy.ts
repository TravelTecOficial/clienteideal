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
        const url = `${SUPABASE_URL}/functions/v1/evolution-proxy`
        // #region agent log
        fetch("http://127.0.0.1:7243/ingest/bc96f30d-a63c-4828-beaf-5cec801979c8",{method:"POST",headers:{"Content-Type":"application/json","X-Debug-Session-Id":"ef5fa3"},body:JSON.stringify({sessionId:"ef5fa3",runId:"pre-fix",hypothesisId:"H1",location:"src/hooks/use-evolution-proxy.ts:44",message:"Starting evolution proxy request",data:{action,url,hasToken:Boolean(token),hasInstanceName:Boolean(options?.instanceName?.trim())},timestamp:Date.now()})}).catch(()=>{})
        // #endregion
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
        // #region agent log
        fetch("http://127.0.0.1:7243/ingest/bc96f30d-a63c-4828-beaf-5cec801979c8",{method:"POST",headers:{"Content-Type":"application/json","X-Debug-Session-Id":"ef5fa3"},body:JSON.stringify({sessionId:"ef5fa3",runId:"pre-fix",hypothesisId:"H2",location:"src/hooks/use-evolution-proxy.ts:57",message:"Evolution proxy response received",data:{status:res.status,ok:res.ok,url:res.url},timestamp:Date.now()})}).catch(()=>{})
        // #endregion

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
        // #region agent log
        fetch("http://127.0.0.1:7243/ingest/bc96f30d-a63c-4828-beaf-5cec801979c8",{method:"POST",headers:{"Content-Type":"application/json","X-Debug-Session-Id":"ef5fa3"},body:JSON.stringify({sessionId:"ef5fa3",runId:"pre-fix",hypothesisId:"H3",location:"src/hooks/use-evolution-proxy.ts:82",message:"Evolution proxy request failed",data:{errorMessage:msg,name:err instanceof Error?err.name:"unknown"},timestamp:Date.now()})}).catch(()=>{})
        // #endregion
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
