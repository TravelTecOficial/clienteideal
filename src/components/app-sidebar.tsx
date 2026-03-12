import * as React from "react"
import { Link, useLocation } from "react-router-dom"
import { useClerk } from "@clerk/clerk-react"
import {
  LogOut,
  Minus,
  Plus,
  LayoutDashboard,
  User,
  Users,
  Briefcase,
  Calendar,
  Headphones,
  BookOpen,
  Package,
  Settings,
  HandCoins,
  Share2,
  MapPin,
  Building2,
  Plug2,
  Smartphone,
} from "lucide-react"

import { SearchForm } from "@/components/search-form"
import { useSegmentType } from "@/hooks/use-segment-type"
import { useCompanyPreview } from "@/lib/company-preview-context"
import { getAdminPreviewCompanyId, getPreviewUrlSuffix } from "@/lib/admin-preview-storage"
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
  SidebarRail,
} from "@/components/ui/sidebar"

// Itens simples (link direto) - Produtos & Serviços e Consórcios são mutuamente exclusivos por segment_type
const navItemsBase = [
  { title: "Home", url: "/dashboard", icon: LayoutDashboard },
  { title: "Cliente Ideal", url: "/dashboard/cliente-ideal", icon: User },
  { title: "Leads", url: "/dashboard/leads", icon: Users },
  { title: "Oportunidades", url: "/dashboard/oportunidades", icon: Briefcase },
  { title: "Agenda", url: "/dashboard/agenda", icon: Calendar },
  { title: "Atendimentos", url: "/dashboard/atendimentos", icon: Headphones },
  { title: "Base de conhecimento", url: "/dashboard/base-conhecimento", icon: BookOpen },
  { title: "Social Media", url: "/dashboard/social-hub", icon: Share2 },
  { title: "GMB Local", url: "/dashboard/gmb-local", icon: MapPin },
  { title: "Produtos & Serviços", url: "/dashboard/items", icon: Package, segmentFilter: "produtos" as const },
  { title: "Consórcios", url: "/dashboard/consorcio", icon: HandCoins, segmentFilter: "consorcio" as const },
]

// Menu Configurações: subitens (Empresa, Integrações, WhatsApp)
const configuracoesNav = {
  title: "Configurações",
  icon: Settings,
  items: [
    { title: "Empresa", url: "/dashboard/configuracoes/empresa", icon: Building2 },
    { title: "Integrações", url: "/dashboard/configuracoes/integracoes", icon: Plug2 },
    { title: "WhatsApp", url: "/dashboard/configuracoes/whatsapp", icon: Smartphone },
  ],
}

// Menu Usuários: subitens (Vendedores integrado ao Clerk + Usuários do sistema)
const usuariosNav = {
  title: "Usuários",
  icon: Users,
  items: [
    { title: "Vendedores", url: "/dashboard/vendedores", icon: Users },
    { title: "Usuários do sistema", url: "/admin", icon: Settings },
  ],
}

