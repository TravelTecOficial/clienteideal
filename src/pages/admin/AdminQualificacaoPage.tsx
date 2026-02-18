import { useEffect, useState, useCallback } from "react"
import { useUser, useAuth } from "@clerk/clerk-react"
import { Navigate } from "react-router-dom"
import { SUPABASE_URL, SUPABASE_ANON_KEY } from "@/lib/supabase"
import { AdminLayout } from "@/components/admin-layout"
import { isSaasAdmin } from "@/lib/use-saas-admin"
import { getErrorMessage } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
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
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core"
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable"
import { CSS } from "@dnd-kit/utilities"
import { Plus, Loader2, Edit2, Trash2, Pencil, GripVertical, AlertCircle } from "lucide-react"
import { cn } from "@/lib/utils"

interface QualificacaoTemplateRow {
  id: string
  nome: string | null
  segment_type: string | null
  perguntas?: Array<{
    id: string
    pergunta: string
    peso: number
    ordem: number
    resposta_fria: string
    resposta_morna: string
    resposta_quente: string
  }>
}

interface PerguntaLocal {
  id: string
  pergunta: string
  peso: number
  resposta_fria: string
  resposta_morna: string
  resposta_quente: string
}

const respostasConfig = [
  { id: "fria" as const, labelBase: "Frio", valorTipo: 1, dotClass: "bg-info" },
  { id: "morna" as const, labelBase: "Morno", valorTipo: 5, dotClass: "bg-warning" },
  { id: "quente" as const, labelBase: "Quente", valorTipo: 10, dotClass: "bg-destructive" },
] as const

function generateId(): string {
  return Math.random().toString(36).slice(2, 11)
}

