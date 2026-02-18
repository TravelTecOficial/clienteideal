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
import { Loader2, Check, HandCoins, Package, MessageSquare } from "lucide-react"
import { useToast } from "@/hooks/use-toast";
import { getErrorMessage } from "@/lib/utils"

type ConfigType = "consorcio" | "produtos" | "chat"

interface WebhookConfig {
  config_type: string
  webhook_testar_atendente: string | null
  webhook_enviar_arquivos: string | null
  webhook_chat: string | null
}

const CONFIG_LABELS: Record<ConfigType, string> = {
  consorcio: "Consórcio",
  produtos: "Produtos & Serviços",
  chat: "Chat de Conhecimento",
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
    webhook_testar_atendente: "",
    webhook_enviar_arquivos: "",
    webhook_chat: "",
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
      if (error) throw error
      const body = data as { configs?: WebhookConfig[] }
      setConfigs(body?.configs ?? [])
    } catch (err) {
      setErrorMsg(getErrorMessage(err))
    } finally {
      setLoading(false)
    }
  }, [getToken, supabase.functions, toast])

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
        webhook_testar_atendente: c.webhook_testar_atendente ?? "",
        webhook_enviar_arquivos: c.webhook_enviar_arquivos ?? "",
        webhook_chat: c.webhook_chat ?? "",
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
      }
      if (selectedType === "chat") {
        payload.webhook_chat = form.webhook_chat.trim() || undefined
      } else {
        payload.webhook_testar_atendente = form.webhook_testar_atendente.trim() || undefined
        payload.webhook_enviar_arquivos = form.webhook_enviar_arquivos.trim() || undefined
      }
      const { data, error } = await supabase.functions.invoke("admin-webhook-config", {
        body: payload,
        headers: { Authorization: `Bearer ${token}` },
      })
      if (error) throw error
      const body = data as { error?: string }
      if (body?.error) throw new Error(body.error)
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
            Cadastre os webhooks por tipo. Consórcio e Produtos possuem dois webhooks cada. O Chat de Conhecimento usa uma URL global única para todas as empresas.
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
              <div className="grid gap-4 sm:grid-cols-3">
                {(["consorcio", "produtos", "chat"] as ConfigType[]).map((type) => (
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
                      ) : type === "produtos" ? (
                        <Package className="h-10 w-10 text-primary" />
                      ) : (
                        <MessageSquare className="h-10 w-10 text-primary" />
                      )}
                      <CardTitle className="text-lg">{CONFIG_LABELS[type]}</CardTitle>
                    </CardHeader>
                    <CardDescription>
                      {type === "chat"
                        ? "Webhook global (todas as empresas)"
                        : "Clique para configurar os webhooks"}
                    </CardDescription>
                  </Card>
                ))}
              </div>

              {selectedType && (
                <Card className="border-primary/30">
                  <CardHeader>
                    <CardTitle>{CONFIG_LABELS[selectedType]}</CardTitle>
                    <CardDescription>
                      {selectedType === "chat"
                        ? "URL única do webhook N8N para o Chat de Conhecimento (formato Evolution API)"
                        : "Webhook para testar atendente e para enviar arquivos ao N8N"}
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {selectedType === "chat" ? (
                      <div className="space-y-2">
                        <Label htmlFor="webhook_chat">Webhook do Chat de Conhecimento</Label>
                        <Input
                          id="webhook_chat"
                          type="url"
                          placeholder="https://seu-n8n.com/webhook/consulta-chat"
                          value={form.webhook_chat}
                          onChange={(e) =>
                            setForm((f) => ({ ...f, webhook_chat: e.target.value }))
                          }
                        />
                      </div>
                    ) : (
                      <>
                        <div className="space-y-2">
                          <Label htmlFor="webhook_testar">Webhook para testar atendente</Label>
                          <Input
                            id="webhook_testar"
                            type="url"
                            placeholder="https://seu-n8n.com/webhook/testar-atendente"
                            value={form.webhook_testar_atendente}
                            onChange={(e) =>
                              setForm((f) => ({ ...f, webhook_testar_atendente: e.target.value }))
                            }
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="webhook_arquivos">Webhook para enviar arquivos ao N8N</Label>
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
                      </>
                    )}
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
