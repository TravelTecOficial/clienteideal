import React, { useState, useEffect, useCallback, useRef } from "react";
import { Link } from "react-router-dom";
import { DashboardLink } from "@/components/DashboardLink";
import { useAuth } from "@clerk/clerk-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";

import { Plus, Loader2, Check, Database, Megaphone, Smartphone, ImagePlus, Building2, Trash2, Pencil, Plug2, MapPin, MessageSquare, Sparkles } from "lucide-react";

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
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useSupabaseClient } from "@/lib/supabase-context";
import { useEffectiveCompanyId } from "@/hooks/use-effective-company-id";
import { cn, getErrorMessage } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { useEvolutionProxy } from "@/hooks/use-evolution-proxy";
import { ChatBriefingModal } from "@/components/chat-briefing/ChatBriefingModal";

// --- Interfaces ---
interface CompanyRow {
  name: string | null;
  nome_fantasia: string | null;
  cnpj: string | null;
  logradouro: string | null;
  numero: string | null;
  bairro: string | null;
  cidade: string | null;
  uf: string | null;
  cep: string | null;
  site_oficial: string | null;
  celular_atendimento: string | null;
  email_atendimento: string | null;
  horario_funcionamento: string | null;
  instagram_url: string | null;
  facebook_url: string | null;
  linkedin_url: string | null;
  estancia_whatsapp: string | null;
  whatsapp_group_image_url: string | null;
  evolution_instance_name: string | null;
  support_access_enabled?: boolean | null;
}

interface Pagamento {
  id: string;
  data: string;
  plataforma: string;
  valor: number;
}

interface Campanha {
  id: string;
  nome: string;
  campaign_id: string;
  plataforma: string;
  ideal_customer_id: string | null;
  ideal_customers?: { profile_name: string | null } | null;
}

interface IdealCustomerOption {
  id: string;
  profile_name: string | null;
}

// --- Helpers ---
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
  name: z.string().min(1, "Razão Social é obrigatória"),
  nome_fantasia: z.string().optional(),
  cnpj: z.string().optional(),
  logradouro: z.string().optional(),
  numero: z.string().optional(),
  bairro: z.string().optional(),
  cidade: z.string().optional(),
  uf: z.string().optional(),
  cep: z.string().optional(),
  site_oficial: z.string().optional(),
  celular_atendimento: z.string().optional(),
  email_atendimento: z
    .union([z.string().email("E-mail inválido"), z.literal("")])
    .optional(),
  horario_funcionamento: z.string().optional(),
  instagram_url: z.string().optional(),
  facebook_url: z.string().optional(),
  linkedin_url: z.string().optional(),
});

