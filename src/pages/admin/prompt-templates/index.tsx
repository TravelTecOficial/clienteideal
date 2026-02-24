import { useEffect, useState, useCallback } from "react"
import { useUser } from "@clerk/clerk-react"
import { Navigate, useNavigate } from "react-router-dom"
import { AdminLayout } from "@/components/admin-layout"
import { isSaasAdmin } from "@/lib/use-saas-admin"
import { useSupabaseClient } from "@/lib/supabase-context"
import { getErrorMessage } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { useToast } from "@/hooks/use-toast"
import { Plus, Loader2, Trash2, Pencil, AlertCircle } from "lucide-react"

const CATEGORIA_OBJETIVO_OPTIONS = [
  { value: "atendimento", label: "Apenas Atendimento" },
  { value: "atendimento_agendamento", label: "Atendimento + Agendamento" },
  { value: "atendimento_qualificacao_agendamento", label: "Atendimento + Qualificação + Agendamento" },
  { value: "atendimento_completo", label: "Atendimento + Qualificação + Agendamento + Pagamento" },
  { value: "atendimento_agendamento_pagamento", label: "Atendimento + Agendamento + Pagamento" },
] as const

interface PromptTemplateRow {
  id: string
  name: string | null
  categoria_objetivo: string | null
  criatividade_temperatura: number | null
  max_tokens: number | null
  informacoes_uso: string | null
}

interface PromptTemplateWithStages extends PromptTemplateRow {
  stages?: Array<{
    id: string
    stage_key: string
  }>
}

export function AdminPromptTemplatesPage() {
  const navigate = useNavigate()
  const { isLoaded, isSignedIn, user } = useUser()
  const supabase = useSupabaseClient()
  const { toast } = useToast()
  const [templates, setTemplates] = useState<PromptTemplateWithStages[]>([])
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle")
  const [errorMsg, setErrorMsg] = useState("")

  const fetchTemplates = useCallback(async () => {
    setStatus("loading")
    setErrorMsg("")
    try {
      const { data: templatesData, error: templatesError } = await supabase
        .from("prompt_templates")
        .select("id, name, categoria_objetivo, criatividade_temperatura, max_tokens, informacoes_uso")
        .order("created_at", { ascending: false })

      if (templatesError) throw templatesError

      const { data: stagesData, error: stagesError } = await supabase
        .from("prompt_template_stages")
        .select("id, template_id, stage_key")

      if (stagesError) throw stagesError

      type StageRow = { id: string; template_id: string; stage_key: string }
      const stagesByTemplate = (stagesData ?? []).reduce(
        (acc: Record<string, StageRow[]>, s: StageRow) => {
          const tid = s.template_id
          if (!acc[tid]) acc[tid] = []
          acc[tid].push(s)
          return acc
        },
        {} as Record<string, StageRow[]>
      )

      const merged: PromptTemplateWithStages[] = (templatesData ?? []).map((t: PromptTemplateRow) => ({
        ...t,
        stages: stagesByTemplate[t.id] ?? [],
      }))

      setTemplates(merged)
      setStatus("success")
    } catch (err) {
      setStatus("error")
      setErrorMsg(getErrorMessage(err, "Erro ao carregar templates."))
    }
  }, [supabase])

  useEffect(() => {
    if (!isLoaded || !isSignedIn || !user) return
    if (!isSaasAdmin(user.publicMetadata as Record<string, unknown>)) return
    fetchTemplates()
  }, [isLoaded, isSignedIn, user, fetchTemplates])

  async function handleDelete(t: PromptTemplateRow, e: React.MouseEvent) {
    e.stopPropagation()
    const confirmed = window.confirm(
      `Excluir o template "${t.name ?? "Sem nome"}"? Esta ação não pode ser desfeita.`
    )
    if (!confirmed) return
    try {
      const { error } = await supabase.from("prompt_templates").delete().eq("id", t.id)
      if (error) throw error
      toast({ title: "Excluído", description: "Template removido." })
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
    <AdminLayout breadcrumb={{ label: "Templates Master", page: "Templates Master" }}>
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-foreground">
              Templates Master
            </h1>
            <p className="text-muted-foreground">
              Modelos de prompt por estágio do fluxo: inicial, atendimento, qualificação, agendamento, grupo, pagamento e encerramento.
            </p>
          </div>
          <Button onClick={() => navigate("/admin/prompt-templates/new")}>
            <Plus className="mr-2 h-4 w-4" /> Novo Template
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
              <p className="font-medium text-destructive">Erro ao carregar templates</p>
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
                  <TableHead className="text-muted-foreground">Modelo de atendimento</TableHead>
                  <TableHead className="text-muted-foreground">Estágios</TableHead>
                  <TableHead className="text-right text-muted-foreground">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {templates.length === 0 ? (
                  <TableRow className="border-border">
                    <TableCell colSpan={4} className="py-12 text-center text-muted-foreground">
                      Nenhum template cadastrado. Clique em &quot;Novo Template&quot; para começar.
                    </TableCell>
                  </TableRow>
                ) : (
                  templates.map((t) => (
                    <TableRow
                      key={t.id}
                      className="border-border hover:bg-muted/50 cursor-pointer"
                      onClick={() => navigate(`/admin/prompt-templates/${t.id}`)}
                    >
                      <TableCell className="font-medium text-foreground">{t.name ?? "—"}</TableCell>
                      <TableCell className="text-muted-foreground">
                        {CATEGORIA_OBJETIVO_OPTIONS.find((o) => o.value === t.categoria_objetivo)?.label ?? "—"}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {t.stages?.length ?? 0} estágio(s)
                      </TableCell>
                      <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                        <div className="flex justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => navigate(`/admin/prompt-templates/${t.id}`)}
                            aria-label={`Editar ${t.name ?? "template"}`}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-destructive hover:text-destructive hover:bg-destructive/10"
                            onClick={(e) => handleDelete(t, e)}
                            aria-label={`Excluir ${t.name ?? "template"}`}
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
    </AdminLayout>
  )
}
