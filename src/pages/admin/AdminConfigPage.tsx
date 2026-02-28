import { useState, useEffect, useCallback, useRef } from "react"
import { useUser, useAuth } from "@clerk/clerk-react"
import { Navigate } from "react-router-dom"
import { FunctionsHttpError } from "@supabase/supabase-js"
import { useSupabaseClient } from "@/lib/supabase-context"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { AdminLayout } from "@/components/admin-layout"
import { isSaasAdmin } from "@/lib/use-saas-admin"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Loader2, Check, HandCoins, Package } from "lucide-react"
import { useToast } from "@/hooks/use-toast";
import { getErrorMessage } from "@/lib/utils"

type ConfigType = "consorcio" | "produtos"

interface WebhookConfig {
  config_type: string
  webhook_producao: string | null
  webhook_teste: string | null
  webhook_enviar_arquivos: string | null
}

const CONFIG_LABELS: Record<ConfigType, string> = {
  consorcio: "Consórcio",
  produtos: "Produtos & Serviços",
}

async function extractApiError(error: unknown): Promise<string> {
  if (error instanceof FunctionsHttpError && error.context) {
    try {
      const res = error.context.clone?.() ?? error.context
      const parsed = (await res.json()) as { error?: string; hint?: string }
      if (parsed?.error) {
        return parsed.hint ? `${parsed.error} — ${parsed.hint}` : parsed.error
      }
    } catch {
      /* fallback para message */
    }
  }
  return error instanceof Error ? error.message : "Erro desconhecido"
}

