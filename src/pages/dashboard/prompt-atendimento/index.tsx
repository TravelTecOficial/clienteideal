import { useState, useEffect, useCallback } from "react"
import { Link, useNavigate } from "react-router-dom"
import { useAuth } from "@clerk/clerk-react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import * as z from "zod"
import type { SupabaseClient } from "@supabase/supabase-js"

import { Loader2, Check, MessageSquare, Plus, Pencil, Trash2, UserPlus } from "lucide-react"

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
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Switch } from "@/components/ui/switch"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { useSupabaseClient } from "@/lib/supabase-context"
import { getErrorMessage } from "@/lib/utils"
import { useToast } from "@/hooks/use-toast"

const CATEGORIA_OBJETIVO_OPTIONS = [
  { value: "atendimento", label: "Apenas Atendimento" },
  { value: "atendimento_agendamento", label: "Atendimento + Agendamento" },
  { value: "atendimento_qualificacao_agendamento", label: "Atendimento + Qualificação + Agendamento" },
  { value: "atendimento_completo", label: "Atendimento + Qualificação + Agendamento + Pagamento" },
  { value: "atendimento_agendamento_pagamento", label: "Atendimento + Agendamento + Pagamento" },
] as const

interface ProfileRow {
  company_id: string | null
}

interface PersonaOption {
  id: string
  profile_name: string | null
}

interface PromptTemplateOption {
  id: string
  name: string | null
  descricao: string | null
}

interface PromptAtendimentoRow {
  id: string
  name: string | null
  nome_atendente: string | null
  principais_instrucoes: string | null
  papel: string | null
  tom_voz: string | null
  persona_id: string | null
  prompt_template_id: string | null
  fluxo_objetivo: string | null
  follow_up_active: boolean | null
  follow_up_tempo: number | null
  follow_up_tentativas: number | null
}

async function fetchCompanyId(
  supabase: SupabaseClient,
  userId: string
): Promise<string | null> {
  const { data, error } = await supabase
    .from("profiles")
    .select("company_id")
    .eq("id", userId)
    .maybeSingle()

  if (error) {
    console.error("Erro ao buscar company_id:", error)
    return null
  }
  const profile = data as ProfileRow | null
  return profile?.company_id ?? null
}

const formSchema = z.object({
  name: z.string().optional(),
  fluxo_objetivo: z.string().optional(),
  prompt_template_id: z.string().optional(),
  follow_up_active: z.boolean().default(false),
  follow_up_tempo: z
    .union([z.number(), z.string()])
    .transform((v) => (typeof v === "string" ? parseInt(v, 10) || 0 : v))
    .pipe(z.number().min(0)),
  follow_up_tentativas: z
    .union([z.number(), z.string()])
    .transform((v) => (typeof v === "string" ? parseInt(v, 10) || 0 : v))
    .pipe(z.number().min(0)),
  nome_atendente: z.string().optional(),
  principais_instrucoes: z.string().optional(),
  papel: z.string().optional(),
  tom_voz: z.string().optional(),
  persona_id: z.string().optional(),
})

type FormValues = z.infer<typeof formSchema>

function getDisplayLabel(row: PromptAtendimentoRow, personas: PersonaOption[]): string {
  if (row.name?.trim()) return row.name
  if (row.persona_id) {
    const p = personas.find((x) => x.id === row.persona_id)
    return p?.profile_name ?? "Persona"
  }
  return "Prompt padrão"
}

interface PromptFormProps {
  editingId: string | null
  initialValues: FormValues | null
  companyId: string
  personas: PersonaOption[]
  promptTemplates: PromptTemplateOption[]
  fluxoObjetivo: string
  onLoadTemplates: (fluxo: string) => void
  onSave: (id: string | null, values: FormValues) => Promise<void>
  onCancel: () => void
  onDelete?: (id: string) => void
}

