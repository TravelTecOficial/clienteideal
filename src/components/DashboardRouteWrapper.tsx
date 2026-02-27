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

  // #region agent log
  const logPayload = {sessionId:'8ad401',location:'DashboardRouteWrapper.tsx',message:'DashboardRouteWrapper snapshot',data:{previewCompanyId,isAdminPreview,hostname:typeof window!=='undefined'?window.location.hostname:null},hypothesisId:'H2',timestamp:Date.now()};
  if (typeof window!=='undefined' && (window.location.hostname==='localhost'||window.location.hostname==='127.0.0.1')) {
    fetch('http://127.0.0.1:7243/ingest/bc96f30d-a63c-4828-beaf-5cec801979c8',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'8ad401'},body:JSON.stringify(logPayload)}).catch(()=>{});
  } else {
    console.log('[debug 8ad401]', logPayload);
  }
  // #endregion

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