export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
  const location = useLocation()
  const { signOut } = useClerk()
  const { segmentType } = useSegmentType()
  const { companyId: previewCompanyId } = useCompanyPreview()
  const storagePreviewId = getAdminPreviewCompanyId()
  const effectivePreviewId = previewCompanyId ?? storagePreviewId
  const UsuariosIcon = usuariosNav.icon
  const ConfiguracoesIcon = configuracoesNav.icon

  const previewSuffix = effectivePreviewId ? getPreviewUrlSuffix(effectivePreviewId) : ""

  const navItems = navItemsBase.filter((item) => {
    const filter = (item as { segmentFilter?: "produtos" | "consorcio" }).segmentFilter
    if (!filter) return true
    return segmentType === filter
  })

  const isActive = (url: string) => {
    if (url === "/dashboard") return location.pathname === "/dashboard"
    return location.pathname.startsWith(url)
  }

  return (
    <Sidebar {...props}>
      <SidebarHeader>
        <div className="mx-2 rounded-lg border border-border bg-white p-2 shadow-sm">
          <SidebarMenu>
                <SidebarMenuItem>
                  <SidebarMenuButton size="lg" asChild className="h-auto p-2">
                    <Link to={previewSuffix ? `/dashboard${previewSuffix}` : "/dashboard"} className="flex items-center justify-center">
                  <img
                    src="/logo-cliente-ideal.png"
                    alt="CLIENTE IDEAL Online"
                    className="h-12 w-auto max-w-full object-contain"
                  />
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        </div>
        <SearchForm />
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarMenu>
            {navItems.map((item) => {
              const Icon = item.icon
              const url = previewSuffix ? `${item.url}${previewSuffix}` : item.url
              return (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild isActive={isActive(item.url)}>
                    <Link to={url} className="flex items-center gap-2">
                      <Icon className="size-4 shrink-0" />
                      {item.title}
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              )
            })}
            <Collapsible
              defaultOpen={location.pathname.startsWith("/dashboard/vendedores") || location.pathname.startsWith("/admin")}
              className="group/collapsible"
            >
              <SidebarMenuItem>
                <CollapsibleTrigger asChild>
                  <SidebarMenuButton
                    isActive={
                      location.pathname.startsWith("/dashboard/vendedores") ||
                      (location.pathname === "/admin")
                    }
                  >
                    <UsuariosIcon className="size-4 shrink-0" />
                    {usuariosNav.title}
                    <Plus className="ml-auto group-data-[state=open]/collapsible:hidden" />
                    <Minus className="ml-auto group-data-[state=closed]/collapsible:hidden" />
                  </SidebarMenuButton>
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <SidebarMenuSub>
                    {usuariosNav.items.map((subItem) => {
                      const SubIcon = subItem.icon
                      return (
                        <SidebarMenuSubItem key={subItem.title}>
                          <SidebarMenuSubButton
                            asChild
                            isActive={isActive(subItem.url)}
                          >
                            <Link to={subItem.url} className="flex items-center gap-2">
                              <SubIcon className="size-4 shrink-0" />
                              {subItem.title}
                            </Link>
                          </SidebarMenuSubButton>
                        </SidebarMenuSubItem>
                      )
                    })}
                  </SidebarMenuSub>
                </CollapsibleContent>
              </SidebarMenuItem>
            </Collapsible>
            <Collapsible
              defaultOpen={location.pathname.startsWith("/dashboard/configuracoes")}
              className="group/collapsible"
            >
              <SidebarMenuItem>
                <CollapsibleTrigger asChild>
                  <SidebarMenuButton
                    isActive={location.pathname.startsWith("/dashboard/configuracoes")}
                  >
                    <ConfiguracoesIcon className="size-4 shrink-0" />
                    {configuracoesNav.title}
                    <Plus className="ml-auto group-data-[state=open]/collapsible:hidden" />
                    <Minus className="ml-auto group-data-[state=closed]/collapsible:hidden" />
                  </SidebarMenuButton>
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <SidebarMenuSub>
                    {configuracoesNav.items.map((subItem) => {
                      const SubIcon = subItem.icon
                      const url = previewSuffix ? `${subItem.url}${previewSuffix}` : subItem.url
                      return (
                        <SidebarMenuSubItem key={subItem.title}>
                          <SidebarMenuSubButton
                            asChild
                            isActive={isActive(subItem.url)}
                          >
                            <Link to={url} className="flex items-center gap-2">
                              <SubIcon className="size-4 shrink-0" />
                              {subItem.title}
                            </Link>
                          </SidebarMenuSubButton>
                        </SidebarMenuSubItem>
                      )
                    })}
                  </SidebarMenuSub>
                </CollapsibleContent>
              </SidebarMenuItem>
            </Collapsible>
          </SidebarMenu>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton onClick={() => signOut({ redirectUrl: "/" })}>
              <LogOut className="size-4" />
              Sair
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  )
}
