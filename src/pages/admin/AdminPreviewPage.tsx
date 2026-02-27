import { useParams, Navigate } from "react-router-dom"
import { useUser } from "@clerk/clerk-react"
import { useSupabaseClient } from "@/lib/supabase-context"
import { useEffect, useState } from "react"
import { CompanyPreviewProvider } from "@/lib/company-preview-context"
import { setAdminPreviewCompanyId, clearAdminPreviewCompanyId } from "@/lib/admin-preview-storage"
import { AdminPreviewBanner } from "@/components/AdminPreviewBanner"
import { isSaasAdmin } from "@/lib/use-saas-admin"
import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar"
import { AppSidebar } from "@/components/app-sidebar"
import { ProfileDropdown } from "@/components/profile-dropdown"
import { Separator } from "@/components/ui/separator"
import { Breadcrumb, BreadcrumbItem, BreadcrumbLink, BreadcrumbList, BreadcrumbPage, BreadcrumbSeparator } from "@/components/ui/breadcrumb"
import { Link } from "react-router-dom"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Loader2 } from "lucide-react"
import IndicadoresPageContent from "@/pages/dashboard/indicadores"

export function AdminPreviewPage() {
  const { companyId } = useParams<{ companyId: string }>()
  const { user, isLoaded, isSignedIn } = useUser()
  const supabase = useSupabaseClient()
  const [companyName, setCompanyName] = useState<string | null>(null)
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading")

  useEffect(() => {
    if (!companyId || !supabase) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- early exit com estado inválido
      setStatus("error")
      return
    }
    setAdminPreviewCompanyId(companyId)
    // #region agent log
    const logPayload = {sessionId:'8ad401',location:'AdminPreviewPage.tsx:setAdminPreviewCompanyId',message:'AdminPreview set sessionStorage',data:{companyId,hostname:typeof window!=='undefined'?window.location.hostname:null},hypothesisId:'H2',timestamp:Date.now()};
    if (typeof window!=='undefined' && (window.location.hostname==='localhost'||window.location.hostname==='127.0.0.1')) {
      fetch('http://127.0.0.1:7243/ingest/bc96f30d-a63c-4828-beaf-5cec801979c8',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'8ad401'},body:JSON.stringify(logPayload)}).catch(()=>{});
    } else {
      console.log('[debug 8ad401]', logPayload);
    }
    // #endregion
    supabase
      .from("companies")
      .select("name")
      .eq("id", companyId)
      .maybeSingle()
      .then(({ data, error }) => {
        if (error) {
          setStatus("error")
          return
        }
        setCompanyName((data as { name: string } | null)?.name ?? null)
        setStatus("ready")
      })
  }, [companyId, supabase])

  if (!isLoaded || !isSignedIn || !user) {
    return <Navigate to="/entrar" replace />
  }

  if (!isSaasAdmin(user.publicMetadata as Record<string, unknown>)) {
    return <Navigate to="/dashboard" replace />
  }

  if (!companyId || status === "error") {
    return <Navigate to="/admin" replace />
  }

  if (status === "loading") {
    return (
      <main className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-10 w-10 animate-spin text-primary" />
      </main>
    )
  }

  return (
    <CompanyPreviewProvider companyId={companyId}>
      <AdminPreviewBanner />
      <div className="pt-14">
        <SidebarProvider>
          <AppSidebar />
          <SidebarInset>
            <header className="flex h-16 shrink-0 items-center gap-2 border-b px-4">
            <SidebarTrigger className="-ml-1" />
            <Separator orientation="vertical" className="mr-2 data-[orientation=vertical]:h-4" />
            <Breadcrumb>
              <BreadcrumbList>
                <BreadcrumbItem>
                  <BreadcrumbLink asChild>
                    <Link to="/admin" onClick={clearAdminPreviewCompanyId}>Admin</Link>
                  </BreadcrumbLink>
                </BreadcrumbItem>
                <BreadcrumbSeparator />
                <BreadcrumbItem>
                  <BreadcrumbPage>Preview: {companyName ?? companyId}</BreadcrumbPage>
                </BreadcrumbItem>
              </BreadcrumbList>
            </Breadcrumb>
            <ProfileDropdown className="ml-auto" />
          </header>
          <div className="flex flex-1 flex-col gap-4 p-4">
            <Alert className="border-primary/50 bg-primary/5">
              <AlertTitle>Modo preview</AlertTitle>
              <AlertDescription>
                Visualizando o dashboard da empresa {companyName ?? companyId}. Os dados exibidos são desta licença.
              </AlertDescription>
            </Alert>
            <div className="flex-1 overflow-auto">
              <IndicadoresPageContent />
            </div>
          </div>
        </SidebarInset>
      </SidebarProvider>
      </div>
    </CompanyPreviewProvider>
  )
}
