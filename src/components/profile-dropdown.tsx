import { useEffect, useState } from "react"
import { Link } from "react-router-dom"
import { LifeBuoy, Loader2, User, UserCircle } from "lucide-react"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Button } from "@/components/ui/button"
import { cn, getErrorMessage } from "@/lib/utils"
import { useSupabaseClient } from "@/lib/supabase-context"
import { useUser } from "@clerk/clerk-react"
import { useToast } from "@/hooks/use-toast"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Switch } from "@/components/ui/switch"

interface ProfileDropdownProps {
  className?: string
}

export function ProfileDropdown({ className }: ProfileDropdownProps) {
  const { user, isLoaded } = useUser()
  const supabase = useSupabaseClient()
  const { toast } = useToast()
  const [supportDialogOpen, setSupportDialogOpen] = useState(false)
  const [supportAccessEnabled, setSupportAccessEnabled] = useState(false)
  const [loadingSupport, setLoadingSupport] = useState(false)
  const [savingSupport, setSavingSupport] = useState(false)
  const [canManageSupport, setCanManageSupport] = useState(false)
  const [companyId, setCompanyId] = useState<string | null>(null)

  useEffect(() => {
    if (!isLoaded || !user) return

    let isCancelled = false

    ;(async () => {
      try {
        setLoadingSupport(true)
        const { data, error } = await supabase
          .from("profiles")
          .select("company_id, role, companies(support_access_enabled)")
          .eq("id", user.id)
          .maybeSingle()

        if (isCancelled) return

        if (error || !data) {
          setCanManageSupport(false)
          return
        }

        const row = data as {
          company_id: string | null
          role?: string | null
          companies?: { support_access_enabled?: boolean | null } | null
        }

        const role = row.role ?? ""
        const companyIdValue = row.company_id ?? null
        setCompanyId(companyIdValue)
        setSupportAccessEnabled(Boolean(row.companies?.support_access_enabled))
        setCanManageSupport(role === "admin" && !!companyIdValue)
      } catch {
        setCanManageSupport(false)
      } finally {
        if (!isCancelled) {
          setLoadingSupport(false)
        }
      }
    })()

    return () => {
      isCancelled = true
    }
  }, [isLoaded, user, supabase])

  const handleSaveSupport = async () => {
    if (!companyId) return
    setSavingSupport(true)
    try {
      const { error } = await supabase
        .from("companies")
        .update({ support_access_enabled: supportAccessEnabled })
        .eq("id", companyId)

      if (error) throw error

      toast({
        title: "Preferência de suporte atualizada",
        description: supportAccessEnabled
          ? "A equipe de suporte agora pode acessar sua licença em modo preview para implantação e atendimento."
          : "O acesso de suporte foi desativado para esta licença.",
      })
      setSupportDialogOpen(false)
    } catch (err) {
      toast({
        variant: "destructive",
        title: "Erro ao salvar preferência de suporte",
        description: getErrorMessage(err),
      })
    } finally {
      setSavingSupport(false)
    }
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className={cn("rounded-full", className)}
            aria-label="Menu do perfil"
          >
            <UserCircle className="h-8 w-8 text-muted-foreground hover:text-foreground" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56">
          <DropdownMenuItem asChild>
            <Link to="/dashboard/perfil" className="flex items-center gap-2 cursor-pointer">
              <User className="h-4 w-4" />
              Seu Perfil
            </Link>
          </DropdownMenuItem>
          <DropdownMenuItem
            className="flex items-center gap-2 cursor-pointer"
            onSelect={(e) => e.preventDefault()}
          >
            <UserCircle className="h-4 w-4" />
            Sua conta
          </DropdownMenuItem>
          {canManageSupport && (
            <DropdownMenuItem
              className="flex items-center gap-2 cursor-pointer"
              onSelect={(e) => {
                e.preventDefault()
                if (!loadingSupport) {
                  setSupportDialogOpen(true)
                }
              }}
            >
              <LifeBuoy className="h-4 w-4" />
              Suporte
            </DropdownMenuItem>
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      {canManageSupport && (
        <Dialog open={supportDialogOpen} onOpenChange={setSupportDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Suporte</DialogTitle>
              <DialogDescription>
                Controle se a equipe do Cliente Ideal pode acessar temporariamente seu dashboard para implantação e
                atendimento.
              </DialogDescription>
            </DialogHeader>
            <div className="flex items-center justify-between gap-4 py-4">
              <div className="space-y-1">
                <p className="text-sm font-medium">Liberar acesso do suporte</p>
                <p className="text-xs text-muted-foreground">
                  Quando habilitado, o suporte pode abrir seu dashboard no Admin em modo preview para ajudá-lo na
                  configuração.
                </p>
              </div>
              <Switch
                id="support_access_enabled"
                checked={supportAccessEnabled}
                disabled={loadingSupport || savingSupport || !companyId}
                onCheckedChange={(checked) => setSupportAccessEnabled(checked)}
              />
            </div>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setSupportDialogOpen(false)}
              >
                Cancelar
              </Button>
              <Button
                type="button"
                onClick={handleSaveSupport}
                disabled={savingSupport || loadingSupport || !companyId}
              >
                {savingSupport ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Salvando…
                  </>
                ) : (
                  "Salvar"
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </>
  )
}
