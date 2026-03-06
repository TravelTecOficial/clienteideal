import { useEffect, useState } from "react"
import { useAuth } from "@clerk/clerk-react"
import { SUPABASE_URL, SUPABASE_ANON_KEY } from "@/lib/supabase"
import { getErrorMessage } from "@/lib/utils"

interface MetricPoint {
  value: number
  endTime: string | null
}

export interface InstagramOverview {
  reach: MetricPoint[]
}

export interface FacebookOverview {
  pageId: string
  impressions: MetricPoint[]
  engagedUsers: MetricPoint[]
}

interface HookState<T> {
  data: T | null
  isLoading: boolean
  error: string | null
}

export function useInstagramOverview(): HookState<InstagramOverview> {
  const { getToken } = useAuth()
  const [state, setState] = useState<HookState<InstagramOverview>>({
    data: null,
    isLoading: true,
    error: null,
  })

  useEffect(() => {
    let cancelled = false

    const run = async () => {
      setState((prev) => ({ ...prev, isLoading: true, error: null }))
      try {
        const token = await getToken()
        if (!token) {
          throw new Error("Token de autenticação indisponível. Faça login novamente.")
        }

        // #region agent log - meta-instagram fetch preflight
        fetch("http://127.0.0.1:7243/ingest/f98a865e-323b-4de9-a075-eed5347401f2", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-Debug-Session-Id": "ab699e",
          },
          body: JSON.stringify({
            sessionId: "ab699e",
            runId: "pre-fix",
            hypothesisId: "H-CORS-meta",
            location:
              "src/pages/dashboard/indicadores/use-social-insights.ts:useInstagramOverview:before-fetch",
            message: "Instagram overview fetch about to run",
            data: {
              supabaseUrl: SUPABASE_URL || null,
              locationOrigin: typeof window !== "undefined" ? window.location.origin : null,
              hasAuthorizationHeader: true,
            },
            timestamp: Date.now(),
          }),
        }).catch(() => {})
        // #endregion agent log - meta-instagram fetch preflight

        const res = await fetch(`${SUPABASE_URL}/functions/v1/meta-instagram`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
          },
          body: JSON.stringify({
            action: "getInstagramOverview",
            token,
          }),
        })
        const raw = await res.text()
        const data = (() => {
          try {
            return JSON.parse(raw) as {
              metrics?: { metric: string; values: MetricPoint[] }[]
              error?: string
              hint?: string
            } | null
          } catch {
            return null
          }
        })()

        if (!res.ok || data?.error) {
          const msg = data?.hint ? `${data.error ?? res.status} — ${data.hint}` : data?.error ?? `Erro ${res.status}`
          throw new Error(msg)
        }

        const metrics = data?.metrics ?? []
        const reach =
          metrics.find((m) => m.metric === "reach")?.values ??
          []

        if (cancelled) return

        setState({
          data: { reach },
          isLoading: false,
          error: null,
        })
      } catch (err) {
        if (cancelled) return

        // #region agent log - meta-instagram fetch error
        {
          const errAny = err as unknown
          const message = errAny instanceof Error ? errAny.message : String(errAny)
          fetch("http://127.0.0.1:7243/ingest/f98a865e-323b-4de9-a075-eed5347401f2", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "X-Debug-Session-Id": "ab699e",
            },
            body: JSON.stringify({
              sessionId: "ab699e",
              runId: "pre-fix",
              hypothesisId: "H-CORS-meta",
              location:
                "src/pages/dashboard/indicadores/use-social-insights.ts:useInstagramOverview:catch",
              message: "Instagram overview fetch error",
              data: {
                errorMessage: message,
                errorName: errAny instanceof Error ? errAny.name : typeof errAny,
                isTypeError: errAny instanceof TypeError,
              },
              timestamp: Date.now(),
            }),
          }).catch(() => {})
        }
        // #endregion agent log - meta-instagram fetch error

        setState({
          data: null,
          isLoading: false,
          error: getErrorMessage(err),
        })
      }
    }

    void run()

    return () => {
      cancelled = true
    }
  }, [getToken])

  return state
}

export function useFacebookOverview(): HookState<FacebookOverview> {
  const { getToken } = useAuth()
  const [state, setState] = useState<HookState<FacebookOverview>>({
    data: null,
    isLoading: true,
    error: null,
  })

  useEffect(() => {
    let cancelled = false

    const run = async () => {
      setState((prev) => ({ ...prev, isLoading: true, error: null }))
      try {
        const token = await getToken()
        if (!token) {
          throw new Error("Token de autenticação indisponível. Faça login novamente.")
        }

        // #region agent log - facebook overview fetch preflight
        fetch("http://127.0.0.1:7243/ingest/f98a865e-323b-4de9-a075-eed5347401f2", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-Debug-Session-Id": "ab699e",
          },
          body: JSON.stringify({
            sessionId: "ab699e",
            runId: "pre-fix",
            hypothesisId: "H-CORS-meta",
            location:
              "src/pages/dashboard/indicadores/use-social-insights.ts:useFacebookOverview:before-fetch",
            message: "Facebook overview fetch about to run",
            data: {
              supabaseUrl: SUPABASE_URL || null,
              locationOrigin: typeof window !== "undefined" ? window.location.origin : null,
              hasAuthorizationHeader: true,
            },
            timestamp: Date.now(),
          }),
        }).catch(() => {})
        // #endregion agent log - facebook overview fetch preflight

        const res = await fetch(`${SUPABASE_URL}/functions/v1/meta-instagram`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
          },
          body: JSON.stringify({
            action: "getFacebookOverview",
            token,
          }),
        })
        const raw = await res.text()
        const data = (() => {
          try {
            return JSON.parse(raw) as {
              pageId?: string
              metrics?: { metric: string; values: MetricPoint[] }[]
              error?: string
              hint?: string
            } | null
          } catch {
            return null
          }
        })()

        if (!res.ok || data?.error) {
          const msg = data?.hint ? `${data.error ?? res.status} — ${data.hint}` : data?.error ?? `Erro ${res.status}`
          throw new Error(msg)
        }

        const metrics = data?.metrics ?? []
        const impressions = metrics.find((m) => m.metric === "page_impressions")?.values ?? []
        const engagedUsers = metrics.find((m) => m.metric === "page_engaged_users")?.values ?? []

        if (cancelled) return

        setState({
          data: {
            pageId: data?.pageId ?? "",
            impressions,
            engagedUsers,
          },
          isLoading: false,
          error: null,
        })
      } catch (err) {
        if (cancelled) return

        // #region agent log - facebook overview fetch error
        {
          const errAny = err as unknown
          const message = errAny instanceof Error ? errAny.message : String(errAny)
          fetch("http://127.0.0.1:7243/ingest/f98a865e-323b-4de9-a075-eed5347401f2", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "X-Debug-Session-Id": "ab699e",
            },
            body: JSON.stringify({
              sessionId: "ab699e",
              runId: "pre-fix",
              hypothesisId: "H-CORS-meta",
              location:
                "src/pages/dashboard/indicadores/use-social-insights.ts:useFacebookOverview:catch",
              message: "Facebook overview fetch error",
              data: {
                errorMessage: message,
                errorName: errAny instanceof Error ? errAny.name : typeof errAny,
                isTypeError: errAny instanceof TypeError,
              },
              timestamp: Date.now(),
            }),
          }).catch(() => {})
        }
        // #endregion agent log - facebook overview fetch error

        setState({
          data: null,
          isLoading: false,
          error: getErrorMessage(err),
        })
      }
    }

    void run()

    return () => {
      cancelled = true
    }
  }, [getToken])

  return state
}

