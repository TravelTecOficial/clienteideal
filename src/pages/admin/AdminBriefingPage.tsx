import { useEffect, useState, useCallback } from "react"
import { useUser, useAuth } from "@clerk/clerk-react"
import { Navigate } from "react-router-dom"
import { useSupabaseClient } from "@/lib/supabase-context"
import { SUPABASE_URL, SUPABASE_ANON_KEY } from "@/lib/supabase"
import { AdminLayout } from "@/components/admin-layout"
import { isSaasAdmin } from "@/lib/use-saas-admin"
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
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { useToast } from "@/hooks/use-toast"
import {
  Plus,
  Loader2,
  Trash2,
  Pencil,
  ChevronUp,
  ChevronDown,
  FileQuestion,
  Sparkles,
} from "lucide-react"

// --- Types ---
type BriefingCategory =
  | "dna_empresa"
  | "produto_oferta"
  | "publico_persona"
  | "mercado_concorrencia"
  | "objetivos_metas"

type BriefingInputType = "texto_curto" | "texto_longo" | "selecao" | "numerico"

interface BriefingQuestion {
  id: string
  category: BriefingCategory
  question_text: string
  help_text: string | null
  input_type: BriefingInputType
  slug: string
  is_atrito: boolean
  options: string[] | null
  ordem: number
  created_at: string
  updated_at: string
}

const CATEGORY_LABELS: Record<BriefingCategory, string> = {
  dna_empresa: "DNA da Empresa",
  produto_oferta: "Produto/Oferta",
  publico_persona: "Público e Persona",
  mercado_concorrencia: "Mercado e Concorrência",
  objetivos_metas: "Objetivos e Metas",
}

const INPUT_TYPE_LABELS: Record<BriefingInputType, string> = {
  texto_curto: "Texto curto",
  texto_longo: "Texto longo",
  selecao: "Seleção",
  numerico: "Numérico",
}

const CATEGORIES: BriefingCategory[] = [
  "dna_empresa",
  "produto_oferta",
  "publico_persona",
  "mercado_concorrencia",
  "objetivos_metas",
]

