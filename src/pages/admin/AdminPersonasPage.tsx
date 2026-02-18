import { useEffect, useState, useCallback } from "react"
import { useUser, useAuth } from "@clerk/clerk-react"
import { Navigate } from "react-router-dom"
import { SUPABASE_URL, SUPABASE_ANON_KEY } from "@/lib/supabase"
import { AdminLayout } from "@/components/admin-layout"
import { isSaasAdmin } from "@/lib/use-saas-admin"
import { getErrorMessage } from "@/lib/utils"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import * as z from "zod"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { useToast } from "@/hooks/use-toast"
import {
  User,
  Brain,
  ShoppingCart,
  Save,
  Loader2,
  Plus,
  Edit2,
  Trash2,
  AlertCircle,
  ImageIcon,
} from "lucide-react"

const templateSchema = z.object({
  profile_name: z.string().min(2, "O nome do perfil é obrigatório"),
  description: z.string().optional(),
  age_range: z.string().optional(),
  gender: z.string().optional(),
  location: z.string().optional(),
  income_level: z.string().optional(),
  job_title: z.string().optional(),
  goals_dreams: z.string().optional(),
  pain_points: z.string().optional(),
  values_list: z.string().optional(),
  hobbies_interests: z.string().optional(),
  buying_journey: z.string().optional(),
  decision_criteria: z.string().optional(),
  common_objections: z.string().optional(),
  target_product: z.string().optional(),
  segment_type: z.enum(["geral", "produtos", "consorcio", "seguros"]).default("geral"),
})

type TemplateFormValues = z.infer<typeof templateSchema>

interface PersonaTemplateRow {
  id: string
  profile_name: string | null
  description: string | null
  job_title: string | null
  location: string | null
  age_range?: string | null
  gender?: string | null
  income_level?: string | null
  goals_dreams?: string | null
  pain_points?: string | null
  values_list?: string | null
  hobbies_interests?: string | null
  buying_journey?: string | null
  decision_criteria?: string | null
  common_objections?: string | null
  target_product?: string | null
  avatar_url?: string | null
  segment_type?: "geral" | "produtos" | "consorcio" | "seguros" | null
}

