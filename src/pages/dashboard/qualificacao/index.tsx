import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@clerk/clerk-react";

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
import { useEffectiveCompanyId } from "@/hooks/use-effective-company-id";
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
import { Plus, Loader2, Trash2, Pencil, GripVertical, Copy } from "lucide-react";
import { cn } from "@/lib/utils";

// --- Interfaces ---
const PONTOS_TIPO = { fria: 1, morna: 5, quente: 10 } as const;

interface Qualificador {
  id: string;
  nome: string;
  prompt_atendimento_id: string | null;
  prompt_atendimento?: { name: string | null; ideal_customers: { profile_name: string | null } | null } | null;
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

interface QualificacaoTemplateRow {
  id: string;
  nome: string | null;
  segment_type: string | null;
  perguntas?: Array<{
    id: string;
    pergunta: string;
    peso: number;
    ordem: number;
    respostas?: Array<{ tipo: string; resposta_texto: string; pontuacao: number }>;
  }>;
}

// --- Helpers ---
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

interface QualificacaoPageProps {
  /** Quando definido, filtra qualificadores pelo prompt do Cliente Ideal e pré-seleciona ao criar. */
  clienteIdealId?: string;
}

export default function QualificacaoPage({ clienteIdealId }: QualificacaoPageProps = {}) {
  const { userId } = useAuth();
  const supabase = useSupabaseClient();
  const { toast } = useToast();
  const effectiveCompanyId = useEffectiveCompanyId();

  const [promptAtendimentoIdFromPersona, setPromptAtendimentoIdFromPersona] = useState<string | null>(null);
  const [qualificadores, setQualificadores] = useState<Qualificador[]>([]);
  const [prompts, setPrompts] = useState<{ id: string; label: string }[]>([]);
  const [isFetching, setIsFetching] = useState(true);
  const [loading, setLoading] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Modal state: nome + prompt + loop de perguntas
  const [nome, setNome] = useState("");
  const [promptAtendimentoId, setPromptAtendimentoId] = useState("");
  const [perguntas, setPerguntas] = useState<PerguntaLocal[]>([
    { id: generateId(), pergunta: "", peso: 1, resposta_fria: "", resposta_morna: "", resposta_quente: "" },
  ]);
  const [qualificadorIdToEdit, setQualificadorIdToEdit] = useState<string | null>(null);
  const [isCopyModalOpen, setIsCopyModalOpen] = useState(false);
  const [templatesCopy, setTemplatesCopy] = useState<QualificacaoTemplateRow[]>([]);
  const [isLoadingTemplatesCopy, setIsLoadingTemplatesCopy] = useState(false);
  const [copyingTemplateId, setCopyingTemplateId] = useState<string | null>(null);
  const [companySegmentType, setCompanySegmentType] = useState<string>("produtos");

  // Buscar Prompts de atendimento da empresa
  const loadPrompts = useCallback(async () => {
    if (!effectiveCompanyId) return;
    try {
      const { data, error } = await supabase
        .from("prompt_atendimento")
        .select("id, name, ideal_customers!persona_id(profile_name)")
        .eq("company_id", effectiveCompanyId)
        .order("created_at", { ascending: false });

      if (error) throw error;
      setPrompts(
        (data ?? []).map((r: { id: string; name: string | null; ideal_customers: { profile_name: string | null } | null }) => {
          const label = r.name?.trim() || (r.ideal_customers as { profile_name: string | null } | null)?.profile_name || "Prompt padrão";
          return { id: String(r.id), label };
        })
      );
    } catch (err) {
      console.error("Erro ao carregar prompts:", err);
    }
  }, [effectiveCompanyId, supabase]);

  useEffect(() => {
    loadPrompts();
  }, [loadPrompts]);

  useEffect(() => {
    if (!clienteIdealId || !effectiveCompanyId || !supabase) {
      setPromptAtendimentoIdFromPersona(null);
      return;
    }
    let cancelled = false;
    (async () => {
      const { data, error } = await supabase
        .from("ideal_customers")
        .select("prompt_atendimento_id")
        .eq("id", clienteIdealId)
        .eq("company_id", effectiveCompanyId)
        .maybeSingle();
      if (cancelled) return;
      if (error || !data) {
        setPromptAtendimentoIdFromPersona(null);
        return;
      }
      setPromptAtendimentoIdFromPersona((data as { prompt_atendimento_id: string | null }).prompt_atendimento_id);
    })();
    return () => { cancelled = true; };
  }, [clienteIdealId, effectiveCompanyId, supabase]);

  useEffect(() => {
    async function loadSegment() {
      if (!effectiveCompanyId) return;
      const { data, error } = await supabase
        .from("companies")
        .select("segment_type")
        .eq("id", effectiveCompanyId)
        .maybeSingle();
      if (error) return;
      const seg = (data as { segment_type?: string | null } | null)?.segment_type;
      if (seg) setCompanySegmentType(seg);
    }
    loadSegment();
  }, [effectiveCompanyId, supabase]);

  const loadTemplatesForCopy = useCallback(async () => {
    setIsLoadingTemplatesCopy(true);
    try {
      const { data: templatesData, error: errT } = await supabase
        .from("qualificacao_templates")
        .select("id, nome, segment_type")
        .order("created_at", { ascending: false });

      if (errT) throw errT;
      const allTemplates = (templatesData ?? []) as QualificacaoTemplateRow[];
      const allowed = allTemplates.filter((t) => {
        const seg = t.segment_type ?? "geral";
        return seg === "geral" || seg === companySegmentType;
      });

      const result: QualificacaoTemplateRow[] = [];
      for (const t of allowed) {
        const { data: pergData } = await supabase
          .from("qualificacao_template_perguntas")
          .select("id, pergunta, peso, ordem")
          .eq("template_id", t.id)
          .order("ordem", { ascending: true });

        const perguntasComRespostas: QualificacaoTemplateRow["perguntas"] = [];
        for (const p of pergData ?? []) {
          const { data: respData } = await supabase
            .from("qualificacao_template_respostas")
            .select("tipo, resposta_texto, pontuacao")
            .eq("pergunta_id", p.id);
          perguntasComRespostas.push({
            id: p.id,
            pergunta: p.pergunta ?? "",
            peso: p.peso ?? 1,
            ordem: p.ordem ?? 1,
            respostas: (respData ?? []) as Array<{ tipo: string; resposta_texto: string; pontuacao: number }>,
          });
        }
        result.push({ ...t, perguntas: perguntasComRespostas });
      }
      setTemplatesCopy(result);
    } catch (err) {
      console.error("Erro ao carregar modelos:", err);
      toast({
        variant: "destructive",
        title: "Erro",
        description: "Falha ao carregar modelos de qualificação.",
      });
      setTemplatesCopy([]);
    } finally {
      setIsLoadingTemplatesCopy(false);
    }
  }, [supabase, toast, companySegmentType]);

  const handleOpenCopyModal = useCallback(() => {
    setIsCopyModalOpen(true);
    loadTemplatesForCopy();
  }, [loadTemplatesForCopy]);

  async function handleCopyTemplate(t: QualificacaoTemplateRow) {
    if (!userId || !effectiveCompanyId) {
      toast({
        variant: "destructive",
        title: "Erro",
        description: "Sessão ou empresa não configurada.",
      });
      return;
    }
    setCopyingTemplateId(t.id);
    try {
      const res1 = await supabase
        .from("qualificadores")
        .insert({
          company_id: effectiveCompanyId,
          user_id: userId,
          nome: (t.nome ?? "Qualificador").trim(),
          prompt_atendimento_id: null,
        })
        .select("id")
        .single();

      let qual: { id: string } | null = res1.data;
      if (res1.error && isColumnError(res1.error, "prompt_atendimento_id")) {
        const res2 = await supabase
          .from("qualificadores")
          .insert({
            company_id: effectiveCompanyId,
            user_id: userId,
            nome: (t.nome ?? "Qualificador").trim(),
          })
          .select("id")
          .single();
        if (res2.error) throw res2.error;
        qual = res2.data;
      } else if (res1.error) {
        throw res1.error;
      }

      if (!qual) throw new Error("Falha ao criar qualificador");
      const qualificadorId = qual.id;

      const perguntasList = t.perguntas ?? [];
      for (let i = 0; i < perguntasList.length; i++) {
        const p = perguntasList[i];
        const peso = Math.min(3, Math.max(1, p.peso ?? 1));
        const { data: pergunta, error: errP } = await supabase
          .from("qualificacao_perguntas")
          .insert({
            qualificador_id: qualificadorId,
            pergunta: p.pergunta.trim(),
            peso,
            ordem: i + 1,
          })
          .select("id")
          .single();

        if (errP || !pergunta) continue;

        const respostas = (p.respostas ?? []).map((r) => ({
          pergunta_id: pergunta.id,
          resposta_texto: r.resposta_texto,
          tipo: r.tipo as "fria" | "morna" | "quente",
          pontuacao: r.pontuacao,
        }));
        if (respostas.length > 0) {
          await supabase.from("qualificacao_respostas").insert(respostas);
        }
      }

      const pontuacaoMaxima = perguntasList.reduce((acc, p) => acc + Math.min(3, Math.max(1, p.peso ?? 1)) * 10, 0);
      const limiteFrioMax = Math.floor(pontuacaoMaxima / 3);
      const limiteMornoMax = Math.floor((2 * pontuacaoMaxima) / 3);

      await supabase
        .from("qualificadores")
        .update({
          pontuacao_maxima: pontuacaoMaxima,
          limite_frio_max: limiteFrioMax,
          limite_morno_max: limiteMornoMax,
        })
        .eq("id", qualificadorId)
        .eq("company_id", effectiveCompanyId);

      toast({
        title: "Copiado!",
        description: `Qualificador "${t.nome ?? "modelo"}" copiado para sua empresa.`,
      });
      setIsCopyModalOpen(false);
      loadQualificadores();
    } catch (err) {
      toast({
        variant: "destructive",
        title: "Erro ao copiar",
        description: getErrorMessage(err, "Falha ao copiar modelo."),
      });
    } finally {
      setCopyingTemplateId(null);
    }
  }

  function isColumnError(err: unknown, col: string): boolean {
    const code = (err as { code?: string })?.code;
    const msg = String((err as { message?: string })?.message ?? "").toLowerCase();
    const colLower = col.toLowerCase();
    return (
      code === "42703" ||
      code === "PGRST200" ||
      (msg.includes(colLower) && (msg.includes("does not exist") || msg.includes("não existe")))
    );
  }

  // Buscar qualificadores
  const loadQualificadores = useCallback(async () => {
    if (!effectiveCompanyId) {
      setIsFetching(false);
      setQualificadores([]);
      return;
    }
    setIsFetching(true);
    try {
      let qualList: Qualificador[] = [];

      // 1) Tentar schema novo (prompt_atendimento_id)
      let query = supabase
        .from("qualificadores")
        .select("id, nome, prompt_atendimento_id, pontuacao_maxima, limite_frio_max, limite_morno_max, prompt_atendimento(name, ideal_customers!persona_id(profile_name))")
        .eq("company_id", effectiveCompanyId)
        .order("created_at", { ascending: false });
      if (promptAtendimentoIdFromPersona) {
        query = query.eq("prompt_atendimento_id", promptAtendimentoIdFromPersona);
      }
      const { data: qualDataNew, error: qualErrorNew } = await query;

      if (!qualErrorNew && qualDataNew && qualDataNew.length >= 0) {
        qualList = qualDataNew as Qualificador[];
      } else if (qualErrorNew && isColumnError(qualErrorNew, "prompt_atendimento_id")) {
        // 2) Fallback: schema legado (ideal_customer_id)
        const { data: legacyQualData, error: legacyQualError } = await supabase
          .from("qualificadores")
          .select("id, nome, ideal_customer_id, pontuacao_maxima, limite_frio_max, limite_morno_max, ideal_customers(profile_name)")
          .eq("company_id", effectiveCompanyId)
          .order("created_at", { ascending: false });

        if (legacyQualError && isColumnError(legacyQualError, "ideal_customer_id")) {
          // 3) Fallback: schema mínimo (apenas colunas base)
          const { data: minData, error: minErr } = await supabase
            .from("qualificadores")
            .select("id, nome, pontuacao_maxima, limite_frio_max, limite_morno_max")
            .eq("company_id", effectiveCompanyId)
            .order("created_at", { ascending: false });
          if (minErr) throw minErr;
          qualList = (minData ?? []).map((q) => ({
            ...q,
            prompt_atendimento_id: null,
            prompt_atendimento: null,
          })) as Qualificador[];
        } else if (legacyQualError) {
          throw legacyQualError;
        } else {
          qualList = ((legacyQualData ?? []) as Array<Qualificador & { ideal_customer_id?: string | null }>).map((q) => ({
            ...q,
            prompt_atendimento_id: null,
            prompt_atendimento: q.ideal_customers
              ? { name: null, ideal_customers: q.ideal_customers }
              : null,
          }));
        }
      } else if (qualErrorNew) {
        throw qualErrorNew;
      }

      if (clienteIdealId && qualList.some((q) => (q as Qualificador & { ideal_customer_id?: string | null }).ideal_customer_id)) {
        qualList = qualList.filter(
          (q) => (q as Qualificador & { ideal_customer_id?: string | null }).ideal_customer_id === clienteIdealId
        );
      }

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
  }, [effectiveCompanyId, supabase, toast, promptAtendimentoIdFromPersona, clienteIdealId]);

  useEffect(() => {
    loadQualificadores();
  }, [loadQualificadores]);

  const isContextual = !!clienteIdealId;

  // No modo contextual: ao carregar qualificadores, abrir direto o formulário (criar ou editar)
  useEffect(() => {
    if (!isContextual || isFetching) return;
    if (qualificadores.length === 1) {
      loadQualifierIntoForm(qualificadores[0]);
    } else if (qualificadores.length === 0) {
      setQualificadorIdToEdit(null);
      setNome("");
      setPromptAtendimentoId(promptAtendimentoIdFromPersona ?? "");
      setPerguntas([
        { id: generateId(), pergunta: "", peso: 1, resposta_fria: "", resposta_morna: "", resposta_quente: "" },
      ]);
    }
  }, [isContextual, isFetching, qualificadores, promptAtendimentoIdFromPersona]);

  function isColumnMissingError(err: unknown): boolean {
    return isColumnError(err, "prompt_atendimento_id");
  }

  async function loadQualifierIntoForm(q: Qualificador) {
    if (!q.id) return;
    setLoading(true);
    try {
      let qualData: { id: string; nome: string; prompt_atendimento_id?: string | null; ideal_customer_id?: string | null };
      const { data: qualDataNew, error: qualErr } = await supabase
        .from("qualificadores")
        .select("id, nome, prompt_atendimento_id")
        .eq("id", q.id)
        .single();

      if (qualErr && isColumnMissingError(qualErr)) {
        const { data: legacyData, error: legacyErr } = await supabase
          .from("qualificadores")
          .select("id, nome, ideal_customer_id")
          .eq("id", q.id)
          .single();
        if (legacyErr && isColumnError(legacyErr, "ideal_customer_id")) {
          const { data: minData, error: minErr } = await supabase
            .from("qualificadores")
            .select("id, nome")
            .eq("id", q.id)
            .single();
          if (minErr || !minData) throw minErr ?? new Error("Qualificador não encontrado");
          qualData = { ...minData, prompt_atendimento_id: null };
        } else if (legacyErr || !legacyData) {
          throw legacyErr ?? new Error("Qualificador não encontrado");
        } else {
          qualData = { ...legacyData, prompt_atendimento_id: null };
        }
      } else if (qualErr || !qualDataNew) {
        throw qualErr ?? new Error("Qualificador não encontrado");
      } else {
        qualData = qualDataNew;
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
      setPromptAtendimentoId(qualData.prompt_atendimento_id ?? "");
      setPerguntas(
        perguntasComRespostas.length > 0
          ? perguntasComRespostas
          : [{ id: generateId(), pergunta: "", peso: 1, resposta_fria: "", resposta_morna: "", resposta_quente: "" }]
      );
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
      const profileRes = await supabase
        .from("profiles")
        .select("company_id, saas_admin")
        .eq("id", userId)
        .maybeSingle();
      const profileCompanyId = (profileRes.data as { company_id: string | null; saas_admin?: boolean | null } | null)?.company_id ?? null;
      const isSaasAdmin = Boolean((profileRes.data as { company_id: string | null; saas_admin?: boolean | null } | null)?.saas_admin);
      const writeCompanyId = isSaasAdmin ? effectiveCompanyId : (profileCompanyId ?? effectiveCompanyId);
      let qualificadorId: string;

      if (qualificadorIdToEdit) {
        const { error: errUpdate } = await supabase
          .from("qualificadores")
          .update({
            nome: nome.trim(),
            prompt_atendimento_id: promptAtendimentoId || null,
          })
          .eq("id", qualificadorIdToEdit)
          .eq("company_id", writeCompanyId ?? "");

        if (errUpdate) {
          const { error: errUpdate2 } = await supabase
            .from("qualificadores")
            .update({ nome: nome.trim() })
            .eq("id", qualificadorIdToEdit)
            .eq("company_id", writeCompanyId ?? "");
          if (errUpdate2) throw errUpdate2;
        }
        qualificadorId = qualificadorIdToEdit;

        const { error: errDel } = await supabase
          .from("qualificacao_perguntas")
          .delete()
          .eq("qualificador_id", qualificadorIdToEdit);

        if (errDel) throw errDel;
      } else {
        const res1 = await supabase
          .from("qualificadores")
          .insert({
            company_id: writeCompanyId ?? "",
            user_id: userId,
            nome: nome.trim(),
            prompt_atendimento_id: promptAtendimentoId || null,
          })
          .select("id")
          .single();

        if (res1.error || !res1.data) {
          const res2 = await supabase
            .from("qualificadores")
            .insert({
              company_id: writeCompanyId ?? "",
              user_id: userId,
              nome: nome.trim(),
            })
            .select("id")
            .single();
          if (res2.error || !res2.data) throw res1.error ?? res2.error ?? new Error("Falha ao criar qualificador");
          qualificadorId = res2.data.id;
        } else {
          qualificadorId = res1.data.id;
        }
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
        .eq("company_id", writeCompanyId ?? "");

      if (errLimites) throw errLimites;

      toast({
        title: qualificadorIdToEdit ? "Qualificador atualizado" : "Qualificador salvo",
        description: qualificadorIdToEdit
          ? "O qualificador foi atualizado com sucesso."
          : "O qualificador foi criado com sucesso.",
      });

      setQualificadorIdToEdit(null);
      setNome("");
      setPromptAtendimentoId("");
      setPerguntas([
        { id: generateId(), pergunta: "", peso: 1, resposta_fria: "", resposta_morna: "", resposta_quente: "" },
      ]);
      if (!isContextual) setIsModalOpen(false);
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
    setPromptAtendimentoId(promptAtendimentoIdFromPersona ?? "");
    setPerguntas([
      { id: generateId(), pergunta: "", peso: 1, resposta_fria: "", resposta_morna: "", resposta_quente: "" },
    ]);
    setIsModalOpen(true);
  };

  async function handleOpenEdit(q: Qualificador) {
    if (!q.id) return;
    await loadQualifierIntoForm(q);
    setIsModalOpen(true);
  }

  const qualificadorFormContent = (
    <div className="space-y-6 pt-4">
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
            Prompt (opcional)
          </Label>
          <StyledSelect
            value={promptAtendimentoId}
            onChange={setPromptAtendimentoId}
            options={
              promptAtendimentoIdFromPersona
                ? prompts
                    .filter((p) => p.id === promptAtendimentoIdFromPersona)
                    .map((p) => ({ value: p.id, label: p.label }))
                : [{ value: "", label: "Nenhum" }, ...prompts.map((p) => ({ value: p.id, label: p.label }))]
            }
            placeholder="Selecione..."
          />
        </div>
      </div>

      <div className="space-y-4">
        <div className="flex justify-between items-center">
          <Label className="text-[11px] font-bold uppercase text-muted-foreground tracking-wider">
            Perguntas e respostas
          </Label>
          <div className="flex gap-2">
            {isContextual && !qualificadorIdToEdit && (
              <Button type="button" variant="outline" size="sm" onClick={handleOpenCopyModal}>
                <Copy className="mr-2 h-4 w-4" /> Copiar de modelo
              </Button>
            )}
            <Button type="button" variant="outline" size="sm" onClick={addPergunta}>
              <Plus className="mr-2 h-4 w-4" /> Adicionar outra pergunta
            </Button>
          </div>
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

      <div className="pt-6 border-t border-border flex justify-end items-center gap-4">
        {!isContextual && (
          <Button
            type="button"
            variant="ghost"
            onClick={() => setIsModalOpen(false)}
            className="text-muted-foreground font-semibold hover:text-foreground"
          >
            Cancelar
          </Button>
        )}
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
  );

  if (isContextual) {
    return (
      <div className="p-6 space-y-6">
        <h1 className="text-3xl font-bold tracking-tight text-foreground">
          Configurar Qualificador
        </h1>
        {isFetching ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : (
          qualificadorFormContent
        )}
        <Dialog open={isCopyModalOpen} onOpenChange={setIsCopyModalOpen}>
          <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="text-foreground">Copiar de modelo</DialogTitle>
              <DialogDescription className="text-muted-foreground">
                Escolha um modelo de qualificação para copiar para sua empresa. Apenas modelos compatíveis com seu segmento são exibidos.
              </DialogDescription>
            </DialogHeader>
            <div className="pt-4">
              {isLoadingTemplatesCopy ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                </div>
              ) : templatesCopy.length === 0 ? (
                <p className="text-muted-foreground text-center py-8">
                  Nenhum modelo disponível para seu segmento.
                </p>
              ) : (
                <div className="space-y-2">
                  {templatesCopy.map((t) => (
                    <div
                      key={t.id}
                      className="flex items-center justify-between p-4 rounded-lg border border-border bg-card hover:bg-muted/50 transition-colors"
                    >
                      <div>
                        <p className="font-medium text-foreground">{t.nome ?? "Sem nome"}</p>
                        <p className="text-sm text-muted-foreground">
                          Segmento: {t.segment_type ?? "geral"} · {t.perguntas?.length ?? 0} pergunta(s)
                        </p>
                      </div>
                      <Button
                        size="sm"
                        onClick={() => handleCopyTemplate(t)}
                        disabled={copyingTemplateId !== null}
                      >
                        {copyingTemplateId === t.id ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <>
                            <Copy className="mr-2 h-4 w-4" /> Copiar
                          </>
                        )}
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </DialogContent>
        </Dialog>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold tracking-tight text-foreground">
          Configurar Qualificador
        </h1>
        <div className="flex items-center gap-2">
          <Button size="sm" onClick={handleOpenModal} disabled={!effectiveCompanyId}>
            <Plus className="mr-2 h-4 w-4" /> Criar qualificador
          </Button>
          <Button size="sm" variant="outline" onClick={handleOpenCopyModal} disabled={!effectiveCompanyId}>
            <Copy className="mr-2 h-4 w-4" /> Copiar de modelo
          </Button>
        </div>
      </div>

      {/* Listagem de qualificadores */}
      <div className="border border-border rounded-md bg-white">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="text-foreground">Nome</TableHead>
              <TableHead className="text-foreground">Prompt</TableHead>
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
                    {q.prompt_atendimento
                      ? (q.prompt_atendimento.name?.trim() || (q.prompt_atendimento.ideal_customers as { profile_name: string | null } | null)?.profile_name || "—")
                      : "—"}
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

          {qualificadorFormContent}
        </DialogContent>
      </Dialog>

      {/* Modal Copiar de modelo */}
      <Dialog open={isCopyModalOpen} onOpenChange={setIsCopyModalOpen}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-foreground">Copiar de modelo</DialogTitle>
            <DialogDescription className="text-muted-foreground">
              Escolha um modelo de qualificação para copiar para sua empresa. Apenas modelos compatíveis com seu segmento são exibidos.
            </DialogDescription>
          </DialogHeader>
          <div className="pt-4">
            {isLoadingTemplatesCopy ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            ) : templatesCopy.length === 0 ? (
              <p className="text-muted-foreground text-center py-8">
                Nenhum modelo disponível para seu segmento.
              </p>
            ) : (
              <div className="space-y-2">
                {templatesCopy.map((t) => (
                  <div
                    key={t.id}
                    className="flex items-center justify-between p-4 rounded-lg border border-border bg-card hover:bg-muted/50 transition-colors"
                  >
                    <div>
                      <p className="font-medium text-foreground">{t.nome ?? "Sem nome"}</p>
                      <p className="text-sm text-muted-foreground">
                        Segmento: {t.segment_type ?? "geral"} · {t.perguntas?.length ?? 0} pergunta(s)
                      </p>
                    </div>
                    <Button
                      size="sm"
                      onClick={() => handleCopyTemplate(t)}
                      disabled={copyingTemplateId !== null}
                    >
                      {copyingTemplateId === t.id ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <>
                          <Copy className="mr-2 h-4 w-4" /> Copiar
                        </>
                      )}
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
