import { useEffect, useState, useCallback, type ReactNode } from "react"
import { useUser, useAuth } from "@clerk/clerk-react"
import { Navigate, useLocation } from "react-router-dom"
import { Loader2 } from "lucide-react"
import { useSupabaseClient } from "@/lib/supabase-context"
import { isSaasAdmin, isLocalhost } from "@/lib/use-saas-admin"

const PLAN_CHECK_KEY = "plan_check_passed"
const PLAN_CHECK_TTL_MS = 10 * 60 * 1000 // 10 min

function getPlanCheckPassed(): boolean {
  if (typeof sessionStorage === "undefined") return false
  const stored = sessionStorage.getItem(PLAN_CHECK_KEY)
  if (!stored) return false
  const ts = parseInt(stored, 10)
  return !isNaN(ts) && Date.now() - ts < PLAN_CHECK_TTL_MS
}

function setPlanCheckPassed(): void {
  sessionStorage?.setItem(PLAN_CHECK_KEY, String(Date.now()))
}

function clearPlanCheckPassed(): void {
  sessionStorage?.removeItem(PLAN_CHECK_KEY)
}

interface ProfileWithCompany {
  company_id: string | null
  companies: { plan_type: string | null } | null
}

interface ProtectedRouteProps {
  children: ReactNode
}

/**
 * Estado de loading durante checagem de auth/plano.
 * Nota: checagem apenas em nível de UI. API deve revalidar.
 */
function LoadingState() {
  return (
    <div className="flex min-h-[280px] flex-col items-center justify-center gap-4 p-8">
      <Loader2
        className="h-10 w-10 animate-spin text-primary"
        aria-hidden
      />
      <p className="text-sm font-medium text-foreground">Verificando acesso…</p>
      <p className="text-xs text-muted-foreground">Aguarde um momento…</p>
    </div>
  )
}

/**
 * Protege rotas exigindo autenticação Clerk e plano válido no Supabase.
 * - Não autenticado → redireciona para /entrar
 * - plan_type 'none' ou vazio → redireciona para /planos
 * - Exceção: em /planos não redireciona (evita loop)
 */
export function ProtectedRoute({ children }: ProtectedRouteProps) {
  const { isLoaded, isSignedIn, user } = useUser()
  const { getToken } = useAuth()
  const supabase = useSupabaseClient()
  const location = useLocation()
  const [planCheckStatus, setPlanCheckStatus] = useState<
    "idle" | "loading" | "allowed" | "blocked"
  >("idle")

  const fetchAndCheckPlan = useCallback(
    async (retryCount = 0): Promise<void> => {
      if (!user?.id) return
      setPlanCheckStatus("loading")

      const maxRetries = location.state?.fromPlanSelection ? 5 : 3
      const retryDelay = 500

      try {
        // Garantir que o JWT do Clerk (template supabase) está pronto antes de consultar
        const token = await getToken()
        if (!token) {
          if (retryCount < maxRetries) {
            await new Promise((r) => setTimeout(r, retryDelay))
            return fetchAndCheckPlan(retryCount + 1)
          }
          setPlanCheckStatus("blocked")
          return
        }

        const { data, error } = await supabase
          .from("profiles")
          .select("company_id, companies(plan_type)")
          .eq("id", user.id)
          .maybeSingle()

        if (error) {
          if (retryCount < maxRetries) {
            await new Promise((r) => setTimeout(r, retryDelay))
            return fetchAndCheckPlan(retryCount + 1)
          }
          setPlanCheckStatus("blocked")
          return
        }

        const profile = data as ProfileWithCompany | null
        const companyId = profile?.company_id ?? null
        const planType = profile?.companies?.plan_type ?? null

        const hasValidPlan =
          companyId &&
          planType &&
          planType.trim() !== "" &&
          planType.toLowerCase() !== "none"

        if (hasValidPlan) {
          setPlanCheckPassed()
          setPlanCheckStatus("allowed")
          return
        }

        if (retryCount < maxRetries) {
          await new Promise((r) => setTimeout(r, retryDelay))
          return fetchAndCheckPlan(retryCount + 1)
        }
        setPlanCheckStatus("blocked")
      } catch {
        if (retryCount < maxRetries) {
          await new Promise((r) => setTimeout(r, retryDelay))
          return fetchAndCheckPlan(retryCount + 1)
        }
        setPlanCheckStatus("blocked")
      }
    },
    [user?.id, supabase, location.state?.fromPlanSelection, getToken]
  )

  useEffect(() => {
    if (!isLoaded || !isSignedIn || !user) return

    if (location.pathname === "/planos") {
      setPlanCheckStatus("allowed")
      return
    }

    fetchAndCheckPlan()
  }, [isLoaded, isSignedIn, user, location.pathname, fetchAndCheckPlan])

  if (!isLoaded) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center bg-background">
        <LoadingState />
      </main>
    )
  }

  if (!isSignedIn) {
    clearPlanCheckPassed()
    return <Navigate to="/entrar" replace state={{ from: location }} />
  }

  // Admin do SaaS (publicMetadata.role === "admin") → /admin. Note: UI-level check. API enforcement required.
  // Em localhost, não redireciona para permitir testar fluxo de usuário normal.
  if (!isLocalhost() && isSaasAdmin(user.publicMetadata as Record<string, unknown>)) {
    return <Navigate to="/admin" replace />
  }

  // Note: UI-level bypass. Update já foi validado em Planos antes da navegação.
  if (location.state?.fromPlanSelection === true) {
    setPlanCheckPassed()
    return <>{children}</>
  }

  // Bypass temporário: se já passou recentemente (ex: navegação dentro do dashboard), evita re-fetch
  if (location.pathname.startsWith("/dashboard") && getPlanCheckPassed()) {
    return <>{children}</>
  }

  if (planCheckStatus === "loading" || planCheckStatus === "idle") {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center bg-background">
        <LoadingState />
      </main>
    )
  }

  if (planCheckStatus === "blocked") {
    return <Navigate to="/planos" replace state={{ from: location }} />
  }

  return <>{children}</>
}
