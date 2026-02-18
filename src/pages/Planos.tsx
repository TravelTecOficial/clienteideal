import { useState, useCallback, useEffect } from "react"
import { useNavigate } from "react-router-dom"
import { useUser, useAuth } from "@clerk/clerk-react"
import { isLocalhost } from "@/lib/use-saas-admin"
import type { SupabaseClient } from "@supabase/supabase-js"
import { FunctionsHttpError } from "@supabase/supabase-js"
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
    benefits: ["Até 50 leads por mês", "1 usuário", "Relatórios básicos", "Suporte por e-mail"],
  },
  {
    type: "pro",
    title: "Pro",
    price: "R$ 49",
    description: "Acesso completo",
    benefits: ["Leads ilimitados", "Até 5 usuários", "Relatórios avançados", "Suporte prioritário", "Integrações de CRM", "API de acesso"],
  },
  {
    type: "enterprise",
    title: "Enterprise",
    price: "Sob consulta",
    description: "Suporte dedicado",
    benefits: ["Tudo do Pro", "Usuários ilimitados", "SLA garantido", "Gerente de conta dedicado", "Onboarding personalizado", "Customizações sob medida"],
  },
]

async function fetchProfileWithRetry(
  supabaseClient: SupabaseClient,
  userId: string,
  onRetry?: (attempt: number) => void
): Promise<string | null> {
  for (let attempt = 1; attempt <= RETRY_ATTEMPTS; attempt++) {
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

/** Chama Edge Function enviando o Bearer Token do Clerk para autenticação */
async function syncProfile(
  supabaseClient: SupabaseClient,
  email: string,
  fullName: string,
  token: string
): Promise<{ companyId: string } | { error: string }> {
  const { data, error } = await supabaseClient.functions.invoke("sync-profile-client", {
    body: { email, fullName },
    headers: {
      Authorization: `Bearer ${token}`,
    },
  })

  if (error) {
    let errMsg = error.message
    if (error instanceof FunctionsHttpError) {
      try {
        const parsed = (await error.context.json()) as { error?: string }
        if (parsed?.error) errMsg = parsed.error
      } catch { /* fallback */ }
    }
    return { error: errMsg }
  }

  const body = data as { companyId?: string; error?: string } | null
  if (body?.companyId) return { companyId: body.companyId }

  return { error: body?.error || "Erro ao sincronizar perfil." }
}

/**
 * Fallback para localhost: cria company e profile diretamente via Supabase
 * quando sync-profile-client falha (ex: CLERK_SECRET_KEY não configurado).
 * Usa RLS com JWT do Clerk (template supabase).
 */
async function syncProfileDirect(
  supabaseClient: SupabaseClient,
  userId: string,
  email: string,
  fullName: string
): Promise<{ companyId: string } | { error: string }> {
  const companyId = `company-${userId.replace(/^user_/, "")}`
  const { error: companyError } = await supabaseClient
    .from("companies")
    .upsert(
      {
        id: companyId,
        name: fullName || "Minha Empresa",
        slug: `company-${userId.replace(/^user_/, "")}`,
        plan_type: "free",
        status: "trialing",
      },
      { onConflict: "id" }
    )

  if (companyError) {
    return { error: companyError.message }
  }

  const { error: profileError } = await supabaseClient.from("profiles").upsert(
    {
      id: userId,
      email: email || "",
      full_name: fullName,
      company_id: companyId,
      role: "admin",
    },
    { onConflict: "id" }
  )

  if (profileError) {
    const isDuplicateEmail =
      profileError.code === "23505" &&
      String(profileError.message).includes("profiles_email_key")
    return {
      error: isDuplicateEmail
        ? "Este e-mail já está vinculado a outra conta."
        : profileError.message,
    }
  }

  return { companyId }
}

async function updateCompanyPlan(
  supabaseClient: SupabaseClient,
  companyId: string,
  planType: PlanType
): Promise<{ error: Error | null }> {
  const { data, error } = await supabaseClient
    .from("companies")
    .update({ plan_type: planType, status: "active" })
    .eq("id", String(companyId))
    .select("id")

  if (error) return { error: new Error(error.message) }
  if (!data || data.length === 0) {
    return { error: new Error("Atualização bloqueada. Verifique suas permissões.") }
  }
  return { error: null }
}

function LoadingState({ message }: { message: string }) {
  return (
    <div className="flex min-h-[280px] flex-col items-center justify-center gap-4 p-8">
      <Loader2 className="h-10 w-10 animate-spin text-primary" />
      <p className="text-sm font-medium text-foreground">{message}</p>
    </div>
  )
}

export function Planos() {
  const { user, isLoaded } = useUser()
  const { getToken } = useAuth() // ESSENCIAL: Hook para pegar o JWT
  const supabaseClient = useSupabaseClient()
  const navigate = useNavigate()
  const [companyId, setCompanyId] = useState<string | null>(null)
  const [status, setStatus] = useState<"idle" | "loading-profile" | "ready" | "processing" | "error">("idle")
  const [errorMsg, setErrorMsg] = useState<string>("")

  const loadProfile = useCallback(async () => {
    if (!user?.id) return
    setStatus("loading-profile")
    setErrorMsg("")

    try {
      let id = await fetchProfileWithRetry(supabaseClient, user.id)

      if (!id) {
        const primaryEmail = user.primaryEmailAddress?.emailAddress ?? ""
        const fullName = [user.firstName, user.lastName].filter(Boolean).join(" ").trim()

        let result: { companyId?: string; error?: string }

        // Em localhost: tenta criar perfil diretamente PRIMEIRO (usa JWT template supabase + RLS)
        // Dispensa CLERK_SECRET_KEY na Edge Function durante o desenvolvimento
        if (isLocalhost()) {
          const directResult = await syncProfileDirect(supabaseClient, user.id, primaryEmail, fullName)
          if ("companyId" in directResult) {
            result = directResult
          } else {
            // Fallback: Edge Function (requer CLERK_SECRET_KEY configurada)
            const token = await getToken()
            if (!token) {
              throw new Error("Não foi possível gerar o token de acesso. Tente fazer logout e login novamente.")
            }
            result = await syncProfile(supabaseClient, primaryEmail, fullName, token)
          }
        } else {
          const token = await getToken()
          if (!token) {
            throw new Error("Não foi possível gerar o token de acesso. Tente fazer logout e login novamente.")
          }
          result = await syncProfile(supabaseClient, primaryEmail, fullName, token)
        }

        if ("companyId" in result) {
          id = result.companyId
          // Em localhost: após sync bem-sucedido, vai direto ao dashboard
          if (id && isLocalhost()) {
            setCompanyId(id)
            setStatus("ready")
            navigate("/dashboard", { replace: true, state: { fromPlanSelection: true } })
            return
          }
        } else {
          setStatus("error")
          const baseMsg = result.error ?? "Erro ao sincronizar perfil."
          const extraHint = isLocalhost()
            ? " Em localhost você usa pk_test_...; o Supabase precisa de sk_test_... (não sk_live_). Troque a chave no Supabase."
            : ""
          setErrorMsg(baseMsg + extraHint)
          return
        }
      }

      if (id) {
        setCompanyId(id)
        setStatus("ready")
      }
    } catch (err) {
      setStatus("error")
      setErrorMsg(err instanceof Error ? err.message : "Erro ao buscar perfil.")
    }
  }, [user, getToken, supabaseClient])

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

    const { error } = await updateCompanyPlan(supabaseClient, companyId, planType)

    if (error) {
      setStatus("ready")
      setErrorMsg(error.message)
      return
    }

    navigate("/dashboard", { replace: true, state: { fromPlanSelection: true } })
  }

  if (!isLoaded || status === "loading-profile") {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center bg-background px-4 py-8">
        <Card className="w-full max-w-3xl">
          <CardHeader>
            <CardTitle>Escolha seu plano</CardTitle>
            <CardDescription>Verificando sua conta…</CardDescription>
          </CardHeader>
          <CardContent>
            <LoadingState message="Configurando seu acesso..." />
          </CardContent>
        </Card>
      </main>
    )
  }

  return (
    <main className="flex min-h-screen flex-col items-center bg-background px-4 py-8 sm:px-6 md:px-10">
      <div className="w-full max-w-5xl space-y-8">
        <div className="text-center">
          <h1 className="text-3xl font-bold tracking-tight text-foreground">Escolha seu plano</h1>
          <p className="mt-2 text-sm text-muted-foreground">Selecione o plano ideal para sua empresa</p>
        </div>

        {errorMsg && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Erro de Sincronização</AlertTitle>
            <AlertDescription className="space-y-2">
              <span>{errorMsg}</span>
              {isLocalhost() && (
                <div className="mt-2 flex flex-col gap-1 text-sm">
                  <a
                    href="https://dashboard.clerk.com"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="font-medium underline underline-offset-4 hover:no-underline"
                  >
                    1. Clerk → API Keys → Reveal Secret Key (sk_test_...)
                  </a>
                  <a
                    href={`https://supabase.com/dashboard/project/${(import.meta.env.VITE_SUPABASE_URL ?? "").replace("https://", "").replace(".supabase.co", "") || "mrkvvgofjyvlutqpvedt"}/settings/functions`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="font-medium underline underline-offset-4 hover:no-underline"
                  >
                    2. Supabase → Edge Functions Secrets → Add CLERK_SECRET_KEY
                  </a>
                </div>
              )}
            </AlertDescription>
          </Alert>
        )}

        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {PLANS.map((plan) => (
            <Card key={plan.type} className={cn("flex flex-col transition-shadow hover:shadow-md", plan.type === "pro" && "border-primary ring-2 ring-primary/20")}>
              <CardHeader>
                <CardTitle className="text-xl font-semibold">{plan.title}</CardTitle>
                <CardDescription>{plan.description}</CardDescription>
              </CardHeader>
              <CardContent className="flex-1 space-y-4">
                <p className="text-2xl font-bold">{plan.price}</p>
                <ul className="space-y-2">
                  {plan.benefits.map((benefit) => (
                    <li key={benefit} className="flex items-start gap-2 text-sm">
                      <Check className="mt-0.5 h-4 w-4 text-primary" />
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
                  {status === "processing" ? "Processando..." : "Selecionar"}
                </Button>
              </CardFooter>
            </Card>
          ))}
        </div>
      </div>
    </main>
  )
}