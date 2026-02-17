import { useState, useEffect, useCallback } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "@clerk/clerk-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";

import { Plus, Loader2, Check, Database, Megaphone, MessageSquare, Layers, Smartphone } from "lucide-react";

import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { Separator } from "@/components/ui/separator";
import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/app-sidebar";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { useSupabaseClient } from "@/lib/supabase-context";
import { getErrorMessage } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { useEvolutionProxy } from "@/hooks/use-evolution-proxy";

// --- Interfaces ---
interface ProfileRow {
  company_id: string | null;
}

interface CompanyRow {
  celular_atendimento: string | null;
  email_atendimento: string | null;
  estancia_whatsapp: string | null;
  n8n_chat_webhook_url: string | null;
  segment_type: string | null;
  evolution_api_url: string | null;
  evolution_api_key: string | null;
  evolution_instance_name: string | null;
}

interface Pagamento {
  id: string;
  data: string;
  plataforma: string;
  valor: number;
}

interface PersonaOption {
  id: string;
  profile_name: string | null;
}

interface PromptAtendimentoRow {
  id: string;
  nome_atendente: string | null;
  principais_instrucoes: string | null;
  papel: string | null;
  tom_voz: string | null;
  persona_id: string | null;
  criatividade_temperatura: number | null;
  max_tokens: number | null;
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

function formatDate(dateStr: string | null): string {
  if (!dateStr) return "—";
  const d = new Date(dateStr);
  return d.toLocaleDateString("pt-BR");
}

function formatValor(valor: number): string {
  return valor.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}

// --- Schemas ---
const dadosFormSchema = z.object({
  celular_atendimento: z.string().optional(),
  email_atendimento: z
    .union([z.string().email("E-mail inválido"), z.literal("")])
    .optional(),
  estancia_whatsapp: z.string().optional(),
  n8n_chat_webhook_url: z
    .union([z.literal(""), z.string().url("URL inválida")])
    .optional(),
});

const pagamentoFormSchema = z.object({
  data: z.string().min(1, "Data é obrigatória"),
  plataforma: z.enum(["Google Ads", "Meta Ads"], {
    required_error: "Selecione a plataforma",
  }),
  valor: z
    .union([z.number(), z.string()])
    .transform((v) => (typeof v === "string" ? parseFloat(v.replace(",", ".")) || 0 : v))
    .pipe(z.number().min(0, "O valor deve ser maior ou igual a zero")),
});

const promptAtendimentoFormSchema = z.object({
  nome_atendente: z.string().optional(),
  principais_instrucoes: z.string().optional(),
  papel: z.string().optional(),
  tom_voz: z.string().optional(),
  persona_id: z.string().optional(),
  criatividade_temperatura: z
    .union([z.number(), z.string()])
    .transform((v) => (typeof v === "string" ? parseInt(v, 10) || 5 : v))
    .pipe(z.number().min(1, "Mínimo 1").max(10, "Máximo 10")),
  max_tokens: z
    .union([z.number(), z.string()])
    .transform((v) => (typeof v === "string" ? parseInt(v, 10) || 1024 : v))
    .pipe(z.number().min(1, "Mínimo 1")),
});

const evolutionFormSchema = z.object({
  evolution_api_url: z
    .union([z.literal(""), z.string().url("URL inválida")])
    .optional(),
  evolution_api_key: z.string().optional(),
  evolution_instance_name: z.string().optional(),
});

type DadosFormValues = z.infer<typeof dadosFormSchema>;
type PagamentoFormValues = z.infer<typeof pagamentoFormSchema>;
type PromptAtendimentoFormValues = z.infer<typeof promptAtendimentoFormSchema>;
type EvolutionFormValues = z.infer<typeof evolutionFormSchema>;

const PLATAFORMA_OPTIONS = [
  { value: "Google Ads", label: "Google Ads" },
  { value: "Meta Ads", label: "Meta Ads" },
] as const;

// --- Component ---
export function ConfiguracoesPage() {
  const { userId } = useAuth();
  const supabase = useSupabaseClient();
  const { toast } = useToast();

  const [companyId, setCompanyId] = useState<string | null>(null);
  const [isFetchingDados, setIsFetchingDados] = useState(true);
  const [isSavingDados, setIsSavingDados] = useState(false);
  const [pagamentos, setPagamentos] = useState<Pagamento[]>([]);
  const [isFetchingPagamentos, setIsFetchingPagamentos] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSavingPagamento, setIsSavingPagamento] = useState(false);
  const [personas, setPersonas] = useState<PersonaOption[]>([]);
  const [isFetchingPrompt, setIsFetchingPrompt] = useState(true);
  const [isSavingPrompt, setIsSavingPrompt] = useState(false);
  const [segmentType, setSegmentType] = useState<string>("produtos");
  const [isFetchingSegment, setIsFetchingSegment] = useState(true);
  const [isSavingSegment, setIsSavingSegment] = useState(false);
  const [isFetchingEvolution, setIsFetchingEvolution] = useState(true);
  const [isSavingEvolution, setIsSavingEvolution] = useState(false);
  const [qrCodeBase64, setQrCodeBase64] = useState<string | null>(null);
  const [connectionState, setConnectionState] = useState<string | null>(null);