// --- Preview Component ---
function BriefingPreview({
  questions,
  category,
}: {
  questions: BriefingQuestion[]
  category: BriefingCategory
}) {
  return (
    <Card className="border-border bg-muted/30">
      <CardHeader className="pb-2">
        <CardTitle className="text-base flex items-center gap-2">
          <FileQuestion className="h-4 w-4" />
          Preview: Chat de Briefing
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm font-medium text-foreground">
          {CATEGORY_LABELS[category]}
        </p>
        {questions.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Nenhuma pergunta nesta categoria. Adicione perguntas para ver o preview.
          </p>
        ) : (
          <div className="space-y-4">
            {questions.map((q) => (
              <div key={q.id} className="space-y-2">
                <div className="flex items-center gap-2">
                  <Label className="text-sm font-medium">{q.question_text}</Label>
                  {q.is_atrito && (
                    <Badge variant="secondary" className="text-xs gap-0.5">
                      <Sparkles className="h-3 w-3" />
                      Atrito
                    </Badge>
                  )}
                </div>
                {q.help_text && (
                  <p className="text-xs text-muted-foreground">{q.help_text}</p>
                )}
                {q.input_type === "texto_curto" && (
                  <Input
                    placeholder="Sua resposta..."
                    className="bg-background"
                    readOnly
                    disabled
                  />
                )}
                {q.input_type === "texto_longo" && (
                  <Textarea
                    placeholder="Sua resposta..."
                    className="bg-background min-h-[80px]"
                    readOnly
                    disabled
                  />
                )}
                {q.input_type === "numerico" && (
                  <Input
                    type="number"
                    placeholder="0"
                    className="bg-background"
                    readOnly
                    disabled
                  />
                )}
                {q.input_type === "selecao" && (
                  <Select disabled>
                    <SelectTrigger className="bg-background">
                      <SelectValue placeholder="Selecione..." />
                    </SelectTrigger>
                    <SelectContent>
                      {(q.options ?? []).map((opt) => (
                        <SelectItem key={opt} value={opt}>
                          {opt}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}

// --- Main Page ---
export function AdminBriefingPage() {
  const { isLoaded, isSignedIn, user } = useUser()
  const { getToken } = useAuth()
  const supabase = useSupabaseClient()
  const { toast } = useToast()

  const [questions, setQuestions] = useState<BriefingQuestion[]>([])
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle")
  const [errorMsg, setErrorMsg] = useState("")
  const [activeCategory, setActiveCategory] = useState<BriefingCategory>("dna_empresa")
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editingQuestion, setEditingQuestion] = useState<BriefingQuestion | null>(null)
  const [isSaving, setIsSaving] = useState(false)

  // Form state
  const [formQuestionText, setFormQuestionText] = useState("")
  const [formHelpText, setFormHelpText] = useState("")
  const [formInputType, setFormInputType] = useState<BriefingInputType>("texto_curto")
  const [formSlug, setFormSlug] = useState("")
  const [formIsAtrito, setFormIsAtrito] = useState(false)
  const [formOptions, setFormOptions] = useState<string>("")
  const [formOrdem, setFormOrdem] = useState(1)

  const fetchQuestions = useCallback(async () => {
    setStatus("loading")
    setErrorMsg("")
    try {
      const { data, error } = await supabase
        .from("briefing_questions")
        .select("*")
        .order("ordem", { ascending: true })

      if (error) throw error
      setQuestions((data as BriefingQuestion[]) ?? [])
      setStatus("success")
    } catch (err) {
      setStatus("error")
      setErrorMsg(getErrorMessage(err, "Erro ao carregar perguntas."))
    }
  }, [supabase])

  useEffect(() => {
    if (!isLoaded || !isSignedIn || !user) return
    if (!isSaasAdmin(user.publicMetadata as Record<string, unknown>)) return
    fetchQuestions()
  }, [isLoaded, isSignedIn, user, fetchQuestions])

  const questionsByCategory = questions.filter((q) => q.category === activeCategory)

  const callEdgeFunction = async (
    action: "create" | "update" | "delete" | "reorder",
    payload: Record<string, unknown>
  ) => {
    const token = (await getToken({ template: "supabase" })) ?? (await getToken())
    if (!token) throw new Error("Token indisponível. Faça login novamente.")

    // #region agent log
    fetch("http://127.0.0.1:7243/ingest/f98a865e-323b-4de9-a075-eed5347401f2", {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Debug-Session-Id": "d58bde" },
      body: JSON.stringify({
        sessionId: "d58bde",
        location: "AdminBriefingPage.tsx:callEdgeFunction",
        message: "Antes do fetch",
        data: { action, hasToken: !!token, tokenPrefix: token?.slice(0, 20) },
        timestamp: Date.now(),
        hypothesisId: "A",
      }),
    }).catch(() => {})
    // #endregion

    const res = await fetch(`${SUPABASE_URL}/functions/v1/admin-briefing-questions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: SUPABASE_ANON_KEY,
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ action, token, ...payload }),
    })
    const data = (await res.json().catch(() => ({}))) as { error?: string }

    // #region agent log
    fetch("http://127.0.0.1:7243/ingest/f98a865e-323b-4de9-a075-eed5347401f2", {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Debug-Session-Id": "d58bde" },
      body: JSON.stringify({
        sessionId: "d58bde",
        location: "AdminBriefingPage.tsx:callEdgeFunction",
        message: "Resposta da API",
        data: { status: res.status, ok: res.ok, body: data },
        timestamp: Date.now(),
        hypothesisId: "B",
      }),
    }).catch(() => {})
    // #endregion

    if (!res.ok) throw new Error(data?.error ?? `Erro ${res.status}`)
    if (data?.error) throw new Error(data.error)
  }

  const handleOpenNew = () => {
    setEditingQuestion(null)
    setFormQuestionText("")
    setFormHelpText("")
    setFormInputType("texto_curto")
    setFormSlug("")
    setFormIsAtrito(false)
    setFormOptions("")
    setFormOrdem(questionsByCategory.length + 1)
    setIsModalOpen(true)
  }

  const handleOpenEdit = (q: BriefingQuestion) => {
    setEditingQuestion(q)
    setFormQuestionText(q.question_text)
    setFormHelpText(q.help_text ?? "")
    setFormInputType(q.input_type)
    setFormSlug(q.slug)
    setFormIsAtrito(q.is_atrito)
    setFormOptions((q.options ?? []).join("\n"))
    setFormOrdem(q.ordem)
    setIsModalOpen(true)
  }

  const handleSubmit = async () => {
    const slug = formSlug.trim().toLowerCase().replace(/\s+/g, "_")
    if (!/^[a-z0-9_]+$/.test(slug) || slug.length < 2) {
      toast({
        variant: "destructive",
        title: "Slug inválido",
        description: "Use apenas letras minúsculas, números e underscore (ex: oferta_ticket_medio).",
      })
      return
    }
    if (!formQuestionText.trim()) {
      toast({
        variant: "destructive",
        title: "Erro",
        description: "Texto da pergunta é obrigatório.",
      })
      return
    }
    if (formInputType === "selecao") {
      const opts = formOptions
        .split("\n")
        .map((s) => s.trim())
        .filter(Boolean)
      if (opts.length === 0) {
        toast({
          variant: "destructive",
          title: "Erro",
          description: "Para tipo Seleção, adicione pelo menos uma opção.",
        })
        return
        }
    }

    setIsSaving(true)
    try {
      if (editingQuestion) {
        const payload: Record<string, unknown> = {
          id: editingQuestion.id,
          question_text: formQuestionText.trim(),
          help_text: formHelpText.trim() || null,
          input_type: formInputType,
          slug,
          is_atrito: formIsAtrito,
          ordem: formOrdem,
        }
        if (formInputType === "selecao") {
          payload.options = formOptions
            .split("\n")
            .map((s) => s.trim())
            .filter(Boolean)
        } else {
          payload.options = null
        }
        await callEdgeFunction("update", payload)
        toast({ title: "Atualizado!", description: "Pergunta salva com sucesso." })
      } else {
        const payload: Record<string, unknown> = {
          category: activeCategory,
          question_text: formQuestionText.trim(),
          help_text: formHelpText.trim() || null,
          input_type: formInputType,
          slug,
          is_atrito: formIsAtrito,
          ordem: formOrdem,
        }
        if (formInputType === "selecao") {
          payload.options = formOptions
            .split("\n")
            .map((s) => s.trim())
            .filter(Boolean)
        }
        await callEdgeFunction("create", payload)
        toast({ title: "Criado!", description: "Pergunta adicionada com sucesso." })
      }
      setIsModalOpen(false)
      fetchQuestions()
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

  const handleDelete = async (q: BriefingQuestion) => {
    if (!window.confirm(`Excluir a pergunta "${q.question_text}"?`)) return
    try {
      await callEdgeFunction("delete", { id: q.id })
      toast({ title: "Excluído", description: "Pergunta removida." })
      fetchQuestions()
    } catch (err) {
      toast({
        variant: "destructive",
        title: "Erro ao excluir",
        description: getErrorMessage(err),
      })
    }
  }

  const handleMoveUp = async (q: BriefingQuestion, idx: number) => {
    if (idx <= 0) return
    const prev = questionsByCategory[idx - 1]
    const newOrder = [...questionsByCategory]
    ;[newOrder[idx - 1], newOrder[idx]] = [newOrder[idx], newOrder[idx - 1]]
    try {
      await callEdgeFunction("reorder", {
        category: activeCategory,
        order_ids: newOrder.map((x) => x.id),
      })
      toast({ title: "Ordem atualizada" })
      fetchQuestions()
    } catch (err) {
      toast({
        variant: "destructive",
        title: "Erro",
        description: getErrorMessage(err),
      })
    }
  }

  const handleMoveDown = async (q: BriefingQuestion, idx: number) => {
    if (idx >= questionsByCategory.length - 1) return
    const newOrder = [...questionsByCategory]
    ;[newOrder[idx], newOrder[idx + 1]] = [newOrder[idx + 1], newOrder[idx]]
    try {
      await callEdgeFunction("reorder", {
        category: activeCategory,
        order_ids: newOrder.map((x) => x.id),
      })
      toast({ title: "Ordem atualizada" })
      fetchQuestions()
    } catch (err) {
      toast({
        variant: "destructive",
        title: "Erro",
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
    <AdminLayout breadcrumb={{ label: "Briefing Estratégico", page: "Briefing Estratégico" }}>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">
            Questionário de Briefing Estratégico
          </h1>
          <p className="text-muted-foreground">
            Gerencie as perguntas do questionário por pilar. As respostas são salvas por empresa no Chat de Briefing.
          </p>
        </div>

        {status === "loading" && (
          <div className="flex min-h-[120px] items-center justify-center">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        )}

        {status === "error" && (
          <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-4 flex items-center gap-3">
            <p className="font-medium text-destructive">Erro ao carregar perguntas</p>
            <p className="text-sm text-muted-foreground">{errorMsg}</p>
            <Button variant="outline" size="sm" onClick={fetchQuestions}>
              Tentar novamente
            </Button>
          </div>
        )}

        {status === "success" && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 space-y-4">
              <Tabs value={activeCategory} onValueChange={(v) => setActiveCategory(v as BriefingCategory)}>
                <TabsList className="grid w-full grid-cols-5">
                  {CATEGORIES.map((cat) => (
                    <TabsTrigger key={cat} value={cat} className="text-xs truncate">
                      {CATEGORY_LABELS[cat]}
                    </TabsTrigger>
                  ))}
                </TabsList>

                {CATEGORIES.map((cat) => (
                  <TabsContent key={cat} value={cat} className="space-y-4 mt-4">
                    <div className="flex justify-between items-center">
                      <h3 className="text-lg font-medium">{CATEGORY_LABELS[cat]}</h3>
                      <Button size="sm" onClick={handleOpenNew}>
                        <Plus className="h-4 w-4 mr-1" />
                        Nova Pergunta
                      </Button>
                    </div>

                    <div className="rounded-lg border border-border overflow-hidden">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead className="w-10" />
                            <TableHead>Pergunta</TableHead>
                            <TableHead>Tipo</TableHead>
                            <TableHead>Slug</TableHead>
                            <TableHead className="w-24">Atrito</TableHead>
                            <TableHead className="w-[100px]">Ações</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {questions
                            .filter((q) => q.category === cat)
                            .sort((a, b) => a.ordem - b.ordem)
                            .map((q, idx) => (
                              <TableRow key={q.id}>
                                <TableCell>
                                  <div className="flex flex-col gap-0">
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      className="h-6 w-6"
                                      onClick={() => handleMoveUp(q, idx)}
                                      disabled={idx === 0}
                                      aria-label="Mover para cima"
                                    >
                                      <ChevronUp className="h-4 w-4" />
                                    </Button>
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      className="h-6 w-6"
                                      onClick={() => handleMoveDown(q, idx)}
                                      disabled={idx === questions.filter((x) => x.category === cat).length - 1}
                                      aria-label="Mover para baixo"
                                    >
                                      <ChevronDown className="h-4 w-4" />
                                    </Button>
                                  </div>
                                </TableCell>
                                <TableCell className="max-w-[200px] truncate" title={q.question_text}>
                                  {q.question_text}
                                </TableCell>
                                <TableCell className="text-muted-foreground text-sm">
                                  {INPUT_TYPE_LABELS[q.input_type]}
                                </TableCell>
                                <TableCell className="font-mono text-xs">{q.slug}</TableCell>
                                <TableCell>
                                  {q.is_atrito && (
                                    <Badge variant="secondary" className="text-xs">
                                      <Sparkles className="h-3 w-3 mr-0.5" />
                                      Atrito
                                    </Badge>
                                  )}
                                </TableCell>
                                <TableCell>
                                  <div className="flex gap-1">
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      className="h-8 w-8"
                                      onClick={() => handleOpenEdit(q)}
                                      aria-label="Editar"
                                    >
                                      <Pencil className="h-4 w-4" />
                                    </Button>
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10"
                                      onClick={() => handleDelete(q)}
                                      aria-label="Excluir"
                                    >
                                      <Trash2 className="h-4 w-4" />
                                    </Button>
                                  </div>
                                </TableCell>
                              </TableRow>
                            ))}
                          {questions.filter((q) => q.category === cat).length === 0 && (
                            <TableRow>
                              <TableCell colSpan={6} className="py-8 text-center text-muted-foreground">
                                Nenhuma pergunta. Clique em &quot;Nova Pergunta&quot; para adicionar.
                              </TableCell>
                            </TableRow>
                          )}
                        </TableBody>
                      </Table>
                    </div>
                  </TabsContent>
                ))}
              </Tabs>
            </div>

            <div className="lg:col-span-1">
              <div className="sticky top-4">
                <BriefingPreview
                  questions={questionsByCategory}
                  category={activeCategory}
                />
              </div>
            </div>
          </div>
        )}
      </div>

      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingQuestion ? "Editar Pergunta" : "Nova Pergunta"}
            </DialogTitle>
            <DialogDescription>
              {editingQuestion
                ? "Altere os dados da pergunta."
                : `Adicione uma pergunta na categoria ${CATEGORY_LABELS[activeCategory]}.`}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 pt-4">
            <div className="space-y-2">
              <Label htmlFor="question_text">Texto da Pergunta</Label>
              <Input
                id="question_text"
                value={formQuestionText}
                onChange={(e) => setFormQuestionText(e.target.value)}
                placeholder="Ex: Qual o ticket médio do seu produto?"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="help_text">Dica de Ajuda (opcional)</Label>
              <Textarea
                id="help_text"
                value={formHelpText}
                onChange={(e) => setFormHelpText(e.target.value)}
                placeholder="Ex: Isso ajuda a IA a entender o esforço de venda necessário."
                rows={2}
              />
            </div>

            <div className="space-y-2">
              <Label>Tipo de Input</Label>
              <Select
                value={formInputType}
                onValueChange={(v) => setFormInputType(v as BriefingInputType)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="texto_curto">Texto curto</SelectItem>
                  <SelectItem value="texto_longo">Texto longo</SelectItem>
                  <SelectItem value="selecao">Seleção</SelectItem>
                  <SelectItem value="numerico">Numérico</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {formInputType === "selecao" && (
              <div className="space-y-2">
                <Label htmlFor="options">Opções (uma por linha)</Label>
                <Textarea
                  id="options"
                  value={formOptions}
                  onChange={(e) => setFormOptions(e.target.value)}
                  placeholder="Uma opção por linha"
                  rows={4}
                />
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="slug">Slug / ID de Referência</Label>
              <Input
                id="slug"
                value={formSlug}
                onChange={(e) =>
                  setFormSlug(e.target.value.replace(/\s/g, "_").toLowerCase())
                }
                placeholder="oferta_ticket_medio"
              />
              <p className="text-xs text-muted-foreground">
                snake_case, apenas letras minúsculas, números e underscore.
              </p>
            </div>

            <div className="flex items-center gap-2">
              <Switch
                id="is_atrito"
                checked={formIsAtrito}
                onCheckedChange={setFormIsAtrito}
              />
              <Label htmlFor="is_atrito" className="cursor-pointer">
                Pergunta de Atrito (peso maior na vetorização para IA)
              </Label>
            </div>

            {editingQuestion && (
              <div className="space-y-2">
                <Label htmlFor="ordem">Ordem</Label>
                <Input
                  id="ordem"
                  type="number"
                  min={1}
                  value={formOrdem}
                  onChange={(e) => setFormOrdem(parseInt(e.target.value, 10) || 1)}
                />
              </div>
            )}

            <div className="pt-4 flex justify-end gap-2">
              <Button variant="outline" onClick={() => setIsModalOpen(false)}>
                Cancelar
              </Button>
              <Button onClick={handleSubmit} disabled={isSaving}>
                {isSaving && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                {editingQuestion ? "Atualizar" : "Salvar"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </AdminLayout>
  )
}
