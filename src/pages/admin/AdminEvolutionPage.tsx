import { useState, useEffect, useCallback, useRef } from "react"
import { useUser, useAuth } from "@clerk/clerk-react"
import { Navigate } from "react-router-dom"
import { useSupabaseClient } from "@/lib/supabase-context"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { AdminLayout } from "@/components/admin-layout"
import { isSaasAdmin } from "@/lib/use-saas-admin"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Loader2, Check, Smartphone } from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import { getErrorMessage } from "@/lib/utils"

export function AdminEvolutionPage() {
  const { isLoaded, isSignedIn, user } = useUser()
  const { getToken } = useAuth()
  const supabase = useSupabaseClient()
  const { toast } = useToast()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({
    evolution_api_url: "",
    evolution_api_key: "",
  })
  const [errorMsg, setErrorMsg] = useState<string>("")
  const loadedRef = useRef(false)

  const fetchConfig = useCallback(async () => {
    const token = await getToken({ template: "supabase" }) ?? await getToken()
    if (!token) {
      setLoading(false)
      setErrorMsg("Token indisponível para carregar configurações.")
      return
    }
    setLoading(true)
    setErrorMsg("")
    try {
      const { data, error } = await supabase.functions.invoke("admin-evolution-config", {
        method: "POST",
        body: {},
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
      })
      if (error) throw error
      const body = data as { evolution_api_url?: string | null; error?: string }
      if (body?.error) throw new Error(body.error)
      setForm({
        evolution_api_url: body?.evolution_api_url ?? "",
        evolution_api_key: "", // Nunca carregado por segurança
      })
    } catch (err) {
      setErrorMsg(getErrorMessage(err))
    } finally {
      setLoading(false)
    }
  }, [getToken, supabase.functions])

  useEffect(() => {
    if (!isLoaded || !isSignedIn || !user) return
    if (!isSaasAdmin(user.publicMetadata as Record<string, unknown>)) return
    if (loadedRef.current) return
    loadedRef.current = true
    fetchConfig()
  }, [isLoaded, isSignedIn, user, fetchConfig])

  const handleSave = async () => {
    const token = await getToken({ template: "supabase" }) ?? await getToken()
    if (!token) {
      toast({ variant: "destructive", title: "Erro", description: "Token indisponível." })
      return
    }
    setSaving(true)
    try {
      const payload: Record<string, string | null> = {
        evolution_api_url: form.evolution_api_url.trim() || null,
      }
      if (form.evolution_api_key.trim()) {
        payload.evolution_api_key = form.evolution_api_key.trim()
      }
      const { data, error } = await supabase.functions.invoke("admin-evolution-config", {
        method: "POST",
        body: payload,
        headers: { Authorization: `Bearer ${token}` },
      })
      if (error) throw error
      const body = data as { error?: string }
      if (body?.error) throw new Error(body.error)
      toast({ title: "Salvo", description: "Configuração da Evolution API atualizada." })
      setForm((f) => ({ ...f, evolution_api_key: "" }))
      fetchConfig()
    } catch (err) {
      toast({
        variant: "destructive",
        title: "Erro ao salvar",
        description: getErrorMessage(err),
      })
    } finally {
      setSaving(false)
    }
  }

  if (!isLoaded) return null
  if (!isSignedIn) return <Navigate to="/entrar" replace />
  if (!isSaasAdmin(user?.publicMetadata as Record<string, unknown>)) {
    return <Navigate to="/dashboard" replace />
  }

  return (
    <AdminLayout breadcrumb={{ label: "Evolution API" }}>
      <Card className="border-border bg-card">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-foreground">
            <Smartphone className="h-5 w-5" />
            Evolution API (WhatsApp)
          </CardTitle>
          <CardDescription className="text-muted-foreground">
            Configure a URL e a API Key da Evolution API (global para todo o sistema). Depois, em Configurações, cadastre o webhook correto para Consórcio e Produtos. Ao conectar uma instância no Dashboard, o sistema usará o webhook do segmento da empresa.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {errorMsg && (
            <div className="rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
              <p>{errorMsg}</p>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="mt-2"
                onClick={() => {
                  loadedRef.current = false
                  fetchConfig()
                }}
              >
                Tentar novamente
              </Button>
            </div>
          )}
          {loading ? (
            <div className="flex min-h-[120px] items-center justify-center">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <div className="space-y-4 max-w-md">
              <div className="space-y-2">
                <Label htmlFor="evolution_api_url">URL da Evolution API</Label>
                <Input
                  id="evolution_api_url"
                  type="url"
                  placeholder="https://evolution.sua-vps.com"
                  value={form.evolution_api_url}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, evolution_api_url: e.target.value }))
                  }
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="evolution_api_key">API Key</Label>
                <Input
                  id="evolution_api_key"
                  type="password"
                  placeholder="••••••••"
                  autoComplete="off"
                  value={form.evolution_api_key}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, evolution_api_key: e.target.value }))
                  }
                />
                <p className="text-xs text-muted-foreground">
                  Deixe em branco para manter a chave atual.
                </p>
              </div>
              <Button onClick={handleSave} disabled={saving}>
                {saving ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Salvando…
                  </>
                ) : (
                  <>
                    <Check className="h-4 w-4" />
                    Salvar
                  </>
                )}
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </AdminLayout>
  )
}
