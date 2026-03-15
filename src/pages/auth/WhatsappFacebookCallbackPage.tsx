import { useEffect, useRef } from "react"
import { useNavigate } from "react-router-dom"
import { Loader2 } from "lucide-react"
import { useAuth } from "@clerk/clerk-react"
import { SUPABASE_URL, SUPABASE_ANON_KEY } from "@/lib/supabase"
import { useToast } from "@/hooks/use-toast"
import { getErrorMessage } from "@/lib/utils"

const STORAGE_KEY = "whatsapp_connect_company_id"

export function WhatsappFacebookCallbackPage() {
  const { getToken } = useAuth()
  const { toast } = useToast()
  const navigate = useNavigate()
  const hasRunRef = useRef(false)

  useEffect(() => {
    if (hasRunRef.current) return
    hasRunRef.current = true

    const run = async () => {
      try {
        const url = new URL(window.location.href)
        const code = url.searchParams.get("code")
        const companyId = url.searchParams.get("state") ?? window.localStorage.getItem(STORAGE_KEY) ?? window.sessionStorage.getItem(STORAGE_KEY)

        if (!code) {
          toast({
            variant: "destructive",
            title: "Código ausente",
            description: "Parâmetro 'code' não informado pela Meta. Tente novamente.",
          })
          navigate("/dashboard/configuracoes/integracoes")
          return
        }

        if (!companyId) {
          toast({
            variant: "destructive",
            title: "Sessão expirada",
            description: "Inicie a conexão novamente na página de configurações.",
          })
          navigate("/dashboard/configuracoes/integracoes")
          return
        }

        const token = await getToken()
        if (!token) {
          throw new Error("Token de autenticação indisponível. Faça login novamente.")
        }

        const res = await fetch(`${SUPABASE_URL}/functions/v1/whatsapp-integration`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
          },
          body: JSON.stringify({
            action: "exchangeCode",
            code,
            company_id: companyId,
            token,
          }),
        })

        const raw = await res.text()
        const data = (() => {
          try {
            return JSON.parse(raw) as {
              success?: boolean
              display_phone_number?: string
              phoneNumbers?: { id: string; display_phone_number: string; verified_name?: string | null }[]
              error?: string
              hint?: string
            } | null
          } catch {
            return null
          }
        })()

        if (!res.ok || data?.error) {
          const msg = data?.hint ? `${data.error ?? res.status} — ${data.hint}` : (data?.error ?? `Erro ${res.status}`)
          throw new Error(msg)
        }

        window.localStorage.removeItem(STORAGE_KEY)
        window.sessionStorage.removeItem(STORAGE_KEY)

        if (data?.phoneNumbers && data.phoneNumbers.length > 0) {
          window.sessionStorage.setItem("whatsapp_pending_phone_numbers", JSON.stringify(data.phoneNumbers))
        }
        window.sessionStorage.setItem("whatsapp_just_connected", "1")
        // #region agent log
        fetch("http://127.0.0.1:7243/ingest/f98a865e-323b-4de9-a075-eed5347401f2", {
          method: "POST",
          headers: { "Content-Type": "application/json", "X-Debug-Session-Id": "9bd63d" },
          body: JSON.stringify({
            sessionId: "9bd63d",
            location: "WhatsappFacebookCallbackPage.tsx",
            message: "Callback set whatsapp_just_connected before navigate",
            data: { hasPhoneNumbers: !!(data?.phoneNumbers?.length) },
            timestamp: Date.now(),
            hypothesisId: "A",
          }),
        }).catch(() => {})
        // #endregion

        toast({
          title: "WhatsApp conectado",
          description: data?.display_phone_number
            ? `Número vinculado: ${data.display_phone_number}`
            : "A conta foi conectada com sucesso.",
        })

        navigate("/dashboard/configuracoes/integracoes", { replace: true })
      } catch (err) {
        toast({
          variant: "destructive",
          title: "Erro ao finalizar conexão WhatsApp",
          description: getErrorMessage(err),
        })
        navigate("/dashboard/configuracoes/integracoes", { replace: true })
      }
    }

    void run()
  }, [navigate, getToken, toast])

  return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <div className="flex flex-col items-center gap-3 rounded-lg border bg-card px-6 py-8 shadow-sm">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        <p className="text-sm text-muted-foreground">
          Concluindo conexão com WhatsApp via Meta…
        </p>
      </div>
    </div>
  )
}