function SortablePerguntaCard({
  pergunta,
  idx,
  onRemove,
  onUpdate,
  canRemove,
}: {
  pergunta: PerguntaLocal
  idx: number
  onRemove: () => void
  onUpdate: (id: string, field: keyof PerguntaLocal, value: string | number) => void
  canRemove: boolean
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: pergunta.id })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        "rounded-lg border border-border p-4 space-y-4 bg-muted/30",
        isDragging && "opacity-50 shadow-lg"
      )}
    >
      <div className="flex justify-between items-start gap-2">
        <div className="flex items-center gap-2">
          <button
            type="button"
            className="touch-none cursor-grab active:cursor-grabbing p-1 rounded hover:bg-muted text-muted-foreground"
            aria-label="Arrastar para reordenar"
            {...attributes}
            {...listeners}
          >
            <GripVertical className="h-4 w-4" />
          </button>
          <span className="text-sm font-medium text-muted-foreground">Pergunta {idx + 1}</span>
        </div>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="text-destructive hover:text-destructive h-8 shrink-0"
          onClick={onRemove}
          disabled={!canRemove}
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      </div>

      <div className="space-y-2">
        <Input
          value={pergunta.pergunta}
          onChange={(e) => onUpdate(pergunta.id, "pergunta", e.target.value)}
          placeholder="Ex: Qual é a sua renda mensal?"
          className="border-0 border-b border-input rounded-none px-0 bg-transparent focus-visible:ring-0 focus-visible:ring-offset-0 focus-visible:border-primary text-lg font-medium h-auto py-2"
        />
      </div>

      <div className="flex gap-4 items-center">
        <div className="w-24 shrink-0">
          <Label className="text-[11px] font-bold uppercase text-muted-foreground tracking-wider">
            Peso
          </Label>
          <select
            value={String(pergunta.peso)}
            onChange={(e) => onUpdate(pergunta.id, "peso", parseInt(e.target.value, 10) || 1)}
            className="flex h-10 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm"
          >
            <option value="1">1x</option>
            <option value="2">2x</option>
            <option value="3">3x</option>
          </select>
        </div>
      </div>

      <div className="space-y-3">
        {respostasConfig.map((item) => {
          const pontuacao = item.valorTipo * pergunta.peso
          return (
            <div key={item.id} className="flex items-center gap-4">
              <div className="flex items-center gap-3 min-w-[140px]">
                <div className={cn("w-2.5 h-2.5 rounded-full", item.dotClass)} />
                <span className="text-[11px] font-bold text-muted-foreground uppercase tracking-widest">
                  {item.labelBase} ({pontuacao} pts)
                </span>
              </div>
              <div className="flex-1">
                <Input
                  value={pergunta[`resposta_${item.id}`]}
                  onChange={(e) =>
                    onUpdate(pergunta.id, `resposta_${item.id}` as keyof PerguntaLocal, e.target.value)
                  }
                  placeholder={`Resposta ${item.labelBase.toLowerCase()}...`}
                  className="border-input"
                />
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

const SEGMENT_LABELS: Record<string, string> = {
  geral: "Geral",
  produtos: "Produtos & Serviços",
  consorcio: "Consórcio",
  seguros: "Seguros",
}

export function AdminQualificacaoPage() {
  const { isLoaded, isSignedIn, user } = useUser()
  const { getToken } = useAuth()
  const { toast } = useToast()
  const [templates, setTemplates] = useState<QualificacaoTemplateRow[]>([])
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle")
  const [errorMsg, setErrorMsg] = useState("")
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [isSaving, setIsSaving] = useState(false)
  const [nome, setNome] = useState("")
  const [segmentType, setSegmentType] = useState<"geral" | "produtos" | "consorcio" | "seguros">("geral")
  const [perguntas, setPerguntas] = useState<PerguntaLocal[]>([
    { id: generateId(), pergunta: "", peso: 1, resposta_fria: "", resposta_morna: "", resposta_quente: "" },
  ])

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  )

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
      const res = await fetch(`${SUPABASE_URL}/functions/v1/admin-qualificacao-templates`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          apikey: SUPABASE_ANON_KEY,
          Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
        },
        body: JSON.stringify({ action: "list", token }),
      })
      const data = (await res.json().catch(() => ({}))) as { error?: string; templates?: QualificacaoTemplateRow[] }
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
    setNome("")
    setSegmentType("geral")
    setPerguntas([
      { id: generateId(), pergunta: "", peso: 1, resposta_fria: "", resposta_morna: "", resposta_quente: "" },
    ])
    setIsModalOpen(true)
  }

  const handleOpenEdit = (t: QualificacaoTemplateRow) => {
    setEditingId(t.id)
    setNome(t.nome ?? "")
    setSegmentType((t.segment_type as "geral" | "produtos" | "consorcio" | "seguros") ?? "geral")
    const pergs = t.perguntas ?? []
    setPerguntas(
      pergs.length > 0
        ? pergs.map((p) => ({
            id: generateId(),
            pergunta: p.pergunta ?? "",
            peso: p.peso ?? 1,
            resposta_fria: p.resposta_fria ?? "",
            resposta_morna: p.resposta_morna ?? "",
            resposta_quente: p.resposta_quente ?? "",
          }))
        : [{ id: generateId(), pergunta: "", peso: 1, resposta_fria: "", resposta_morna: "", resposta_quente: "" }]
    )
    setIsModalOpen(true)
  }

  const addPergunta = () => {
    setPerguntas((prev) => [
      ...prev,
      { id: generateId(), pergunta: "", peso: 1, resposta_fria: "", resposta_morna: "", resposta_quente: "" },
    ])
  }

  const removePergunta = (id: string) => {
    setPerguntas((prev) => prev.filter((p) => p.id !== id))
  }

  const updatePergunta = (id: string, field: keyof PerguntaLocal, value: string | number) => {
    setPerguntas((prev) =>
      prev.map((p) => (p.id === id ? { ...p, [field]: value } : p))
    )
  }

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event
    if (over && active.id !== over.id) {
      setPerguntas((prev) => {
        const oldIndex = prev.findIndex((p) => p.id === active.id)
        const newIndex = prev.findIndex((p) => p.id === over.id)
        if (oldIndex === -1 || newIndex === -1) return prev
        return arrayMove(prev, oldIndex, newIndex)
      })
    }
  }

  async function handleSubmit() {
    if (!nome.trim()) {
      toast({ variant: "destructive", title: "Erro", description: "Nome é obrigatório." })
      return
    }
    const perguntasValidas = perguntas.filter(
      (p) =>
        p.pergunta.trim() &&
        (p.resposta_fria.trim() || p.resposta_morna.trim() || p.resposta_quente.trim())
    )
    if (perguntasValidas.length === 0) {
      toast({
        variant: "destructive",
        title: "Erro",
        description: "Adicione pelo menos uma pergunta com ao menos uma resposta.",
      })
      return
    }

    const token = (await getToken()) ?? (await getToken({ template: "supabase" }))
    if (!token) {
      toast({ variant: "destructive", title: "Erro", description: "Sessão inválida." })
      return
    }

    setIsSaving(true)
    try {
      const payload = {
        action: editingId ? "update" : "create",
        token,
        id: editingId ?? undefined,
        nome: nome.trim(),
        segment_type: segmentType,
        perguntas: perguntasValidas.map((p, i) => ({
          pergunta: p.pergunta.trim(),
          peso: Math.min(3, Math.max(1, p.peso)),
          ordem: i + 1,
          resposta_fria: p.resposta_fria.trim() || undefined,
          resposta_morna: p.resposta_morna.trim() || undefined,
          resposta_quente: p.resposta_quente.trim() || undefined,
        })),
      }

      const res = await fetch(`${SUPABASE_URL}/functions/v1/admin-qualificacao-templates`, {
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
        description: "Modelo de qualificação salvo com sucesso.",
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

  async function handleDelete(t: QualificacaoTemplateRow) {
    const confirmed = window.confirm(
      `Excluir o modelo "${t.nome ?? "Sem nome"}"? Esta ação não pode ser desfeita.`
    )
    if (!confirmed) return
    const token = (await getToken()) ?? (await getToken({ template: "supabase" }))
    if (!token) return
    try {
      const res = await fetch(`${SUPABASE_URL}/functions/v1/admin-qualificacao-templates`, {
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

  return (
    <AdminLayout breadcrumb={{ label: "Modelos de Qualificação", page: "Modelos de Qualificação" }}>
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-foreground">
              Modelos de Qualificação
            </h1>
            <p className="text-muted-foreground">
              Modelos globais que as licenças podem copiar para sua empresa na página Qualificador.
            </p>
          </div>
          <Button onClick={handleOpenNew}>
            <Plus className="mr-2 h-4 w-4" /> Novo Modelo
          </Button>
        </div>

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
                  <TableHead className="text-muted-foreground">Nome</TableHead>
                  <TableHead className="text-muted-foreground">Segmento</TableHead>
                  <TableHead className="text-muted-foreground">Perguntas</TableHead>
                  <TableHead className="text-right text-muted-foreground">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {templates.length === 0 ? (
                  <TableRow className="border-border">
                    <TableCell colSpan={4} className="py-12 text-center text-muted-foreground">
                      Nenhum modelo cadastrado. Clique em &quot;Novo Modelo&quot; para começar.
                    </TableCell>
                  </TableRow>
                ) : (
                  templates.map((t) => (
                    <TableRow key={t.id} className="border-border hover:bg-muted/50">
                      <TableCell className="font-medium text-foreground">{t.nome ?? "—"}</TableCell>
                      <TableCell className="text-muted-foreground">
                        {SEGMENT_LABELS[t.segment_type ?? "geral"] ?? t.segment_type}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {t.perguntas?.length ?? 0}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleOpenEdit(t)}
                            aria-label={`Editar ${t.nome ?? "modelo"}`}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-destructive hover:text-destructive hover:bg-destructive/10"
                            onClick={() => handleDelete(t)}
                            aria-label={`Excluir ${t.nome ?? "modelo"}`}
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
      </div>

      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-foreground">
              {editingId ? "Editar Modelo de Qualificação" : "Novo Modelo de Qualificação"}
            </DialogTitle>
            <DialogDescription className="text-muted-foreground">
              Os campos preenchidos serão copiados quando uma licença usar este modelo.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-6 pt-4">
            <div className="flex gap-6">
              <div className="flex-1 space-y-2">
                <Label>Nome do qualificador</Label>
                <Input
                  value={nome}
                  onChange={(e) => setNome(e.target.value)}
                  placeholder="Ex: Qualificador de vendas B2B"
                />
              </div>
              <div className="flex-1 space-y-2">
                <Label>Segmento</Label>
                <Select value={segmentType} onValueChange={(v) => setSegmentType(v as typeof segmentType)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="geral">Geral</SelectItem>
                    <SelectItem value="produtos">Produtos & Serviços</SelectItem>
                    <SelectItem value="consorcio">Consórcio</SelectItem>
                    <SelectItem value="seguros">Seguros</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <Label>Perguntas e respostas</Label>
                <Button type="button" variant="outline" size="sm" onClick={addPergunta}>
                  <Plus className="mr-2 h-4 w-4" /> Adicionar pergunta
                </Button>
              </div>

              <DndContext
                sensors={sensors}
                collisionDetection={closestCenter}
                onDragEnd={handleDragEnd}
              >
                <SortableContext
                  items={perguntas.map((p) => p.id)}
                  strategy={verticalListSortingStrategy}
                >
                  <div className="space-y-4">
                    {perguntas.map((p, idx) => (
                      <SortablePerguntaCard
                        key={p.id}
                        pergunta={p}
                        idx={idx}
                        onRemove={() => removePergunta(p.id)}
                        onUpdate={updatePergunta}
                        canRemove={perguntas.length > 1}
                      />
                    ))}
                  </div>
                </SortableContext>
              </DndContext>
            </div>

            <div className="pt-6 border-t border-border flex justify-end gap-4">
              <Button type="button" variant="outline" onClick={() => setIsModalOpen(false)}>
                Cancelar
              </Button>
              <Button onClick={handleSubmit} disabled={isSaving}>
                {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                {editingId ? "Atualizar" : "Salvar"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </AdminLayout>
  )
}
