import React, { useState, useEffect, useCallback, useRef } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "@clerk/clerk-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";

import { Plus, Loader2, Check, Database, Megaphone, Smartphone, ImagePlus, Building2 } from "lucide-react";

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
import { ProfileDropdown } from "@/components/profile-dropdown";
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
import { useSupabaseClient } from "@/lib/supabase-context";
import { getErrorMessage } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { useEvolutionProxy } from "@/hooks/use-evolution-proxy";

// --- Interfaces ---
interface ProfileRow {
  company_id: string | null;
}

interface CompanyRow {
  name: string | null;
  description: string | null;
  history: string | null;
  celular_atendimento: string | null;
  email_atendimento: string | null;
  estancia_whatsapp: string | null;
  whatsapp_group_image_url: string | null;
  evolution_instance_name: string | null;
}

interface Pagamento {
  id: string;
  data: string;
  plataforma: string;
  valor: number;
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
const empresaFormSchema = z.object({
  name: z.string().min(1, "Nome da empresa é obrigatório"),
  description: z.string().optional(),
  history: z.string().optional(),
});

const dadosFormSchema = z.object({
  celular_atendimento: z.string().optional(),
  email_atendimento: z
    .union([z.string().email("E-mail inválido"), z.literal("")])
    .optional(),
  estancia_whatsapp: z.string().optional(),
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

const evolutionFormSchema = z.object({
  evolution_instance_name: z.string().optional(),
});

type EmpresaFormValues = z.infer<typeof empresaFormSchema>;
type DadosFormValues = z.infer<typeof dadosFormSchema>;
type PagamentoFormValues = z.infer<typeof pagamentoFormSchema>;
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
  const [isFetchingEmpresa, setIsFetchingEmpresa] = useState(true);
  const [isSavingEmpresa, setIsSavingEmpresa] = useState(false);
  const [isFetchingDados, setIsFetchingDados] = useState(true);
  const [isSavingDados, setIsSavingDados] = useState(false);
  const [pagamentos, setPagamentos] = useState<Pagamento[]>([]);
  const [isFetchingPagamentos, setIsFetchingPagamentos] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSavingPagamento, setIsSavingPagamento] = useState(false);
  const [isFetchingEvolution, setIsFetchingEvolution] = useState(true);
  const [isSavingEvolution, setIsSavingEvolution] = useState(false);
  const [qrCodeBase64, setQrCodeBase64] = useState<string | null>(null);
  const [connectionState, setConnectionState] = useState<string | null>(null);
  const connectionPollIntervalRef = useRef<number | null>(null);
  const connectionPollAttemptsRef = useRef(0);
  const [whatsappImageUrl, setWhatsappImageUrl] = useState<string | null>(null);
  const [isUploadingImage, setIsUploadingImage] = useState(false);
  const whatsappImageInputRef = useRef<HTMLInputElement>(null);

  const { execute: executeEvolutionProxy } = useEvolutionProxy();
  const evolutionForm = useForm<EvolutionFormValues>({
    resolver: zodResolver(evolutionFormSchema),
    defaultValues: {
      evolution_instance_name: "",
    },
  });

  const stopConnectionPolling = useCallback(() => {
    if (connectionPollIntervalRef.current !== null) {
      window.clearInterval(connectionPollIntervalRef.current);
      connectionPollIntervalRef.current = null;
    }
    connectionPollAttemptsRef.current = 0;
  }, []);

  const normalizeConnectionState = useCallback((value: unknown): string | null => {
    if (typeof value !== "string") return null;
    return value.trim().toLowerCase();
  }, []);

  const checkConnectionState = useCallback(async (runId: "pre-fix" | "post-fix" = "post-fix") => {
    const instanceName = evolutionForm.getValues("evolution_instance_name")?.trim();
    if (!instanceName) return;
    const { data, error } = await executeEvolutionProxy("connectionState", {
      instanceName,
    });
    if (error) {
      // #region agent log
      fetch("http://127.0.0.1:7243/ingest/bc96f30d-a63c-4828-beaf-5cec801979c8",{method:"POST",headers:{"Content-Type":"application/json","X-Debug-Session-Id":"ef5fa3"},body:JSON.stringify({sessionId:"ef5fa3",runId,hypothesisId:"H7",location:"src/pages/dashboard/ConfiguracoesPage.tsx:204",message:"connectionState request failed",data:{instanceName,errorMessage:error},timestamp:Date.now()})}).catch(()=>{})
      // #endregion
      return;
    }
    const res = data as { state?: unknown; instance?: { state?: unknown } } | null;
    const rawState = res?.state ?? res?.instance?.state ?? res;
    const normalizedState = normalizeConnectionState(rawState);
    // #region agent log
    fetch("http://127.0.0.1:7243/ingest/bc96f30d-a63c-4828-beaf-5cec801979c8",{method:"POST",headers:{"Content-Type":"application/json","X-Debug-Session-Id":"ef5fa3"},body:JSON.stringify({sessionId:"ef5fa3",runId,hypothesisId:"H6",location:"src/pages/dashboard/ConfiguracoesPage.tsx:213",message:"connectionState normalized",data:{instanceName,rawState:typeof rawState==="string"?rawState:"non-string",normalizedState},timestamp:Date.now()})}).catch(()=>{})
    // #endregion
    if (normalizedState) {
      setConnectionState(normalizedState);
    }
    if (normalizedState === "open") {
      setQrCodeBase64(null);
      stopConnectionPolling();
      // #region agent log
      fetch("http://127.0.0.1:7243/ingest/bc96f30d-a63c-4828-beaf-5cec801979c8",{method:"POST",headers:{"Content-Type":"application/json","X-Debug-Session-Id":"ef5fa3"},body:JSON.stringify({sessionId:"ef5fa3",runId,hypothesisId:"H5",location:"src/pages/dashboard/ConfiguracoesPage.tsx:224",message:"connection open; qr closed",data:{instanceName},timestamp:Date.now()})}).catch(()=>{})
      // #endregion
    }
  }, [evolutionForm, executeEvolutionProxy, normalizeConnectionState, stopConnectionPolling]);

  const empresaForm = useForm<EmpresaFormValues>({
    resolver: zodResolver(empresaFormSchema),
    defaultValues: {
      name: "",
      description: "",
      history: "",
    },
  });

  const dadosForm = useForm<DadosFormValues>({
    resolver: zodResolver(dadosFormSchema),
    defaultValues: {
      celular_atendimento: "",
      email_atendimento: "",
      estancia_whatsapp: "",
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

  // Buscar company_id
  useEffect(() => {
    async function init() {
      if (!userId) return;
      const cid = await fetchCompanyId(supabase, userId);
      setCompanyId(cid);
    }
    init();
  }, [userId, supabase]);

  // Carregar informações básicas da empresa (nome, apresentação, histórico)
  const loadEmpresa = useCallback(async () => {
    if (!companyId) {
      setIsFetchingEmpresa(false);
      return;
    }
    setIsFetchingEmpresa(true);
    try {
      const { data, error } = await supabase
        .from("companies")
        .select("name, description, history")
        .eq("id", companyId)
        .maybeSingle();

      if (error) throw error;
      const row = data as { name: string | null; description: string | null; history: string | null } | null;
      empresaForm.reset({
        name: row?.name ?? "",
        description: row?.description ?? "",
        history: row?.history ?? "",
      });
    } catch (err) {
      console.error("Erro ao carregar dados da empresa:", err);
      toast({
        variant: "destructive",
        title: "Erro",
        description: "Falha ao carregar informações da empresa.",
      });
    } finally {
      setIsFetchingEmpresa(false);
    }
  }, [companyId, supabase, toast, empresaForm]);

  useEffect(() => {
    loadEmpresa();
  }, [loadEmpresa]);

  // Carregar dados da empresa (celular, email atendimento)
  const loadDados = useCallback(async () => {
    if (!companyId) {
      setIsFetchingDados(false);
      return;
    }
    setIsFetchingDados(true);
    try {
      const { data, error } = await supabase
        .from("companies")
        .select("celular_atendimento, email_atendimento, estancia_whatsapp, whatsapp_group_image_url")
        .eq("id", companyId)
        .maybeSingle();

      if (error) throw error;
      const row = data as CompanyRow | null;
      dadosForm.reset({
        celular_atendimento: row?.celular_atendimento ?? "",
        email_atendimento: row?.email_atendimento ?? "",
        estancia_whatsapp: row?.estancia_whatsapp ?? "",
      });
      setWhatsappImageUrl(row?.whatsapp_group_image_url ?? null);
    } catch (err) {
      console.error("Erro ao carregar dados:", err);
      toast({
        variant: "destructive",
        title: "Erro",
        description: "Falha ao carregar dados da empresa.",
      });
    } finally {
      setIsFetchingDados(false);
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

  // Carregar configuração Evolution API (URL e API Key são configuradas apenas no Admin)
  const loadEvolution = useCallback(async () => {
    if (!companyId) {
      setIsFetchingEvolution(false);
      return;
    }
    setIsFetchingEvolution(true);
    try {
      const { data, error } = await supabase
        .from("companies")
        .select("evolution_instance_name")
        .eq("id", companyId)
        .maybeSingle();

      if (error) throw error;
      const row = data as { evolution_instance_name: string | null } | null;
      evolutionForm.reset({
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

  useEffect(() => {
    return () => {
      stopConnectionPolling();
    };
  }, [stopConnectionPolling]);

  // Salvar informações da empresa (aba Empresa)
  async function onEmpresaSubmit(values: EmpresaFormValues) {
    if (!companyId) {
      toast({
        variant: "destructive",
        title: "Erro",
        description: "Empresa não identificada.",
      });
      return;
    }
    setIsSavingEmpresa(true);
    try {
      const { error } = await supabase
        .from("companies")
        .update({
          name: values.name?.trim() || null,
          description: values.description?.trim() || null,
          history: values.history?.trim() || null,
        })
        .eq("id", companyId);

      if (error) throw error;

      toast({
        title: "Dados salvos",
        description: "As informações da empresa foram atualizadas.",
      });
    } catch (err) {
      toast({
        variant: "destructive",
        title: "Erro ao salvar",
        description: getErrorMessage(err),
      });
    } finally {
      setIsSavingEmpresa(false);
    }
  }

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

  // Salvar nome da instância Evolution (URL e API Key são configuradas apenas no Admin)
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
      const { error } = await supabase
        .from("companies")
        .update({
          evolution_instance_name: values.evolution_instance_name?.trim() || null,
        })
        .eq("id", companyId);

      if (error) throw error;

      toast({
        title: "Instância salva",
        description: "O nome da instância foi atualizado.",
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
    const webhookDebug = (res?._webhook ?? null) as
      | {
          configured?: boolean;
          attempts?: Array<{
            endpoint?: string;
            status?: number;
            ok?: boolean;
            responsePreview?: string;
          }>;
        }
      | null;
    if (action === "connect" && res) {
      const base64 = (res.base64 ?? res.code ?? res.pairingCode) as string | undefined;
      // #region agent log
      fetch("http://127.0.0.1:7243/ingest/bc96f30d-a63c-4828-beaf-5cec801979c8",{method:"POST",headers:{"Content-Type":"application/json","X-Debug-Session-Id":"ef5fa3"},body:JSON.stringify({sessionId:"ef5fa3",runId:"post-fix",hypothesisId:"H5",location:"src/pages/dashboard/ConfiguracoesPage.tsx:604",message:"connect response received",data:{instanceName:instanceName||null,hasBase64:Boolean(base64)},timestamp:Date.now()})}).catch(()=>{})
      // #endregion
      if (base64) {
        const src = typeof base64 === "string" && base64.startsWith("data:")
          ? base64
          : `data:image/png;base64,${base64}`;
        setQrCodeBase64(src);
        stopConnectionPolling();
        connectionPollAttemptsRef.current = 0;
        await checkConnectionState("post-fix");
        connectionPollIntervalRef.current = window.setInterval(() => {
          connectionPollAttemptsRef.current += 1;
          void checkConnectionState("post-fix");
          if (connectionPollAttemptsRef.current >= 24) {
            stopConnectionPolling();
          }
        }, 5000);
      } else {
        setQrCodeBase64(null);
        toast({
          variant: "destructive",
          title: "QR Code não retornado",
          description: "A Evolution API não retornou o QR Code. Verifique se a instância existe.",
        });
      }
    }
    if (action === "connectionState") {
      await checkConnectionState("post-fix");
    }
    if ((action === "create" || action === "connect") && webhookDebug) {
      const firstAttempt = webhookDebug.attempts?.[0];
      const attemptSummary = webhookDebug.attempts
        ?.map((a) => `${a.status ?? 0}${a.ok ? " OK" : " FAIL"}`)
        .join(" | ");
      toast({
        title: webhookDebug.configured ? "Webhook configurado" : "Webhook não configurado",
        description: webhookDebug.configured
          ? "A Evolution confirmou a configuração do webhook."
          : `Tentativas: ${attemptSummary ?? "sem detalhes"}${
              firstAttempt?.responsePreview ? ` | resposta: ${firstAttempt.responsePreview}` : ""
            }`,
      });
    }
    if (action === "logout") {
      stopConnectionPolling();
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
          <ProfileDropdown className="ml-auto" />
        </header>
        <div className="flex flex-1 flex-col gap-4 p-4">
          <Tabs defaultValue="empresa" className="w-full">
            <TabsList className="grid w-full max-w-[1000px] grid-cols-4">
              <TabsTrigger value="empresa" className="gap-2">
                <Building2 className="h-4 w-4" /> Empresa
              </TabsTrigger>
              <TabsTrigger value="dados" className="gap-2">
                <Database className="h-4 w-4" /> Dados
              </TabsTrigger>
              <TabsTrigger value="evolution" className="gap-2">
                <Smartphone className="h-4 w-4" /> Evolution API
              </TabsTrigger>
              <TabsTrigger value="anuncios" className="gap-2">
                <Megaphone className="h-4 w-4" /> Anúncios
              </TabsTrigger>
            </TabsList>

            <TabsContent value="empresa" className="space-y-4 pt-4">
              <Card>
                <CardHeader>
                  <CardTitle>Informações da empresa</CardTitle>
                  <CardDescription>
                    Nome, apresentação e histórico da sua empresa. Essas informações podem ser usadas em atendimentos e materiais.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {isFetchingEmpresa ? (
                    <div className="flex min-h-[120px] items-center justify-center">
                      <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                    </div>
                  ) : (
                    <form
                      onSubmit={empresaForm.handleSubmit(onEmpresaSubmit)}
                      className="grid gap-4 sm:grid-cols-2"
                    >
                      <div className="space-y-2 sm:col-span-2">
                        <Label htmlFor="empresa_name">Nome da empresa</Label>
                        <Input
                          id="empresa_name"
                          type="text"
                          placeholder="Ex: Minha Empresa Ltda"
                          {...empresaForm.register("name")}
                        />
                        {empresaForm.formState.errors.name && (
                          <p className="text-xs text-destructive">
                            {empresaForm.formState.errors.name.message}
                          </p>
                        )}
                      </div>
                      <div className="space-y-2 sm:col-span-2">
                        <Label htmlFor="empresa_description">Apresentação</Label>
                        <Textarea
                          id="empresa_description"
                          placeholder="Descreva sua empresa: o que faz, missão, diferenciais..."
                          rows={4}
                          className="resize-none"
                          {...empresaForm.register("description")}
                        />
                        {empresaForm.formState.errors.description && (
                          <p className="text-xs text-destructive">
                            {empresaForm.formState.errors.description?.message}
                          </p>
                        )}
                      </div>
                      <div className="space-y-2 sm:col-span-2">
                        <Label htmlFor="empresa_history">Histórico</Label>
                        <Textarea
                          id="empresa_history"
                          placeholder="Conte a história da empresa: fundação, marcos, evolução..."
                          rows={4}
                          className="resize-none"
                          {...empresaForm.register("history")}
                        />
                        {empresaForm.formState.errors.history && (
                          <p className="text-xs text-destructive">
                            {empresaForm.formState.errors.history?.message}
                          </p>
                        )}
                      </div>
                      <div className="sm:col-span-2">
                        <Button type="submit" disabled={isSavingEmpresa}>
                          {isSavingEmpresa ? (
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
                        <Label className="flex items-center gap-2">
                          <ImagePlus className="h-4 w-4" />
                          Imagem para grupos WhatsApp
                        </Label>
                        <p className="text-xs text-muted-foreground">
                          Imagem pequena para uso em grupos (máx. 1MB, JPEG/PNG/WebP)
                        </p>
                        <div className="flex items-center gap-4">
                          {whatsappImageUrl && (
                            <img
                              src={whatsappImageUrl}
                              alt="Imagem WhatsApp"
                              className="h-16 w-16 rounded-lg border object-cover"
                            />
                          )}
                          <input
                            ref={whatsappImageInputRef}
                            type="file"
                            accept="image/jpeg,image/png,image/webp,image/gif"
                            className="hidden"
                            onChange={async (e) => {
                              const file = e.target.files?.[0];
                              if (!file || !companyId) return;
                              if (file.size > 1048576) {
                                toast({
                                  variant: "destructive",
                                  title: "Arquivo grande",
                                  description: "Máximo 1MB.",
                                });
                                return;
                              }
                              setIsUploadingImage(true);
                              try {
                                const ext = file.name.split(".").pop() || "jpg";
                                const path = `${companyId}/whatsapp-group.${ext}`;
                                const { error: uploadError } = await supabase.storage
                                  .from("company-assets")
                                  .upload(path, file, { upsert: true });
                                if (uploadError) throw uploadError;
                                const { data: urlData } = supabase.storage
                                  .from("company-assets")
                                  .getPublicUrl(path);
                                const url = urlData.publicUrl;
                                const { error: updateError } = await supabase
                                  .from("companies")
                                  .update({ whatsapp_group_image_url: url })
                                  .eq("id", companyId);
                                if (updateError) throw updateError;
                                setWhatsappImageUrl(url);
                                toast({ title: "Imagem salva", description: "A imagem foi atualizada." });
                              } catch (err) {
                                toast({
                                  variant: "destructive",
                                  title: "Erro ao enviar",
                                  description: getErrorMessage(err),
                                });
                              } finally {
                                setIsUploadingImage(false);
                                e.target.value = "";
                              }
                            }}
                          />
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            disabled={isUploadingImage}
                            onClick={() => whatsappImageInputRef.current?.click()}
                          >
                            {isUploadingImage ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              "Selecionar imagem"
                            )}
                          </Button>
                        </div>
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

            <TabsContent value="evolution" className="space-y-4 pt-4">
              <Card>
                <CardHeader>
                  <CardTitle>Evolution API (WhatsApp)</CardTitle>
                  <CardDescription>
                    Crie uma instância e conecte via QR Code. A URL e a API Key da Evolution API são configuradas pelo administrador.
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
                        className="flex flex-wrap items-end gap-4"
                      >
                        <div className="space-y-2 min-w-[200px]">
                          <Label htmlFor="evolution_instance_name">
                            Nome da instância
                          </Label>
                          <Input
                            id="evolution_instance_name"
                            type="text"
                            placeholder="Ex: minha-empresa-whatsapp"
                            {...evolutionForm.register("evolution_instance_name")}
                          />
                        </div>
                        <Button type="submit" disabled={isSavingEvolution}>
                          {isSavingEvolution ? (
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
