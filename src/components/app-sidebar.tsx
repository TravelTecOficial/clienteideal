import * as React from "react"
import { Link, useLocation } from "react-router-dom"
import { useClerk } from "@clerk/clerk-react"
import { LogOut, Minus, Plus } from "lucide-react"

import { SearchForm } from "@/components/search-form"
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

// Itens simples (link direto)
const navItems = [
  { title: "Home", url: "/dashboard" },
  { title: "Cliente Ideal", url: "/dashboard/cliente-ideal" },
  { title: "Qualificador", url: "/dashboard/qualificador" },
  { title: "Leads", url: "/dashboard/leads" },
  { title: "Oportunidades", url: "/dashboard/oportunidades" },
  { title: "Agenda", url: "/dashboard/agenda" },
  { title: "Atendimentos", url: "/dashboard/atendimentos" },
  { title: "Base de conhecimento", url: "/dashboard/base-conhecimento" },
  { title: "Produtos & Serviços", url: "/dashboard/items" },
  { title: "Perfil", url: "/dashboard/perfil" },
]

// Menu Usuários: subitens (Vendedores integrado ao Clerk + Usuários do sistema)
const usuariosNav = {
  title: "Usuários",
  items: [
    { title: "Vendedores", url: "/dashboard/vendedores" },
    { title: "Usuários do sistema", url: "/admin" },
  ],
}

export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
  const location = useLocation()
  const { signOut } = useClerk()

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
                <Link to="/dashboard" className="flex items-center justify-center">
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
            {navItems.map((item) => (
              <SidebarMenuItem key={item.title}>
                <SidebarMenuButton asChild isActive={isActive(item.url)}>
                  <Link to={item.url}>{item.title}</Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
            ))}
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
                    {usuariosNav.title}{" "}
                    <Plus className="ml-auto group-data-[state=open]/collapsible:hidden" />
                    <Minus className="ml-auto group-data-[state=closed]/collapsible:hidden" />
                  </SidebarMenuButton>
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <SidebarMenuSub>
                    {usuariosNav.items.map((subItem) => (
                      <SidebarMenuSubItem key={subItem.title}>
                        <SidebarMenuSubButton
                          asChild
                          isActive={isActive(subItem.url)}
                        >
                          <Link to={subItem.url}>{subItem.title}</Link>
                        </SidebarMenuSubButton>
                      </SidebarMenuSubItem>
                    ))}
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
