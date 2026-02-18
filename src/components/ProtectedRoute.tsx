import { useEffect, useState, useCallback, type ReactNode } from "react"
import { useUser, useAuth } from "@clerk/clerk-react"
import { Navigate, useLocation } from "react-router-dom"
import { Loader2, WifiOff } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useSupabaseClient } from "@/lib/supabase-context"
import { isSaasAdmin } from "@/lib/use-saas-admin"

const PLAN_CHECK_KEY = "plan_check_passed"
const PLAN_CHECK_TTL_MS = 10 * 60 * 1000 // 10 min

/** Rotas que usam apenas dados fictícios (mock) e não dependem do Supabase. */
const MOCK_ONLY_ROUTES = ["/dashboard/indicadores"]

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
    "idle" | "loading" | "allowed" | "blocked" | "connection_failed"
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
          const msg = (error as { message?: string }).message ?? ""
          const code = (error as { code?: string }).code ?? ""
          const isConnectionError =
            msg.toLowerCase().includes("fetch") ||
            msg.toLowerCase().includes("network") ||
            msg.toLowerCase().includes("connection") ||
            msg.toLowerCase().includes("failed") ||
            code === "PGRST301"
          if (isConnectionError && retryCount >= maxRetries) {
            setPlanCheckStatus("connection_failed")
            return
          }
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
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err)
        const isConnectionError =
          msg.toLowerCase().includes("fetch") ||
          msg.toLowerCase().includes("network") ||
          msg.toLowerCase().includes("connection") ||
          msg.toLowerCase().includes("failed")
        if (isConnectionError && retryCount >= maxRetries) {
          setPlanCheckStatus("connection_failed")
          return
        }
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
  if (isSaasAdmin(user.publicMetadata as Record<string, unknown>)) {
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

  if (planCheckStatus === "connection_failed") {
    const isMockOnlyRoute = MOCK_ONLY_ROUTES.some((r) =>
      location.pathname.startsWith(r)
    )
    if (isMockOnlyRoute) {
      return <>{children}</>
    }
    return (
      <main className="flex min-h-screen flex-col items-center justify-center gap-4 bg-background p-8">
        <WifiOff className="h-12 w-12 text-muted-foreground" aria-hidden />
        <h1 className="text-lg font-semibold text-foreground">
          Falha na conexão
        </h1>
        <p className="max-w-sm text-center text-sm text-muted-foreground">
          Não foi possível conectar ao servidor. Verifique sua conexão com a
          internet e as variáveis VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY no
          arquivo .env.local.
        </p>
        <Button
          variant="outline"
          onClick={() => {
            setPlanCheckStatus("idle")
            fetchAndCheckPlan(0)
          }}
        >
          Tentar novamente
        </Button>
      </main>
    )
  }

  if (planCheckStatus === "blocked") {
    return <Navigate to="/planos" replace state={{ from: location }} />
  }

  return <>{children}</>
}
