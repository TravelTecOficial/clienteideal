import { useEffect } from "react"
import { Link, useLocation } from "react-router-dom"
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb"
import { Separator } from "@/components/ui/separator"
import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar"
import { AppSidebar } from "@/components/app-sidebar"
import { ProfileDropdown } from "@/components/profile-dropdown"
import LeadsPageContent from "@/pages/dashboard/leads"

export function LeadsPage() {
  const location = useLocation()

  useEffect(() => {
    // #region agent log
    const wrapperMountPayload = {
      sessionId: "8ad401",
      runId: "leads-wrapper-debug",
      hypothesisId: "H14",
      location: "LeadsPage.tsx:useEffect:mount",
      message: "Leads wrapper mounted",
      data: {
        path: location.pathname,
        search: location.search,
      },
      timestamp: Date.now(),
    }
    fetch("http://127.0.0.1:7243/ingest/bc96f30d-a63c-4828-beaf-5cec801979c8", {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Debug-Session-Id": "8ad401" },
      body: JSON.stringify(wrapperMountPayload),
    }).catch(() => {})
    console.log("[debug 8ad401]", wrapperMountPayload)
    // #endregion

    const handleWindowError = (event: ErrorEvent) => {
      // #region agent log
      const wrapperErrorPayload = {
        sessionId: "8ad401",
        runId: "leads-wrapper-debug",
        hypothesisId: "H15",
        location: "LeadsPage.tsx:window:error",
        message: "Unhandled window error on leads route",
        data: {
          path: location.pathname,
          search: location.search,
          errorMessage: event.message,
          source: event.filename ?? null,
        },
        timestamp: Date.now(),
      }
      fetch("http://127.0.0.1:7243/ingest/bc96f30d-a63c-4828-beaf-5cec801979c8", {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-Debug-Session-Id": "8ad401" },
        body: JSON.stringify(wrapperErrorPayload),
      }).catch(() => {})
      console.log("[debug 8ad401]", wrapperErrorPayload)
      // #endregion
    }

    window.addEventListener("error", handleWindowError)
    return () => window.removeEventListener("error", handleWindowError)
  }, [location.pathname, location.search])

  return (
    <SidebarProvider>
      <AppSidebar />
      <SidebarInset>
        <header className="flex h-16 shrink-0 items-center gap-2 border-b border-border px-4">
          <SidebarTrigger className="-ml-1" />
          <Separator
            orientation="vertical"
            className="mr-2 data-[orientation=vertical]:h-4"
          />
          <Breadcrumb>
            <BreadcrumbList>
              <BreadcrumbItem className="hidden md:block">
                <BreadcrumbLink asChild>
                  <Link to="/dashboard">Dashboard</Link>
                </BreadcrumbLink>
              </BreadcrumbItem>
              <BreadcrumbSeparator className="hidden md:block" />
              <BreadcrumbItem>
                <BreadcrumbPage>Leads</BreadcrumbPage>
              </BreadcrumbItem>
            </BreadcrumbList>
          </Breadcrumb>
          <ProfileDropdown className="ml-auto" />
        </header>
        <div className="flex flex-1 flex-col gap-4 p-4 overflow-auto">
          <LeadsPageContent />
        </div>
      </SidebarInset>
    </SidebarProvider>
  )
}
