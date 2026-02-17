import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@clerk/clerk-react";
import type { SupabaseClient } from "@supabase/supabase-js";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useSupabaseClient } from "@/lib/supabase-context";
import { getErrorMessage } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Plus, Loader2, Trash2, Pencil, GripVertical } from "lucide-react";
import { cn } from "@/lib/utils";

// --- Interfaces ---
interface ProfileRow {
  company_id: string | null;
}

const PONTOS_TIPO = { fria: 1, morna: 5, quente: 10 } as const;

interface Qualificador {
  id: string;
  nome: string;
  ideal_customer_id: string | null;
  ideal_customers?: { profile_name: string | null } | null;
  perguntas_count?: number;
  pontuacao_maxima?: number | null;
  limite_frio_max?: number | null;
  limite_morno_max?: number | null;
}

interface PerguntaLocal {
  id: string;
  pergunta: string;
  peso: number;
  resposta_fria: string;
  resposta_morna: string;
  resposta_quente: string;
}

// --- Helpers ---
async function fetchCompanyId(
  supabase: SupabaseClient,
  userId: string
): Promise<string | null> {
  const { data, error } = await supabase
    .from("profiles")
    .select("company_id")
    .eq("id", userId)
    .maybeSingle();

  if (error) {
    console.error("Erro ao buscar company_id:", error);
    return null;
  }
  const profile = data as ProfileRow | null;
  return profile?.company_id ?? null;
}

function generateId(): string {
  return Math.random().toString(36).slice(2, 11);
}

// --- Select estilizado (native) ---
function StyledSelect({
  value,
  onChange,
  options,
  placeholder,
  className,
  ...props
}: {
  value: string;
  onChange: (value: string) => void;
  options: { value: string; label: string }[];
  placeholder?: string;
  className?: string;
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className={cn(
        "flex h-10 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50",
        className
      )}
      {...props}
    >
      {placeholder && (
        <option value="" disabled>
          {placeholder}
        </option>
      )}
      {options.map((opt) => (
        <option key={opt.value} value={opt.value}>
          {opt.label}
        </option>
      ))}
    </select>
  );
}

const respostasConfig = [
  { id: "fria" as const, labelBase: "Frio", valorTipo: 1, dotClass: "bg-info" },
  { id: "morna" as const, labelBase: "Morno", valorTipo: 5, dotClass: "bg-warning" },
  { id: "quente" as const, labelBase: "Quente", valorTipo: 10, dotClass: "bg-destructive" },
] as const;

