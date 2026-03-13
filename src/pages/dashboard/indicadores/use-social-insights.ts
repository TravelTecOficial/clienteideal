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

export function useInstagramOverview(options?: { enabled?: boolean; companyId?: string | null }): HookState<InstagramOverview> {
  const enabled = options?.enabled !== false
  const companyId = options?.companyId
  const { getToken } = useAuth()
  const [state, setState] = useState<HookState<InstagramOverview>>({
    data: null,
    isLoading: enabled,
    error: null,
  })

  useEffect(() => {
    if (!enabled) {
      setState({ data: null, isLoading: false, error: null })
      return
    }
    let cancelled = false

    const run = async () => {
      setState((prev) => ({ ...prev, isLoading: true, error: null }))
      try {
        const token = await getToken()
        if (!token) {
          throw new Error("Token de autenticação indisponível. Faça login novamente.")
        }

        const res = await fetch(`${SUPABASE_URL}/functions/v1/meta-instagram`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
            apikey: SUPABASE_ANON_KEY,
          },
          body: JSON.stringify({
            action: "getInstagramOverview",
            token,
            company_id: companyId ?? undefined,
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
  }, [getToken, enabled, companyId])

  return state
}

export function useFacebookOverview(options?: { enabled?: boolean; companyId?: string | null }): HookState<FacebookOverview> {
  const enabled = options?.enabled !== false
  const companyId = options?.companyId
  const { getToken } = useAuth()
  const [state, setState] = useState<HookState<FacebookOverview>>({
    data: null,
    isLoading: enabled,
    error: null,
  })

  useEffect(() => {
    if (!enabled) {
      setState({ data: null, isLoading: false, error: null })
      return
    }
    let cancelled = false

    const run = async () => {
      setState((prev) => ({ ...prev, isLoading: true, error: null }))
      try {
        const token = await getToken()
        if (!token) {
          throw new Error("Token de autenticação indisponível. Faça login novamente.")
        }

        const res = await fetch(`${SUPABASE_URL}/functions/v1/meta-instagram`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
            apikey: SUPABASE_ANON_KEY,
          },
          body: JSON.stringify({
            action: "getFacebookOverview",
            token,
            company_id: companyId ?? undefined,
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
  }, [getToken, enabled, companyId])

  return state
}

