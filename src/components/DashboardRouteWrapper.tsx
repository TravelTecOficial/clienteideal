import { type ReactNode, useEffect, useState } from "react"
import { useLocation, useNavigate } from "react-router-dom"
import { CompanyPreviewProvider } from "@/lib/company-preview-context"
import { getAdminPreviewCompanyId } from "@/lib/admin-preview-storage"
import { AdminPreviewBanner } from "@/components/AdminPreviewBanner"
import { SupportAccessBanner } from "@/components/SupportAccessBanner"
import { useSupabaseClient } from "@/lib/supabase-context"
import { useEffectiveCompanyId } from "@/hooks/use-effective-company-id"

interface DashboardRouteWrapperProps {
  children: ReactNode
}

/**
 * Envolve rotas do dashboard para suportar modo preview do admin.
 * Garante que ?preview=companyId persista na URL em todas as navegações.
 */
export function DashboardRouteWrapper({ children }: DashboardRouteWrapperProps) {
  const location = useLocation()
  const navigate = useNavigate()
  const supabase = useSupabaseClient()
  const previewCompanyId = getAdminPreviewCompanyId()
  const isAdminPreview = !!previewCompanyId?.trim()
  const effectiveCompanyId = useEffectiveCompanyId()
  const [supportAccessEnabled, setSupportAccessEnabled] = useState(false)
  const [supportAccessLoaded, setSupportAccessLoaded] = useState(false)

  useEffect(() => {
    if (!isAdminPreview || !previewCompanyId || typeof window === "undefined") return
    const params = new URLSearchParams(location.search)
    if (params.get("preview") !== previewCompanyId) {
      params.set("preview", previewCompanyId)
      const search = params.toString()
      const to = `${location.pathname}${search ? `?${search}` : ""}`
      navigate(to, { replace: true })
    }
  }, [isAdminPreview, previewCompanyId, location.pathname, location.search, navigate])

  useEffect(() => {
    const companyId = (isAdminPreview ? previewCompanyId : effectiveCompanyId) ?? ""
    if (!companyId) {
      setSupportAccessEnabled(false)
      setSupportAccessLoaded(true)
      return
    }

    let isCancelled = false
    ;(async () => {
      const { data, error } = await supabase
        .from("companies")
        .select("support_access_enabled")
        .eq("id", companyId)
        .maybeSingle()

      if (isCancelled) return
      if (error) {
        setSupportAccessEnabled(false)
        setSupportAccessLoaded(true)
        return
      }

      const row = data as { support_access_enabled?: boolean | null } | null
      setSupportAccessEnabled(Boolean(row?.support_access_enabled))
      setSupportAccessLoaded(true)
    })()

    return () => {
      isCancelled = true
    }
  }, [effectiveCompanyId, isAdminPreview, previewCompanyId, supabase])

  if (isAdminPreview) {
    if (supportAccessLoaded && !supportAccessEnabled) {
      return (
        <CompanyPreviewProvider companyId={previewCompanyId}>
          <div className="min-h-screen p-6">
            <div className="rounded-lg border border-red-300 bg-red-50 p-4 text-red-800">
              O acesso de suporte está desabilitado para esta licença. Solicite liberação no painel de Configurações do cliente.
            </div>
          </div>
        </CompanyPreviewProvider>
      )
    }

    return (
      <CompanyPreviewProvider companyId={previewCompanyId}>
        <div className="min-h-screen">
          <AdminPreviewBanner />
          <div className="pt-14">{children}</div>
        </div>
      </CompanyPreviewProvider>
    )
  }

  if (supportAccessEnabled) {
    return (
      <div className="min-h-screen">
        <SupportAccessBanner />
        <div className="pt-14">{children}</div>
      </div>
    )
  }

  return <>{children}</>
}
