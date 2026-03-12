import { useEffect, useRef } from "react"
import { useNavigate } from "react-router-dom"
import { Loader2 } from "lucide-react"
import { useAuth } from "@clerk/clerk-react"
import { SUPABASE_URL, SUPABASE_ANON_KEY } from "@/lib/supabase"
import { useEffectiveCompanyId } from "@/hooks/use-effective-company-id"
import { useToast } from "@/hooks/use-toast"
import { getErrorMessage } from "@/lib/utils"

const STORAGE_KEY = "google_oauth_state"

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

        if (!code) {
          toast({
            variant: "destructive",
            title: "Código ausente",
            description: "Parâmetro 'code' não informado pelo Google. Tente novamente.",
          })
          navigate("/dashboard/configuracoes?tab=integracoes")
          return
        }

        const storedState = window.sessionStorage.getItem(STORAGE_KEY)
        if (!storedState || !stateFromUrl || storedState !== stateFromUrl) {
          toast({
            variant: "destructive",
            title: "Sessão inválida",
            description: "Não foi possível validar o retorno do Google. Inicie a conexão novamente.",
          })
          navigate("/dashboard/configuracoes?tab=integracoes")
          return
        }

        if (!companyId) {
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
          },
          body: JSON.stringify({
            action: "exchangeCode",
            code,
            state: stateFromUrl,
            company_id: companyId,
            token,
          }),
        })
        const raw = await res.text()
        const data = (() => {
          try {
            return JSON.parse(raw) as { error?: string; hint?: string } | null
          } catch {
            return null
          }
        })()
        if (!res.ok || data?.error) {
          const msg = data?.hint ? `${data.error ?? res.status} — ${data.hint}` : (data?.error ?? `Erro ${res.status}`)
          throw new Error(msg)
        }

        window.sessionStorage.removeItem(STORAGE_KEY)

        toast({
          title: "Google conectado",
          description:
            "A conta do Google foi conectada com sucesso. GA4, Ads e My Business estão disponíveis para atualização automática de dados.",
        })

        navigate("/dashboard/configuracoes?tab=integracoes", { replace: true })
      } catch (err) {
        toast({
          variant: "destructive",
          title: "Erro ao finalizar conexão",
          description: getErrorMessage(err),
        })
        navigate("/dashboard/configuracoes?tab=integracoes", { replace: true })
      }
    }

    void run()
  }, [navigate, getToken, toast, hasRunRef, companyId])

  return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <div className="flex flex-col items-center gap-3 rounded-lg border bg-card px-6 py-8 shadow-sm">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        <p className="text-sm text-muted-foreground">
          Concluindo conexão com Google (GA4, Ads, My Business)…
        </p>
      </div>
    </div>
  )
}
