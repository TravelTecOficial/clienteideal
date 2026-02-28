import { useEffect, useState } from "react";
import { Link, Outlet, useParams, useLocation, Navigate } from "react-router-dom";
import { useSupabaseClient } from "@/lib/supabase-context";
import { useEffectiveCompanyId } from "@/hooks/use-effective-company-id";
import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { Separator } from "@/components/ui/separator";
import { AppSidebar } from "@/components/app-sidebar";
import { ProfileDropdown } from "@/components/profile-dropdown";
import { Loader2, User, Bot, Target, MessageSquare, Megaphone, LayoutDashboard } from "lucide-react";
import { cn } from "@/lib/utils";

const TAB_ROUTES = [
  { path: "perfil", label: "Perfil", icon: User },
  { path: "prompt", label: "Prompt", icon: Bot },
  { path: "qualificador", label: "Qualificador", icon: Target },
  { path: "chat", label: "Chat", icon: MessageSquare },
  { path: "campanhas", label: "Campanhas", icon: Megaphone },
  { path: "dashboard", label: "Dashboard", icon: LayoutDashboard },
] as const;

export function ClienteIdealContextLayout() {
  const { id } = useParams<{ id: string }>();
  const location = useLocation();
  const supabase = useSupabaseClient();
  const effectiveCompanyId = useEffectiveCompanyId();
  const [profileName, setProfileName] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    if (!id || !effectiveCompanyId || !supabase) {
      setIsLoading(false);
      return;
    }
    if (id === "novo") {
      setProfileName("Novo");
      setNotFound(false);
      setIsLoading(false);
      return;
    }
    let cancelled = false;
    (async () => {
      const { data, error } = await supabase
        .from("ideal_customers")
        .select("profile_name")
        .eq("id", id)
        .eq("company_id", effectiveCompanyId)
        .maybeSingle();

      if (cancelled) return;
      if (error || !data) {
        setNotFound(true);
        setProfileName(null);
      } else {
        setProfileName((data as { profile_name: string | null }).profile_name);
      }
      setIsLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [id, effectiveCompanyId, supabase]);

  if (!effectiveCompanyId) {
    return (
      <SidebarProvider>
        <AppSidebar />
        <SidebarInset>
          <header className="flex h-16 shrink-0 items-center gap-2 border-b px-4">
            <SidebarTrigger className="-ml-1" />
            <Separator orientation="vertical" className="mr-2 data-[orientation=vertical]:h-4" />
            <Breadcrumb>
              <BreadcrumbList>
                <BreadcrumbItem className="hidden md:block">
                  <BreadcrumbLink asChild>
                    <Link to="/dashboard">Dashboard</Link>
                  </BreadcrumbLink>
                </BreadcrumbItem>
                <BreadcrumbSeparator className="hidden md:block" />
                <BreadcrumbItem>
                  <BreadcrumbLink asChild>
                    <Link to="/dashboard/cliente-ideal">Cliente Ideal</Link>
                  </BreadcrumbLink>
                </BreadcrumbItem>
                <BreadcrumbSeparator className="hidden md:block" />
                <BreadcrumbItem>
                  <BreadcrumbPage>Carregando...</BreadcrumbPage>
                </BreadcrumbItem>
              </BreadcrumbList>
            </Breadcrumb>
            <ProfileDropdown className="ml-auto" />
          </header>
          <div className="flex flex-1 flex-col gap-4 p-4">
            <p className="text-muted-foreground">
              Empresa não vinculada. Configure sua empresa em Configurações.
            </p>
          </div>
        </SidebarInset>
      </SidebarProvider>
    );
  }

  if (notFound) {
    return <Navigate to="/dashboard/cliente-ideal" replace />;
  }

  const basePath = `/dashboard/cliente-ideal/${id}`;
  const pathSegments = location.pathname.split("/").filter(Boolean);
  const currentTab = pathSegments[pathSegments.length - 1] ?? "perfil";

  return (
    <SidebarProvider>
      <AppSidebar />
      <SidebarInset>
        <header className="flex h-16 shrink-0 items-center gap-2 border-b px-4">
          <SidebarTrigger className="-ml-1" />
          <Separator orientation="vertical" className="mr-2 data-[orientation=vertical]:h-4" />
          <Breadcrumb>
            <BreadcrumbList>
              <BreadcrumbItem className="hidden md:block">
                <BreadcrumbLink asChild>
                  <Link to="/dashboard">Dashboard</Link>
                </BreadcrumbLink>
              </BreadcrumbItem>
              <BreadcrumbSeparator className="hidden md:block" />
              <BreadcrumbItem>
                <BreadcrumbLink asChild>
                  <Link to="/dashboard/cliente-ideal">Cliente Ideal</Link>
                </BreadcrumbLink>
              </BreadcrumbItem>
              <BreadcrumbSeparator className="hidden md:block" />
              <BreadcrumbItem>
                <BreadcrumbPage>
                  {isLoading ? (
                    <span className="flex items-center gap-2">
                      <Loader2 className="h-4 w-4 animate-spin" /> Carregando...
                    </span>
                  ) : (
                    profileName ?? id
                  )}
                </BreadcrumbPage>
              </BreadcrumbItem>
            </BreadcrumbList>
          </Breadcrumb>
          <ProfileDropdown className="ml-auto" />
        </header>

        {/* Abas superiores contextuais */}
        <div className="border-b border-border bg-muted/30 px-4">
          <nav className="flex gap-1 -mb-px overflow-x-auto">
            {TAB_ROUTES.map((tab) => {
              const href = `${basePath}/${tab.path}`;
              const isActive = currentTab === tab.path;
              const Icon = tab.icon;
              return (
                <Link
                  key={tab.path}
                  to={href}
                  className={cn(
                    "flex items-center gap-2 px-4 py-3 text-sm font-medium whitespace-nowrap border-b-2 transition-colors",
                    isActive
                      ? "border-primary text-primary"
                      : "border-transparent text-muted-foreground hover:text-foreground hover:border-muted-foreground/50"
                  )}
                >
                  <Icon className="h-4 w-4 shrink-0" />
                  {tab.label}
                </Link>
              );
            })}
          </nav>
        </div>

        <div className="flex-1 flex flex-col gap-4 p-4 overflow-auto">
          <Outlet context={{ clienteIdealId: id, profileName }} />
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}
