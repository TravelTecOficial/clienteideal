import { useState, useCallback, useEffect } from "react"
import { useNavigate } from "react-router-dom"
import { useUser } from "@clerk/clerk-react"
import type { SupabaseClient } from "@supabase/supabase-js"
import { useSupabaseClient } from "@/lib/supabase-context"
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { cn } from "@/lib/utils"
import { Loader2, AlertCircle, Check } from "lucide-react"

const RETRY_ATTEMPTS = 5
const RETRY_INTERVAL_MS = 2000

type PlanType = "free" | "pro" | "enterprise"

interface ProfileRow {
  id: string
  company_id: string | null
}

const PLANS: {
  type: PlanType
  title: string
  price: string
  description: string
  benefits: string[]
}[] = [
  {
    type: "free",
    title: "Free",
    price: "R$ 0",
    description: "Para começar",
    benefits: [
      "Até 50 leads por mês",
      "1 usuário",
      "Relatórios básicos",
      "Suporte por e-mail",
    ],
  },
  {
    type: "pro",
    title: "Pro",
    price: "R$ 49",
    description: "Acesso completo",
    benefits: [
      "Leads ilimitados",
      "Até 5 usuários",
      "Relatórios avançados",
      "Suporte prioritário",
      "Integrações de CRM",
      "API de acesso",
    ],
  },
  {
    type: "enterprise",
    title: "Enterprise",
    price: "Sob consulta",
    description: "Suporte dedicado",
    benefits: [
      "Tudo do Pro",
      "Usuários ilimitados",
      "SLA garantido",
      "Gerente de conta dedicado",
      "Onboarding personalizado",
      "Customizações sob medida",
    ],
  },
]

/** Busca company_id do perfil com retry. Forçamos o ID como string para evitar erro de UUID. */
async function fetchProfileWithRetry(
  supabaseClient: SupabaseClient,
  userId: string,
  onRetry?: (attempt: number) => void
): Promise<string | null> {
  for (let attempt = 1; attempt <= RETRY_ATTEMPTS; attempt++) {
    // A correção principal está no .eq("id", String(userId))
    const { data, error } = await supabaseClient
      .from("profiles")
      .select("id, company_id")
      .eq("id", String(userId))
      .maybeSingle()

    if (error) {
      console.error("Erro na busca do perfil:", error)
      throw new Error(error.message)
    }

    const profile = data as ProfileRow | null
    if (profile?.company_id) {
      return profile.company_id
    }

    if (attempt < RETRY_ATTEMPTS) {
      onRetry?.(attempt)
      await new Promise((resolve) => setTimeout(resolve, RETRY_INTERVAL_MS))
    }
  }
  return null
}

/** Atualiza company com plan_type e status. */
async function updateCompanyPlan(
  supabaseClient: SupabaseClient,
  companyId: string,
  planType: PlanType
): Promise<{ error: Error | null }> {
  const { error } = await supabaseClient
    .from("companies")
    .update({ plan_type: planType, status: "active" })
    .eq("id", String(companyId)) // Garantindo que o ID da empresa também seja tratado como texto

  return { error: error ? new Error(error.message) : null }
}

/** Componente de loading respeitando design tokens do index.css. */
function LoadingState({ message }: { message: string }) {
  return (
    <div className="flex min-h-[280px] flex-col items-center justify-center gap-4 p-8">
      <Loader2
        className="h-10 w-10 animate-spin text-primary"
        aria-hidden
      />
      <p className="text-sm font-medium text-foreground">{message}</p>
      <p className="text-xs text-muted-foreground">Aguarde um momento…</p>
    </div>
  )
}

