import { type ReactNode } from "react"
import { CompanyPreviewProvider } from "@/lib/company-preview-context"
import { getAdminPreviewCompanyId } from "@/lib/admin-preview-storage"
import { AdminPreviewBanner } from "@/components/AdminPreviewBanner"

interface DashboardRouteWrapperProps {
  children: ReactNode
}

/**
 * Envolve rotas do dashboard para suportar modo preview do admin.
 * Usa apenas sessionStorage: ProtectedRoute já garante que só admin acessa /dashboard/* com preview.
 * Evita dependência de useUser() que pode estar loading e causar effectiveCompanyId = null.
 */
export function DashboardRouteWrapper({ children }: DashboardRouteWrapperProps) {
  const previewCompanyId = getAdminPreviewCompanyId()
  const isAdminPreview = !!previewCompanyId?.trim()

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
