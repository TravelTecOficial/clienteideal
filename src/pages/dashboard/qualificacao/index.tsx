import { useState, useEffect, useCallback } from "react";
import { useAuth, useOrganization } from "@clerk/clerk-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useSupabaseClient } from "@/lib/supabase-context";
import { useToast } from "@/hooks/use-toast";
import { Plus, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

// --- Interfaces ---
interface ProfileRow {
  company_id: string | null;
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

// --- Schema ---
const formSchema = z.object({
  pergunta: z.string().min(5, "A pergunta deve ser mais descritiva"),
  peso: z.string(),
  ideal_customer_id: z.string().min(1, "Selecione um Cliente Ideal"),
  resposta_fria: z.string().min(1, "Campo obrigatório"),
  resposta_morna: z.string().min(1, "Campo obrigatório"),
  resposta_quente: z.string().min(1, "Campo obrigatório"),
});

type FormValues = z.infer<typeof formSchema>;

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

export default function QualificacaoPage() {
  const { userId } = useAuth();
  const { organization } = useOrganization();
  const supabase = useSupabaseClient();
  const { toast } = useToast();

  const [personas, setPersonas] = useState<{ id: string; profile_name: string }[]>([]);
  const [companyId, setCompanyId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const effectiveCompanyId = companyId ?? organization?.id ?? null;

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      pergunta: "",
      peso: "1",
      ideal_customer_id: "",
      resposta_fria: "",
      resposta_morna: "",
      resposta_quente: "",
    },
  });

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

  async function onSubmit(values: FormValues) {
    if (!effectiveCompanyId || !userId) {
      toast({
        variant: "destructive",
        title: "Erro",
        description: "Usuário ou empresa não identificados.",
      });
      return;
    }

    setLoading(true);
    try {
      const pesoInt = parseInt(values.peso, 10) || 1;

      const { error } = await supabase.from("qualificacoes").insert({
        company_id: effectiveCompanyId,
        user_id: userId,
        ideal_customer_id: values.ideal_customer_id || null,
        pergunta: values.pergunta.trim(),
        peso: pesoInt,
        resposta_fria: values.resposta_fria.trim(),
        resposta_morna: values.resposta_morna.trim(),
        resposta_quente: values.resposta_quente.trim(),
      });

      if (error) throw error;

      toast({
        title: "Sucesso!",
        description: "Qualificação salva com sucesso.",
      });
      form.reset();
    } catch (err) {
      toast({
        variant: "destructive",
        title: "Erro",
        description: err instanceof Error ? err.message : "Falha ao salvar dados.",
      });
    } finally {
      setLoading(false);
    }
  }

  const respostasConfig = [
    { id: "fria" as const, label: "Frio (1pt)", dotClass: "bg-info" },
    { id: "morna" as const, label: "Morno (5pts)", dotClass: "bg-warning" },
    { id: "quente" as const, label: "Quente (10pts)", dotClass: "bg-destructive" },
  ];

  return (
    <div className="p-8 max-w-5xl mx-auto space-y-8">
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-2xl font-bold text-foreground tracking-tight">
            Configurar Qualificador
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            Defina as perguntas e critérios de pontuação para as Personas.
          </p>
        </div>
        <Button variant="default" className="gap-2">
          <Plus className="h-4 w-4" /> Adicionar Pergunta
        </Button>
      </div>

      <form
        onSubmit={form.handleSubmit(onSubmit)}
        className="bg-card rounded-xl border border-border shadow-sm overflow-hidden"
      >
        <div className="p-8 space-y-10">
          {/* Persona e Peso */}
          <div className="flex gap-6">
            <div className="flex-1 space-y-2">
              <Label className="text-[11px] font-bold uppercase text-muted-foreground tracking-wider">
                Vincular ao Cliente Ideal (Persona)
              </Label>
              <StyledSelect
                value={form.watch("ideal_customer_id")}
                onChange={(v) => form.setValue("ideal_customer_id", v)}
                options={personas.map((p) => ({ value: p.id, label: p.profile_name }))}
                placeholder="Selecione a Persona..."
              />
              {form.formState.errors.ideal_customer_id && (
                <p className="text-sm text-destructive">
                  {form.formState.errors.ideal_customer_id.message}
                </p>
              )}
            </div>

            <div className="w-32 space-y-2">
              <Label className="text-[11px] font-bold uppercase text-muted-foreground tracking-wider">
                Peso
              </Label>
              <StyledSelect
                value={form.watch("peso")}
                onChange={(v) => form.setValue("peso", v)}
                options={[
                  { value: "1", label: "1x" },
                  { value: "2", label: "2x" },
                  { value: "3", label: "3x" },
                ]}
              />
            </div>
          </div>

          {/* Pergunta - Estilo Ghost */}
          <div className="space-y-2">
            <Label className="text-[11px] font-bold uppercase text-muted-foreground tracking-wider">
              Pergunta
            </Label>
            <Input
              {...form.register("pergunta")}
              placeholder="Ex: Qual é a sua renda mensal?"
              className="border-0 border-b border-input rounded-none px-0 bg-transparent focus-visible:ring-0 focus-visible:ring-offset-0 focus-visible:border-primary text-lg font-medium h-auto py-2"
            />
            {form.formState.errors.pergunta && (
              <p className="text-sm text-destructive">
                {form.formState.errors.pergunta.message}
              </p>
            )}
          </div>

          {/* Respostas Frio, Morno, Quente */}
          <div className="space-y-5">
            {respostasConfig.map((item) => (
              <div key={item.id} className="flex items-center gap-6">
                <div className="flex items-center gap-3 min-w-[140px]">
                  <div className={cn("w-2.5 h-2.5 rounded-full", item.dotClass)} />
                  <span className="text-[11px] font-bold text-muted-foreground uppercase tracking-widest">
                    {item.label}
                  </span>
                </div>
                <div className="flex-1">
                  <Input
                    {...form.register(`resposta_${item.id}`)}
                    placeholder="Ex: Defina o critério para este nível..."
                    className="rounded-xl border-input h-12 focus-visible:shadow-md focus-visible:ring-2 focus-visible:ring-primary/20 transition-all"
                  />
                  {form.formState.errors[`resposta_${item.id}`] && (
                    <p className="text-sm text-destructive mt-1">
                      {form.formState.errors[`resposta_${item.id}`]?.message}
                    </p>
                  )}
                </div>
              </div>
            ))}
          </div>

          {/* Botões */}
          <div className="pt-8 border-t border-border flex justify-end items-center gap-4">
            <Button
              type="button"
              variant="ghost"
              onClick={() => form.reset()}
              className="text-muted-foreground font-semibold hover:text-foreground"
            >
              Descartar alterações
            </Button>
            <Button
              type="submit"
              disabled={loading}
              className="bg-primary hover:bg-primary/90 text-primary-foreground px-8 h-11 rounded-xl font-bold"
            >
              {loading ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : null}
              Salvar Qualificação
            </Button>
          </div>
        </div>
      </form>
    </div>
  );
}
