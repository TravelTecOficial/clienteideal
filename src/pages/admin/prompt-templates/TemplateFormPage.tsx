import { useEffect, useState, useCallback } from "react"
import { useUser } from "@clerk/clerk-react"
import { Navigate, useParams, useNavigate } from "react-router-dom"
import { AdminLayout } from "@/components/admin-layout"
import { isSaasAdmin } from "@/lib/use-saas-admin"
import { useSupabaseClient } from "@/lib/supabase-context"
import { getErrorMessage } from "@/lib/utils"
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
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { useToast } from "@/hooks/use-toast"
import { Plus, Loader2, Trash2, ArrowLeft } from "lucide-react"
import { Link } from "react-router-dom"

const STAGE_KEYS = [
  { key: "inicial", label: "Inicial" },
  { key: "atendimento", label: "Atendimento" },
  { key: "qualificacao", label: "Qualificação" },
  { key: "agendamento", label: "Agendamento" },
  { key: "grupo", label: "Grupo" },
  { key: "pagamento", label: "Pagamento" },
  { key: "encerramento", label: "Encerramento" },
] as const

type StageKey = (typeof STAGE_KEYS)[number]["key"]

const CATEGORIA_OBJETIVO_OPTIONS = [
  { value: "atendimento", label: "Apenas Atendimento" },
  { value: "atendimento_agendamento", label: "Atendimento + Agendamento" },
  { value: "atendimento_qualificacao_agendamento", label: "Atendimento + Qualificação + Agendamento" },
  { value: "atendimento_completo", label: "Atendimento + Qualificação + Agendamento + Pagamento" },
  { value: "atendimento_agendamento_pagamento", label: "Atendimento + Agendamento + Pagamento" },
] as const

const ORDEM_OPTIONS = [1, 2, 3, 4, 5, 6, 7] as const

interface ToolParam {
  name: string
  info: string
}

interface ToolConfig {
  id: string
  name: string
  description: string
  parameters: ToolParam[]
}

interface StageConfig {
  stage_key: StageKey
  rules_do: string[]
  rules_dont: string[]
  tools: ToolConfig[]
  instrucoes: string
  enabled: boolean
  ordem: number
}

interface PromptTemplateRow {
  id: string
  name: string | null
  categoria_objetivo: string | null
  criatividade_temperatura: number | null
  max_tokens: number | null
  informacoes_uso: string | null
  descricao: string | null
}

interface StageRow {
  id: string
  template_id: string
  stage_key: string
  rules_do: unknown
  rules_dont: unknown
  tools: unknown
  instrucoes: string | null
  enabled: boolean | null
  ordem: number | null
}

function generateId(): string {
  return Math.random().toString(36).slice(2, 11)
}

function emptyStageConfig(stageKey: StageKey): StageConfig {
  return {
    stage_key: stageKey,
    rules_do: [],
    rules_dont: [],
    tools: [],
    instrucoes: "",
    enabled: false,
    ordem: 1,
  }
}

function parseStageFromDb(stageKey: StageKey, raw: StageRow | null): StageConfig {
  if (!raw) return emptyStageConfig(stageKey)
  const rules_do = Array.isArray(raw.rules_do) ? (raw.rules_do as string[]) : []
  const rules_dont = Array.isArray(raw.rules_dont) ? (raw.rules_dont as string[]) : []
  const toolsRaw = Array.isArray(raw.tools) ? raw.tools : []
  const tools: ToolConfig[] = toolsRaw.map((t) => {
    const obj = typeof t === "object" && t !== null ? (t as Record<string, unknown>) : {}
    const paramsRaw = Array.isArray(obj.parameters) ? obj.parameters : []
    const parameters: ToolParam[] = paramsRaw.map((p) => {
      if (typeof p === "string") return { name: p, info: "" }
      const o = typeof p === "object" && p !== null ? (p as Record<string, unknown>) : {}
      return {
        name: typeof o.name === "string" ? o.name : "",
        info: typeof o.info === "string" ? o.info : "",
      }
    })
    return {
      id: generateId(),
      name: typeof obj.name === "string" ? obj.name : "",
      description: typeof obj.description === "string" ? obj.description : "",
      parameters,
    }
  })
  return {
    stage_key: stageKey,
    rules_do,
    rules_dont,
    tools,
    instrucoes: typeof raw.instrucoes === "string" ? raw.instrucoes : "",
    enabled: raw.enabled ?? false,
    ordem: typeof raw.ordem === "number" ? raw.ordem : 1,
  }
}

