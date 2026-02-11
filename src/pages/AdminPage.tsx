import { useEffect, useState, useCallback } from "react"
import { useUser, useAuth } from "@clerk/clerk-react"
import { Navigate } from "react-router-dom"
import { useSupabaseClient } from "@/lib/supabase-context"
import { FunctionsHttpError } from "@supabase/supabase-js"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Loader2, AlertCircle, Users } from "lucide-react"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { cn } from "@/lib/utils"
import { isSaasAdmin } from "@/lib/use-saas-admin"

/** Tipo retornado pela Edge Function admin-list-users */
interface AdminUser {
  id: string
  email: string
  full_name: string
  role: string
  company_name: string
  plan_type: string
}

function LoadingState() {
  return (
    <div className="flex min-h-[280px] flex-col items-center justify-center gap-4 p-8">
      <Loader2
        className="h-10 w-10 animate-spin text-primary"
        aria-hidden
      />
      <p className="text-sm font-medium text-foreground">Carregando usuários…</p>
    </div>
  )
}

export function AdminPage() {
  const { isLoaded, isSignedIn, user } = useUser()
  const { getToken } = useAuth()
  const supabase = useSupabaseClient()
  const [users, setUsers] = useState<AdminUser[]>([])
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">(
    "idle"
  )
  const [errorMsg, setErrorMsg] = useState<string>("")

  const fetchUsers = useCallback(async () => {
    // Token de sessão do Clerk (não o template supabase). A Edge Function admin-list-users
    // valida com verifyToken do Clerk, que exige o token padrão assinado pela chave do Clerk.
    const token = await getToken()
    if (!token) {
      setStatus("error")
      setErrorMsg("Token de acesso indisponível. Faça logout e login novamente.")
      return
    }

    setStatus("loading")
    setErrorMsg("")

    const { data, error } = await supabase.functions.invoke("admin-list-users", {
      headers: { Authorization: `Bearer ${token}` },
    })

    if (error) {
      let errMsg = error.message
      if (error instanceof FunctionsHttpError) {
        try {
          const parsed = (await error.context.json()) as { error?: string }
          if (parsed?.error) errMsg = parsed.error
        } catch {
          /* fallback */
        }
      }
      setStatus("error")
      setErrorMsg(errMsg)
      return
    }

    const body = data as { users?: AdminUser[] } | null
    setUsers(body?.users ?? [])
    setStatus("success")
  }, [getToken, supabase.functions])

  useEffect(() => {
    if (!isLoaded || !isSignedIn || !user) return
    if (!isSaasAdmin(user.publicMetadata as Record<string, unknown>)) {
      return
    }
    fetchUsers()
  }, [isLoaded, isSignedIn, user, fetchUsers])

  if (!isLoaded) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center bg-background">
        <LoadingState />
      </main>
    )
  }

  if (!isSignedIn) {
    return <Navigate to="/entrar" replace />
  }

  if (!isSaasAdmin(user?.publicMetadata as Record<string, unknown>)) {
    return <Navigate to="/dashboard" replace />
  }

  return (
    <main className="min-h-screen bg-background text-foreground">
      <header className="border-b border-border bg-card">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-2">
            <Users className="h-6 w-6 text-primary" aria-hidden />
            <h1 className="text-xl font-semibold text-foreground">
              Painel Administrativo
            </h1>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
        <Card className="border-border bg-card">
          <CardHeader>
            <CardTitle className="text-foreground">Usuários do sistema</CardTitle>
            <CardDescription className="text-muted-foreground">
              Lista de todos os usuários cadastrados na plataforma
            </CardDescription>
          </CardHeader>
          <CardContent>
            {status === "loading" && <LoadingState />}

            {status === "error" && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertTitle>Erro ao carregar usuários</AlertTitle>
                <AlertDescription>{errorMsg}</AlertDescription>
              </Alert>
            )}

            {status === "success" && (
              <div className="rounded-lg border border-border">
                <Table>
                  <TableHeader>
                    <TableRow className="border-border hover:bg-muted/50">
                      <TableHead className="text-muted-foreground">Nome</TableHead>
                      <TableHead className="text-muted-foreground">E-mail</TableHead>
                      <TableHead className="text-muted-foreground">Empresa</TableHead>
                      <TableHead className="text-muted-foreground">Função</TableHead>
                      <TableHead className="text-muted-foreground">Plano</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {users.length === 0 ? (
                      <TableRow className="border-border">
                        <TableCell
                          colSpan={5}
                          className="py-12 text-center text-muted-foreground"
                        >
                          Nenhum usuário encontrado
                        </TableCell>
                      </TableRow>
                    ) : (
                      users.map((u) => (
                        <TableRow
                          key={u.id}
                          className="border-border hover:bg-muted/50"
                        >
                          <TableCell className="font-medium text-foreground">
                            {u.full_name || "—"}
                          </TableCell>
                          <TableCell className="text-foreground">
                            {u.email}
                          </TableCell>
                          <TableCell className="text-muted-foreground">
                            {u.company_name || "—"}
                          </TableCell>
                          <TableCell>
                            <Badge
                              variant="secondary"
                              className={cn(
                                "bg-secondary/80 text-secondary-foreground",
                                u.role === "admin" && "bg-primary/20 text-primary"
                              )}
                            >
                              {u.role || "—"}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-muted-foreground">
                            {u.plan_type || "—"}
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </main>
  )
}