export function Planos() {
  const { user, isLoaded } = useUser()
  const supabaseClient = useSupabaseClient()
  const navigate = useNavigate()
  const [companyId, setCompanyId] = useState<string | null>(null)
  const [status, setStatus] = useState<
    "idle" | "loading-profile" | "ready" | "processing" | "error"
  >("idle")
  const [errorMsg, setErrorMsg] = useState<string>("")

  const loadProfile = useCallback(async () => {
    if (!user?.id) return
    setStatus("loading-profile")
    setErrorMsg("")

    try {
      // Passamos o user.id do Clerk que começa com "user_..."
      const id = await fetchProfileWithRetry(supabaseClient, user.id)
      if (id) {
        setCompanyId(id)
        setStatus("ready")
      } else {
        setStatus("error")
        setErrorMsg(
          "Perfil ainda não encontrado. O sistema está finalizando sua configuração. Tente novamente em instantes."
        )
      }
    } catch (err) {
      setStatus("error")
      setErrorMsg(err instanceof Error ? err.message : "Erro ao buscar perfil.")
    }
  }, [user?.id, supabaseClient])

  useEffect(() => {
    if (!isLoaded) return
    if (!user) {
      navigate("/entrar", { replace: true })
      return
    }
    loadProfile()
  }, [isLoaded, user, loadProfile, navigate])

  const handleSelectPlan = async (planType: PlanType) => {
    if (!companyId) return
    setStatus("processing")
    setErrorMsg("")

    const { error } = await updateCompanyPlan(
      supabaseClient,
      companyId,
      planType
    )

    if (error) {
      setStatus("ready")
      setErrorMsg(error.message)
      return
    }

    navigate("/dashboard", { replace: true })
  }

  if (!isLoaded || status === "loading-profile") {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center bg-background px-4 py-8">
        <div className="w-full max-w-3xl">
          <Card>
            <CardHeader>
              <CardTitle className="text-2xl font-bold text-foreground">
                Escolha seu plano
              </CardTitle>
              <CardDescription className="text-muted-foreground">
                Verificando sua conta…
              </CardDescription>
            </CardHeader>
            <CardContent>
              <LoadingState message="Carregando sua conta…" />
            </CardContent>
          </Card>
        </div>
      </main>
    )
  }

  return (
    <main className="flex min-h-screen flex-col items-center bg-background px-4 py-8 sm:px-6 md:px-10">
      <div className="w-full max-w-5xl space-y-8">
        <div className="text-center">
          <h1 className="text-3xl font-bold tracking-tight text-foreground">
            Escolha seu plano
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Selecione o plano ideal para sua empresa
          </p>
        </div>

        {errorMsg && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Erro de Configuração</AlertTitle>
            <AlertDescription>{errorMsg}</AlertDescription>
          </Alert>
        )}

        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {PLANS.map((plan) => (
            <Card
              key={plan.type}
              className={cn(
                "flex flex-col transition-shadow hover:shadow-md",
                plan.type === "pro" && "border-primary ring-2 ring-primary/20"
              )}
            >
              <CardHeader>
                <CardTitle className="text-xl font-semibold text-foreground">
                  {plan.title}
                </CardTitle>
                <CardDescription className="text-muted-foreground">
                  {plan.description}
                </CardDescription>
              </CardHeader>
              <CardContent className="flex-1 space-y-4">
                <p className="text-2xl font-bold text-foreground">
                  {plan.price}
                </p>
                <p className="text-sm text-muted-foreground">
                  {plan.type === "enterprise" ? "" : "/mês"}
                </p>
                <ul className="space-y-2">
                  {plan.benefits.map((benefit) => (
                    <li
                      key={benefit}
                      className="flex items-start gap-2 text-sm text-foreground"
                    >
                      <Check className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                      <span>{benefit}</span>
                    </li>
                  ))}
                </ul>
              </CardContent>
              <CardFooter>
                <Button
                  variant={plan.type === "pro" ? "default" : "secondary"}
                  className="w-full"
                  onClick={() => handleSelectPlan(plan.type)}
                  disabled={status === "processing" || status === "error"}
                >
                  {status === "processing" ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin mr-2" />
                      Processando…
                    </>
                  ) : (
                    "Selecionar"
                  )}
                </Button>
              </CardFooter>
            </Card>
          ))}
        </div>

        {status === "error" && (
          <div className="flex justify-center">
            <Button variant="outline" size="sm" onClick={loadProfile}>
              Tentar novamente
            </Button>
          </div>
        )}
      </div>
    </main>
  )
}