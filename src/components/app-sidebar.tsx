import * as React from "react"
import { Link, useLocation } from "react-router-dom"
import { useClerk } from "@clerk/clerk-react"
import { LogOut } from "lucide-react"

import { SearchForm } from "@/components/search-form"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
} from "@/components/ui/sidebar"

// Menu flat: 11 itens ligados às rotas existentes
const navItems = [
  { title: "Home", url: "/dashboard" },
  { title: "Cliente Ideal", url: "/dashboard/cliente-ideal" },
  { title: "Qualificador", url: "/dashboard/qualificador" },
  { title: "Leads", url: "/dashboard/leads" },
  { title: "Oportunidades", url: "/dashboard/oportunidades" },
  { title: "Agenda", url: "/dashboard/agenda" },
  { title: "Atendimentos", url: "/dashboard/atendimentos" },
  { title: "Base de conhecimento", url: "/dashboard/base-conhecimento" },
  { title: "Usuários", url: "/admin" },
  { title: "Produtos & Serviços", url: "/dashboard/produtos-servicos" },
  { title: "Perfil", url: "/dashboard/perfil" },
]

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
      </SidebarHeader>
      <div className="mx-2 flex flex-1 min-h-0 flex-col gap-2 rounded-lg border border-border bg-white p-2 shadow-sm">
        <SearchForm />
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
            </SidebarMenu>
          </SidebarGroup>
        </SidebarContent>
      </div>
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