export function AdminConfigPage() {
  const { isLoaded, isSignedIn, user } = useUser()
  const { getToken } = useAuth()
  const supabase = useSupabaseClient()
  const { toast } = useToast()
  const [configs, setConfigs] = useState<WebhookConfig[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState<string | null>(null)
  const [selectedType, setSelectedType] = useState<ConfigType | null>(null)
  const [form, setForm] = useState({
    webhook_producao: "",
    webhook_teste: "",
    webhook_enviar_arquivos: "",
  })
  const [errorMsg, setErrorMsg] = useState<string>("")
  const loadedRef = useRef(false)

  const fetchConfigs = useCallback(async () => {
    const token = await getToken({ template: "supabase" }) ?? await getToken()
    if (!token) {
      setLoading(false)
      setErrorMsg("Token indisponível para carregar configurações.")
      return
    }
    setLoading(true)
    setErrorMsg("")
    try {
      const { data, error } = await supabase.functions.invoke("admin-webhook-config", {
        headers: { Authorization: `Bearer ${token}` },
      })
      if (error) {
        const msg = await extractApiError(error)
        throw new Error(msg)
      }
      const body = data as { configs?: WebhookConfig[] }
      setConfigs(body?.configs ?? [])
    } catch (err) {
      setErrorMsg(getErrorMessage(err))
    } finally {
      setLoading(false)
    }
  // toast é estável (useToast); exhaustive-deps reclama mas é necessário no catch
  }, [getToken, supabase.functions])

  useEffect(() => {
    if (!isLoaded || !isSignedIn || !user) return
    if (!isSaasAdmin(user.publicMetadata as Record<string, unknown>)) return
    if (loadedRef.current) return
    loadedRef.current = true
    fetchConfigs()
  }, [isLoaded, isSignedIn, user, fetchConfigs])

  useEffect(() => {
    if (!selectedType || configs.length === 0) return
    const c = configs.find((x) => x.config_type === selectedType)
    if (c) {
      setForm({
        webhook_producao: c.webhook_producao ?? "",
        webhook_teste: c.webhook_teste ?? "",
        webhook_enviar_arquivos: c.webhook_enviar_arquivos ?? "",
      })
    }
  }, [selectedType, configs])

  const handleSave = async () => {
    if (!selectedType) return
    const token = await getToken({ template: "supabase" }) ?? await getToken()
    if (!token) {
      toast({ variant: "destructive", title: "Erro", description: "Token indisponível." })
      return
    }
    setSaving(selectedType)
    try {
      const payload: Record<string, string | undefined> = {
        config_type: selectedType,
        webhook_producao: form.webhook_producao.trim() || undefined,
        webhook_teste: form.webhook_teste.trim() || undefined,
        webhook_enviar_arquivos: form.webhook_enviar_arquivos.trim() || undefined,
      }
      const { data, error } = await supabase.functions.invoke("admin-webhook-config", {
        body: payload,
        headers: { Authorization: `Bearer ${token}` },
      })
      if (error) {
        const msg = await extractApiError(error)
        throw new Error(msg)
      }
      const body = data as { error?: string; hint?: string }
      if (body?.error) throw new Error(body.hint ? `${body.error} ${body.hint}` : body.error)
      toast({ title: "Salvo", description: "Configurações atualizadas." })
      fetchConfigs()
    } catch (err) {
      toast({
        variant: "destructive",
        title: "Erro ao salvar",
        description: getErrorMessage(err),
      })
    } finally {
      setSaving(null)
    }
  }

  if (!isLoaded) return null
  if (!isSignedIn) return <Navigate to="/entrar" replace />
  if (!isSaasAdmin(user?.publicMetadata as Record<string, unknown>)) {
    return <Navigate to="/dashboard" replace />
  }

  return (
    <AdminLayout breadcrumb={{ label: "Configurações" }}>
      <Card className="border-border bg-card">
        <CardHeader>
          <CardTitle className="text-foreground">Tipos de Configuração</CardTitle>
          <CardDescription className="text-muted-foreground">
            Cadastre os webhooks por segmento. Consórcio e Produtos possuem três webhooks cada: Produção, Teste e Enviar arquivos.
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
                  fetchConfigs()
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
            <>
              <div className="grid gap-4 sm:grid-cols-2">
                {(["consorcio", "produtos"] as ConfigType[]).map((type) => (
                  <Card
                    key={type}
                    className={`cursor-pointer transition-colors hover:bg-muted/50 ${
                      selectedType === type ? "ring-2 ring-primary" : ""
                    }`}
                    onClick={() => setSelectedType(type)}
                  >
                    <CardHeader className="flex flex-row items-center gap-4">
                      {type === "consorcio" ? (
                        <HandCoins className="h-10 w-10 text-primary" />
                      ) : (
                        <Package className="h-10 w-10 text-primary" />
                      )}
                      <CardTitle className="text-lg">{CONFIG_LABELS[type]}</CardTitle>
                    </CardHeader>
                    <CardDescription>
                      Clique para configurar os webhooks (Produção, Teste, Enviar arquivos)
                    </CardDescription>
                  </Card>
                ))}
              </div>

              {selectedType && (
                <Card className="border-primary/30">
                  <CardHeader>
                    <CardTitle>{CONFIG_LABELS[selectedType]}</CardTitle>
                    <CardDescription>
                      Webhooks N8N para produção, testes e envio de arquivos
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="webhook_producao">Webhook Produção</Label>
                      <Input
                        id="webhook_producao"
                        type="url"
                        placeholder="https://seu-n8n.com/webhook/producao"
                        value={form.webhook_producao}
                        onChange={(e) =>
                          setForm((f) => ({ ...f, webhook_producao: e.target.value }))
                        }
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="webhook_teste">Webhook Teste</Label>
                      <Input
                        id="webhook_teste"
                        type="url"
                        placeholder="https://seu-n8n.com/webhook/teste"
                        value={form.webhook_teste}
                        onChange={(e) =>
                          setForm((f) => ({ ...f, webhook_teste: e.target.value }))
                        }
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="webhook_arquivos">Webhook Enviar arquivos</Label>
                      <Input
                        id="webhook_arquivos"
                        type="url"
                        placeholder="https://seu-n8n.com/webhook/enviar-arquivos"
                        value={form.webhook_enviar_arquivos}
                        onChange={(e) =>
                          setForm((f) => ({ ...f, webhook_enviar_arquivos: e.target.value }))
                        }
                      />
                    </div>
                    <Button onClick={handleSave} disabled={!!saving}>
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
                  </CardContent>
                </Card>
              )}
            </>
          )}
        </CardContent>
      </Card>
    </AdminLayout>
  )
}
