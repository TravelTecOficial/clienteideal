import { useEffect, useState, useCallback } from "react"
import { Link } from "react-router-dom"
import { useUser } from "@clerk/clerk-react"
import { useSupabaseClient } from "@/lib/supabase-context"
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
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Loader2, AlertCircle, Check } from "lucide-react"
import { cn } from "@/lib/utils"

interface ProfileFormData {
  full_name: string
  phone: string
  job_title: string
  status: boolean
}

export function ProfilePage() {
  const { user } = useUser()
  const supabase = useSupabaseClient()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const [email, setEmail] = useState<string>("")
  const [form, setForm] = useState<ProfileFormData>({
    full_name: "",
    phone: "",
    job_title: "",
    status: true,
  })

  const fetchProfile = useCallback(async () => {
    if (!user?.id) return
    setLoading(true)
    setError(null)
    try {
      const { data, error: err } = await supabase
        .from("profiles")
        .select("full_name, email, phone, job_title, status")
        .eq("id", user.id)
        .maybeSingle()

      if (err) {
        setError(err.message)
        return
      }
      if (data) {
        setEmail((data.email as string) ?? "")
        setForm({
          full_name: (data.full_name as string) ?? "",
          phone: (data.phone as string) ?? "",
          job_title: (data.job_title as string) ?? "",
          status: data.status !== false,
        })
      }
    } catch {
      setError("Erro ao carregar perfil.")
    } finally {
      setLoading(false)
    }
  }, [user?.id, supabase])

  useEffect(() => {
    fetchProfile()
  }, [fetchProfile])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!user?.id) return
    setSaving(true)
    setError(null)
    setSuccess(false)
    try {
      const { error: err } = await supabase
        .from("profiles")
        .update({
          full_name: form.full_name.trim() || null,
          phone: form.phone.trim() || null,
          job_title: form.job_title.trim() || null,
          status: form.status,
        })
        .eq("id", user.id)

      if (err) {
        setError(err.message)
        return
      }
      setSuccess(true)
    } catch {
      setError("Erro ao salvar perfil.")
    } finally {
      setSaving(false)
    }
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
                  <Link to="/dashboard">Dashboard</Link>
                </BreadcrumbLink>
              </BreadcrumbItem>
              <BreadcrumbSeparator className="hidden md:block" />
              <BreadcrumbItem>
                <BreadcrumbPage>Perfil</BreadcrumbPage>
              </BreadcrumbItem>
            </BreadcrumbList>
          </Breadcrumb>
          <ProfileDropdown className="ml-auto" />
        </header>
        <div className="flex flex-1 flex-col gap-4 p-4">
          <Card className="border border-border rounded-md bg-white shadow-sm">
            <CardHeader>
              <CardTitle className="text-foreground">Meu perfil</CardTitle>
              <CardDescription className="text-muted-foreground">
                Edite suas informações. O e-mail não pode ser alterado.
              </CardDescription>
            </CardHeader>
            <form onSubmit={handleSubmit}>
              <CardContent className="space-y-6">
                {error && (
                  <Alert variant="destructive">
                    <AlertCircle className="h-4 w-4" />
                    <AlertTitle>Erro</AlertTitle>
                    <AlertDescription>{error}</AlertDescription>
                  </Alert>
                )}
                {success && (
                  <Alert className="border-success/50 bg-success/10 text-success">
                    <Check className="h-4 w-4" />
                    <AlertTitle>Salvo</AlertTitle>
                    <AlertDescription>
                      Suas informações foram atualizadas com sucesso.
                    </AlertDescription>
                  </Alert>
                )}
                {loading ? (
                  <div className="flex min-h-[200px] items-center justify-center">
                    <Loader2 className="h-10 w-10 animate-spin text-primary" />
                  </div>
                ) : (
                  <div className="grid gap-6 sm:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="full_name" className="text-foreground">
                        Nome completo
                      </Label>
                      <Input
                        id="full_name"
                        value={form.full_name}
                        onChange={(e) =>
                          setForm((f) => ({ ...f, full_name: e.target.value }))
                        }
                        placeholder="Seu nome"
                        className="bg-background text-foreground"
                        disabled={loading}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="email" className="text-foreground">
                        E-mail
                      </Label>
                      <Input
                        id="email"
                        type="email"
                        value={email}
                        readOnly
                        disabled
                        className="bg-muted text-muted-foreground cursor-not-allowed"
                        aria-describedby="email-help"
                      />
                      <p
                        id="email-help"
                        className="text-xs text-muted-foreground"
                      >
                        O e-mail não pode ser alterado.
                      </p>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="phone" className="text-foreground">
                        Telefone
                      </Label>
                      <Input
                        id="phone"
                        type="tel"
                        value={form.phone}
                        onChange={(e) =>
                          setForm((f) => ({ ...f, phone: e.target.value }))
                        }
                        placeholder="(00) 00000-0000"
                        className="bg-background text-foreground"
                        disabled={loading}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="job_title" className="text-foreground">
                        Cargo
                      </Label>
                      <Input
                        id="job_title"
                        value={form.job_title}
                        onChange={(e) =>
                          setForm((f) => ({ ...f, job_title: e.target.value }))
                        }
                        placeholder="Seu cargo"
                        className="bg-background text-foreground"
                        disabled={loading}
                      />
                    </div>
                    <div className="space-y-2 sm:col-span-2">
                      <Label className="text-foreground">Status</Label>
                      <select
                        value={form.status ? "true" : "false"}
                        onChange={(e) =>
                          setForm((f) => ({
                            ...f,
                            status: e.target.value === "true",
                          }))
                        }
                        disabled={loading}
                        className={cn(
                          "flex h-10 w-full max-w-xs rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground ring-offset-background",
                          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
                          "disabled:cursor-not-allowed disabled:opacity-50"
                        )}
                      >
                        <option value="true">Ativo</option>
                        <option value="false">Inativo</option>
                      </select>
                      <p className="text-xs text-muted-foreground">
                        Define se sua conta está ativa no sistema.
                      </p>
                    </div>
                  </div>
                )}
              </CardContent>
              {!loading && (
                <CardFooter>
                  <Button type="submit" disabled={saving}>
                    {saving ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Salvando…
                      </>
                    ) : (
                      <>
                        <Check className="h-4 w-4" />
                        Salvar alterações
                      </>
                    )}
                  </Button>
                </CardFooter>
              )}
            </form>
          </Card>
        </div>
      </SidebarInset>
    </SidebarProvider>
  )
}