export function AdminPersonasPage() {
  const { isLoaded, isSignedIn, user } = useUser()
  const { getToken } = useAuth()
  const { toast } = useToast()
  const [templates, setTemplates] = useState<PersonaTemplateRow[]>([])
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle")
  const [errorMsg, setErrorMsg] = useState("")
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [isSaving, setIsSaving] = useState(false)
  const [generatingAvatarId, setGeneratingAvatarId] = useState<string | null>(null)

  const form = useForm<TemplateFormValues>({
    resolver: zodResolver(templateSchema),
    defaultValues: {
      profile_name: "",
      description: "",
      age_range: "",
      gender: "",
      location: "",
      income_level: "",
      job_title: "",
      goals_dreams: "",
      pain_points: "",
      values_list: "",
      hobbies_interests: "",
      buying_journey: "",
      decision_criteria: "",
      common_objections: "",
      target_product: "",
      segment_type: "geral",
    },
  })

  const fetchTemplates = useCallback(async () => {
    const token = (await getToken()) ?? (await getToken({ template: "supabase" }))
    if (!token) {
      setStatus("error")
      setErrorMsg("Token indisponível. Faça login novamente.")
      return
    }
    setStatus("loading")
    setErrorMsg("")
    try {
      const res = await fetch(`${SUPABASE_URL}/functions/v1/admin-persona-templates`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          apikey: SUPABASE_ANON_KEY,
          Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
        },
        body: JSON.stringify({ action: "list", token }),
      })
      const data = (await res.json().catch(() => ({}))) as { error?: string; templates?: PersonaTemplateRow[] }
      if (!res.ok) throw new Error(data?.error ?? `Erro ${res.status}`)
      if (data?.error) throw new Error(data.error)
      setTemplates(data?.templates ?? [])
      setStatus("success")
    } catch (err) {
      setStatus("error")
      setErrorMsg(getErrorMessage(err, "Erro ao carregar modelos."))
    }
  }, [getToken])

  useEffect(() => {
    if (!isLoaded || !isSignedIn || !user) return
    if (!isSaasAdmin(user.publicMetadata as Record<string, unknown>)) return
    fetchTemplates()
  }, [isLoaded, isSignedIn, user, fetchTemplates])

  const handleOpenNew = () => {
    setEditingId(null)
    form.reset({
      profile_name: "",
      description: "",
      age_range: "",
      gender: "",
      location: "",
      income_level: "",
      job_title: "",
      goals_dreams: "",
      pain_points: "",
      values_list: "",
      hobbies_interests: "",
      buying_journey: "",
      decision_criteria: "",
      common_objections: "",
      target_product: "",
      segment_type: "geral",
    })
    setIsModalOpen(true)
  }

  const handleOpenEdit = (id: string) => {
    const t = templates.find((x) => x.id === id)
    if (!t) return
    setEditingId(id)
    form.reset({
      profile_name: t.profile_name ?? "",
      description: t.description ?? "",
      age_range: t.age_range ?? "",
      gender: t.gender ?? "",
      location: t.location ?? "",
      income_level: t.income_level ?? "",
      job_title: t.job_title ?? "",
      goals_dreams: t.goals_dreams ?? "",
      pain_points: t.pain_points ?? "",
      values_list: t.values_list ?? "",
      hobbies_interests: t.hobbies_interests ?? "",
      buying_journey: t.buying_journey ?? "",
      decision_criteria: t.decision_criteria ?? "",
      common_objections: t.common_objections ?? "",
      target_product: t.target_product ?? "",
      segment_type: t.segment_type ?? "geral",
    })
    setIsModalOpen(true)
  }

  async function onSubmit(values: TemplateFormValues) {
    const token = (await getToken()) ?? (await getToken({ template: "supabase" }))
    if (!token) {
      toast({
        variant: "destructive",
        title: "Erro",
        description: "Sessão inválida. Faça login novamente.",
      })
      return
    }
    setIsSaving(true)
    try {
      const payload = {
        action: editingId ? "update" : "create",
        token,
        id: editingId ?? undefined,
        profile_name: values.profile_name.trim(),
        description: values.description?.trim() || null,
        age_range: values.age_range?.trim() || null,
        gender: values.gender?.trim() || null,
        location: values.location?.trim() || null,
        income_level: values.income_level?.trim() || null,
        job_title: values.job_title?.trim() || null,
        goals_dreams: values.goals_dreams?.trim() || null,
        pain_points: values.pain_points?.trim() || null,
        values_list: values.values_list?.trim() || null,
        hobbies_interests: values.hobbies_interests?.trim() || null,
        buying_journey: values.buying_journey?.trim() || null,
        decision_criteria: values.decision_criteria?.trim() || null,
        common_objections: values.common_objections?.trim() || null,
        target_product: values.target_product?.trim() || null,
        segment_type: values.segment_type,
      }
      const res = await fetch(`${SUPABASE_URL}/functions/v1/admin-persona-templates`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          apikey: SUPABASE_ANON_KEY,
          Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
        },
        body: JSON.stringify(payload),
      })
      const data = (await res.json().catch(() => ({}))) as { error?: string }
      if (!res.ok) throw new Error(data?.error ?? `Erro ${res.status}`)
      if (data?.error) throw new Error(data.error)
      toast({
        title: editingId ? "Atualizado!" : "Criado!",
        description: "Modelo de persona salvo com sucesso.",
      })
      setIsModalOpen(false)
      fetchTemplates()
    } catch (err) {
      toast({
        variant: "destructive",
        title: "Erro ao salvar",
        description: getErrorMessage(err, "Erro ao salvar."),
      })
    } finally {
      setIsSaving(false)
    }
  }

  async function handleDelete(t: PersonaTemplateRow) {
    const confirmed = window.confirm(
      `Excluir o modelo "${t.profile_name ?? "Sem nome"}"? Esta ação não pode ser desfeita.`
    )
    if (!confirmed) return
    const token = (await getToken()) ?? (await getToken({ template: "supabase" }))
    if (!token) return
    try {
      const res = await fetch(`${SUPABASE_URL}/functions/v1/admin-persona-templates`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          apikey: SUPABASE_ANON_KEY,
          Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
        },
        body: JSON.stringify({ action: "delete", id: t.id, token }),
      })
      const data = (await res.json().catch(() => ({}))) as { error?: string }
      if (!res.ok) throw new Error(data?.error ?? `Erro ${res.status}`)
      if (data?.error) throw new Error(data.error)
      toast({ title: "Excluído", description: "Modelo removido." })
      fetchTemplates()
    } catch (err) {
      toast({
        variant: "destructive",
        title: "Erro ao excluir",
        description: getErrorMessage(err),
      })
    }
  }

  async function handleGenerateAvatarTemplate(t: PersonaTemplateRow) {
    const token = (await getToken()) ?? (await getToken({ template: "supabase" }))
    if (!token) {
      toast({
        variant: "destructive",
        title: "Erro",
        description: "Sessão inválida. Faça login novamente.",
      })
      return
    }
    setGeneratingAvatarId(t.id)
    try {
      const res = await fetch(`${SUPABASE_URL}/functions/v1/persona-template-generate-avatar`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          apikey: SUPABASE_ANON_KEY,
          Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
        },
        body: JSON.stringify({ template_id: t.id, token }),
      })
      const data = (await res.json().catch(() => ({}))) as { error?: string }
      if (!res.ok) throw new Error(data?.error ?? `Erro ${res.status}`)
      if (data?.error) throw new Error(data.error)
      toast({
        title: "Avatar gerado!",
        description: "A foto do modelo foi criada com sucesso.",
      })
      fetchTemplates()
    } catch (err) {
      toast({
        variant: "destructive",
        title: "Erro ao gerar avatar",
        description: getErrorMessage(err, "Falha ao gerar avatar."),
      })
    } finally {
      setGeneratingAvatarId(null)
    }
  }

  if (!isLoaded) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center bg-background">
        <Loader2 className="h-10 w-10 animate-spin text-primary" />
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
    <AdminLayout breadcrumb={{ label: "Modelos de Persona", page: "Modelos de Persona" }}>
      <Card className="border-border bg-card">
        <CardHeader>
          <div className="flex justify-between items-center">
            <div>
              <CardTitle className="text-foreground">Modelos de Persona</CardTitle>
              <CardDescription className="text-muted-foreground">
                Modelos globais que as licenças podem copiar para sua empresa na página Cliente Ideal.
              </CardDescription>
            </div>
            <Button onClick={handleOpenNew}>
              <Plus className="mr-2 h-4 w-4" /> Novo Modelo
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {status === "loading" && (
            <div className="flex min-h-[120px] items-center justify-center">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          )}

          {status === "error" && (
            <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-4 flex items-center gap-3">
              <AlertCircle className="h-5 w-5 text-destructive shrink-0" />
              <div className="flex-1">
                <p className="font-medium text-destructive">Erro ao carregar modelos</p>
                <p className="text-sm text-muted-foreground">{errorMsg}</p>
              </div>
              <Button variant="outline" size="sm" onClick={() => fetchTemplates()}>
                Tentar novamente
              </Button>
            </div>
          )}

          {status === "success" && (
            <div className="rounded-lg border border-border">
              <Table>
                <TableHeader>
                  <TableRow className="border-border hover:bg-muted/50">
                    <TableHead className="text-muted-foreground w-24">Avatar</TableHead>
                    <TableHead className="text-muted-foreground">Perfil</TableHead>
                    <TableHead className="text-muted-foreground">Segmento</TableHead>
                    <TableHead className="text-muted-foreground">Cargo</TableHead>
                    <TableHead className="text-muted-foreground">Localização</TableHead>
                    <TableHead className="text-muted-foreground">Descrição</TableHead>
                    <TableHead className="text-right text-muted-foreground">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {templates.length === 0 ? (
                    <TableRow className="border-border">
                      <TableCell
                          colSpan={7}
                        className="py-12 text-center text-muted-foreground"
                      >
                        Nenhum modelo cadastrado. Clique em &quot;Novo Modelo&quot; para começar.
                      </TableCell>
                    </TableRow>
                  ) : (
                    templates.map((t) => (
                      <TableRow key={t.id} className="border-border hover:bg-muted/50">
                        <TableCell className="w-24">
                          {t.avatar_url ? (
                            <img
                              src={t.avatar_url}
                              alt={`Avatar de ${t.profile_name ?? "modelo"}`}
                              className="h-16 w-16 rounded-full object-cover border border-border"
                            />
                          ) : (
                            <div className="h-16 w-16 rounded-full bg-muted flex items-center justify-center">
                              <User className="h-6 w-6 text-muted-foreground" />
                            </div>
                          )}
                        </TableCell>
                        <TableCell className="font-medium text-foreground">
                          {t.profile_name ?? "—"}
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {t.segment_type === "consorcio"
                            ? "Consórcio"
                            : t.segment_type === "seguros"
                              ? "Seguros"
                              : t.segment_type === "produtos"
                                ? "Produtos & Serviços"
                                : "Geral"}
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {t.job_title ?? "—"}
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {t.location ?? "—"}
                        </TableCell>
                        <TableCell className="text-muted-foreground max-w-[200px] truncate">
                          {t.description ?? "—"}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-1">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleGenerateAvatarTemplate(t)}
                              disabled={generatingAvatarId === t.id}
                              aria-label={`Gerar avatar de ${t.profile_name ?? "modelo"}`}
                            >
                              {generatingAvatarId === t.id ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                              ) : (
                                <ImageIcon className="h-4 w-4" />
                              )}
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleOpenEdit(t.id)}
                              aria-label={`Editar ${t.profile_name ?? "modelo"}`}
                            >
                              <Edit2 className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="text-destructive hover:text-destructive hover:bg-destructive/10"
                              onClick={() => handleDelete(t)}
                              aria-label={`Excluir ${t.profile_name ?? "modelo"}`}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
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

      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-foreground">
              {editingId ? "Editar Modelo de Persona" : "Novo Modelo de Persona"}
            </DialogTitle>
            <DialogDescription className="text-muted-foreground">
              Os campos preenchidos serão copiados quando uma licença usar este modelo.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={form.handleSubmit(onSubmit)}>
            <Tabs defaultValue="demographics" className="w-full">
              <TabsList className="grid w-full grid-cols-3 mb-4">
                <TabsTrigger value="demographics">
                  <User className="w-4 h-4 mr-2" /> Demográficos
                </TabsTrigger>
                <TabsTrigger value="psychographics">
                  <Brain className="w-4 h-4 mr-2" /> Psicográficos
                </TabsTrigger>
                <TabsTrigger value="behavior">
                  <ShoppingCart className="w-4 h-4 mr-2" /> Comportamento
                </TabsTrigger>
              </TabsList>

              <TabsContent value="demographics">
                <Card>
                  <CardHeader>
                    <CardTitle>Dados Demográficos</CardTitle>
                    <CardDescription>Quem é o cliente ideal deste modelo?</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="space-y-2">
                      <Label>Descrição (uso interno)</Label>
                      <Input
                        {...form.register("description")}
                        placeholder="Ex: Empreendedor B2B, 35-50 anos"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Segmento</Label>
                      <Select
                        value={form.watch("segment_type")}
                        onValueChange={(value) =>
                          form.setValue("segment_type", value as TemplateFormValues["segment_type"])
                        }
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Selecione o segmento" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="geral">Geral</SelectItem>
                          <SelectItem value="produtos">Produtos & Serviços</SelectItem>
                          <SelectItem value="consorcio">Consórcio</SelectItem>
                          <SelectItem value="seguros">Seguros</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>Nome Fictício do Perfil *</Label>
                        <Input
                          {...form.register("profile_name")}
                          placeholder="Ex: Pedro Empreendedor"
                        />
                        {form.formState.errors.profile_name && (
                          <p className="text-red-500 text-xs">
                            {form.formState.errors.profile_name.message}
                          </p>
                        )}
                      </div>
                      <div className="space-y-2">
                        <Label>Cargo / Profissão</Label>
                        <Input
                          {...form.register("job_title")}
                          placeholder="Ex: Diretor de Vendas"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Faixa Etária</Label>
                        <Input
                          {...form.register("age_range")}
                          placeholder="Ex: 30-45 anos"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Localização</Label>
                        <Input
                          {...form.register("location")}
                          placeholder="Ex: São Paulo / Brasil"
                        />
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="psychographics">
                <Card>
                  <CardHeader>
                    <CardTitle>Dados Psicográficos</CardTitle>
                    <CardDescription>O que o cliente pensa e sente?</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="space-y-2">
                      <Label>Dores e Problemas</Label>
                      <Textarea
                        {...form.register("pain_points")}
                        placeholder="Descreva as dificuldades atuais..."
                        className="min-h-[100px]"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Objetivos e Sonhos</Label>
                      <Textarea
                        {...form.register("goals_dreams")}
                        placeholder="O que ele deseja conquistar..."
                        className="min-h-[100px]"
                      />
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="behavior">
                <Card>
                  <CardHeader>
                    <CardTitle>Comportamento de Compra</CardTitle>
                    <CardDescription>Como ele toma decisões de compra?</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="space-y-2">
                      <Label>Objeções Comuns</Label>
                      <Textarea
                        {...form.register("common_objections")}
                        placeholder="Ex: Preço alto, falta de tempo..."
                        className="min-h-[100px]"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Critérios de Decisão</Label>
                      <Textarea
                        {...form.register("decision_criteria")}
                        placeholder="Ex: Atendimento, Suporte, Preço"
                        className="min-h-[100px]"
                      />
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>

            <div className="flex justify-end gap-3 pt-6 border-t border-border mt-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsModalOpen(false)}
              >
                Cancelar
              </Button>
              <Button type="submit" disabled={isSaving}>
                {isSaving ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Save className="mr-2 h-4 w-4" />
                )}
                {editingId ? "Atualizar" : "Salvar"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </AdminLayout>
  )
}
