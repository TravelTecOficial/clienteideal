import { useState, useEffect, useCallback } from "react";
import { useParams } from "react-router-dom";
import { useSupabaseClient } from "@/lib/supabase-context";
import { useEffectiveCompanyId } from "@/hooks/use-effective-company-id";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { MessageSquare, Loader2 } from "lucide-react";
import { PromptForm, type FormValues } from "@/pages/dashboard/prompt-atendimento";

interface PromptAtendimentoRow {
  id: string;
  name: string | null;
  nome_atendente: string | null;
  principais_instrucoes: string | null;
  papel: string | null;
  tom_voz: string | null;
  persona_id: string | null;
  prompt_template_id: string | null;
  fluxo_objetivo: string | null;
  follow_up_active: boolean | null;
  follow_up_tempo: number | null;
  follow_up_tentativas: number | null;
}

function rowToFormValues(row: PromptAtendimentoRow, identifyingPhrase: string): FormValues {
  return {
    name: row.name ?? "",
    identifying_phrase: identifyingPhrase,
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
  };
}

interface PromptAtendimentoContextualProps {
  clienteIdealId: string | undefined;
}

export function PromptAtendimentoContextual({ clienteIdealId }: PromptAtendimentoContextualProps) {
  const { id } = useParams<{ id: string }>();
  const supabase = useSupabaseClient();
  const { toast } = useToast();
  const companyId = useEffectiveCompanyId();
  const [promptAtendimentoId, setPromptAtendimentoId] = useState<string | null>(null);
  const [promptRow, setPromptRow] = useState<PromptAtendimentoRow | null>(null);
  const [personas, setPersonas] = useState<{ id: string; profile_name: string | null }[]>([]);
  const [promptTemplates, setPromptTemplates] = useState<{ id: string; name: string | null; descricao: string | null }[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const basePath = id ? `/dashboard/cliente-ideal/${id}` : "/dashboard/cliente-ideal";

  const [personaIdentifyingPhrase, setPersonaIdentifyingPhrase] = useState<string>("");

  useEffect(() => {
    if (!clienteIdealId || !companyId || !supabase) {
      setIsLoading(false);
      return;
    }
    let cancelled = false;
    (async () => {
      const { data, error } = await supabase
        .from("ideal_customers")
        .select("prompt_atendimento_id, identifying_phrase")
        .eq("id", clienteIdealId)
        .eq("company_id", companyId)
        .maybeSingle();
      if (cancelled) return;
      if (error || !data) {
        setPromptAtendimentoId(null);
        setPersonaIdentifyingPhrase("");
        setIsLoading(false);
        return;
      }
      const row = data as { prompt_atendimento_id: string | null; identifying_phrase: string | null };
      setPromptAtendimentoId(row.prompt_atendimento_id);
      setPersonaIdentifyingPhrase(row.identifying_phrase ?? "");
      setIsLoading(false);
    })();
    return () => { cancelled = true; };
  }, [clienteIdealId, companyId, supabase]);

  useEffect(() => {
    if (!promptAtendimentoId || !companyId || !supabase) {
      setPromptRow(null);
      return;
    }
    let cancelled = false;
    (async () => {
      const { data, error } = await supabase
        .from("prompt_atendimento")
        .select("id, name, nome_atendente, principais_instrucoes, papel, tom_voz, persona_id, prompt_template_id, fluxo_objetivo, follow_up_active, follow_up_tempo, follow_up_tentativas")
        .eq("id", promptAtendimentoId)
        .eq("company_id", companyId)
        .maybeSingle();
      if (cancelled) return;
      if (error || !data) {
        setPromptRow(null);
        return;
      }
      setPromptRow(data as PromptAtendimentoRow);
    })();
    return () => { cancelled = true; };
  }, [promptAtendimentoId, companyId, supabase]);

  const loadPersonas = useCallback(async () => {
    if (!companyId || !supabase) return;
    const { data } = await supabase
      .from("ideal_customers")
      .select("id, profile_name")
      .eq("company_id", companyId)
      .order("profile_name");
    setPersonas((data as { id: string; profile_name: string | null }[]) ?? []);
  }, [companyId, supabase]);

  useEffect(() => {
    loadPersonas();
  }, [loadPersonas]);

  const loadPromptTemplates = useCallback(async (fluxo: string) => {
    if (!fluxo?.trim() || !supabase) {
      setPromptTemplates([]);
      return;
    }
    const { data } = await supabase
      .from("prompt_templates")
      .select("id, name, descricao")
      .eq("categoria_objetivo", fluxo)
      .order("created_at", { ascending: false });
    setPromptTemplates((data as { id: string; name: string | null; descricao: string | null }[]) ?? []);
  }, [supabase]);

  const handleSave = useCallback(async (promptId: string | null, values: FormValues) => {
    if (!companyId || !supabase) return;
    const newPersonaId = (values.persona_id?.trim() || clienteIdealId) ?? null;
    const identifyingPhrase = values.identifying_phrase?.trim() || null;
    const payload = {
      company_id: companyId,
      name: values.name?.trim() || null,
      nome_atendente: values.nome_atendente?.trim() || null,
      principais_instrucoes: values.principais_instrucoes?.trim() || null,
      papel: values.papel?.trim() || null,
      tom_voz: values.tom_voz?.trim() || null,
      persona_id: newPersonaId,
      prompt_template_id: values.prompt_template_id?.trim() || null,
      fluxo_objetivo: values.fluxo_objetivo?.trim() || null,
      follow_up_active: values.follow_up_active ?? false,
      follow_up_tempo: values.follow_up_active ? (values.follow_up_tempo ?? null) : null,
      follow_up_tentativas: values.follow_up_active ? (values.follow_up_tentativas ?? null) : null,
    };
    if (promptId) {
      const { error } = await supabase
        .from("prompt_atendimento")
        .update(payload)
        .eq("id", promptId)
        .eq("company_id", companyId);
      if (error) throw error;
      if (newPersonaId) {
        await supabase
          .from("ideal_customers")
          .update({ prompt_atendimento_id: promptId, identifying_phrase: identifyingPhrase })
          .eq("id", newPersonaId)
          .eq("company_id", companyId);
        setPersonaIdentifyingPhrase(identifyingPhrase ?? "");
      }
      toast({ title: "Atualizado", description: "Prompt atualizado com sucesso." });
      setPromptRow((prev) => (prev ? { ...prev, ...payload } : null));
    } else {
      const { data: inserted, error } = await supabase
        .from("prompt_atendimento")
        .insert(payload)
        .select("id")
        .single();
      if (error) throw error;
      const newPromptId = inserted?.id;
      if (newPromptId && clienteIdealId) {
        await supabase
          .from("ideal_customers")
          .update({ prompt_atendimento_id: newPromptId, identifying_phrase: identifyingPhrase })
          .eq("id", clienteIdealId)
          .eq("company_id", companyId);
        setPersonaIdentifyingPhrase(identifyingPhrase ?? "");
      }
      toast({ title: "Salvo", description: "Novo prompt criado com sucesso." });
      setPromptAtendimentoId(newPromptId ?? null);
      if (newPromptId) {
        setPromptRow({
          id: newPromptId,
          name: payload.name,
          nome_atendente: payload.nome_atendente,
          principais_instrucoes: payload.principais_instrucoes,
          papel: payload.papel,
          tom_voz: payload.tom_voz,
          persona_id: newPersonaId,
          prompt_template_id: payload.prompt_template_id,
          fluxo_objetivo: payload.fluxo_objetivo,
          follow_up_active: payload.follow_up_active,
          follow_up_tempo: payload.follow_up_tempo,
          follow_up_tentativas: payload.follow_up_tentativas,
        });
      }
    }
  }, [companyId, supabase, toast, clienteIdealId]);

  if (isLoading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  const isCreateMode = !promptAtendimentoId || !promptRow;
  const initialValues: FormValues = isCreateMode
    ? {
        name: "",
        identifying_phrase: personaIdentifyingPhrase,
        fluxo_objetivo: "",
        prompt_template_id: "",
        follow_up_active: false,
        follow_up_tempo: 24,
        follow_up_tentativas: 3,
        nome_atendente: "",
        principais_instrucoes: "",
        papel: "",
        tom_voz: "",
        persona_id: clienteIdealId ?? "",
      }
    : rowToFormValues(promptRow!, personaIdentifyingPhrase);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <MessageSquare className="h-5 w-5" />
          Prompt de Atendimento
        </CardTitle>
        <CardDescription>
          {isCreateMode
            ? "Crie e configure o prompt de atendimento para este Cliente Ideal. O prompt será vinculado automaticamente."
            : "Configuração do prompt vinculado a este Cliente Ideal."}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <PromptForm
          editingId={promptRow?.id ?? null}
          initialValues={initialValues}
          companyId={companyId}
          personas={personas}
          promptTemplates={promptTemplates}
          fluxoObjetivo={initialValues.fluxo_objetivo ?? ""}
          allowDefaultPersona={false}
          hidePersonaField
          onLoadTemplates={loadPromptTemplates}
          onSave={handleSave}
          onCancel={() => {}}
          onDelete={undefined}
        />
      </CardContent>
    </Card>
  );
}
