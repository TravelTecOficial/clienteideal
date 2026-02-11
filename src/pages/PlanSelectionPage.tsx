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
import { Loader2, AlertCircle } from "lucide-react"

const RETRY_ATTEMPTS = 3
const RETRY_INTERVAL_MS = 2000

type PlanType = "free" | "pro" | "enterprise"

interface ProfileRow {
  id: string
  company_id: string | null
}

const PLANS: { type: PlanType; title: string; description: string; price: string }[] = [
  { type: "free", title: "Free", description: "Para começar", price: "R$ 0" },
  { type: "pro", title: "Pro", description: "Acesso completo", price: "R$ 49" },
  { type: "enterprise", title: "Enterprise", description: "Suporte dedicado", price: "Sob consulta" },
]

/** Busca company_id do perfil com retry para aguardar webhook do Clerk. */
async function fetchProfileWithRetry(
  supabaseClient: SupabaseClient,
  userId: string,
  onRetry?: (attempt: number) => void
): Promise<string | null> {
  for (let attempt = 1; attempt <= RETRY_ATTEMPTS; attempt++) {
    const { data, error } = await supabaseClient
  .from("profiles")
      .select("id, company_id")
      .eq("id", userId)
      .maybeSingle()

    if (error) {
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
    .eq("id", companyId)

  return { error: error ? new Error(error.message) : null }
}

/** Componente de loading respeitando design tokens. */
function LoadingState({ message }: { message: string }) {
  return (
    <div className="flex min-h-[280px] flex-col items-center justify-center gap-4 p-8">
      <Loader2 className="h-10 w-10 animate-spin text-primary" aria-hidden />
      <p className="text-sm font-medium text-foreground">{message}</p>
      <p className="text-xs text-muted-foreground">Aguarde um momento…</p>
    </div>
  )
}

export function PlanSelectionPage() {
  const { user, isLoaded } = useUser()
  const supabaseClient = useSupabaseClient()
  const navigate = useNavigate()
  const [companyId, setCompanyId] = useState<string | null>(null)
  const [status, setStatus] = useState<
    "idle" | "loading-profile" | "ready" | "processing" | "error"
  >("idle")
  const [errorMsg, setErrorMsg] = useState<string>("")
  const [retryCount, setRetryCount] = useState(0)

  const loadProfile = useCallback(async () => {
    if (!user?.id) return
    setStatus("loading-profile")
    setErrorMsg("")
    setRetryCount(0)

    try {
      const id = await fetchProfileWithRetry(
        supabaseClient,
        user.id,
        (attempt) => setRetryCount(attempt)
      )
      if (id) {
        setCompanyId(id)
        setStatus("ready")
      } else {
        setStatus("error")
        setErrorMsg(
          "Perfil ainda não encontrado. O webhook pode estar processando. Tente novamente em alguns segundos."
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
                Verificando seu perfil…
              </CardDescription>
            </CardHeader>
            <CardContent>
              <LoadingState
                message={
                  retryCount > 0
                    ? `Tentativa ${retryCount + 1} de ${RETRY_ATTEMPTS}…`
                    : "Buscando seu perfil…"
                }
              />
            </CardContent>
          </Card>
        </div>
      </main>
    )
  }

  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-background px-4 py-8 sm:px-6 md:px-10">
      <div className="w-full max-w-3xl space-y-6">
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
            <AlertTitle>Erro</AlertTitle>
            <AlertDescription>{errorMsg}</AlertDescription>
          </Alert>
        )}

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {PLANS.map((plan) => (
            <Card
              key={plan.type}
              className={cn(
                plan.type === "pro" && "border-primary shadow-sm"
              )}
            >
              <CardHeader>
                <CardTitle className="text-lg font-semibold text-foreground">
                  {plan.title}
                </CardTitle>
                <CardDescription className="text-muted-foreground">
                  {plan.description}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold text-foreground">
                  {plan.price}
                </p>
                <p className="text-sm text-muted-foreground">/mês</p>
              </CardContent>
              <CardFooter>
                <Button
                  variant={plan.type === "pro" ? "default" : "secondary"}
                  className="w-full"
                  onClick={() => handleSelectPlan(plan.type)}
                  disabled={status === "processing"}
                >
                  {status === "processing" ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
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

        {companyId && (
          <div className="flex justify-center">
            <Button variant="outline" size="sm" onClick={loadProfile}>
              Tentar novamente (buscar perfil)
            </Button>
          </div>
        )}
      </div>
    </main>
  )
}