const dadosFormSchema = z.object({
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

const campanhaFormSchema = z.object({
  nome: z.string().min(1, "Nome da campanha é obrigatório"),
  campaign_id: z.string().min(1, "ID da campanha é obrigatório"),
  plataforma: z.string().min(1, "Selecione a plataforma"),
  ideal_customer_id: z.string().optional(),
});

type EmpresaFormValues = z.infer<typeof empresaFormSchema>;
type DadosFormValues = z.infer<typeof dadosFormSchema>;
type PagamentoFormValues = z.infer<typeof pagamentoFormSchema>;
type CampanhaFormValues = z.infer<typeof campanhaFormSchema>;
type EvolutionFormValues = z.infer<typeof evolutionFormSchema>;

const PLATAFORMA_OPTIONS = [
  { value: "Google Ads", label: "Google Ads" },
  { value: "Meta Ads", label: "Meta Ads" },
] as const;

const PLATAFORMA_CAMPANHA_OPTIONS = [
  { value: "Google Ads", label: "Google Ads" },
  { value: "Meta Ads", label: "Meta Ads" },
  { value: "TikTok Ads", label: "TikTok Ads" },
  { value: "LinkedIn Ads", label: "LinkedIn Ads" },
  { value: "Outro", label: "Outro" },
] as const;

// --- Component ---
export function ConfiguracoesPage() {
  const { userId } = useAuth();
  const supabase = useSupabaseClient();
  const { toast } = useToast();
  const companyId = useEffectiveCompanyId();
  const [isFetchingEmpresa, setIsFetchingEmpresa] = useState(true);
  const [isSavingEmpresa, setIsSavingEmpresa] = useState(false);
  const [isFetchingDados, setIsFetchingDados] = useState(true);
  const [isSavingDados, setIsSavingDados] = useState(false);
  const [supportAccessEnabled, setSupportAccessEnabled] = useState(true);
  const [isSavingSupportAccess, setIsSavingSupportAccess] = useState(false);
  const [pagamentos, setPagamentos] = useState<Pagamento[]>([]);
  const [isFetchingPagamentos, setIsFetchingPagamentos] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSavingPagamento, setIsSavingPagamento] = useState(false);
  const [campanhas, setCampanhas] = useState<Campanha[]>([]);
  const [idealCustomers, setIdealCustomers] = useState<IdealCustomerOption[]>([]);
  const [isFetchingCampanhas, setIsFetchingCampanhas] = useState(true);
  const [isModalCampanhaOpen, setIsModalCampanhaOpen] = useState(false);
  const [editingCampanha, setEditingCampanha] = useState<Campanha | null>(null);
  const [isSavingCampanha, setIsSavingCampanha] = useState(false);
  const [isFetchingEvolution, setIsFetchingEvolution] = useState(true);
  const [isSavingEvolution, setIsSavingEvolution] = useState(false);
  const [qrCodeBase64, setQrCodeBase64] = useState<string | null>(null);
  const [connectionState, setConnectionState] = useState<string | null>(null);
  const connectionPollIntervalRef = useRef<number | null>(null);
  const connectionPollAttemptsRef = useRef(0);
  const [whatsappImageUrl, setWhatsappImageUrl] = useState<string | null>(null);
  const [isUploadingImage, setIsUploadingImage] = useState(false);
  const whatsappImageInputRef = useRef<HTMLInputElement>(null);
  const [briefingCompleted, setBriefingCompleted] = useState(false);
  const [isBriefingModalOpen, setIsBriefingModalOpen] = useState(false);
  const [googleAdsOAuthOpen, setGoogleAdsOAuthOpen] = useState(false);
  const [googleAdsOAuthStep, setGoogleAdsOAuthStep] = useState<"login" | "account" | "success">("login");
  const [googleAdsOAuthEmail, setGoogleAdsOAuthEmail] = useState("");
  const [googleAdsSelectedAccount, setGoogleAdsSelectedAccount] = useState<string | null>(null);
  const [isGoogleAdsConnecting, setIsGoogleAdsConnecting] = useState(false);

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

  const checkConnectionState = useCallback(async () => {
    const instanceName = evolutionForm.getValues("evolution_instance_name")?.trim();
    if (!instanceName) return;
    const { data, error } = await executeEvolutionProxy("connectionState", {
      instanceName,
    });
    if (error) {
      return;
    }
    const res = data as { state?: unknown; instance?: { state?: unknown } } | null;
    const rawState = res?.state ?? res?.instance?.state ?? res;
    const normalizedState = normalizeConnectionState(rawState);
    if (normalizedState) {
      setConnectionState(normalizedState);
    }
    if (normalizedState === "open") {
      setQrCodeBase64(null);
      stopConnectionPolling();
    }
  }, [evolutionForm, executeEvolutionProxy, normalizeConnectionState, stopConnectionPolling]);

  const empresaForm = useForm<EmpresaFormValues>({
    resolver: zodResolver(empresaFormSchema),
    defaultValues: {
      name: "",
      nome_fantasia: "",
      cnpj: "",
      logradouro: "",
      numero: "",
      bairro: "",
      cidade: "",
      uf: "",
      cep: "",
      site_oficial: "",
      celular_atendimento: "",
      email_atendimento: "",
      horario_funcionamento: "",
      instagram_url: "",
      facebook_url: "",
      linkedin_url: "",
    },
  });

  const dadosForm = useForm<DadosFormValues>({
    resolver: zodResolver(dadosFormSchema),
    defaultValues: {
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

  const campanhaForm = useForm<CampanhaFormValues>({
    resolver: zodResolver(campanhaFormSchema),
    defaultValues: {
      nome: "",
      campaign_id: "",
      plataforma: "",
      ideal_customer_id: "",
    },
  });

  // Carregar informações cadastrais da empresa
  const loadEmpresa = useCallback(async () => {
    if (!companyId) {
      setIsFetchingEmpresa(false);
      return;
    }
    setIsFetchingEmpresa(true);
    try {
      const { data, error } = await supabase
        .from("companies")
        .select(
          "name, nome_fantasia, cnpj, logradouro, numero, bairro, cidade, uf, cep, " +
          "site_oficial, celular_atendimento, email_atendimento, horario_funcionamento, " +
          "instagram_url, facebook_url, linkedin_url"
        )
        .eq("id", companyId)
        .maybeSingle();

      if (error) throw error;
      const row = data as Partial<CompanyRow> | null;
      empresaForm.reset({
        name: row?.name ?? "",
        nome_fantasia: row?.nome_fantasia ?? "",
        cnpj: row?.cnpj ?? "",
        logradouro: row?.logradouro ?? "",
        numero: row?.numero ?? "",
        bairro: row?.bairro ?? "",
        cidade: row?.cidade ?? "",
        uf: row?.uf ?? "",
        cep: row?.cep ?? "",
        site_oficial: row?.site_oficial ?? "",
        celular_atendimento: row?.celular_atendimento ?? "",
        email_atendimento: row?.email_atendimento ?? "",
        horario_funcionamento: row?.horario_funcionamento ?? "",
        instagram_url: row?.instagram_url ?? "",
        facebook_url: row?.facebook_url ?? "",
        linkedin_url: row?.linkedin_url ?? "",
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
        .select("celular_atendimento, email_atendimento, estancia_whatsapp, whatsapp_group_image_url, support_access_enabled")
        .eq("id", companyId)
        .maybeSingle();

      if (error) throw error;
      const row = data as CompanyRow | null;
      dadosForm.reset({
        celular_atendimento: row?.celular_atendimento ?? "",
        email_atendimento: row?.email_atendimento ?? "",
        estancia_whatsapp: row?.estancia_whatsapp ?? "",
      });
      setSupportAccessEnabled(Boolean(row?.support_access_enabled ?? true));
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

  // Carregar Personas (Clientes Ideais)
  const loadIdealCustomers = useCallback(async () => {
    if (!companyId) {
      setIdealCustomers([]);
      return;
    }
    try {
      const { data, error } = await supabase
        .from("ideal_customers")
        .select("id, profile_name")
        .eq("company_id", companyId)
        .order("profile_name", { ascending: true });

      if (error) throw error;
      setIdealCustomers((data as IdealCustomerOption[]) ?? []);
    } catch (err) {
      console.error("Erro ao carregar Personas:", err);
      setIdealCustomers([]);
    }
  }, [companyId, supabase]);

  useEffect(() => {
    loadIdealCustomers();
  }, [loadIdealCustomers]);

  // Carregar campanhas
  const loadCampanhas = useCallback(async () => {
    if (!companyId) {
      setIsFetchingCampanhas(false);
      setCampanhas([]);
      return;
    }
    setIsFetchingCampanhas(true);
    try {
      const { data, error } = await supabase
        .from("campanhas_anuncios")
        .select("id, nome, campaign_id, plataforma, ideal_customer_id, ideal_customers(profile_name)")
        .eq("company_id", companyId)
        .order("nome", { ascending: true });

      if (error) throw error;
      setCampanhas((data as Campanha[]) ?? []);
    } catch (err) {
      console.error("Erro ao carregar campanhas:", err);
      toast({
        variant: "destructive",
        title: "Erro",
        description: "Falha ao carregar campanhas.",
      });
      setCampanhas([]);
    } finally {
      setIsFetchingCampanhas(false);
    }
  }, [companyId, supabase, toast]);

  useEffect(() => {
    loadCampanhas();
  }, [loadCampanhas]);

  // Carregar status do briefing (company_briefing_responses: count > 0 = realizado)
  const loadBriefingStatus = useCallback(async () => {
    if (!companyId) {
      setBriefingCompleted(false);
      return;
    }
    try {
      const { count, error } = await supabase
        .from("company_briefing_responses")
        .select("id", { count: "exact", head: true })
        .eq("company_id", companyId);

      if (error) throw error;
      setBriefingCompleted((count ?? 0) > 0);
    } catch {
      setBriefingCompleted(false);
    }
  }, [companyId, supabase]);

  useEffect(() => {
    loadBriefingStatus();
  }, [loadBriefingStatus]);

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
          nome_fantasia: values.nome_fantasia?.trim() || null,
          cnpj: values.cnpj?.trim() || null,
          logradouro: values.logradouro?.trim() || null,
          numero: values.numero?.trim() || null,
          bairro: values.bairro?.trim() || null,
          cidade: values.cidade?.trim() || null,
          uf: values.uf?.trim() || null,
          cep: values.cep?.trim() || null,
          site_oficial: values.site_oficial?.trim() || null,
          celular_atendimento: values.celular_atendimento?.trim() || null,
          email_atendimento: values.email_atendimento?.trim() || null,
          horario_funcionamento: values.horario_funcionamento?.trim() || null,
          instagram_url: values.instagram_url?.trim() || null,
          facebook_url: values.facebook_url?.trim() || null,
          linkedin_url: values.linkedin_url?.trim() || null,
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

  // Buscar endereço por CEP (ViaCEP - API pública, sem credenciais)
  async function handleBuscarCep() {
    const cep = empresaForm.getValues("cep")?.replace(/\D/g, "") ?? "";
    if (cep.length !== 8) {
      toast({
        variant: "destructive",
        title: "CEP inválido",
        description: "Informe um CEP com 8 dígitos.",
      });
      return;
    }
    try {
      const res = await fetch(`https://viacep.com.br/ws/${cep}/json/`);
      const data = await res.json();
      if (data.erro) {
        toast({
          variant: "destructive",
          title: "CEP não encontrado",
          description: "Verifique o CEP informado.",
        });
        return;
      }
      empresaForm.setValue("logradouro", data.logradouro ?? "");
      empresaForm.setValue("bairro", data.bairro ?? "");
      empresaForm.setValue("cidade", data.localidade ?? "");
      empresaForm.setValue("uf", data.uf ?? "");
      toast({
        title: "Endereço preenchido",
        description: "Os campos foram preenchidos com base no CEP.",
      });
    } catch {
      toast({
        variant: "destructive",
        title: "Erro",
        description: "Falha ao buscar endereço. Tente novamente.",
      });
    }
  }

  // Salvar dados (aba Dados - Estância WhatsApp e imagem)
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
          estancia_whatsapp: values.estancia_whatsapp?.trim() || null,
        })
        .eq("id", companyId);

      if (error) throw error;

      toast({
        title: "Dados salvos",
        description: "As informações de integração foram atualizadas.",
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

  async function onSupportAccessChange(enabled: boolean) {
    if (!companyId) {
      toast({
        variant: "destructive",
        title: "Erro",
        description: "Empresa não identificada.",
      });
      return;
    }

    const previousValue = supportAccessEnabled;
    setSupportAccessEnabled(enabled);
    setIsSavingSupportAccess(true);
    try {
      const { error } = await supabase
        .from("companies")
        .update({ support_access_enabled: enabled })
        .eq("id", companyId);

      if (error) throw error;

      toast({
        title: enabled ? "Acesso de suporte habilitado" : "Acesso de suporte desabilitado",
        description: enabled
          ? "O suporte da Cliente Ideal pode acessar esta licença."
          : "O suporte da Cliente Ideal não poderá acessar esta licença.",
      });
    } catch (err) {
      setSupportAccessEnabled(previousValue);
      toast({
        variant: "destructive",
        title: "Erro ao atualizar acesso de suporte",
        description: getErrorMessage(err),
      });
    } finally {
      setIsSavingSupportAccess(false);
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

  // Salvar campanha (modal) - criar ou editar
  async function onCampanhaSubmit(values: CampanhaFormValues) {
    if (!companyId) {
      toast({
        variant: "destructive",
        title: "Erro",
        description: "Empresa não identificada.",
      });
      return;
    }
    setIsSavingCampanha(true);
    try {
      const payload = {
        nome: values.nome.trim(),
        campaign_id: values.campaign_id.trim(),
        plataforma: values.plataforma,
        ideal_customer_id: values.ideal_customer_id?.trim() || null,
      };

      if (editingCampanha) {
        const { error } = await supabase
          .from("campanhas_anuncios")
          .update(payload)
          .eq("id", editingCampanha.id)
          .eq("company_id", companyId);

        if (error) throw error;

        toast({
          title: "Campanha atualizada",
          description: "A campanha foi atualizada com sucesso.",
        });
      } else {
        const { error } = await supabase.from("campanhas_anuncios").insert({
          company_id: companyId,
          ...payload,
        });

        if (error) throw error;

        toast({
          title: "Campanha cadastrada",
          description: "A campanha foi registrada com sucesso.",
        });
      }

      setIsModalCampanhaOpen(false);
      setEditingCampanha(null);
      campanhaForm.reset({
        nome: "",
        campaign_id: "",
        plataforma: "",
        ideal_customer_id: "",
      });
      loadCampanhas();
    } catch (err) {
      toast({
        variant: "destructive",
        title: editingCampanha ? "Erro ao atualizar" : "Erro ao cadastrar",
        description: getErrorMessage(err),
      });
    } finally {
      setIsSavingCampanha(false);
    }
  }

  // Abrir modal para editar campanha
  function openCampanhaEdit(c: Campanha) {
    setEditingCampanha(c);
    campanhaForm.reset({
      nome: c.nome,
      campaign_id: c.campaign_id,
      plataforma: c.plataforma,
      ideal_customer_id: c.ideal_customer_id ?? "",
    });
    setIsModalCampanhaOpen(true);
  }

  // Excluir campanha
  async function onCampanhaDelete(id: string) {
    if (!companyId) return;
    try {
      const { error } = await supabase.from("campanhas_anuncios").delete().eq("id", id).eq("company_id", companyId);

      if (error) throw error;

      toast({
        title: "Campanha excluída",
        description: "A campanha foi removida.",
      });
      loadCampanhas();
    } catch (err) {
      toast({
        variant: "destructive",
        title: "Erro ao excluir",
        description: getErrorMessage(err),
      });
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
    action: "create" | "connect" | "connectionState" | "fetchInstances" | "logout" | "setWebhook"
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
      if (base64) {
        const src = typeof base64 === "string" && base64.startsWith("data:")
          ? base64
          : `data:image/png;base64,${base64}`;
        setQrCodeBase64(src);
        stopConnectionPolling();
        connectionPollAttemptsRef.current = 0;
        await checkConnectionState();
        connectionPollIntervalRef.current = window.setInterval(() => {
          connectionPollAttemptsRef.current += 1;
          void checkConnectionState();
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
      await checkConnectionState();
    }
    // Só exibe toast de webhook quando NÃO está configurado (problema). Quando OK, evita banner redundante.
    if ((action === "create" || action === "connect") && webhookDebug && !webhookDebug.configured) {
      const firstAttempt = webhookDebug.attempts?.[0];
      const attemptSummary = webhookDebug.attempts
        ?.map((a) => `${a.status ?? 0}${a.ok ? " OK" : " FAIL"}`)
        .join(" | ");
      toast({
        title: "Webhook não configurado",
        description: `Tentativas: ${attemptSummary ?? "sem detalhes"}${
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
    if (action === "setWebhook") {
      if (webhookDebug?.configured) {
        toast({
          title: "Webhook configurado",
          description: "O webhook foi registrado na Evolution API (MESSAGES_UPSERT, base64).",
        });
      } else if (webhookDebug && !webhookDebug.configured) {
        const firstAttempt = webhookDebug.attempts?.[0];
        const attemptSummary = webhookDebug.attempts
          ?.map((a) => `${a.status ?? 0}${a.ok ? " OK" : " FAIL"}`)
          .join(" | ");
        toast({
          variant: "destructive",
          title: "Webhook não configurado",
          description: `Tentativas: ${attemptSummary ?? "sem detalhes"}${
            firstAttempt?.responsePreview ? ` | resposta: ${firstAttempt.responsePreview}` : ""
          }`,
        });
      }
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
                  <DashboardLink>Dashboard</DashboardLink>
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
            <TabsList className="grid w-full max-w-[1200px] grid-cols-5">
              <TabsTrigger value="empresa" className="gap-2">
                <Building2 className="h-4 w-4" /> Empresa
              </TabsTrigger>
              <TabsTrigger value="dados" className="gap-2">
                <Database className="h-4 w-4" /> Dados
              </TabsTrigger>
              <TabsTrigger value="integracoes" className="gap-2">
                <Plug2 className="h-4 w-4" /> Integrações
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
                  <div className="flex flex-1 items-center justify-between gap-4">
                    <div className="space-y-1.5">
                      <CardTitle className="flex items-center gap-2">
                        <Sparkles className="h-5 w-5 text-primary" />
                        Prepare sua Estratégia de IA
                      </CardTitle>
                      <CardDescription>
                        Para que seu SDR e suas campanhas sejam eficientes, precisamos entender o DNA do seu negócio. Vamos fazer seu briefing agora?
                      </CardDescription>
                    </div>
                    {briefingCompleted && (
                      <Badge variant="secondary" className="shrink-0">
                        Briefing Realizado
                      </Badge>
                    )}
                  </div>
                </CardHeader>
                <CardContent>
                  <Button
                    type="button"
                    onClick={() => setIsBriefingModalOpen(true)}
                    disabled={!companyId}
                    className="gap-2"
                  >
                    <MessageSquare className="h-4 w-4" />
                    Iniciar Chat de Briefing
                  </Button>
                </CardContent>
              </Card>

              <ChatBriefingModal
                open={isBriefingModalOpen}
                onOpenChange={setIsBriefingModalOpen}
                companyId={companyId}
                onCompleted={loadBriefingStatus}
              />

              <Card>
                <CardHeader>
                  <CardTitle>Informações da empresa</CardTitle>
                  <CardDescription>
                    Dados cadastrais estruturados da sua empresa.
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
                      className="space-y-6"
                    >
                      {/* Bloco Institucional */}
                      <div className="space-y-4">
                        <h4 className="text-sm font-medium text-foreground">Institucional</h4>
                        <div className="grid gap-4 sm:grid-cols-2">
                          <div className="space-y-2">
                            <Label htmlFor="empresa_name">Razão Social</Label>
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
                          <div className="space-y-2">
                            <Label htmlFor="empresa_nome_fantasia">Nome Fantasia</Label>
                            <Input
                              id="empresa_nome_fantasia"
                              type="text"
                              placeholder="Ex: Minha Empresa"
                              {...empresaForm.register("nome_fantasia")}
                            />
                          </div>
                          <div className="space-y-2 sm:col-span-2">
                            <Label htmlFor="empresa_cnpj">CNPJ (opcional)</Label>
                            <Input
                              id="empresa_cnpj"
                              type="text"
                              placeholder="00.000.000/0001-00"
                              {...empresaForm.register("cnpj")}
                            />
                          </div>
                        </div>
                      </div>

                      {/* Bloco Localização */}
                      <div className="space-y-4">
                        <h4 className="text-sm font-medium text-foreground">Localização</h4>
                        <div className="grid gap-4 sm:grid-cols-2">
                          <div className="space-y-2 sm:col-span-2 flex gap-2">
                            <div className="flex-1 space-y-2">
                              <Label htmlFor="empresa_cep">CEP</Label>
                              <Input
                                id="empresa_cep"
                                type="text"
                                placeholder="00000-000"
                                {...empresaForm.register("cep")}
                              />
                            </div>
                            <div className="flex items-end">
                              <Button
                                type="button"
                                variant="outline"
                                onClick={handleBuscarCep}
                                className="gap-2"
                              >
                                <MapPin className="h-4 w-4" />
                                Buscar por CEP
                              </Button>
                            </div>
                          </div>
                          <div className="space-y-2 sm:col-span-2">
                            <Label htmlFor="empresa_logradouro">Logradouro</Label>
                            <Input
                              id="empresa_logradouro"
                              type="text"
                              placeholder="Rua, Avenida..."
                              {...empresaForm.register("logradouro")}
                            />
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor="empresa_numero">Número</Label>
                            <Input
                              id="empresa_numero"
                              type="text"
                              placeholder="123"
                              {...empresaForm.register("numero")}
                            />
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor="empresa_bairro">Bairro</Label>
                            <Input
                              id="empresa_bairro"
                              type="text"
                              placeholder="Centro"
                              {...empresaForm.register("bairro")}
                            />
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor="empresa_cidade">Cidade</Label>
                            <Input
                              id="empresa_cidade"
                              type="text"
                              placeholder="São Paulo"
                              {...empresaForm.register("cidade")}
                            />
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor="empresa_uf">UF</Label>
                            <Input
                              id="empresa_uf"
                              type="text"
                              placeholder="SP"
                              maxLength={2}
                              {...empresaForm.register("uf")}
                            />
                          </div>
                        </div>
                      </div>

                      {/* Bloco Contato e Presença */}
                      <div className="space-y-4">
                        <h4 className="text-sm font-medium text-foreground">Contato e Presença</h4>
                        <div className="grid gap-4 sm:grid-cols-2">
                          <div className="space-y-2 sm:col-span-2">
                            <Label htmlFor="empresa_site">Site Oficial</Label>
                            <Input
                              id="empresa_site"
                              type="url"
                              placeholder="https://www.empresa.com.br"
                              {...empresaForm.register("site_oficial")}
                            />
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor="empresa_email">E-mail Principal</Label>
                            <Input
                              id="empresa_email"
                              type="email"
                              placeholder="contato@empresa.com.br"
                              {...empresaForm.register("email_atendimento")}
                            />
                            {empresaForm.formState.errors.email_atendimento && (
                              <p className="text-xs text-destructive">
                                {empresaForm.formState.errors.email_atendimento.message}
                              </p>
                            )}
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor="empresa_celular">Telefone/WhatsApp de Atendimento</Label>
                            <Input
                              id="empresa_celular"
                              type="tel"
                              placeholder="(00) 00000-0000"
                              {...empresaForm.register("celular_atendimento")}
                            />
                          </div>
                        </div>
                      </div>

                      {/* Bloco Operação */}
                      <div className="space-y-4">
                        <h4 className="text-sm font-medium text-foreground">Operação</h4>
                        <div className="space-y-2">
                          <Label htmlFor="empresa_horario">Horário de Funcionamento</Label>
                          <Input
                            id="empresa_horario"
                            type="text"
                            placeholder="Ex: Segunda a Sexta, 08h às 18h"
                            {...empresaForm.register("horario_funcionamento")}
                          />
                        </div>
                      </div>

                      {/* Redes Sociais */}
                      <div className="space-y-4">
                        <h4 className="text-sm font-medium text-foreground">Redes Sociais</h4>
                        <div className="grid gap-4 sm:grid-cols-2">
                          <div className="space-y-2">
                            <Label htmlFor="empresa_instagram">Instagram</Label>
                            <Input
                              id="empresa_instagram"
                              type="url"
                              placeholder="https://instagram.com/empresa"
                              {...empresaForm.register("instagram_url")}
                            />
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor="empresa_facebook">Facebook</Label>
                            <Input
                              id="empresa_facebook"
                              type="url"
                              placeholder="https://facebook.com/empresa"
                              {...empresaForm.register("facebook_url")}
                            />
                          </div>
                          <div className="space-y-2 sm:col-span-2">
                            <Label htmlFor="empresa_linkedin">LinkedIn</Label>
                            <Input
                              id="empresa_linkedin"
                              type="url"
                              placeholder="https://linkedin.com/company/empresa"
                              {...empresaForm.register("linkedin_url")}
                            />
                          </div>
                        </div>
                      </div>

                      <div className="pt-2">
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
                  <CardTitle>Dados de integração</CardTitle>
                  <CardDescription>
                    Estância Whatsapp e imagem para grupos. Celular e e-mail estão na aba Empresa.
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
                      <div className="sm:col-span-2 rounded-lg border border-red-200 bg-red-50/70 p-4">
                        <div className="flex items-center justify-between gap-4">
                          <div className="space-y-1">
                            <Label htmlFor="support_access_enabled" className="text-sm font-semibold text-red-900">
                              Liberar acesso do suporte Cliente Ideal
                            </Label>
                            <p className="text-xs text-red-800">
                              Quando habilitado, o suporte pode abrir seu dashboard no Admin para implantação e atendimento.
                            </p>
                          </div>
                          <Switch
                            id="support_access_enabled"
                            checked={supportAccessEnabled}
                            disabled={isSavingSupportAccess}
                            onCheckedChange={onSupportAccessChange}
                          />
                        </div>
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

            <TabsContent value="integracoes" className="space-y-4 pt-4">
              <Card>
                <CardHeader>
                  <CardTitle>Integrações</CardTitle>
                  <CardDescription>
                    Conecte suas plataformas de marketing e vendas. Em breve você poderá integrar com os principais serviços.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid gap-4 sm:grid-cols-2">
                    {/* Google Ads - Simulado OAuth */}
                    <Card>
                      <CardHeader className="flex flex-row items-center gap-4 pb-2">
                        <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-muted text-2xl">
                          🔍
                        </div>
                        <div className="flex-1 space-y-1">
                          <CardTitle className="text-base">Google Ads</CardTitle>
                          <CardDescription>Google Ads</CardDescription>
                        </div>
                        <div className="flex items-center gap-2">
                          <Button
                            size="sm"
                            onClick={() => {
                              setGoogleAdsOAuthStep("login");
                              setGoogleAdsOAuthEmail("");
                              setGoogleAdsSelectedAccount(null);
                              setGoogleAdsOAuthOpen(true);
                            }}
                          >
                            Conectar Google Ads
                          </Button>
                        </div>
                      </CardHeader>
                    </Card>
                    {[
                      {
                        id: "meta-ads",
                        name: "Meta Ads",
                        icon: "📱",
                        description: "Facebook e Instagram Ads",
                      },
                      {
                        id: "google-meu-negocio",
                        name: "Google Meu Negócio",
                        icon: "📍",
                        description: "Google Meu Negócio",
                      },
                      {
                        id: "rd-station",
                        name: "RD Station",
                        icon: "📊",
                        description: "RD Station Marketing",
                      },
                    ].map((platform) => (
                      <Card key={platform.id}>
                        <CardHeader className="flex flex-row items-center gap-4 pb-2">
                          <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-muted text-2xl">
                            {platform.icon}
                          </div>
                          <div className="flex-1 space-y-1">
                            <CardTitle className="text-base">{platform.name}</CardTitle>
                            <CardDescription>{platform.description}</CardDescription>
                          </div>
                          <div className="flex items-center gap-2">
                            <Badge variant="secondary">Em breve</Badge>
                            <Button disabled size="sm">
                              Conectar
                            </Button>
                          </div>
                        </CardHeader>
                      </Card>
                    ))}
                  </div>
                </CardContent>
              </Card>

              {/* Modal simulado OAuth Google Ads */}
              <Dialog
                open={googleAdsOAuthOpen}
                onOpenChange={(open) => {
                  setGoogleAdsOAuthOpen(open);
                  if (!open) {
                    setGoogleAdsOAuthStep("login");
                    setGoogleAdsOAuthEmail("");
                    setGoogleAdsSelectedAccount(null);
                  }
                }}
              >
                <DialogContent className="max-w-md">
                  {googleAdsOAuthStep === "login" && (
                    <>
                      <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                          <span className="flex h-8 w-8 items-center justify-center rounded bg-[#4285F4] text-white text-sm font-bold">
                            G
                          </span>
                          Conectar Google Ads
                        </DialogTitle>
                        <DialogDescription>
                          Faça login com sua conta Google para conectar o Google Ads.
                        </DialogDescription>
                      </DialogHeader>
                      <div className="space-y-4 py-4">
                        <div className="space-y-2">
                          <Label htmlFor="google-oauth-email">E-mail ou telefone</Label>
                          <Input
                            id="google-oauth-email"
                            type="email"
                            placeholder="seu@email.com"
                            value={googleAdsOAuthEmail}
                            onChange={(e) => setGoogleAdsOAuthEmail(e.target.value)}
                            className="border-2"
                          />
                        </div>
                        <p className="text-xs text-muted-foreground">
                          Simulado: digite qualquer e-mail para continuar.
                        </p>
                      </div>
                      <DialogFooter>
                        <Button
                          onClick={() => {
                            if (googleAdsOAuthEmail.trim()) {
                              setGoogleAdsOAuthStep("account");
                            } else {
                              toast({
                                title: "Informe o e-mail",
                                description: "Digite um e-mail para continuar o login.",
                                variant: "destructive",
                              });
                            }
                          }}
                          className="w-full sm:w-auto"
                        >
                          Próximo
                        </Button>
                      </DialogFooter>
                    </>
                  )}
                  {googleAdsOAuthStep === "account" && (
                    <>
                      <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                          <span className="flex h-8 w-8 items-center justify-center rounded bg-[#4285F4] text-white text-sm font-bold">
                            G
                          </span>
                          Escolher conta
                        </DialogTitle>
                        <DialogDescription>
                          Selecione a conta do Google Ads que deseja conectar.
                        </DialogDescription>
                      </DialogHeader>
                      <div className="space-y-2 py-4">
                        {[
                          { id: "acc-1", name: "Empresa XYZ", customerId: "123-456-7890" },
                          { id: "acc-2", name: "Minha Conta Ads", customerId: "987-654-3210" },
                          { id: "acc-3", name: "Agência Digital", customerId: "555-123-4567" },
                        ].map((acc) => (
                          <button
                            key={acc.id}
                            type="button"
                            onClick={() => setGoogleAdsSelectedAccount(acc.id)}
                            className={cn(
                              "flex w-full items-center justify-between rounded-lg border-2 p-4 text-left transition-colors",
                              googleAdsSelectedAccount === acc.id
                                ? "border-[#4285F4] bg-[#4285F4]/5"
                                : "border-border hover:border-muted-foreground/30"
                            )}
                          >
                            <div>
                              <p className="font-medium">{acc.name}</p>
                              <p className="text-sm text-muted-foreground">
                                ID: {acc.customerId}
                              </p>
                            </div>
                            {googleAdsSelectedAccount === acc.id && (
                              <Check className="h-5 w-5 text-[#4285F4]" />
                            )}
                          </button>
                        ))}
                      </div>
                      <DialogFooter>
                        <Button
                          variant="outline"
                          onClick={() => setGoogleAdsOAuthStep("login")}
                        >
                          Voltar
                        </Button>
                        <Button
                          disabled={!googleAdsSelectedAccount || isGoogleAdsConnecting}
                          onClick={async () => {
                            setIsGoogleAdsConnecting(true);
                            await new Promise((r) => setTimeout(r, 1500));
                            setIsGoogleAdsConnecting(false);
                            setGoogleAdsOAuthStep("success");
                            toast({
                              title: "Google Ads conectado",
                              description: "A integração foi configurada com sucesso (simulado).",
                            });
                          }}
                        >
                          {isGoogleAdsConnecting ? (
                            <>
                              <Loader2 className="h-4 w-4 animate-spin" />
                              Conectando…
                            </>
                          ) : (
                            "Conectar"
                          )}
                        </Button>
                      </DialogFooter>
                    </>
                  )}
                  {googleAdsOAuthStep === "success" && (
                    <>
                      <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                          <Check className="h-8 w-8 text-success" />
                          Conectado com sucesso
                        </DialogTitle>
                        <DialogDescription>
                          Sua conta Google Ads foi conectada. Esta é uma simulação — em produção, os dados seriam sincronizados via API.
                        </DialogDescription>
                      </DialogHeader>
                      <DialogFooter>
                        <Button onClick={() => setGoogleAdsOAuthOpen(false)}>
                          Fechar
                        </Button>
                      </DialogFooter>
                    </>
                  )}
                </DialogContent>
              </Dialog>
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
                            onClick={() => handleEvolutionAction("setWebhook")}
                            disabled={!evolutionForm.watch("evolution_instance_name")?.trim()}
                            title="Reconfigurar webhook na Evolution (MESSAGES_UPSERT, base64)"
                          >
                            Configurar webhook
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
              <div className="flex flex-col gap-6">
                {/* Card Campanhas */}
                <Card>
                  <CardHeader>
                    <div className="flex justify-between items-center">
                      <div>
                        <CardTitle>Campanhas</CardTitle>
                        <CardDescription>
                          Cadastre campanhas de anúncios e associe a uma Persona (Cliente Ideal) para acompanhar performance.
                        </CardDescription>
                      </div>
                      <Dialog
                        open={isModalCampanhaOpen}
                        onOpenChange={(open) => {
                          setIsModalCampanhaOpen(open);
                          if (!open) setEditingCampanha(null);
                        }}
                      >
                        <DialogTrigger asChild>
                          <Button
                            onClick={() => {
                              setEditingCampanha(null);
                              campanhaForm.reset({
                                nome: "",
                                campaign_id: "",
                                plataforma: "",
                                ideal_customer_id: "",
                              });
                            }}
                            className="gap-2"
                          >
                            <Plus className="h-4 w-4" />
                            Nova Campanha
                          </Button>
                        </DialogTrigger>
                        <DialogContent className="sm:max-w-[425px]">
                          <DialogHeader>
                            <DialogTitle>
                              {editingCampanha ? "Editar Campanha" : "Nova Campanha"}
                            </DialogTitle>
                            <DialogDescription>
                              {editingCampanha
                                ? "Altere os dados da campanha."
                                : "Cadastre uma campanha de anúncio com nome, ID, plataforma e Persona (Cliente Ideal) de destino."}
                            </DialogDescription>
                          </DialogHeader>
                          <form
                            onSubmit={campanhaForm.handleSubmit(onCampanhaSubmit)}
                            className="grid gap-4 py-4"
                          >
                            <div className="space-y-2">
                              <Label htmlFor="campanha_nome">Nome da Campanha</Label>
                              <Input
                                id="campanha_nome"
                                type="text"
                                placeholder="Ex: Campanha Black Friday"
                                {...campanhaForm.register("nome")}
                              />
                              {campanhaForm.formState.errors.nome && (
                                <p className="text-xs text-destructive">
                                  {campanhaForm.formState.errors.nome.message}
                                </p>
                              )}
                            </div>
                            <div className="space-y-2">
                              <Label htmlFor="campanha_id">ID</Label>
                              <Input
                                id="campanha_id"
                                type="text"
                                placeholder="ID da campanha na plataforma"
                                {...campanhaForm.register("campaign_id")}
                              />
                              {campanhaForm.formState.errors.campaign_id && (
                                <p className="text-xs text-destructive">
                                  {campanhaForm.formState.errors.campaign_id.message}
                                </p>
                              )}
                            </div>
                            <div className="space-y-2">
                              <Label>Plataforma</Label>
                              <Select
                                value={campanhaForm.watch("plataforma")}
                                onValueChange={(v: string) =>
                                  campanhaForm.setValue("plataforma", v)
                                }
                              >
                                <SelectTrigger>
                                  <SelectValue placeholder="Selecione" />
                                </SelectTrigger>
                                <SelectContent>
                                  {PLATAFORMA_CAMPANHA_OPTIONS.map((opt) => (
                                    <SelectItem key={opt.value} value={opt.value}>
                                      {opt.label}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                              {campanhaForm.formState.errors.plataforma && (
                                <p className="text-xs text-destructive">
                                  {campanhaForm.formState.errors.plataforma.message}
                                </p>
                              )}
                            </div>
                            <div className="space-y-2">
                              <Label>Persona (Cliente Ideal)</Label>
                              <Select
                                value={campanhaForm.watch("ideal_customer_id") ?? "none"}
                                onValueChange={(v: string) =>
                                  campanhaForm.setValue("ideal_customer_id", v === "none" ? "" : v)
                                }
                              >
                                <SelectTrigger>
                                  <SelectValue placeholder="Nenhuma (opcional)" />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="none">Nenhuma</SelectItem>
                                  {idealCustomers.map((ic) => (
                                    <SelectItem key={ic.id} value={ic.id}>
                                      {ic.profile_name ?? "Sem nome"}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                              <p className="text-xs text-muted-foreground">
                                Um Cliente Ideal pode ter 0, 1 ou mais campanhas associadas.
                              </p>
                            </div>
                            <DialogFooter>
                              <Button
                                type="button"
                                variant="outline"
                                onClick={() => setIsModalCampanhaOpen(false)}
                              >
                                Cancelar
                              </Button>
                              <Button type="submit" disabled={isSavingCampanha}>
                                {isSavingCampanha ? (
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
                  </CardHeader>
                  <CardContent>
                    {isFetchingCampanhas ? (
                      <div className="flex min-h-[120px] items-center justify-center">
                        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                      </div>
                    ) : (
                      <div className="overflow-hidden rounded-lg border border-border bg-card shadow-sm">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>Nome</TableHead>
                              <TableHead>ID</TableHead>
                              <TableHead>Plataforma</TableHead>
                              <TableHead>Persona</TableHead>
                              <TableHead className="w-[100px]">Ações</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {campanhas.length === 0 ? (
                              <TableRow>
                                <TableCell
                                  colSpan={5}
                                  className="h-24 text-center text-muted-foreground"
                                >
                                  Nenhuma campanha cadastrada. Clique em Nova Campanha para adicionar.
                                </TableCell>
                              </TableRow>
                            ) : (
                              campanhas.map((c) => (
                                <TableRow key={c.id}>
                                  <TableCell>{c.nome}</TableCell>
                                  <TableCell className="font-mono text-sm">{c.campaign_id}</TableCell>
                                  <TableCell>{c.plataforma}</TableCell>
                                  <TableCell>{c.ideal_customers?.profile_name ?? "—"}</TableCell>
                                  <TableCell>
                                    <div className="flex items-center gap-1">
                                      <Button
                                        type="button"
                                        variant="ghost"
                                        size="icon"
                                        onClick={() => openCampanhaEdit(c)}
                                        aria-label="Editar campanha"
                                      >
                                        <Pencil className="h-4 w-4" />
                                      </Button>
                                      <Button
                                        type="button"
                                        variant="ghost"
                                        size="icon"
                                        className="text-destructive hover:text-destructive hover:bg-destructive/10"
                                        onClick={() => onCampanhaDelete(c.id)}
                                        aria-label="Excluir campanha"
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
                  </CardContent>
                </Card>

                {/* Card Pagamentos */}
                <Card>
                  <CardHeader>
                    <div className="flex justify-between items-center">
                      <div>
                        <CardTitle>Pagamentos</CardTitle>
                        <CardDescription>
                          Registre pagamentos de anúncios (Google Ads ou Meta Ads).
                        </CardDescription>
                      </div>
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
                  </CardHeader>
                  <CardContent>
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
                  </CardContent>
                </Card>
              </div>
            </TabsContent>
          </Tabs>
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}
