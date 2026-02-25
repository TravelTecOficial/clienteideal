import { useState, useEffect, useCallback, useRef } from "react"
import { useUser, useAuth } from "@clerk/clerk-react"
import { Navigate } from "react-router-dom"
import { useSupabaseClient } from "@/lib/supabase-context"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { AdminLayout } from "@/components/admin-layout"
import { isSaasAdmin } from "@/lib/use-saas-admin"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Loader2, Check, BarChart2 } from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import { getErrorMessage } from "@/lib/utils"

export function AdminGtmPage() {
  const { isLoaded, isSignedIn, user } = useUser()
  const { getToken } = useAuth()
  const supabase = useSupabaseClient()
  const { toast } = useToast()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({
    gtm_head: "",
    gtm_body: "",
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
      const { data, error } = await supabase.functions.invoke("admin-gtm-config", {
        method: "POST",
        body: {},
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
      })
      if (error) throw error
      const body = data as { gtm_head?: string | null; gtm_body?: string | null; error?: string }
      if (body?.error) throw new Error(body.error)
      setForm({
        gtm_head: body?.gtm_head ?? "",
        gtm_body: body?.gtm_body ?? "",
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
      const payload = {
        gtm_head: form.gtm_head.trim() || null,
        gtm_body: form.gtm_body.trim() || null,
      }
      const { data, error } = await supabase.functions.invoke("admin-gtm-config", {
        method: "POST",
        body: payload,
        headers: { Authorization: `Bearer ${token}` },
      })
      if (error) throw error
      const body = data as { error?: string }
      if (body?.error) throw new Error(body.error)
      toast({ title: "Salvo", description: "Configuração do Google Tag Manager atualizada." })
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
    <AdminLayout breadcrumb={{ label: "Google Tag Manager" }}>
      <Card className="border-border bg-card">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-foreground">
            <BarChart2 className="h-5 w-5" />
            Google Tag Manager
          </CardTitle>
          <CardDescription className="text-muted-foreground">
            Cole os códigos do Google Tag Manager para head e body. Os scripts serão injetados em todas as páginas da aplicação. O conteúdo deve conter googletagmanager.com.
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
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="gtm_head">Código do Head</Label>
                <Textarea
                  id="gtm_head"
                  placeholder='&lt;script&gt;(function(w,d,s,l,i){...})(window,document,&apos;script&apos;,&apos;dataLayer&apos;,&apos;GTM-XXXXXX&apos;);&lt;/script&gt;'
                  value={form.gtm_head}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, gtm_head: e.target.value }))
                  }
                  rows={6}
                  className="font-mono text-sm"
                />
                <p className="text-xs text-muted-foreground">
                  Script que será injetado no &lt;head&gt; da página.
                </p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="gtm_body">Código do Body</Label>
                <Textarea
                  id="gtm_body"
                  placeholder='&lt;noscript&gt;&lt;iframe src="https://www.googletagmanager.com/ns.html?id=GTM-XXXXXX" ...&gt;&lt;/noscript&gt;'
                  value={form.gtm_body}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, gtm_body: e.target.value }))
                  }
                  rows={4}
                  className="font-mono text-sm"
                />
                <p className="text-xs text-muted-foreground">
                  Conteúdo &lt;noscript&gt; que será injetado no &lt;body&gt; (fallback quando JavaScript está desabilitado).
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
