import { useEffect, useState, useCallback, type ReactNode } from "react"
import { useUser } from "@clerk/clerk-react"
import { Navigate, useLocation } from "react-router-dom"
import { Loader2 } from "lucide-react"
import { useSupabaseClient } from "@/lib/supabase-context"

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
  const supabase = useSupabaseClient()
  const location = useLocation()
  const [planCheckStatus, setPlanCheckStatus] = useState<
    "idle" | "loading" | "allowed" | "blocked"
  >("idle")

  const fetchAndCheckPlan = useCallback(async () => {
    if (!user?.id) return
    setPlanCheckStatus("loading")

    try {
      const { data, error } = await supabase
        .from("profiles")
        .select("company_id, companies(plan_type)")
        .eq("id", user.id)
        .maybeSingle()

      if (error) {
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

      setPlanCheckStatus(hasValidPlan ? "allowed" : "blocked")
    } catch {
      setPlanCheckStatus("blocked")
    }
  }, [user?.id, supabase])

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
    return <Navigate to="/entrar" replace state={{ from: location }} />
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
