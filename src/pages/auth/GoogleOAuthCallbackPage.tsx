import { useEffect, useRef } from "react"
import { useNavigate } from "react-router-dom"
import { Loader2 } from "lucide-react"
import { useAuth } from "@clerk/clerk-react"
import { SUPABASE_URL, SUPABASE_ANON_KEY } from "@/lib/supabase"
import { useEffectiveCompanyId } from "@/hooks/use-effective-company-id"
import { useToast } from "@/hooks/use-toast"
import { getErrorMessage } from "@/lib/utils"

const STORAGE_KEY = "google_oauth_state"
const COMPANY_STORAGE_KEY = "google_oauth_company_id"
const POST_CONNECT_STORAGE_KEY = "google_oauth_post_connect_service"

export function GoogleOAuthCallbackPage() {
  const { getToken } = useAuth()
  const companyId = useEffectiveCompanyId()
  const { toast } = useToast()
  const navigate = useNavigate()
  const hasRunRef = useRef(false)

  useEffect(() => {
    const run = async () => {
      try {
        const url = new URL(window.location.href)
        const code = url.searchParams.get("code")
        const stateFromUrl = url.searchParams.get("state")
        const storedCompanyId = window.sessionStorage.getItem(COMPANY_STORAGE_KEY)?.trim() || null
        const effectiveCompanyId = companyId ?? storedCompanyId

        if (!code) {
          toast({
            variant: "destructive",
            title: "Código ausente",
            description: "Parâmetro 'code' não informado pelo Google. Tente novamente.",
          })
          navigate("/dashboard/configuracoes/integracoes")
          return
        }

        const storedState = window.sessionStorage.getItem(STORAGE_KEY)
        if (!storedState || !stateFromUrl || storedState !== stateFromUrl) {
          toast({
            variant: "destructive",
            title: "Sessão inválida",
            description: "Não foi possível validar o retorno do Google. Inicie a conexão novamente.",
          })
          navigate("/dashboard/configuracoes/integracoes")
          return
        }

        if (!effectiveCompanyId) {
          toast({
            variant: "destructive",
            title: "Empresa não identificada",
            description: "Selecione uma empresa antes de conectar. Redirecionando…",
          })
          navigate("/dashboard/configuracoes/integracoes")
          return
        }

        if (hasRunRef.current) return
        hasRunRef.current = true

        const token = await getToken()
        if (!token) {
          throw new Error("Token de autenticação indisponível. Faça login novamente.")
        }

        const res = await fetch(`${SUPABASE_URL}/functions/v1/google-oauth`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
            apikey: SUPABASE_ANON_KEY,
          },
          body: JSON.stringify({
            action: "exchangeCode",
            code,
            state: stateFromUrl,
            company_id: effectiveCompanyId,
            token,
          }),
        })
        const raw = await res.text()
        const data = (() => {
          try {
            return JSON.parse(raw) as {
              error?: string
              hint?: string
              supabaseError?: string
              supabaseErrorCode?: string
              supabaseErrorDetails?: string
              service?: string
            } | null
          } catch {
            return null
          }
        })()
        if (!res.ok || data?.error) {
          // #region agent log
          const logPayload = {
            sessionId: "d1d2fb",
            location: "GoogleOAuthCallbackPage.tsx:exchangeCode-error",
            message: "Erro ao salvar credenciais Google",
            data: { status: res.status, error: data?.error, hint: data?.hint, supabaseError: data?.supabaseError, rawPreview: raw.slice(0, 800) },
            runId: "exchangeCode",
            hypothesisId: "H1",
            timestamp: Date.now(),
          }
          console.error("[google-oauth-callback] 500 response:", logPayload)
          fetch("http://127.0.0.1:7243/ingest/f98a865e-323b-4de9-a075-eed5347401f2", {
            method: "POST",
            headers: { "Content-Type": "application/json", "X-Debug-Session-Id": "d1d2fb" },
            body: JSON.stringify(logPayload),
          }).catch(() => {})
          // #endregion
          let msg = data?.hint ? `${data.error ?? res.status} — ${data.hint}` : (data?.error ?? `Erro ${res.status}`)
          if (data?.supabaseError) msg += ` [Supabase: ${data.supabaseError}]`
          else if (data?.supabaseErrorCode) msg += ` [Supabase code: ${data.supabaseErrorCode}]`
          else if (raw && raw.length < 600) msg += ` [Resposta: ${raw}]`
          throw new Error(msg)
        }

        window.sessionStorage.removeItem(STORAGE_KEY)
        window.sessionStorage.removeItem(COMPANY_STORAGE_KEY)

        const serviceLabels: Record<string, string> = {
          ga4: "Google Analytics",
          ads: "Google Ads",
          mybusiness: "Google Meu Negócio",
        }
        const serviceName = serviceLabels[data?.service ?? ""] ?? "Google"

        toast({
          title: `${serviceName} conectado`,
          description: "A conta do Google foi conectada com sucesso para este serviço.",
        })

        if (data?.service === "ga4" || data?.service === "mybusiness") {
          window.sessionStorage.setItem(POST_CONNECT_STORAGE_KEY, data.service)
        }

        navigate("/dashboard/configuracoes/integracoes", { replace: true })
      } catch (err) {
        window.sessionStorage.removeItem(COMPANY_STORAGE_KEY)
        toast({
          variant: "destructive",
          title: "Erro ao finalizar conexão",
          description: getErrorMessage(err),
        })
        navigate("/dashboard/configuracoes/integracoes", { replace: true })
      }
    }

    void run()
  }, [navigate, getToken, toast, hasRunRef, companyId])

  return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <div className="flex flex-col items-center gap-3 rounded-lg border bg-card px-6 py-8 shadow-sm">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        <p className="text-sm text-muted-foreground">
          Concluindo conexão com o Google…
        </p>
      </div>
    </div>
  )
}
