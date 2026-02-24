import { useState, useEffect, useCallback } from "react"
import { Link } from "react-router-dom"
import { useAuth } from "@clerk/clerk-react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import * as z from "zod"
import type { SupabaseClient } from "@supabase/supabase-js"

import { Loader2, Check, MessageSquare } from "lucide-react"

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

export function PromptAtendimentoPage() {
  const { userId } = useAuth()
  const supabase = useSupabaseClient()
  const { toast } = useToast()

  const [companyId, setCompanyId] = useState<string | null>(null)
  const [personas, setPersonas] = useState<PersonaOption[]>([])
  const [promptTemplates, setPromptTemplates] = useState<PromptTemplateOption[]>([])
  const [isFetching, setIsFetching] = useState(true)
  const [isSaving, setIsSaving] = useState(false)

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
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

  const fluxoObjetivo = form.watch("fluxo_objetivo")
  const followUpActive = form.watch("follow_up_active")

  useEffect(() => {
    async function init() {
      if (!userId) return
      const cid = await fetchCompanyId(supabase, userId)
      setCompanyId(cid)
    }
    init()
  }, [userId, supabase])

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

  const loadPromptTemplates = useCallback(async () => {
    if (!fluxoObjetivo?.trim()) {
      setPromptTemplates([])
      return
    }
    try {
      const { data, error } = await supabase
        .from("prompt_templates")
        .select("id, name, descricao")
        .eq("categoria_objetivo", fluxoObjetivo)
        .order("created_at", { ascending: false })

      if (error) throw error
      setPromptTemplates((data as PromptTemplateOption[]) ?? [])
    } catch (err) {
      console.error("Erro ao carregar templates:", err)
      setPromptTemplates([])
    }
  }, [fluxoObjetivo, supabase])

  const loadPromptAtendimento = useCallback(async () => {
    if (!companyId) {
      setIsFetching(false)
      return
    }
    setIsFetching(true)
    try {
      const { data, error } = await supabase
        .from("prompt_atendimento")
        .select(
          "id, nome_atendente, principais_instrucoes, papel, tom_voz, persona_id, prompt_template_id, fluxo_objetivo, follow_up_active, follow_up_tempo, follow_up_tentativas"
        )
        .eq("company_id", companyId)
        .maybeSingle()

      if (error) throw error
      const row = data as PromptAtendimentoRow | null
      form.reset({
        fluxo_objetivo: row?.fluxo_objetivo ?? "",
        prompt_template_id: row?.prompt_template_id ?? "",
        follow_up_active: row?.follow_up_active ?? false,
        follow_up_tempo: row?.follow_up_tempo ?? 24,
        follow_up_tentativas: row?.follow_up_tentativas ?? 3,
        nome_atendente: row?.nome_atendente ?? "",
        principais_instrucoes: row?.principais_instrucoes ?? "",
        papel: row?.papel ?? "",
        tom_voz: row?.tom_voz ?? "",
        persona_id: row?.persona_id ?? "",
      })
    } catch (err) {
      console.error("Erro ao carregar prompt de atendimento:", err)
      toast({
        variant: "destructive",
        title: "Erro",
        description: "Falha ao carregar configurações do prompt.",
      })
    } finally {
      setIsFetching(false)
    }
  }, [companyId, supabase, toast, form])

  useEffect(() => {
    loadPersonas()
  }, [loadPersonas])

  useEffect(() => {
    loadPromptTemplates()
  }, [loadPromptTemplates])

  useEffect(() => {
    loadPromptAtendimento()
  }, [loadPromptAtendimento])

  useEffect(() => {
    if (!fluxoObjetivo) {
      form.setValue("prompt_template_id", "")
    }
    const currentTemplateId = form.getValues("prompt_template_id")
    if (currentTemplateId && promptTemplates.length > 0) {
      const exists = promptTemplates.some((t) => t.id === currentTemplateId)
      if (!exists) {
        form.setValue("prompt_template_id", "")
      }
    }
  }, [fluxoObjetivo, promptTemplates, form])

  async function onSubmit(values: FormValues) {
    if (!companyId) {
      toast({
        variant: "destructive",
        title: "Erro",
        description: "Empresa não identificada.",
      })
      return
    }
    setIsSaving(true)
    try {
      const payload = {
        company_id: companyId,
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

      const { data: existing } = await supabase
        .from("prompt_atendimento")
        .select("id")
        .eq("company_id", companyId)
        .maybeSingle()

      if (existing) {
        const { error } = await supabase
          .from("prompt_atendimento")
          .update(payload)
          .eq("company_id", companyId)

        if (error) throw error
      } else {
        const { error } = await supabase.from("prompt_atendimento").insert(payload)

        if (error) throw error
      }

      toast({
        title: "Prompt salvo",
        description: "As configurações do prompt de atendimento foram atualizadas.",
      })
    } catch (err) {
      toast({
        variant: "destructive",
        title: "Erro ao salvar",
        description: getErrorMessage(err),
      })
    } finally {
      setIsSaving(false)
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
              <CardTitle className="flex items-center gap-2">
                <MessageSquare className="h-5 w-5" />
                Prompt de Atendimento
              </CardTitle>
              <CardDescription>
                Configure o comportamento da IA no atendimento: objetivo, template master, follow-up e identidade. Temperatura e tokens são definidos no template (Admin).
              </CardDescription>
            </CardHeader>
            <CardContent>
              {isFetching ? (
                <div className="flex min-h-[200px] items-center justify-center">
                  <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                </div>
              ) : (
                <form
                  onSubmit={form.handleSubmit(onSubmit)}
                  className="grid gap-6 sm:grid-cols-2"
                >
                  <div className="space-y-2 sm:col-span-2">
                    <Label>Qual o objetivo do seu atendimento?</Label>
                    <Select
                      value={form.watch("fluxo_objetivo") || "__none__"}
                      onValueChange={(v) =>
                        form.setValue("fluxo_objetivo", v === "__none__" ? "" : v)
                      }
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

                  <div className="space-y-2 sm:col-span-2">
                    <Label>Template Master</Label>
                    <Select
                      value={
                        form.watch("prompt_template_id") || "__none__"
                      }
                      onValueChange={(v) =>
                        form.setValue(
                          "prompt_template_id",
                          v === "__none__" ? "" : v
                        )
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
                    <p className="text-xs text-muted-foreground">
                      Templates filtrados pelo objetivo selecionado. Criados no Admin.
                    </p>
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

                  <div className="space-y-4 sm:col-span-2">
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
                          <Label htmlFor="follow_up_tempo">
                            Tempo de espera antes do contato (horas)
                          </Label>
                          <Input
                            id="follow_up_tempo"
                            type="number"
                            min={0}
                            placeholder="24"
                            {...form.register("follow_up_tempo")}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="follow_up_tentativas">
                            Número de tentativas de retomada
                          </Label>
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

                  <div className="space-y-2 sm:col-span-2">
                    <h3 className="text-sm font-medium">Identidade</h3>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="nome_atendente">Nome do Atendente</Label>
                    <Input
                      id="nome_atendente"
                      type="text"
                      placeholder="Ex: Assistente de Vendas"
                      {...form.register("nome_atendente")}
                    />
                  </div>
                  <div className="space-y-2 sm:col-span-2">
                    <Label htmlFor="principais_instrucoes">
                      Principais instruções
                    </Label>
                    <Textarea
                      id="principais_instrucoes"
                      placeholder="Descreva as principais instruções para o atendente..."
                      rows={4}
                      className="resize-none"
                      {...form.register("principais_instrucoes")}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="papel">Papel</Label>
                    <Input
                      id="papel"
                      type="text"
                      placeholder="Ex: Consultor de vendas"
                      {...form.register("papel")}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="tom_voz">Tom de Voz</Label>
                    <Input
                      id="tom_voz"
                      type="text"
                      placeholder="Ex: Amigável e profissional"
                      {...form.register("tom_voz")}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Persona (Cliente Ideal)</Label>
                    <Select
                      value={form.watch("persona_id") || "__none__"}
                      onValueChange={(v) =>
                        form.setValue("persona_id", v === "__none__" ? "" : v)
                      }
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione uma persona" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__none__">Nenhuma</SelectItem>
                        {personas.map((p) => (
                          <SelectItem key={p.id} value={p.id}>
                            {p.profile_name ?? "Sem nome"}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="sm:col-span-2">
                    <Button
                      type="submit"
                      disabled={isSaving}
                      className="bg-[#556b2f] hover:bg-[#4a5f28] text-white"
                    >
                      {isSaving ? (
                        <>
                          <Loader2 className="h-4 w-4 animate-spin mr-2" />
                          Salvando…
                        </>
                      ) : (
                        <>
                          <Check className="h-4 w-4 mr-2" />
                          Salvar
                        </>
                      )}
                    </Button>
                  </div>
                </form>
              )}
            </CardContent>
          </Card>
        </div>
      </SidebarInset>
    </SidebarProvider>
  )
}
