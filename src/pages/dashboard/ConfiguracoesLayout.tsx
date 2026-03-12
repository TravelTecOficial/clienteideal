import { NavLink, useParams, Navigate } from "react-router-dom"
import { Building2, Plug2, Smartphone } from "lucide-react"
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
import { DashboardLink } from "@/components/DashboardLink"
import { cn } from "@/lib/utils"
import { ConfiguracoesPage } from "./ConfiguracoesPage"

const SECTIONS = [
  { id: "empresa", label: "Empresa", icon: Building2, path: "/dashboard/configuracoes/empresa" },
  { id: "integracoes", label: "Integrações", icon: Plug2, path: "/dashboard/configuracoes/integracoes" },
  { id: "whatsapp", label: "WhatsApp", icon: Smartphone, path: "/dashboard/configuracoes/whatsapp" },
] as const

const SECTION_LABELS: Record<string, string> = {
  empresa: "Empresa",
  integracoes: "Integrações",
  whatsapp: "WhatsApp",
}

export function ConfiguracoesLayout() {
  const { section } = useParams<{ section: string }>()
  const validSection = section && SECTIONS.some((s) => s.id === section) ? section : null

  if (!validSection) {
    return <Navigate to="/dashboard/configuracoes/empresa" replace />
  }

  return (
    <SidebarProvider>
      <AppSidebar />
      <SidebarInset>
        <header className="flex h-16 shrink-0 items-center gap-2 border-b px-4">
          <SidebarTrigger className="-ml-1" />
          <Separator
            orientation="vertical"
            className="mr-2 data-[orientation=vertical]:h-4"
          />
          <Breadcrumb>
            <BreadcrumbList>
              <BreadcrumbItem className="hidden md:block">
                <BreadcrumbLink asChild>
                  <DashboardLink>Dashboard</DashboardLink>
                </BreadcrumbLink>
              </BreadcrumbItem>
              <BreadcrumbSeparator className="hidden md:block" />
              <BreadcrumbItem>
                <BreadcrumbLink asChild>
                  <NavLink to="/dashboard/configuracoes/empresa">Configurações</NavLink>
                </BreadcrumbLink>
              </BreadcrumbItem>
              <BreadcrumbSeparator className="hidden md:block" />
              <BreadcrumbItem>
                <BreadcrumbPage>{SECTION_LABELS[validSection] ?? validSection}</BreadcrumbPage>
              </BreadcrumbItem>
            </BreadcrumbList>
          </Breadcrumb>
          <ProfileDropdown className="ml-auto" />
        </header>
        <div className="flex flex-1 flex-col gap-4 p-4">
          <nav className="flex gap-2 border-b pb-2">
            {SECTIONS.map((s) => {
              const Icon = s.icon
              return (
                <NavLink
                  key={s.id}
                  to={s.path}
                  className={({ isActive }) =>
                    cn(
                      "flex items-center gap-2 rounded-md px-4 py-2 text-sm font-medium transition-colors",
                      isActive
                        ? "bg-primary text-primary-foreground"
                        : "text-muted-foreground hover:bg-muted hover:text-foreground",
                    )
                  }
                >
                  <Icon className="h-4 w-4" />
                  {s.label}
                </NavLink>
              )
            })}
          </nav>
          <ConfiguracoesPage section={validSection as "empresa" | "integracoes" | "whatsapp"} />
        </div>
      </SidebarInset>
    </SidebarProvider>
  )
}
