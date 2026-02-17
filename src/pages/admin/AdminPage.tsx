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
import { Button } from "@/components/ui/button"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Loader2, AlertCircle, LayoutDashboard } from "lucide-react"
import { Link } from "react-router-dom"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { cn } from "@/lib/utils"
import { isSaasAdmin } from "@/lib/use-saas-admin"
import { AdminLayout } from "@/components/admin-layout"

/** Tipo retornado pela Edge Function admin-list-users */
interface AdminUser {
  id: string
  email: string
  full_name: string
  role: string
  company_id: string
  company_name: string
  plan_type: string
  segment_type: string
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
  const [updatingSegment, setUpdatingSegment] = useState<string | null>(null)

  const fetchUsers = useCallback(async () => {
    if (!user?.id) return
    const supabaseTemplateToken = await getToken({ template: "supabase" })
    const defaultToken = await getToken()
    const token = supabaseTemplateToken ?? defaultToken
    try {
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
        let statusCode: number | undefined
        if (error instanceof FunctionsHttpError && error.context) {
          statusCode = error.context.status
          const responseClone = error.context.clone()
          let responseText = ""
          try {
            responseText = await responseClone.text()
          } catch {
            responseText = ""
          }
          try {
            const parsed = (await error.context.json()) as { error?: string }
            if (parsed?.error) errMsg = parsed.error
          } catch {
            if (statusCode) errMsg = `${errMsg} (HTTP ${statusCode})`
          }
          if (statusCode === 401 || statusCode === 403) {
            errMsg +=
              " Verifique CLERK_SECRET_KEY no Supabase (projeto correto), JWT Template 'supabase' no Clerk e se o usuário logado tem publicMetadata.role='admin'."
          }
          if (responseText) {
            console.error("[admin] resposta 401/403 admin-list-users:", responseText)
          }
        }
        setStatus("error")
        setErrorMsg(errMsg)
        return
      }

      const body = data as { users?: AdminUser[] } | null
      setUsers(body?.users ?? [])
      setStatus("success")
    } catch (err) {
      setStatus("error")
      setErrorMsg(err instanceof Error ? err.message : "Erro ao carregar usuários.")
    }
  }, [getToken, supabase.functions, user?.id])

  useEffect(() => {
    if (!isLoaded || !isSignedIn || !user) return
    if (!isSaasAdmin(user.publicMetadata as Record<string, unknown>)) {
      return
    }
    if (status !== "idle") {
      return
    }
    fetchUsers()
  }, [isLoaded, isSignedIn, user, status, fetchUsers])

  const handleSegmentChange = async (u: AdminUser, newSegment: "produtos" | "consorcio") => {
    if (!u.company_id || newSegment === u.segment_type) return
    setUpdatingSegment(u.id)
    const token = await getToken({ template: "supabase" }) ?? await getToken()
    if (!token) {
      setErrorMsg("Token indisponível.")
      setUpdatingSegment(null)
      return
    }
    try {
      const { data, error } = await supabase.functions.invoke("admin-update-company", {
        body: { company_id: u.company_id, segment_type: newSegment },
        headers: { Authorization: `Bearer ${token}` },
      })
      if (error) throw error
      const body = data as { error?: string }
      if (body?.error) throw new Error(body.error)
      setUsers((prev) =>
        prev.map((x) =>
          x.id === u.id ? { ...x, segment_type: newSegment } : x
        )
      )
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : "Erro ao atualizar segmento.")
    } finally {
      setUpdatingSegment(null)
    }
  }

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
    <AdminLayout breadcrumb={{ label: "Usuários", page: "Usuários do sistema" }}>
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
                <AlertDescription className="space-y-3">
                  <p>{errorMsg}</p>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setErrorMsg("")
                      setStatus("idle")
                    }}
                  >
                    Tentar novamente
                  </Button>
                </AlertDescription>
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
                      <TableHead className="text-muted-foreground">Tipo</TableHead>
                      <TableHead className="text-muted-foreground">Plano</TableHead>
                      <TableHead className="text-muted-foreground text-right">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {users.length === 0 ? (
                      <TableRow className="border-border">
                        <TableCell
                          colSpan={7}
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
                          <TableCell>
                            <Select
                              value={u.segment_type || "produtos"}
                              onValueChange={(v) => handleSegmentChange(u, v as "produtos" | "consorcio")}
                              disabled={!!updatingSegment}
                            >
                              <SelectTrigger className="w-[160px] h-8">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="produtos">Produtos & Serviços</SelectItem>
                                <SelectItem value="consorcio">Consórcio</SelectItem>
                              </SelectContent>
                            </Select>
                          </TableCell>
                          <TableCell className="text-muted-foreground">
                            {u.plan_type || "—"}
                          </TableCell>
                          <TableCell className="text-right">
                            {u.company_id ? (
                              <Button variant="outline" size="sm" asChild>
                                <Link
                                  to={`/admin/preview/${u.company_id}`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="gap-1"
                                >
                                  <LayoutDashboard className="h-4 w-4" />
                                  Ver Dashboard
                                </Link>
                              </Button>
                            ) : (
                              "—"
                            )}
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
    </AdminLayout>
  )
}
