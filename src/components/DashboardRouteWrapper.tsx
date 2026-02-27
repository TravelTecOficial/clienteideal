import { type ReactNode, useEffect } from "react"
import { useLocation, useNavigate } from "react-router-dom"
import { CompanyPreviewProvider } from "@/lib/company-preview-context"
import { getAdminPreviewCompanyId } from "@/lib/admin-preview-storage"
import { AdminPreviewBanner } from "@/components/AdminPreviewBanner"

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
  const previewCompanyId = getAdminPreviewCompanyId()
  const isAdminPreview = !!previewCompanyId?.trim()

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

  if (isAdminPreview) {
    return (
      <CompanyPreviewProvider companyId={previewCompanyId}>
        <div className="min-h-screen">
          <AdminPreviewBanner />
          <div className="pt-14">{children}</div>
        </div>
      </CompanyPreviewProvider>
    )
  }

  return <>{children}</>
}