// --- SortablePerguntaCard ---
function SortablePerguntaCard({
  pergunta,
  idx,
  onRemove,
  onUpdate,
  respostasConfig: config,
  canRemove,
}: {
  pergunta: PerguntaLocal;
  idx: number;
  onRemove: () => void;
  onUpdate: (id: string, field: keyof PerguntaLocal, value: string | number) => void;
  respostasConfig: typeof respostasConfig;
  canRemove: boolean;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: pergunta.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

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
          <span className="text-sm font-medium text-muted-foreground">
            Pergunta {idx + 1}
          </span>
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
          <StyledSelect
            value={String(pergunta.peso)}
            onChange={(v) => onUpdate(pergunta.id, "peso", parseInt(v, 10) || 1)}
            options={[
              { value: "1", label: "1x" },
              { value: "2", label: "2x" },
              { value: "3", label: "3x" },
            ]}
          />
        </div>
      </div>

      <div className="space-y-3">
        {config.map((item) => {
          const pontuacao = item.valorTipo * pergunta.peso;
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
                    onUpdate(
                      pergunta.id,
                      `resposta_${item.id}` as keyof PerguntaLocal,
                      e.target.value
                    )
                  }
                  placeholder="Opcional"
                  className="rounded-xl border-input h-10 focus-visible:ring-2 focus-visible:ring-primary/20"
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default function QualificacaoPage() {
  const { userId } = useAuth();
  const supabase = useSupabaseClient();
  const { toast } = useToast();

  const [qualificadores, setQualificadores] = useState<Qualificador[]>([]);
  const [personas, setPersonas] = useState<{ id: string; profile_name: string }[]>([]);
  const [companyId, setCompanyId] = useState<string | null>(null);
  const [isFetching, setIsFetching] = useState(true);
  const [loading, setLoading] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Modal state: nome + persona + loop de perguntas
  const [nome, setNome] = useState("");
  const [idealCustomerId, setIdealCustomerId] = useState("");
  const [perguntas, setPerguntas] = useState<PerguntaLocal[]>([
    { id: generateId(), pergunta: "", peso: 1, resposta_fria: "", resposta_morna: "", resposta_quente: "" },
  ]);
  const [qualificadorIdToEdit, setQualificadorIdToEdit] = useState<string | null>(null);

  const effectiveCompanyId = companyId;

  // Buscar company_id
  useEffect(() => {
    async function init() {
      if (!userId) return;
      const cid = await fetchCompanyId(supabase, userId);
      setCompanyId(cid);
    }
    init();
  }, [userId, supabase]);

  // Buscar Personas (ideal_customers)
  const loadPersonas = useCallback(async () => {
    if (!effectiveCompanyId) return;
    try {
      const { data, error } = await supabase
        .from("ideal_customers")
        .select("id, profile_name")
        .eq("company_id", effectiveCompanyId);

      if (error) throw error;
      setPersonas(
        (data ?? []).map((r: { id: string; profile_name: string | null }) => ({
          id: String(r.id),
          profile_name: r.profile_name ?? "",
        }))
      );
    } catch (err) {
      console.error("Erro ao carregar personas:", err);
    }
  }, [effectiveCompanyId, supabase]);

  useEffect(() => {
    loadPersonas();
  }, [loadPersonas]);

  // Buscar qualificadores
  const loadQualificadores = useCallback(async () => {
    if (!effectiveCompanyId) {
      setIsFetching(false);
      setQualificadores([]);
      return;
    }
    setIsFetching(true);
    try {
      const { data: qualData, error: qualError } = await supabase
        .from("qualificadores")
        .select("id, nome, ideal_customer_id, pontuacao_maxima, limite_frio_max, limite_morno_max, ideal_customers(profile_name)")
        .eq("company_id", effectiveCompanyId)
        .order("created_at", { ascending: false });

      if (qualError) throw qualError;

      const qualList = (qualData ?? []) as Qualificador[];
      if (qualList.length === 0) {
        setQualificadores([]);
        return;
      }

      const ids = qualList.map((q) => q.id);
      const { data: pergData } = await supabase
        .from("qualificacao_perguntas")
        .select("qualificador_id")
        .in("qualificador_id", ids);

      const countByQual: Record<string, number> = {};
      ids.forEach((id) => { countByQual[id] = 0; });
      (pergData ?? []).forEach((p: { qualificador_id: string }) => {
        countByQual[p.qualificador_id] = (countByQual[p.qualificador_id] ?? 0) + 1;
      });

      const withCount = qualList.map((q) => ({
        ...q,
        perguntas_count: countByQual[q.id] ?? 0,
      }));

      setQualificadores(withCount);
    } catch (err) {
      console.error("Erro ao carregar qualificadores:", err);
      toast({
        variant: "destructive",
        title: "Erro",
        description: `Falha ao carregar qualificadores. ${getErrorMessage(err)}`,
      });
      setQualificadores([]);
    } finally {
      setIsFetching(false);
    }
  }, [effectiveCompanyId, supabase, toast]);

  useEffect(() => {
    loadQualificadores();
  }, [loadQualificadores]);

  async function handleDelete(q: Qualificador) {
    if (!userId) return;
    const confirmed = window.confirm(
      `Excluir o qualificador "${q.nome}"? Esta ação não pode ser desfeita.`
    );
    if (!confirmed) return;

    try {
      const { error } = await supabase
        .from("qualificadores")
        .delete()
        .eq("id", q.id)
        .eq("company_id", effectiveCompanyId ?? "");

      if (error) throw error;

      toast({
        title: "Qualificador excluído",
        description: "O qualificador foi removido.",
      });
      loadQualificadores();
    } catch (err) {
      toast({
        variant: "destructive",
        title: "Erro ao excluir",
        description: getErrorMessage(err),
      });
    }
  }

  function addPergunta() {
    setPerguntas((prev) => [
      ...prev,
      { id: generateId(), pergunta: "", peso: 1, resposta_fria: "", resposta_morna: "", resposta_quente: "" },
    ]);
  }

  function removePergunta(id: string) {
    if (perguntas.length <= 1) return;
    setPerguntas((prev) => prev.filter((p) => p.id !== id));
  }

  function updatePergunta(id: string, field: keyof PerguntaLocal, value: string | number) {
    setPerguntas((prev) =>
      prev.map((p) => (p.id === id ? { ...p, [field]: value } : p))
    );
  }

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      setPerguntas((prev) => {
        const oldIndex = prev.findIndex((p) => p.id === active.id);
        const newIndex = prev.findIndex((p) => p.id === over.id);
        if (oldIndex === -1 || newIndex === -1) return prev;
        return arrayMove(prev, oldIndex, newIndex);
      });
    }
  }

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 5 },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  function validateForm(): string | null {
    const nomeTrim = nome.trim();
    if (!nomeTrim || nomeTrim.length < 3) {
      return "O nome do qualificador deve ter pelo menos 3 caracteres.";
    } else if (perguntas.every((p) => !p.pergunta.trim())) {
      return "Adicione pelo menos uma pergunta.";
    }
    for (let i = 0; i < perguntas.length; i++) {
      const p = perguntas[i];
      if (!p.pergunta.trim()) {
        return `A pergunta ${i + 1} está vazia. Preencha ou remova.`;
      }
      const hasResposta = p.resposta_fria.trim() || p.resposta_morna.trim() || p.resposta_quente.trim();
      if (!hasResposta) {
        return `A pergunta ${i + 1} precisa de pelo menos uma resposta (Fria, Morna ou Quente).`;
      }
    }
    return null;
  }

  async function handleSubmit() {
    if (!effectiveCompanyId || !userId) {
      toast({
        variant: "destructive",
        title: "Erro",
        description: "Usuário ou empresa não identificados.",
      });
      return;
    }

    const err = validateForm();
    if (err) {
      toast({
        variant: "destructive",
        title: "Dados inválidos",
        description: err,
      });
      return;
    }

    setLoading(true);
    try {
      let qualificadorId: string;

      if (qualificadorIdToEdit) {
        const { error: errUpdate } = await supabase
          .from("qualificadores")
          .update({
            nome: nome.trim(),
            ideal_customer_id: idealCustomerId || null,
          })
          .eq("id", qualificadorIdToEdit)
          .eq("company_id", effectiveCompanyId);

        if (errUpdate) throw errUpdate;
        qualificadorId = qualificadorIdToEdit;

        const { error: errDel } = await supabase
          .from("qualificacao_perguntas")
          .delete()
          .eq("qualificador_id", qualificadorIdToEdit);

        if (errDel) throw errDel;
      } else {
        const { data: qualificador, error: errQual } = await supabase
          .from("qualificadores")
          .insert({
            company_id: effectiveCompanyId,
            user_id: userId,
            nome: nome.trim(),
            ideal_customer_id: idealCustomerId || null,
          })
          .select("id")
          .single();

        if (errQual || !qualificador) {
          throw errQual ?? new Error("Falha ao criar qualificador");
        }
        qualificadorId = qualificador.id;
      }

      const perguntasValidas = perguntas.filter(
        (p) => p.pergunta.trim() && (p.resposta_fria.trim() || p.resposta_morna.trim() || p.resposta_quente.trim())
      );

      for (let i = 0; i < perguntasValidas.length; i++) {
        const p = perguntasValidas[i];
        const peso = Math.min(3, Math.max(1, p.peso));
        const { data: pergunta, error: errPerg } = await supabase
          .from("qualificacao_perguntas")
          .insert({
            qualificador_id: qualificadorId,
            pergunta: p.pergunta.trim(),
            peso,
            ordem: i + 1,
          })
          .select("id")
          .single();

        if (errPerg || !pergunta) {
          throw new Error(errPerg?.message ?? `Falha ao criar pergunta ${i + 1}`);
        }

        const respostas: { pergunta_id: string; resposta_texto: string; tipo: "fria" | "morna" | "quente"; pontuacao: number }[] = [];
        if (p.resposta_fria.trim()) respostas.push({ pergunta_id: pergunta.id, resposta_texto: p.resposta_fria.trim(), tipo: "fria", pontuacao: peso * PONTOS_TIPO.fria });
        if (p.resposta_morna.trim()) respostas.push({ pergunta_id: pergunta.id, resposta_texto: p.resposta_morna.trim(), tipo: "morna", pontuacao: peso * PONTOS_TIPO.morna });
        if (p.resposta_quente.trim()) respostas.push({ pergunta_id: pergunta.id, resposta_texto: p.resposta_quente.trim(), tipo: "quente", pontuacao: peso * PONTOS_TIPO.quente });

        if (respostas.length > 0) {
          const { error: errResp } = await supabase.from("qualificacao_respostas").insert(respostas);
          if (errResp) {
            throw new Error(errResp.message ?? `Falha ao salvar respostas da pergunta ${i + 1}`);
          }
        }
      }

      const pontuacaoMaxima = perguntasValidas.reduce((acc, p) => acc + Math.min(3, Math.max(1, p.peso)) * 10, 0);
      const limiteFrioMax = Math.floor(pontuacaoMaxima / 3);
      const limiteMornoMax = Math.floor((2 * pontuacaoMaxima) / 3);

      const { error: errLimites } = await supabase
        .from("qualificadores")
        .update({
          pontuacao_maxima: pontuacaoMaxima,
          limite_frio_max: limiteFrioMax,
          limite_morno_max: limiteMornoMax,
        })
        .eq("id", qualificadorId)
        .eq("company_id", effectiveCompanyId);

      if (errLimites) throw errLimites;

      toast({
        title: qualificadorIdToEdit ? "Qualificador atualizado" : "Qualificador salvo",
        description: qualificadorIdToEdit
          ? "O qualificador foi atualizado com sucesso."
          : "O qualificador foi criado com sucesso.",
      });

      setQualificadorIdToEdit(null);
      setNome("");
      setIdealCustomerId("");
      setPerguntas([
        { id: generateId(), pergunta: "", peso: 1, resposta_fria: "", resposta_morna: "", resposta_quente: "" },
      ]);
      setIsModalOpen(false);
      loadQualificadores();
    } catch (err) {
      toast({
        variant: "destructive",
        title: "Erro",
        description: getErrorMessage(err, "Falha ao salvar dados."),
      });
    } finally {
      setLoading(false);
    }
  }

  const handleOpenModal = () => {
    setQualificadorIdToEdit(null);
    setNome("");
    setIdealCustomerId("");
    setPerguntas([
      { id: generateId(), pergunta: "", peso: 1, resposta_fria: "", resposta_morna: "", resposta_quente: "" },
    ]);
    setIsModalOpen(true);
  };

  async function handleOpenEdit(q: Qualificador) {
    if (!q.id) return;
    setLoading(true);
    try {
      const { data: qualData, error: qualErr } = await supabase
        .from("qualificadores")
        .select("id, nome, ideal_customer_id")
        .eq("id", q.id)
        .single();

      if (qualErr || !qualData) {
        throw qualErr ?? new Error("Qualificador não encontrado");
      }

      const { data: pergData } = await supabase
        .from("qualificacao_perguntas")
        .select("id, pergunta, peso, ordem")
        .eq("qualificador_id", q.id)
        .order("ordem", { ascending: true });

      const perguntasComRespostas: PerguntaLocal[] = [];

      for (const perg of pergData ?? []) {
        const { data: respData } = await supabase
          .from("qualificacao_respostas")
          .select("tipo, resposta_texto")
          .eq("pergunta_id", perg.id);

        const respMap: Record<string, string> = {};
        (respData ?? []).forEach((r: { tipo: string; resposta_texto: string }) => {
          respMap[r.tipo] = r.resposta_texto;
        });

        perguntasComRespostas.push({
          id: generateId(),
          pergunta: perg.pergunta ?? "",
          peso: perg.peso ?? 1,
          resposta_fria: respMap.fria ?? "",
          resposta_morna: respMap.morna ?? "",
          resposta_quente: respMap.quente ?? "",
        });
      }

      setQualificadorIdToEdit(qualData.id);
      setNome(qualData.nome ?? "");
      setIdealCustomerId(qualData.ideal_customer_id ?? "");
      setPerguntas(
        perguntasComRespostas.length > 0
          ? perguntasComRespostas
          : [{ id: generateId(), pergunta: "", peso: 1, resposta_fria: "", resposta_morna: "", resposta_quente: "" }]
      );
      setIsModalOpen(true);
    } catch (err) {
      toast({
        variant: "destructive",
        title: "Erro",
        description: getErrorMessage(err, "Falha ao carregar qualificador."),
      });
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold tracking-tight text-foreground">
          Configurar Qualificador
        </h1>
        <Button size="sm" onClick={handleOpenModal} disabled={!effectiveCompanyId}>
          <Plus className="mr-2 h-4 w-4" /> Criar qualificador
        </Button>
      </div>

      {/* Listagem de qualificadores */}
      <div className="border border-border rounded-md bg-white">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="text-foreground">Nome</TableHead>
              <TableHead className="text-foreground">Persona</TableHead>
              <TableHead className="text-foreground">Perguntas</TableHead>
              <TableHead className="text-foreground">Pontuação máx</TableHead>
              <TableHead className="text-foreground">Frio &lt; X</TableHead>
              <TableHead className="text-foreground">Morno X–Y</TableHead>
              <TableHead className="text-foreground">Quente ≥ Y</TableHead>
              <TableHead className="text-right text-foreground">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isFetching ? (
              <TableRow>
                <TableCell colSpan={8} className="text-center py-10">
                  <Loader2 className="mx-auto h-8 w-8 animate-spin text-primary" />
                </TableCell>
              </TableRow>
            ) : qualificadores.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={8}
                  className="text-center py-10 text-muted-foreground"
                >
                  Nenhum qualificador encontrado. Clique em &quot;Criar qualificador&quot; para adicionar.
                </TableCell>
              </TableRow>
            ) : (
              qualificadores.map((q) => (
                <TableRow key={q.id}>
                  <TableCell className="font-medium text-foreground">{q.nome}</TableCell>
                  <TableCell className="text-muted-foreground">
                    {q.ideal_customers?.profile_name ?? "—"}
                  </TableCell>
                  <TableCell className="text-foreground">{q.perguntas_count ?? 0}</TableCell>
                  <TableCell className="text-foreground">{q.pontuacao_maxima ?? "—"}</TableCell>
                  <TableCell className="text-muted-foreground text-sm">
                    {q.limite_frio_max != null ? "< " + q.limite_frio_max : "—"}
                  </TableCell>
                  <TableCell className="text-muted-foreground text-sm">
                    {q.limite_frio_max != null && q.limite_morno_max != null
                      ? `${q.limite_frio_max}–${q.limite_morno_max - 1}`
                      : "—"}
                  </TableCell>
                  <TableCell className="text-muted-foreground text-sm">
                    {q.limite_morno_max != null ? `≥ ${q.limite_morno_max}` : "—"}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="hover:bg-muted"
                        onClick={() => handleOpenEdit(q)}
                        title="Editar"
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-destructive hover:text-destructive hover:bg-destructive/10"
                        onClick={() => handleDelete(q)}
                        title="Excluir"
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

      {/* Modal Criar Qualificador */}
      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-foreground">
              {qualificadorIdToEdit ? "Editar qualificador" : "Criar qualificador"}
            </DialogTitle>
            <DialogDescription className="text-muted-foreground">
              Informe o nome e cadastre as perguntas com até 3 respostas cada (fria, morna, quente).
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-6 pt-4">
            {/* Nome e Persona */}
            <div className="flex gap-6">
              <div className="flex-1 space-y-2">
                <Label className="text-[11px] font-bold uppercase text-muted-foreground tracking-wider">
                  Nome do qualificador
                </Label>
                <Input
                  value={nome}
                  onChange={(e) => setNome(e.target.value)}
                  placeholder="Ex: Qualificador de vendas B2B"
                  className="border-input"
                />
              </div>
              <div className="flex-1 space-y-2">
                <Label className="text-[11px] font-bold uppercase text-muted-foreground tracking-wider">
                  Persona (opcional)
                </Label>
                <StyledSelect
                  value={idealCustomerId}
                  onChange={setIdealCustomerId}
                  options={personas.map((p) => ({ value: p.id, label: p.profile_name }))}
                  placeholder="Selecione..."
                />
              </div>
            </div>

            {/* Loop de perguntas */}
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <Label className="text-[11px] font-bold uppercase text-muted-foreground tracking-wider">
                  Perguntas e respostas
                </Label>
                <Button type="button" variant="outline" size="sm" onClick={addPergunta}>
                  <Plus className="mr-2 h-4 w-4" /> Adicionar outra pergunta
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
                        respostasConfig={respostasConfig}
                        canRemove={perguntas.length > 1}
                      />
                    ))}
                  </div>
                </SortableContext>
              </DndContext>
            </div>

            {/* Botões */}
            <div className="pt-6 border-t border-border flex justify-end items-center gap-4">
              <Button
                type="button"
                variant="ghost"
                onClick={() => setIsModalOpen(false)}
                className="text-muted-foreground font-semibold hover:text-foreground"
              >
                Cancelar
              </Button>
              <Button
                type="button"
                onClick={handleSubmit}
                disabled={loading}
                className="bg-primary hover:bg-primary/90 text-primary-foreground px-8 h-11 rounded-xl font-bold"
              >
                {loading ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : null}
                {qualificadorIdToEdit ? "Salvar alterações" : "Salvar qualificador"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