  const { execute: executeEvolutionProxy } = useEvolutionProxy();

  const dadosForm = useForm<DadosFormValues>({
    resolver: zodResolver(dadosFormSchema),
    defaultValues: {
      celular_atendimento: "",
      email_atendimento: "",
      estancia_whatsapp: "",
      n8n_chat_webhook_url: "",
    },
  });

  const pagamentoForm = useForm<PagamentoFormValues>({
    resolver: zodResolver(pagamentoFormSchema),
    defaultValues: {
      data: "",
      plataforma: undefined,
      valor: 0,
    },
  });

  const promptForm = useForm<PromptAtendimentoFormValues>({
    resolver: zodResolver(promptAtendimentoFormSchema),
    defaultValues: {
      nome_atendente: "",
      principais_instrucoes: "",
      papel: "",
      tom_voz: "",
      persona_id: "",
      criatividade_temperatura: 5,
      max_tokens: 1024,
    },
  });

  const evolutionForm = useForm<EvolutionFormValues>({
    resolver: zodResolver(evolutionFormSchema),
    defaultValues: {
      evolution_api_url: "",
      evolution_api_key: "",
      evolution_instance_name: "",
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

  // Carregar dados da empresa (celular, email atendimento)
  const loadDados = useCallback(async () => {
    if (!companyId) {
      setIsFetchingDados(false);
      setIsFetchingSegment(false);
      return;
    }
    setIsFetchingDados(true);
    setIsFetchingSegment(true);
    try {
      const { data, error } = await supabase
        .from("companies")
        .select("celular_atendimento, email_atendimento, estancia_whatsapp, n8n_chat_webhook_url, segment_type")
        .eq("id", companyId)
        .maybeSingle();

      if (error) throw error;
      const row = data as CompanyRow | null;
      dadosForm.reset({
        celular_atendimento: row?.celular_atendimento ?? "",
        email_atendimento: row?.email_atendimento ?? "",
        estancia_whatsapp: row?.estancia_whatsapp ?? "",
        n8n_chat_webhook_url: row?.n8n_chat_webhook_url ?? "",
      });
      setSegmentType(row?.segment_type === "consorcio" ? "consorcio" : "produtos");
    } catch (err) {
      console.error("Erro ao carregar dados:", err);
      toast({
        variant: "destructive",
        title: "Erro",
        description: "Falha ao carregar dados da empresa.",
      });
    } finally {
      setIsFetchingDados(false);
      setIsFetchingSegment(false);
    }
  }, [companyId, supabase, toast, dadosForm]);

  useEffect(() => {
    loadDados();
  }, [loadDados]);

  // Carregar pagamentos
  const loadPagamentos = useCallback(async () => {
    if (!companyId) {
      setIsFetchingPagamentos(false);
      setPagamentos([]);
      return;
    }
    setIsFetchingPagamentos(true);
    try {
      const { data, error } = await supabase
        .from("pagamentos_anuncios")
        .select("id, data, plataforma, valor")
        .eq("company_id", companyId)
        .order("data", { ascending: false });

      if (error) throw error;
      setPagamentos((data as Pagamento[]) ?? []);
    } catch (err) {
      console.error("Erro ao carregar pagamentos:", err);
      toast({
        variant: "destructive",
        title: "Erro",
        description: "Falha ao carregar pagamentos.",
      });
      setPagamentos([]);
    } finally {
      setIsFetchingPagamentos(false);
    }
  }, [companyId, supabase, toast]);

  useEffect(() => {
    loadPagamentos();
  }, [loadPagamentos]);

  // Carregar personas (ideal_customers) para o select
  const loadPersonas = useCallback(async () => {
    if (!companyId) return;
    try {
      const { data, error } = await supabase
        .from("ideal_customers")
        .select("id, profile_name")
        .eq("company_id", companyId)
        .order("profile_name");

      if (error) throw error;
      setPersonas((data as PersonaOption[]) ?? []);
    } catch (err) {
      console.error("Erro ao carregar personas:", err);
      setPersonas([]);
    }
  }, [companyId, supabase]);

  // Carregar prompt de atendimento
  const loadPromptAtendimento = useCallback(async () => {
    if (!companyId) {
      setIsFetchingPrompt(false);
      return;
    }
    setIsFetchingPrompt(true);
    try {
      const { data, error } = await supabase
        .from("prompt_atendimento")
        .select("id, nome_atendente, principais_instrucoes, papel, tom_voz, persona_id, criatividade_temperatura, max_tokens")
        .eq("company_id", companyId)
        .maybeSingle();

      if (error) throw error;
      const row = data as PromptAtendimentoRow | null;
      promptForm.reset({
        nome_atendente: row?.nome_atendente ?? "",
        principais_instrucoes: row?.principais_instrucoes ?? "",
        papel: row?.papel ?? "",
        tom_voz: row?.tom_voz ?? "",
        persona_id: row?.persona_id ?? "",
        criatividade_temperatura: row?.criatividade_temperatura ?? 5,
        max_tokens: row?.max_tokens ?? 1024,
      });
    } catch (err) {
      console.error("Erro ao carregar prompt de atendimento:", err);
      toast({
        variant: "destructive",
        title: "Erro",
        description: "Falha ao carregar configurações do prompt.",
      });
    } finally {
      setIsFetchingPrompt(false);
    }
  }, [companyId, supabase, toast, promptForm]);

  useEffect(() => {
    loadPersonas();
  }, [loadPersonas]);

  useEffect(() => {
    loadPromptAtendimento();
  }, [loadPromptAtendimento]);

  // Carregar configuração Evolution API (não carrega API key por segurança)
  const loadEvolution = useCallback(async () => {
    if (!companyId) {
      setIsFetchingEvolution(false);
      return;
    }
    setIsFetchingEvolution(true);
    try {
      const { data, error } = await supabase
        .from("companies")
        .select("evolution_api_url, evolution_instance_name")
        .eq("id", companyId)
        .maybeSingle();

      if (error) throw error;
      const row = data as { evolution_api_url: string | null; evolution_instance_name: string | null } | null;
      evolutionForm.reset({
        evolution_api_url: row?.evolution_api_url ?? "",
        evolution_api_key: "", // Nunca carregado por segurança
        evolution_instance_name: row?.evolution_instance_name ?? "",
      });
    } catch (err) {
      console.error("Erro ao carregar Evolution API:", err);
      toast({
        variant: "destructive",
        title: "Erro",
        description: "Falha ao carregar configuração da Evolution API.",
      });
    } finally {
      setIsFetchingEvolution(false);
    }
  }, [companyId, supabase, toast, evolutionForm]);

  useEffect(() => {
    loadEvolution();
  }, [loadEvolution]);

  // Salvar dados (aba Dados)
  async function onDadosSubmit(values: DadosFormValues) {
    if (!companyId) {
      toast({
        variant: "destructive",
        title: "Erro",
        description: "Empresa não identificada.",
      });
      return;
    }
    setIsSavingDados(true);
    try {
      const { error } = await supabase
        .from("companies")
        .update({
          celular_atendimento: values.celular_atendimento?.trim() || null,
          email_atendimento: values.email_atendimento?.trim() || null,
          estancia_whatsapp: values.estancia_whatsapp?.trim() || null,
          n8n_chat_webhook_url: values.n8n_chat_webhook_url?.trim() || null,
        })
        .eq("id", companyId);

      if (error) throw error;

      toast({
        title: "Dados salvos",
        description: "As informações de atendimento foram atualizadas.",
      });
    } catch (err) {
      toast({
        variant: "destructive",
        title: "Erro ao salvar",
        description: getErrorMessage(err),
      });
    } finally {
      setIsSavingDados(false);
    }
  }

  // Salvar pagamento (modal)
  async function onPagamentoSubmit(values: PagamentoFormValues) {
    if (!companyId || !userId) {
      toast({
        variant: "destructive",
        title: "Erro",
        description: "Usuário ou empresa não identificados.",
      });
      return;
    }
    setIsSavingPagamento(true);
    try {
      const { error } = await supabase.from("pagamentos_anuncios").insert({
        company_id: companyId,
        data: values.data,
        plataforma: values.plataforma,
        valor: values.valor,
      });

      if (error) throw error;

      toast({
        title: "Pagamento cadastrado",
        description: "O pagamento foi registrado com sucesso.",
      });
      setIsModalOpen(false);
      pagamentoForm.reset({
        data: "",
        plataforma: undefined,
        valor: 0,
      });
      loadPagamentos();
    } catch (err) {
      toast({
        variant: "destructive",
        title: "Erro ao cadastrar",
        description: getErrorMessage(err),
      });
    } finally {
      setIsSavingPagamento(false);
    }
  }

  // Salvar prompt de atendimento
  async function onPromptAtendimentoSubmit(values: PromptAtendimentoFormValues) {
    if (!companyId) {
      toast({
        variant: "destructive",
        title: "Erro",
        description: "Empresa não identificada.",
      });
      return;
    }
    setIsSavingPrompt(true);
    try {
      const payload = {
        company_id: companyId,
        nome_atendente: values.nome_atendente?.trim() || null,
        principais_instrucoes: values.principais_instrucoes?.trim() || null,
        papel: values.papel?.trim() || null,
        tom_voz: values.tom_voz?.trim() || null,
        persona_id: values.persona_id?.trim() || null,
        criatividade_temperatura: values.criatividade_temperatura ?? 5,
        max_tokens: values.max_tokens ?? 1024,
      };

      const { data: existing } = await supabase
        .from("prompt_atendimento")
        .select("id")
        .eq("company_id", companyId)
        .maybeSingle();

      if (existing) {
        const { error } = await supabase
          .from("prompt_atendimento")
          .update({
            nome_atendente: payload.nome_atendente,
            principais_instrucoes: payload.principais_instrucoes,
            papel: payload.papel,
            tom_voz: payload.tom_voz,
            persona_id: payload.persona_id,
            criatividade_temperatura: payload.criatividade_temperatura,
            max_tokens: payload.max_tokens,
          })
          .eq("company_id", companyId);

        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("prompt_atendimento")
          .insert(payload);

        if (error) throw error;
      }

      toast({
        title: "Prompt salvo",
        description: "As configurações do prompt de atendimento foram atualizadas.",
      });
    } catch (err) {
      toast({
        variant: "destructive",
        title: "Erro ao salvar",
        description: getErrorMessage(err),
      });
    } finally {
      setIsSavingPrompt(false);
    }
  }

  // Salvar segmento (aba Segmento)
  async function onSegmentSubmit() {
    if (!companyId) {
      toast({
        variant: "destructive",
        title: "Erro",
        description: "Empresa não identificada.",
      });
      return;
    }
    setIsSavingSegment(true);
    try {
      const { error } = await supabase
        .from("companies")
        .update({ segment_type: segmentType })
        .eq("id", companyId);

      if (error) throw error;

      toast({
        title: "Segmento salvo",
        description: "O tipo de segmento foi atualizado. O menu será atualizado.",
      });
      window.dispatchEvent(new CustomEvent("segment-type-changed"));
    } catch (err) {
      toast({
        variant: "destructive",
        title: "Erro ao salvar",
        description: getErrorMessage(err),
      });
    } finally {
      setIsSavingSegment(false);
    }
  }

  // Salvar credenciais Evolution API
  async function onEvolutionSubmit(values: EvolutionFormValues) {
    if (!companyId) {
      toast({
        variant: "destructive",
        title: "Erro",
        description: "Empresa não identificada.",
      });
      return;
    }
    setIsSavingEvolution(true);
    try {
      const payload: Record<string, string | null> = {
        evolution_api_url: values.evolution_api_url?.trim() || null,
        evolution_instance_name: values.evolution_instance_name?.trim() || null,
      };
      if (values.evolution_api_key?.trim()) {
        payload.evolution_api_key = values.evolution_api_key.trim();
      }
      const { error } = await supabase
        .from("companies")
        .update(payload)
        .eq("id", companyId);

      if (error) throw error;

      toast({
        title: "Credenciais salvas",
        description: "As configurações da Evolution API foram atualizadas.",
      });
      evolutionForm.reset({
        ...evolutionForm.getValues(),
        evolution_api_key: "", // Limpa o campo após salvar (nunca persistir no estado do form)
      });
    } catch (err) {
      toast({
        variant: "destructive",
        title: "Erro ao salvar",
        description: getErrorMessage(err),
      });
    } finally {
      setIsSavingEvolution(false);
    }
  }

  // Ações Evolution API via Edge Function
  async function handleEvolutionAction(
    action: "create" | "connect" | "connectionState" | "fetchInstances" | "logout"
  ) {
    const instanceName = evolutionForm.getValues("evolution_instance_name")?.trim();
    const { data, error } = await executeEvolutionProxy(action, {
      instanceName: instanceName || undefined,
    });
    if (error) {
      toast({
        variant: "destructive",
        title: "Erro",
        description: error,
      });
      return;
    }
    const res = data as Record<string, unknown> | null;
    if (action === "connect" && res) {
      const base64 = (res.base64 ?? res.code ?? res.pairingCode) as string | undefined;
      if (base64) {
        const src = typeof base64 === "string" && base64.startsWith("data:")
          ? base64
          : `data:image/png;base64,${base64}`;
        setQrCodeBase64(src);
      } else {
        setQrCodeBase64(null);
        toast({
          variant: "destructive",
          title: "QR Code não retornado",
          description: "A Evolution API não retornou o QR Code. Verifique se a instância existe.",
        });
      }
    }
    if (action === "connectionState" && res) {
      const state = (res.state ?? res.instance?.state ?? res) as string | Record<string, unknown>;
      setConnectionState(typeof state === "string" ? state : JSON.stringify(state));
    }
    if (action === "logout") {
      setQrCodeBase64(null);
      setConnectionState(null);
      toast({
        title: "Desconectado",
        description: "A instância foi desconectada com sucesso.",
      });
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
                <BreadcrumbPage>Configurações</BreadcrumbPage>
              </BreadcrumbItem>
            </BreadcrumbList>
          </Breadcrumb>
        </header>
        <div className="flex flex-1 flex-col gap-4 p-4">
          <Tabs defaultValue="dados" className="w-full">
            <TabsList className="grid w-full max-w-[1000px] grid-cols-5">
              <TabsTrigger value="dados" className="gap-2">
                <Database className="h-4 w-4" /> Dados
              </TabsTrigger>
              <TabsTrigger value="segmento" className="gap-2">
                <Layers className="h-4 w-4" /> Segmento
              </TabsTrigger>
              <TabsTrigger value="evolution" className="gap-2">
                <Smartphone className="h-4 w-4" /> Evolution API
              </TabsTrigger>
              <TabsTrigger value="anuncios" className="gap-2">
                <Megaphone className="h-4 w-4" /> Anúncios
              </TabsTrigger>
              <TabsTrigger value="prompt-atendimento" className="gap-2">
                <MessageSquare className="h-4 w-4" /> Prompt Atendimento
              </TabsTrigger>
            </TabsList>

            <TabsContent value="dados" className="space-y-4 pt-4">
              <Card>
                <CardHeader>
                  <CardTitle>Dados do atendimento</CardTitle>
                  <CardDescription>
                    Celular, e-mail e Estância Whatsapp para contato de
                    atendimento.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {isFetchingDados ? (
                    <div className="flex min-h-[120px] items-center justify-center">
                      <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                    </div>
                  ) : (
                    <form
                      onSubmit={dadosForm.handleSubmit(onDadosSubmit)}
                      className="grid gap-4 sm:grid-cols-2"
                    >
                      <div className="space-y-2">
                        <Label htmlFor="celular_atendimento">
                          Celular do atendimento
                        </Label>
                        <Input
                          id="celular_atendimento"
                          type="tel"
                          placeholder="(00) 00000-0000"
                          {...dadosForm.register("celular_atendimento")}
                        />
                        {dadosForm.formState.errors.celular_atendimento && (
                          <p className="text-xs text-destructive">
                            {
                              dadosForm.formState.errors.celular_atendimento
                                .message
                            }
                          </p>
                        )}
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="email_atendimento">
                          E-mail do atendimento
                        </Label>
                        <Input
                          id="email_atendimento"
                          type="email"
                          placeholder="atendimento@empresa.com"
                          {...dadosForm.register("email_atendimento")}
                        />
                        {dadosForm.formState.errors.email_atendimento && (
                          <p className="text-xs text-destructive">
                            {
                              dadosForm.formState.errors.email_atendimento
                                .message
                            }
                          </p>
                        )}
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="estancia_whatsapp">
                          Estância Whatsapp
                        </Label>
                        <Input
                          id="estancia_whatsapp"
                          type="text"
                          placeholder="Ex: nome-da-instancia"
                          {...dadosForm.register("estancia_whatsapp")}
                        />
                        {dadosForm.formState.errors.estancia_whatsapp && (
                          <p className="text-xs text-destructive">
                            {
                              dadosForm.formState.errors.estancia_whatsapp
                                .message
                            }
                          </p>
                        )}
                      </div>
                      <div className="space-y-2 sm:col-span-2">
                        <Label htmlFor="n8n_chat_webhook_url">
                          Webhook N8N (Chat de Conhecimento)
                        </Label>
                        <Input
                          id="n8n_chat_webhook_url"
                          type="url"
                          placeholder="https://seu-n8n.com/webhook/consulta-chat"
                          {...dadosForm.register("n8n_chat_webhook_url")}
                        />
                        {dadosForm.formState.errors.n8n_chat_webhook_url && (
                          <p className="text-xs text-destructive">
                            {
                              dadosForm.formState.errors.n8n_chat_webhook_url
                                .message
                            }
                          </p>
                        )}
                      </div>
                      <div className="sm:col-span-2">
                        <Button type="submit" disabled={isSavingDados}>
                          {isSavingDados ? (
                            <>
                              <Loader2 className="h-4 w-4 animate-spin" />
                              Salvando…
                            </>
                          ) : (
                            <>
                              <Check className="h-4 w-4" />
                              Salvar
                            </>
                          )}
                        </Button>
                      </div>
                    </form>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="segmento" className="space-y-4 pt-4">
              <Card>
                <CardHeader>
                  <CardTitle>Tipo de Segmento</CardTitle>
                  <CardDescription>
                    Defina o foco do seu negócio. Isso altera os módulos exibidos no menu lateral.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {isFetchingSegment ? (
                    <div className="flex min-h-[120px] items-center justify-center">
                      <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                    </div>
                  ) : (
                    <div className="space-y-4">
                      <RadioGroup
                        value={segmentType}
                        onValueChange={setSegmentType}
                        className="flex flex-col gap-4"
                      >
                        <div className="flex items-center space-x-2">
                          <RadioGroupItem value="produtos" id="segment-produtos" />
                          <Label htmlFor="segment-produtos" className="cursor-pointer font-normal">
                            Produtos e Serviços
                          </Label>
                        </div>
                        <div className="flex items-center space-x-2">
                          <RadioGroupItem value="consorcio" id="segment-consorcio" />
                          <Label htmlFor="segment-consorcio" className="cursor-pointer font-normal">
                            Consórcios
                          </Label>
                        </div>
                      </RadioGroup>
                      <Button
                        type="button"
                        onClick={onSegmentSubmit}
                        disabled={isSavingSegment}
                      >
                        {isSavingSegment ? (
                          <>
                            <Loader2 className="h-4 w-4 animate-spin" />
                            Salvando…
                          </>
                        ) : (
                          <>
                            <Check className="h-4 w-4" />
                            Salvar
                          </>
                        )}
                      </Button>
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="evolution" className="space-y-4 pt-4">
              <Card>
                <CardHeader>
                  <CardTitle>Evolution API (WhatsApp)</CardTitle>
                  <CardDescription>
                    Configure a conexão com a Evolution API hospedada na sua VPS.
                    Crie uma instância e conecte via QR Code.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {isFetchingEvolution ? (
                    <div className="flex min-h-[120px] items-center justify-center">
                      <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                    </div>
                  ) : (
                    <div className="space-y-6">
                      <form
                        onSubmit={evolutionForm.handleSubmit(onEvolutionSubmit)}
                        className="grid gap-4 sm:grid-cols-2"
                      >
                        <div className="space-y-2 sm:col-span-2">
                          <Label htmlFor="evolution_api_url">
                            URL da Evolution API
                          </Label>
                          <Input
                            id="evolution_api_url"
                            type="url"
                            placeholder="https://evolution.sua-vps.com"
                            {...evolutionForm.register("evolution_api_url")}
                          />
                          {evolutionForm.formState.errors.evolution_api_url && (
                            <p className="text-xs text-destructive">
                              {
                                evolutionForm.formState.errors.evolution_api_url
                                  .message
                              }
                            </p>
                          )}
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="evolution_api_key">
                            API Key
                          </Label>
                          <Input
                            id="evolution_api_key"
                            type="password"
                            placeholder="••••••••"
                            autoComplete="off"
                            {...evolutionForm.register("evolution_api_key")}
                          />
                          <p className="text-xs text-muted-foreground">
                            Deixe em branco para manter a chave atual.
                          </p>
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="evolution_instance_name">
                            Nome da instância
                          </Label>
                          <Input
                            id="evolution_instance_name"
                            type="text"
                            placeholder="minha-empresa-whatsapp"
                            {...evolutionForm.register("evolution_instance_name")}
                          />
                        </div>
                        <div className="flex items-end sm:col-span-2">
                          <Button type="submit" disabled={isSavingEvolution}>
                            {isSavingEvolution ? (
                              <>
                                <Loader2 className="h-4 w-4 animate-spin" />
                                Salvando…
                              </>
                            ) : (
                              <>
                                <Check className="h-4 w-4" />
                                Salvar credenciais
                              </>
                            )}
                          </Button>
                        </div>
                      </form>

                      <Separator />

                      <div className="space-y-3">
                        <h4 className="text-sm font-medium">Ações</h4>
                        <div className="flex flex-wrap gap-2">
                          <Button
                            type="button"
                            variant="outline"
                            onClick={() => handleEvolutionAction("create")}
                          >
                            Criar instância
                          </Button>
                          <Button
                            type="button"
                            variant="outline"
                            onClick={() => handleEvolutionAction("connect")}
                            disabled={!evolutionForm.watch("evolution_instance_name")?.trim()}
                          >
                            Conectar / Gerar QR Code
                          </Button>
                          <Button
                            type="button"
                            variant="outline"
                            onClick={() => handleEvolutionAction("connectionState")}
                            disabled={!evolutionForm.watch("evolution_instance_name")?.trim()}
                          >
                            Verificar conexão
                          </Button>
                          <Button
                            type="button"
                            variant="outline"
                            onClick={() => handleEvolutionAction("logout")}
                            disabled={
                              !evolutionForm.watch("evolution_instance_name")?.trim() ||
                              connectionState !== "open"
                            }
                          >
                            Desconectar
                          </Button>
                        </div>
                      </div>

                      {qrCodeBase64 && connectionState !== "open" && (
                        <div className="space-y-2">
                          <p className="text-sm font-medium">
                            Escaneie com WhatsApp no celular
                          </p>
                          <div className="flex justify-center rounded-lg border bg-muted/50 p-4">
                            <img
                              src={qrCodeBase64}
                              alt="QR Code para conectar WhatsApp"
                              className="h-64 w-64 object-contain"
                            />
                          </div>
                        </div>
                      )}

                      {connectionState && (
                        <div className="space-y-2">
                          <p className="text-sm font-medium">Estado da conexão</p>
                          <p className="rounded-md bg-muted p-3 text-sm">
                            {connectionState}
                          </p>
                        </div>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="prompt-atendimento" className="space-y-4 pt-4">
              <Card>
                <CardHeader>
                  <CardTitle>Prompt de Atendimento</CardTitle>
                  <CardDescription>
                    Configure o comportamento da IA no atendimento: nome, papel,
                    tom de voz, persona e parâmetros de geração.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {isFetchingPrompt ? (
                    <div className="flex min-h-[200px] items-center justify-center">
                      <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                    </div>
                  ) : (
                    <form
                      onSubmit={promptForm.handleSubmit(onPromptAtendimentoSubmit)}
                      className="grid gap-4 sm:grid-cols-2"
                    >
                      <div className="space-y-2">
                        <Label htmlFor="nome_atendente">Nome do atendente</Label>
                        <Input
                          id="nome_atendente"
                          type="text"
                          placeholder="Ex: Assistente de Vendas"
                          {...promptForm.register("nome_atendente")}
                        />
                        {promptForm.formState.errors.nome_atendente && (
                          <p className="text-xs text-destructive">
                            {promptForm.formState.errors.nome_atendente.message}
                          </p>
                        )}
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
                          {...promptForm.register("principais_instrucoes")}
                        />
                        {promptForm.formState.errors.principais_instrucoes && (
                          <p className="text-xs text-destructive">
                            {
                              promptForm.formState.errors.principais_instrucoes
                                .message
                            }
                          </p>
                        )}
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="papel">Papel</Label>
                        <Input
                          id="papel"
                          type="text"
                          placeholder="Ex: Consultor de vendas"
                          {...promptForm.register("papel")}
                        />
                        {promptForm.formState.errors.papel && (
                          <p className="text-xs text-destructive">
                            {promptForm.formState.errors.papel.message}
                          </p>
                        )}
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="tom_voz">Tom de voz</Label>
                        <Input
                          id="tom_voz"
                          type="text"
                          placeholder="Ex: Amigável e profissional"
                          {...promptForm.register("tom_voz")}
                        />
                        {promptForm.formState.errors.tom_voz && (
                          <p className="text-xs text-destructive">
                            {promptForm.formState.errors.tom_voz.message}
                          </p>
                        )}
                      </div>
                      <div className="space-y-2">
                        <Label>Persona (Cliente Ideal)</Label>
                        <Select
                          value={
                            promptForm.watch("persona_id") || "__none__"
                          }
                          onValueChange={(v) =>
                            promptForm.setValue(
                              "persona_id",
                              v === "__none__" ? "" : v
                            )
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
                        {promptForm.formState.errors.persona_id && (
                          <p className="text-xs text-destructive">
                            {promptForm.formState.errors.persona_id.message}
                          </p>
                        )}
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="criatividade_temperatura">
                          Criatividade/Temperatura (1-10)
                        </Label>
                        <Input
                          id="criatividade_temperatura"
                          type="number"
                          min={1}
                          max={10}
                          placeholder="5"
                          {...promptForm.register("criatividade_temperatura")}
                        />
                        {promptForm.formState.errors.criatividade_temperatura && (
                          <p className="text-xs text-destructive">
                            {
                              promptForm.formState.errors
                                .criatividade_temperatura?.message
                            }
                          </p>
                        )}
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="max_tokens">
                          Tamanho da resposta (max tokens)
                        </Label>
                        <Input
                          id="max_tokens"
                          type="number"
                          min={1}
                          placeholder="1024"
                          {...promptForm.register("max_tokens")}
                        />
                        {promptForm.formState.errors.max_tokens && (
                          <p className="text-xs text-destructive">
                            {promptForm.formState.errors.max_tokens.message}
                          </p>
                        )}
                      </div>
                      <div className="sm:col-span-2">
                        <Button type="submit" disabled={isSavingPrompt}>
                          {isSavingPrompt ? (
                            <>
                              <Loader2 className="h-4 w-4 animate-spin" />
                              Salvando…
                            </>
                          ) : (
                            <>
                              <Check className="h-4 w-4" />
                              Salvar
                            </>
                          )}
                        </Button>
                      </div>
                    </form>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="anuncios" className="space-y-4 pt-4">
              <div className="flex flex-col gap-4">
                <div className="flex justify-between items-center">
                  <h3 className="text-lg font-semibold">Pagamentos</h3>
                  <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
                    <DialogTrigger asChild>
                      <Button
                        onClick={() => {
                          pagamentoForm.reset({
                            data: "",
                            plataforma: undefined,
                            valor: 0,
                          });
                        }}
                        className="gap-2"
                      >
                        <Plus className="h-4 w-4" />
                        Novo Pagamento
                      </Button>
                    </DialogTrigger>
                    <DialogContent className="sm:max-w-[425px]">
                      <DialogHeader>
                        <DialogTitle>Novo Pagamento</DialogTitle>
                        <DialogDescription>
                          Registre um pagamento de anúncio (Google Ads ou Meta
                          Ads).
                        </DialogDescription>
                      </DialogHeader>
                      <form
                        onSubmit={pagamentoForm.handleSubmit(onPagamentoSubmit)}
                        className="grid gap-4 py-4"
                      >
                        <div className="space-y-2">
                          <Label htmlFor="data">Data</Label>
                          <Input
                            id="data"
                            type="date"
                            {...pagamentoForm.register("data")}
                          />
                          {pagamentoForm.formState.errors.data && (
                            <p className="text-xs text-destructive">
                              {
                                pagamentoForm.formState.errors.data.message
                              }
                            </p>
                          )}
                        </div>
                        <div className="space-y-2">
                          <Label>Plataforma</Label>
                          <Select
                            value={pagamentoForm.watch("plataforma")}
                            onValueChange={(v: string) =>
                              pagamentoForm.setValue(
                                "plataforma",
                                v as PagamentoFormValues["plataforma"]
                              )
                            }
                          >
                            <SelectTrigger>
                              <SelectValue placeholder="Selecione" />
                            </SelectTrigger>
                            <SelectContent>
                              {PLATAFORMA_OPTIONS.map((opt) => (
                                <SelectItem
                                  key={opt.value}
                                  value={opt.value}
                                >
                                  {opt.label}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          {pagamentoForm.formState.errors.plataforma && (
                            <p className="text-xs text-destructive">
                              {
                                pagamentoForm.formState.errors.plataforma
                                  .message
                              }
                            </p>
                          )}
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="valor">Valor (R$)</Label>
                          <Input
                            id="valor"
                            type="number"
                            step="0.01"
                            min={0}
                            placeholder="0,00"
                            {...pagamentoForm.register("valor")}
                          />
                          {pagamentoForm.formState.errors.valor && (
                            <p className="text-xs text-destructive">
                              {
                                pagamentoForm.formState.errors.valor.message
                              }
                            </p>
                          )}
                        </div>
                        <DialogFooter>
                          <Button
                            type="button"
                            variant="outline"
                            onClick={() => setIsModalOpen(false)}
                          >
                            Cancelar
                          </Button>
                          <Button type="submit" disabled={isSavingPagamento}>
                            {isSavingPagamento ? (
                              <>
                                <Loader2 className="h-4 w-4 animate-spin" />
                                Salvando…
                              </>
                            ) : (
                              "Salvar"
                            )}
                          </Button>
                        </DialogFooter>
                      </form>
                    </DialogContent>
                  </Dialog>
                </div>

                <div className="overflow-hidden rounded-lg border border-border bg-card shadow-sm">
                  {isFetchingPagamentos ? (
                    <div className="flex min-h-[200px] items-center justify-center p-8">
                      <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                    </div>
                  ) : (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Data</TableHead>
                          <TableHead>Plataforma</TableHead>
                          <TableHead className="text-right">Valor</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {pagamentos.length === 0 ? (
                          <TableRow>
                            <TableCell
                              colSpan={3}
                              className="h-24 text-center text-muted-foreground"
                            >
                              Nenhum pagamento cadastrado. Clique em Novo
                              Pagamento para adicionar.
                            </TableCell>
                          </TableRow>
                        ) : (
                          pagamentos.map((p) => (
                            <TableRow key={p.id}>
                              <TableCell>{formatDate(p.data)}</TableCell>
                              <TableCell>{p.plataforma}</TableCell>
                              <TableCell className="text-right">
                                {formatValor(p.valor)}
                              </TableCell>
                            </TableRow>
                          ))
                        )}
                      </TableBody>
                    </Table>
                  )}
                </div>
              </div>
            </TabsContent>
          </Tabs>
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}