function PromptForm({
  editingId,
  initialValues,
  companyId,
  personas,
  promptTemplates,
  fluxoObjetivo,
  onLoadTemplates,
  onSave,
  onCancel,
  onDelete,
}: PromptFormProps) {
  const navigate = useNavigate()
  const { toast } = useToast()
  const [isSaving, setIsSaving] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: initialValues ?? {
      name: "",
      fluxo_objetivo: "",
      prompt_template_id: "",
      follow_up_active: false,
      follow_up_tempo: 24,
      follow_up_tentativas: 3,
      nome_atendente: "",
      principais_instrucoes: "",
      papel: "",
      tom_voz: "",
      persona_id: "",
    },
  })

  const followUpActive = form.watch("follow_up_active")
  const currentFluxo = form.watch("fluxo_objetivo")

  useEffect(() => {
    if (initialValues) {
      form.reset(initialValues)
    }
  }, [initialValues, form])

  useEffect(() => {
    if (currentFluxo) onLoadTemplates(currentFluxo)
  }, [currentFluxo, onLoadTemplates])

  useEffect(() => {
    if (!currentFluxo) form.setValue("prompt_template_id", "")
  }, [currentFluxo, form])

  async function handleSubmit(values: FormValues) {
    setIsSaving(true)
    try {
      await onSave(editingId, values)
    } finally {
      setIsSaving(false)
    }
  }

  async function handleDelete() {
    if (!editingId || !onDelete) return
    const ok = window.confirm("Excluir este prompt? Esta ação não pode ser desfeita.")
    if (!ok) return
    setIsDeleting(true)
    try {
      await onDelete(editingId)
      onCancel()
    } catch (err) {
      toast({
        variant: "destructive",
        title: "Erro ao excluir",
        description: getErrorMessage(err),
      })
    } finally {
      setIsDeleting(false)
    }
  }

  return (
    <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-6">
      <div className="space-y-2">
        <Label htmlFor="prompt-name">Nome do prompt (opcional)</Label>
        <Input
          id="prompt-name"
          placeholder="Ex: Atendimento B2B"
          {...form.register("name")}
        />
      </div>

      <div className="space-y-2">
        <Label>Persona (Cliente Ideal)</Label>
        <div className="flex gap-2">
          <Select
            value={form.watch("persona_id") || "__none__"}
            onValueChange={(v) => form.setValue("persona_id", v === "__none__" ? "" : v)}
          >
            <SelectTrigger className="flex-1">
              <SelectValue placeholder="Selecione uma persona" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__none__">Nenhuma (padrão)</SelectItem>
              {personas.map((p) => (
                <SelectItem key={p.id} value={p.id}>
                  {p.profile_name ?? "Sem nome"}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button type="button" variant="outline" size="sm" asChild>
            <Link
              to={`/dashboard/cliente-ideal/novo?returnTo=/dashboard/prompt-atendimento`}
              className="flex items-center gap-1"
            >
              <UserPlus className="h-4 w-4" />
              Criar persona
            </Link>
          </Button>
        </div>
        <p className="text-xs text-muted-foreground">
          A IA usará este prompt quando o lead for identificado como esta persona.
        </p>
      </div>

      <div className="space-y-2">
        <Label>Objetivo do atendimento</Label>
        <Select
          value={form.watch("fluxo_objetivo") || "__none__"}
          onValueChange={(v) => form.setValue("fluxo_objetivo", v === "__none__" ? "" : v)}
        >
          <SelectTrigger>
            <SelectValue placeholder="Selecione o objetivo" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__none__">Selecione...</SelectItem>
            {CATEGORIA_OBJETIVO_OPTIONS.map((o) => (
              <SelectItem key={o.value} value={o.value}>
                {o.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <Label>Template Master</Label>
        <Select
          value={form.watch("prompt_template_id") || "__none__"}
          onValueChange={(v) =>
            form.setValue("prompt_template_id", v === "__none__" ? "" : v)
          }
          disabled={!fluxoObjetivo}
        >
          <SelectTrigger>
            <SelectValue placeholder="Selecione um template (opcional)" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__none__">Nenhum</SelectItem>
            {promptTemplates.map((t) => (
              <SelectItem key={t.id} value={t.id}>
                {t.name ?? "Sem nome"}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {form.watch("prompt_template_id") && (() => {
          const selected = promptTemplates.find(
            (t) => t.id === form.watch("prompt_template_id")
          )
          return selected?.descricao ? (
            <div className="rounded-lg border border-border bg-muted/30 p-3 mt-2">
              <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                {selected.descricao}
              </p>
            </div>
          ) : null
        })()}
      </div>

      <div className="space-y-4">
        <div className="flex items-center justify-between rounded-lg border p-4">
          <div className="space-y-0.5">
            <Label htmlFor="follow_up_active">Follow-up</Label>
            <p className="text-sm text-muted-foreground">
              Ativar retomada automática de contato
            </p>
          </div>
          <Switch
            id="follow_up_active"
            checked={followUpActive}
            onCheckedChange={(checked) =>
              form.setValue("follow_up_active", checked)
            }
          />
        </div>
        {followUpActive && (
          <div className="grid gap-4 sm:grid-cols-2 pl-4 border-l-2 border-muted">
            <div className="space-y-2">
              <Label htmlFor="follow_up_tempo">Tempo de espera (horas)</Label>
              <Input
                id="follow_up_tempo"
                type="number"
                min={0}
                placeholder="24"
                {...form.register("follow_up_tempo")}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="follow_up_tentativas">Tentativas de retomada</Label>
              <Input
                id="follow_up_tentativas"
                type="number"
                min={0}
                placeholder="3"
                {...form.register("follow_up_tentativas")}
              />
            </div>
          </div>
        )}
      </div>

      <div className="space-y-2">
        <h3 className="text-sm font-medium">Identidade</h3>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="nome_atendente">Nome do Atendente</Label>
          <Input
            id="nome_atendente"
            placeholder="Ex: Assistente de Vendas"
            {...form.register("nome_atendente")}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="papel">Papel</Label>
          <Input
            id="papel"
            placeholder="Ex: Consultor de vendas"
            {...form.register("papel")}
          />
        </div>
      </div>
      <div className="space-y-2">
        <Label htmlFor="tom_voz">Tom de Voz</Label>
        <Input
          id="tom_voz"
          placeholder="Ex: Amigável e profissional"
          {...form.register("tom_voz")}
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="principais_instrucoes">Principais instruções</Label>
        <Textarea
          id="principais_instrucoes"
          placeholder="Descreva as principais instruções para o atendente..."
          rows={4}
          className="resize-none"
          {...form.register("principais_instrucoes")}
        />
      </div>

      <div className="flex justify-between pt-4 border-t">
        <div>
          {editingId && onDelete && (
            <Button
              type="button"
              variant="outline"
              className="text-destructive hover:text-destructive hover:bg-destructive/10"
              onClick={handleDelete}
              disabled={isDeleting}
            >
              {isDeleting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
              Excluir
            </Button>
          )}
        </div>
        <div className="flex gap-2">
          <Button type="button" variant="outline" onClick={onCancel}>
            Cancelar
          </Button>
          <Button type="submit" disabled={isSaving} className="bg-[#556b2f] hover:bg-[#4a5f28] text-white">
            {isSaving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Check className="h-4 w-4 mr-2" />}
            {editingId ? "Atualizar" : "Salvar"}
          </Button>
        </div>
      </div>
    </form>
  )
}

export function PromptAtendimentoPage() {
  const { userId } = useAuth()
  const supabase = useSupabaseClient()
  const { toast } = useToast()

  const [companyId, setCompanyId] = useState<string | null>(null)
  const [personas, setPersonas] = useState<PersonaOption[]>([])
  const [promptTemplates, setPromptTemplates] = useState<PromptTemplateOption[]>([])
  const [prompts, setPrompts] = useState<PromptAtendimentoRow[]>([])
  const [isFetching, setIsFetching] = useState(true)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [isNewOpen, setIsNewOpen] = useState(false)

  const loadPersonas = useCallback(async () => {
    if (!companyId) return
    try {
      const { data, error } = await supabase
        .from("ideal_customers")
        .select("id, profile_name")
        .eq("company_id", companyId)
        .order("profile_name")

      if (error) throw error
      setPersonas((data as PersonaOption[]) ?? [])
    } catch (err) {
      console.error("Erro ao carregar personas:", err)
      setPersonas([])
    }
  }, [companyId, supabase])

  const loadPromptTemplates = useCallback(async (fluxo: string) => {
    if (!fluxo?.trim()) {
      setPromptTemplates([])
      return
    }
    try {
      const { data, error } = await supabase
        .from("prompt_templates")
        .select("id, name, descricao")
        .eq("categoria_objetivo", fluxo)
        .order("created_at", { ascending: false })

      if (error) throw error
      setPromptTemplates((data as PromptTemplateOption[]) ?? [])
    } catch (err) {
      console.error("Erro ao carregar templates:", err)
      setPromptTemplates([])
    }
  }, [supabase])

  const loadPrompts = useCallback(async () => {
    if (!companyId) {
      setIsFetching(false)
      setPrompts([])
      return
    }
    setIsFetching(true)
    try {
      const { data, error } = await supabase
        .from("prompt_atendimento")
        .select(
          "id, name, nome_atendente, principais_instrucoes, papel, tom_voz, persona_id, prompt_template_id, fluxo_objetivo, follow_up_active, follow_up_tempo, follow_up_tentativas"
        )
        .eq("company_id", companyId)
        .order("created_at", { ascending: false })

      if (error) throw error
      setPrompts((data as PromptAtendimentoRow[]) ?? [])
    } catch (err) {
      console.error("Erro ao carregar prompts:", err)
      toast({
        variant: "destructive",
        title: "Erro",
        description: "Falha ao carregar prompts de atendimento.",
      })
      setPrompts([])
    } finally {
      setIsFetching(false)
    }
  }, [companyId, supabase, toast])

  useEffect(() => {
    async function init() {
      if (!userId) return
      const cid = await fetchCompanyId(supabase, userId)
      setCompanyId(cid)
    }
    init()
  }, [userId, supabase])

  useEffect(() => {
    loadPersonas()
  }, [loadPersonas])

  useEffect(() => {
    loadPrompts()
  }, [loadPrompts])

  async function handleSave(id: string | null, values: FormValues) {
    if (!companyId) {
      toast({ variant: "destructive", title: "Erro", description: "Empresa não identificada." })
      return
    }

    const payload = {
      company_id: companyId,
      name: values.name?.trim() || null,
      nome_atendente: values.nome_atendente?.trim() || null,
      principais_instrucoes: values.principais_instrucoes?.trim() || null,
      papel: values.papel?.trim() || null,
      tom_voz: values.tom_voz?.trim() || null,
      persona_id: values.persona_id?.trim() || null,
      prompt_template_id: values.prompt_template_id?.trim() || null,
      fluxo_objetivo: values.fluxo_objetivo?.trim() || null,
      follow_up_active: values.follow_up_active ?? false,
      follow_up_tempo: values.follow_up_active ? (values.follow_up_tempo ?? null) : null,
      follow_up_tentativas: values.follow_up_active ? (values.follow_up_tentativas ?? null) : null,
    }

    if (id) {
      const { error } = await supabase
        .from("prompt_atendimento")
        .update(payload)
        .eq("id", id)

      if (error) throw error
      toast({ title: "Atualizado", description: "Prompt atualizado com sucesso." })
    } else {
      const { error } = await supabase.from("prompt_atendimento").insert(payload)

      if (error) throw error
      toast({ title: "Salvo", description: "Novo prompt criado com sucesso." })
    }

    setEditingId(null)
    setIsNewOpen(false)
    loadPrompts()
  }

  async function handleDelete(id: string) {
    const { error } = await supabase
      .from("prompt_atendimento")
      .delete()
      .eq("id", id)

    if (error) throw error
    toast({ title: "Excluído", description: "Prompt removido." })
    loadPrompts()
  }

  function rowToFormValues(row: PromptAtendimentoRow): FormValues {
    return {
      name: row.name ?? "",
      fluxo_objetivo: row.fluxo_objetivo ?? "",
      prompt_template_id: row.prompt_template_id ?? "",
      follow_up_active: row.follow_up_active ?? false,
      follow_up_tempo: row.follow_up_tempo ?? 24,
      follow_up_tentativas: row.follow_up_tentativas ?? 3,
      nome_atendente: row.nome_atendente ?? "",
      principais_instrucoes: row.principais_instrucoes ?? "",
      papel: row.papel ?? "",
      tom_voz: row.tom_voz ?? "",
      persona_id: row.persona_id ?? "",
    }
  }

  const editingRow = editingId ? prompts.find((p) => p.id === editingId) : null
  const editingValues = editingRow ? rowToFormValues(editingRow) : null

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
                <BreadcrumbPage>Prompt de Atendimento</BreadcrumbPage>
              </BreadcrumbItem>
            </BreadcrumbList>
          </Breadcrumb>
          <ProfileDropdown className="ml-auto" />
        </header>
        <div
          className="flex flex-1 flex-col gap-4 p-4"
          style={{ backgroundColor: "#fdfcfb" }}
        >
          <Card>
            <CardHeader>
              <div className="flex justify-between items-start">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <MessageSquare className="h-5 w-5" />
                    Prompt de Atendimento
                  </CardTitle>
                  <CardDescription>
                    Crie múltiplos prompts e associe cada um a um cliente ideal (persona). A IA usará o prompt específico conforme o persona do lead.
                  </CardDescription>
                </div>
                <Button
                  onClick={() => {
                    setIsNewOpen(true)
                    setEditingId(null)
                  }}
                  disabled={!companyId}
                  className="bg-[#556b2f] hover:bg-[#4a5f28] text-white"
                >
                  <Plus className="mr-2 h-4 w-4" />
                  Novo Prompt
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {isFetching ? (
                <div className="flex min-h-[120px] items-center justify-center">
                  <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                </div>
              ) : (
                <div className="space-y-6">
                  {(isNewOpen || editingId) && (
                    <Card className="border-primary/30">
                        <CardHeader className="pb-2">
                          <CardTitle className="text-base">
                            {editingId ? "Editar prompt" : "Novo prompt"}
                          </CardTitle>
                        </CardHeader>
                        <CardContent>
                          <PromptForm
                            editingId={editingId}
                            initialValues={
                              editingId ? editingValues : {
                                name: "",
                                fluxo_objetivo: "",
                                prompt_template_id: "",
                                follow_up_active: false,
                                follow_up_tempo: 24,
                                follow_up_tentativas: 3,
                                nome_atendente: "",
                                principais_instrucoes: "",
                                papel: "",
                                tom_voz: "",
                                persona_id: "",
                              }
                            }
                            companyId={companyId ?? ""}
                            personas={personas}
                            promptTemplates={promptTemplates}
                            fluxoObjetivo={editingValues?.fluxo_objetivo ?? ""}
                            onLoadTemplates={loadPromptTemplates}
                            onSave={handleSave}
                            onCancel={() => {
                              setIsNewOpen(false)
                              setEditingId(null)
                            }}
                            onDelete={editingId ? handleDelete : undefined}
                          />
                        </CardContent>
                    </Card>
                  )}

                  <div>
                    <h3 className="text-sm font-medium mb-3">Prompts cadastrados</h3>
                    {prompts.length === 0 && !isNewOpen ? (
                      <p className="text-sm text-muted-foreground py-6 text-center rounded-lg border border-dashed">
                        Nenhum prompt cadastrado. Clique em &quot;Novo Prompt&quot; para criar o primeiro.
                      </p>
                    ) : (
                      <div className="rounded-lg border">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead className="text-foreground">Nome / Persona</TableHead>
                              <TableHead className="text-foreground">Objetivo</TableHead>
                              <TableHead className="text-foreground">Template</TableHead>
                              <TableHead className="text-right text-foreground">Ações</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {prompts.map((p) => (
                              <TableRow key={p.id}>
                                <TableCell className="font-medium">
                                  {getDisplayLabel(p, personas)}
                                </TableCell>
                                <TableCell className="text-muted-foreground">
                                  {CATEGORIA_OBJETIVO_OPTIONS.find((o) => o.value === p.fluxo_objetivo)?.label ?? "—"}
                                </TableCell>
                                <TableCell className="text-muted-foreground">
                                  {p.prompt_template_id ? "Sim" : "—"}
                                </TableCell>
                                <TableCell className="text-right">
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => {
                                      setEditingId(p.id)
                                      setIsNewOpen(false)
                                    }}
                                    aria-label={`Editar ${getDisplayLabel(p, personas)}`}
                                  >
                                    <Pencil className="h-4 w-4" />
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className="text-destructive hover:text-destructive hover:bg-destructive/10"
                                    onClick={async () => {
                                      const ok = window.confirm(
                                        `Excluir o prompt "${getDisplayLabel(p, personas)}"?`
                                      )
                                      if (ok) await handleDelete(p.id)
                                    }}
                                    aria-label={`Excluir ${getDisplayLabel(p, personas)}`}
                                  >
                                    <Trash2 className="h-4 w-4" />
                                  </Button>
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </SidebarInset>
    </SidebarProvider>
  )
}