function RulesListBlock({
  label,
  items,
  onAdd,
  onRemove,
  inputPlaceholder,
}: {
  label: string
  items: string[]
  onAdd: (value: string) => void
  onRemove: (index: number) => void
  inputPlaceholder: string
}) {
  const [inputValue, setInputValue] = useState("")

  const handleAdd = () => {
    const trimmed = inputValue.trim()
    if (trimmed) {
      onAdd(trimmed)
      setInputValue("")
    }
  }

  return (
    <div className="space-y-2">
      <Label className="text-sm font-medium">{label}</Label>
      <div className="flex gap-2">
        <Input
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), handleAdd())}
          placeholder={inputPlaceholder}
          className="flex-1"
        />
        <Button type="button" variant="outline" size="sm" onClick={handleAdd}>
          Incluir
        </Button>
      </div>
      {items.length > 0 && (
        <ul className="space-y-1 rounded-md border border-border p-2 bg-muted/30">
          {items.map((item, idx) => (
            <li
              key={`${item}-${idx}`}
              className="flex items-center justify-between gap-2 rounded px-2 py-1.5 text-sm"
            >
              <span className="flex-1 truncate">{item}</span>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-8 w-8 p-0 text-destructive hover:text-destructive hover:bg-destructive/10 shrink-0"
                onClick={() => onRemove(idx)}
                aria-label="Remover"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

function ToolBuilder({
  tool,
  onUpdate,
  onRemove,
  canRemove,
}: {
  tool: ToolConfig
  onUpdate: (id: string, field: keyof ToolConfig, value: string | ToolParam[]) => void
  onRemove: () => void
  canRemove: boolean
}) {
  const [paramName, setParamName] = useState("")
  const [paramInfo, setParamInfo] = useState("")

  const addParam = () => {
    const trimmedName = paramName.trim()
    if (trimmedName) {
      onUpdate(tool.id, "parameters", [
        ...tool.parameters,
        { name: trimmedName, info: paramInfo.trim() },
      ])
      setParamName("")
      setParamInfo("")
    }
  }

  return (
    <Card className="rounded-lg border border-border">
      <CardHeader className="p-4 pb-2">
        <div className="flex justify-between items-start gap-2">
          <div className="flex-1 space-y-2">
            <Input
              value={tool.name}
              onChange={(e) => onUpdate(tool.id, "name", e.target.value)}
              placeholder="Nome (ex: agendar)"
              className="font-medium"
            />
            <Input
              value={tool.description}
              onChange={(e) => onUpdate(tool.id, "description", e.target.value)}
              placeholder="Descrição (ex: Fazer agendamento)"
            />
          </div>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="text-destructive hover:text-destructive shrink-0"
            onClick={onRemove}
            disabled={!canRemove}
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </CardHeader>
      <CardContent className="p-4 pt-0 space-y-2">
        <Label className="text-xs text-muted-foreground">Parâmetros</Label>
        <div className="flex flex-col gap-2">
          <div className="flex gap-2">
            <Input
              value={paramName}
              onChange={(e) => setParamName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addParam())}
              placeholder="Nome do parâmetro (ex: data)"
              className="flex-1"
            />
            <Input
              value={paramInfo}
              onChange={(e) => setParamInfo(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addParam())}
              placeholder="Informação (ex: Data no formato DD/MM/AAAA)"
              className="flex-1"
            />
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={addParam}
              disabled={!paramName.trim()}
            >
              Incluir
            </Button>
          </div>
        </div>
        {tool.parameters.length > 0 && (
          <ul className="space-y-1 rounded-md border border-border p-2 bg-muted/30">
            {tool.parameters.map((p, idx) => (
              <li
                key={`${p.name}-${idx}`}
                className="flex items-start justify-between gap-2 rounded px-2 py-1.5 text-sm"
              >
                <div className="flex-1 min-w-0">
                  <span className="font-medium">{p.name}</span>
                  {p.info && (
                    <span className="text-muted-foreground block truncate text-xs">
                      {p.info}
                    </span>
                  )}
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-8 w-8 p-0 text-destructive hover:text-destructive hover:bg-destructive/10 shrink-0"
                  onClick={() =>
                    onUpdate(
                      tool.id,
                      "parameters",
                      tool.parameters.filter((_, i) => i !== idx)
                    )
                  }
                  aria-label="Remover parâmetro"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  )
}

function StageTabContent({
  stage,
  stageLabel,
  onChange,
}: {
  stage: StageConfig
  stageLabel: string
  onChange: (updated: StageConfig) => void
}) {
  const addRuleDo = (value: string) => {
    onChange({ ...stage, rules_do: [...stage.rules_do, value] })
  }
  const removeRuleDo = (idx: number) => {
    onChange({ ...stage, rules_do: stage.rules_do.filter((_, i) => i !== idx) })
  }
  const addRuleDont = (value: string) => {
    onChange({ ...stage, rules_dont: [...stage.rules_dont, value] })
  }
  const removeRuleDont = (idx: number) => {
    onChange({ ...stage, rules_dont: stage.rules_dont.filter((_, i) => i !== idx) })
  }
  const addTool = () => {
    onChange({
      ...stage,
      tools: [...stage.tools, { id: generateId(), name: "", description: "", parameters: [] }],
    })
  }
  const removeTool = (id: string) => {
    onChange({ ...stage, tools: stage.tools.filter((t) => t.id !== id) })
  }
  const updateTool = (id: string, field: keyof ToolConfig, value: string | ToolParam[]) => {
    onChange({
      ...stage,
      tools: stage.tools.map((t) => (t.id === id ? { ...t, [field]: value } : t)),
    })
  }

  return (
    <div className="space-y-6 py-4">
      <div className="flex flex-col gap-4 rounded-lg border border-border p-4 bg-muted/20">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <Switch
                id={`enabled-${stage.stage_key}`}
                checked={stage.enabled}
                onCheckedChange={(checked) => onChange({ ...stage, enabled: checked })}
              />
              <Label htmlFor={`enabled-${stage.stage_key}`} className="text-sm font-medium">
                Habilitar estágio neste template
              </Label>
            </div>
            <div className="flex items-center gap-2">
              <Label htmlFor={`ordem-${stage.stage_key}`} className="text-sm text-muted-foreground">
                Ordem:
              </Label>
              <Select
                value={String(stage.ordem)}
                onValueChange={(v) => onChange({ ...stage, ordem: parseInt(v, 10) })}
              >
                <SelectTrigger id={`ordem-${stage.stage_key}`} className="w-20">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ORDEM_OPTIONS.map((n) => (
                    <SelectItem key={n} value={String(n)}>
                      {n}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor={`instrucoes-${stage.stage_key}`}>Instruções específicas do estágio</Label>
        <Textarea
          id={`instrucoes-${stage.stage_key}`}
          value={stage.instrucoes}
          onChange={(e) => onChange({ ...stage, instrucoes: e.target.value })}
          placeholder={`Instruções específicas para o estágio ${stageLabel}...`}
          rows={4}
          className="resize-y min-h-[120px]"
        />
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <RulesListBlock
          label="O que fazer"
          items={stage.rules_do}
          onAdd={addRuleDo}
          onRemove={removeRuleDo}
          inputPlaceholder="Adicione uma regra..."
        />
        <RulesListBlock
          label="O que não fazer"
          items={stage.rules_dont}
          onAdd={addRuleDont}
          onRemove={removeRuleDont}
          inputPlaceholder="Adicione uma regra..."
        />
      </div>

      <div className="space-y-4">
        <div className="flex justify-between items-center">
          <Label>Ferramentas (Tools)</Label>
          <Button type="button" variant="outline" size="sm" onClick={addTool}>
            <Plus className="mr-2 h-4 w-4" /> Adicionar ferramenta
          </Button>
        </div>
        {stage.tools.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhuma ferramenta configurada.</p>
        ) : (
          <div className="space-y-4">
            {stage.tools.map((tool) => (
              <ToolBuilder
                key={tool.id}
                tool={tool}
                onUpdate={updateTool}
                onRemove={() => removeTool(tool.id)}
                canRemove
              />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

export function TemplateFormPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { isLoaded, isSignedIn, user } = useUser()
  const supabase = useSupabaseClient()
  const { toast } = useToast()
  const isNew = id === "new"
  const [isLoading, setIsLoading] = useState(!isNew)
  const [isSaving, setIsSaving] = useState(false)
  const [nome, setNome] = useState("")
  const [descricao, setDescricao] = useState("")
  const [categoriaObjetivo, setCategoriaObjetivo] = useState<string>("")
  const [informacoesUso, setInformacoesUso] = useState("")
  const [criatividadeTemperatura, setCriatividadeTemperatura] = useState<number>(5)
  const [maxTokens, setMaxTokens] = useState<number>(1024)
  const [stages, setStages] = useState<Record<StageKey, StageConfig>>(() =>
    STAGE_KEYS.reduce(
      (acc, { key }) => ({ ...acc, [key]: emptyStageConfig(key) }),
      {} as Record<StageKey, StageConfig>
    )
  )

  const loadTemplate = useCallback(async () => {
    if (isNew || !id) return
    setIsLoading(true)
    try {
      const { data: templateData, error: templateError } = await supabase
        .from("prompt_templates")
        .select("id, name, categoria_objetivo, criatividade_temperatura, max_tokens, informacoes_uso, descricao")
        .eq("id", id)
        .single()

      if (templateError) throw templateError
      if (!templateData) {
        toast({ variant: "destructive", title: "Erro", description: "Template não encontrado." })
        navigate("/admin/prompt-templates")
        return
      }

      const t = templateData as PromptTemplateRow
      setNome(t.name ?? "")
      setDescricao(t.descricao ?? "")
      setCategoriaObjetivo(t.categoria_objetivo ?? "")
      setInformacoesUso(t.informacoes_uso ?? "")
      setCriatividadeTemperatura(t.criatividade_temperatura ?? 5)
      setMaxTokens(t.max_tokens ?? 1024)

      const { data: stagesData, error: stagesError } = await supabase
        .from("prompt_template_stages")
        .select("id, template_id, stage_key, rules_do, rules_dont, tools, instrucoes, enabled, ordem")
        .eq("template_id", id)
        .order("ordem", { ascending: true })

      if (stagesError) throw stagesError

      const stagesMap = STAGE_KEYS.reduce(
        (acc, { key }) => ({ ...acc, [key]: emptyStageConfig(key) }),
        {} as Record<StageKey, StageConfig>
      )
      for (const s of stagesData ?? []) {
        const row = s as StageRow
        const key = row.stage_key as StageKey
        if (STAGE_KEYS.some((sk) => sk.key === key)) {
          stagesMap[key] = parseStageFromDb(key, row)
        }
      }
      setStages(stagesMap)
    } catch (err) {
      toast({
        variant: "destructive",
        title: "Erro ao carregar",
        description: getErrorMessage(err, "Erro ao carregar template."),
      })
      navigate("/admin/prompt-templates")
    } finally {
      setIsLoading(false)
    }
  }, [id, isNew, supabase, toast, navigate])

  useEffect(() => {
    if (!isLoaded || !isSignedIn || !user) return
    if (!isSaasAdmin(user.publicMetadata as Record<string, unknown>)) return
    loadTemplate()
  }, [isLoaded, isSignedIn, user, loadTemplate])

  const updateStage = (stageKey: StageKey, updated: StageConfig) => {
    setStages((prev) => ({ ...prev, [stageKey]: updated }))
  }

  async function handleSubmit() {
    if (!nome.trim()) {
      toast({ variant: "destructive", title: "Erro", description: "Nome do template é obrigatório." })
      return
    }

    setIsSaving(true)
    try {
      let templateId: string

      if (isNew) {
        const { data, error } = await supabase
          .from("prompt_templates")
          .insert({
            name: nome.trim(),
            descricao: descricao.trim() || null,
            categoria_objetivo: categoriaObjetivo?.trim() || null,
            criatividade_temperatura: criatividadeTemperatura,
            max_tokens: maxTokens,
            informacoes_uso: informacoesUso.trim() || null,
          })
          .select("id")
          .single()

        if (error) throw error
        templateId = data.id
      } else {
        const { error } = await supabase
          .from("prompt_templates")
          .update({
            name: nome.trim(),
            descricao: descricao.trim() || null,
            categoria_objetivo: categoriaObjetivo?.trim() || null,
            criatividade_temperatura: criatividadeTemperatura,
            max_tokens: maxTokens,
            informacoes_uso: informacoesUso.trim() || null,
          })
          .eq("id", id!)

        if (error) throw error
        templateId = id!
      }

      const { error: delErr } = await supabase
        .from("prompt_template_stages")
        .delete()
        .eq("template_id", templateId)
      if (delErr) throw delErr

      // Inserir TODOS os stages para persistir enabled/ordem corretamente (inclui stages sem conteúdo)
      const stagesToInsert = STAGE_KEYS.map(({ key }) => stages[key])

      if (stagesToInsert.length > 0) {
        const rows = stagesToInsert.map((s) => ({
          template_id: templateId,
          stage_key: s.stage_key,
          rules_do: s.rules_do,
          rules_dont: s.rules_dont,
          tools: s.tools.map(({ name, description, parameters }) => ({
            name,
            description,
            parameters,
          })),
          instrucoes: s.instrucoes.trim() || null,
          enabled: s.enabled,
          ordem: s.ordem,
        }))
        const { error } = await supabase.from("prompt_template_stages").insert(rows)
        if (error) throw error
      }

      toast({ title: "Salvo", description: "Template gravado com sucesso." })
      if (isNew) {
        navigate(`/admin/prompt-templates/${templateId}`)
      }
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

  if (!isLoaded) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center bg-background">
        <Loader2 className="h-10 w-10 animate-spin text-primary" />
      </main>
    )
  }

  if (!isSignedIn) return <Navigate to="/entrar" replace />
  if (!isSaasAdmin(user?.publicMetadata as Record<string, unknown>)) {
    return <Navigate to="/dashboard" replace />
  }

  const breadcrumbPage = isNew ? "Novo" : nome || "Editar"

  return (
    <AdminLayout
      breadcrumb={{
        label: "Templates Master",
        page: breadcrumbPage,
        parent: { label: "Templates Master", href: "/admin/prompt-templates" },
      }}
    >
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="sm" asChild>
            <Link to="/admin/prompt-templates">
              <ArrowLeft className="mr-2 h-4 w-4" /> Voltar
            </Link>
          </Button>
        </div>

        {isLoading ? (
          <div className="flex min-h-[200px] items-center justify-center">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : (
          <div className="space-y-6 max-w-4xl">
            <div className="space-y-2">
              <Label>Modelo de atendimento</Label>
              <Select
                value={categoriaObjetivo || "__none__"}
                onValueChange={(v) => setCategoriaObjetivo(v === "__none__" ? "" : v)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione o modelo de atendimento" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">Nenhum</SelectItem>
                  {CATEGORIA_OBJETIVO_OPTIONS.map((o) => (
                    <SelectItem key={o.value} value={o.value}>
                      {o.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                Indique para qual tipo de fluxo este template será usado no dashboard.
              </p>
            </div>

            <div className="space-y-2">
              <Label>Nome do template</Label>
              <Input
                value={nome}
                onChange={(e) => setNome(e.target.value)}
                placeholder="Ex: Template Vendas B2B"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="descricao">Descritivo</Label>
              <Textarea
                id="descricao"
                value={descricao}
                onChange={(e) => setDescricao(e.target.value)}
                placeholder="Descrição do template exibida ao usuário no dashboard..."
                rows={4}
                className="resize-none"
              />
              <p className="text-xs text-muted-foreground">
                Texto exibido ao usuário no dashboard ao selecionar este template.
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="informacoes_uso">Informações de uso (interno)</Label>
              <Textarea
                id="informacoes_uso"
                value={informacoesUso}
                onChange={(e) => setInformacoesUso(e.target.value)}
                placeholder="Instruções e informações sobre como usar este template..."
                rows={4}
                className="resize-none"
              />
              <p className="text-xs text-muted-foreground">
                Texto livre para documentar o uso do template e modelos de negócio compatíveis.
              </p>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="criatividade_temperatura">Temperatura (1-10)</Label>
                <Input
                  id="criatividade_temperatura"
                  type="number"
                  min={1}
                  max={10}
                  value={criatividadeTemperatura}
                  onChange={(e) => setCriatividadeTemperatura(parseInt(e.target.value, 10) || 5)}
                />
                <p className="text-xs text-muted-foreground">
                  Criatividade da IA. Valores mais altos = mais variado.
                </p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="max_tokens">Tamanho da resposta (max tokens)</Label>
                <Input
                  id="max_tokens"
                  type="number"
                  min={1}
                  value={maxTokens}
                  onChange={(e) => setMaxTokens(parseInt(e.target.value, 10) || 1024)}
                />
                <p className="text-xs text-muted-foreground">
                  Limite de tokens por resposta.
                </p>
              </div>
            </div>

            <Tabs defaultValue="inicial" className="w-full">
              <TabsList className="flex flex-wrap h-auto gap-1 p-1">
                {STAGE_KEYS.map(({ key, label }) => (
                  <TabsTrigger key={key} value={key} className="text-xs">
                    {label}
                  </TabsTrigger>
                ))}
              </TabsList>
              {STAGE_KEYS.map(({ key, label }) => (
                <TabsContent key={key} value={key}>
                  <StageTabContent
                    stage={stages[key]}
                    stageLabel={label}
                    onChange={(updated) => updateStage(key, updated)}
                  />
                </TabsContent>
              ))}
            </Tabs>

            <div className="pt-6 border-t border-border flex justify-end gap-4">
              <Button type="button" variant="outline" asChild>
                <Link to="/admin/prompt-templates">Cancelar</Link>
              </Button>
              <Button onClick={handleSubmit} disabled={isSaving}>
                {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                {isNew ? "Salvar" : "Atualizar"}
              </Button>
            </div>
          </div>
        )}
      </div>
    </AdminLayout>
  )
}
