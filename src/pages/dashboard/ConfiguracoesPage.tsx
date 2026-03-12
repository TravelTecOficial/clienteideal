import React, { useState, useEffect, useCallback, useRef } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth, useUser } from "@clerk/clerk-react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";

import { Plus, Loader2, Check, Database, Megaphone, Smartphone, ImagePlus, Building2, Trash2, Pencil, Plug2, MapPin, MessageSquare, Sparkles, Search } from "lucide-react";
import { SiWhatsapp, SiGoogleads, SiMeta, SiInstagram, SiGoogleanalytics, SiGoogle, SiFacebook, SiWordpress } from "react-icons/si";

import { Separator } from "@/components/ui/separator";
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
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { useSupabaseClient } from "@/lib/supabase-context";
import { SUPABASE_URL, SUPABASE_ANON_KEY } from "@/lib/supabase";
import { useEffectiveCompanyId } from "@/hooks/use-effective-company-id";
import { isSaasAdmin } from "@/lib/use-saas-admin";
import { setAdminPreviewCompanyId } from "@/lib/admin-preview-storage";
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
  gmb_place_type: string | null;
  gmb_place_type_secondary: string | null;
  gmb_place_id: string | null;
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
  gmb_place_type: z.string().optional(),
  gmb_place_id: z.string().optional(),
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

interface MetaAccount {
  id: string;
  name: string;
  instagramBusinessId: string | null;
  isSelected?: boolean;
}

interface InstagramMetricValue {
  value: number;
  endTime: string | null;
}

interface InstagramMetric {
  metric: string;
  period: string;
  values: InstagramMetricValue[];
}

interface WhatsappPhoneNumber {
  id: string;
  display_phone_number: string;
  verified_name: string | null;
}

interface WhatsappConnectSuccessResponse {
  success: true;
  wabaId: string;
  expiresAt: string;
  phoneNumbers: WhatsappPhoneNumber[];
}

interface WhatsappErrorResponse {
  error: string;
  code?: string;
  hint?: string;
}

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
interface ConfiguracoesPageProps {
  section: "empresa" | "integracoes" | "whatsapp";
}

interface CompanyOption {
  id: string;
  nome_fantasia: string | null;
  name: string | null;
}

interface GoogleAnalyticsPropertyOption {
  accountName: string;
  accountDisplayName: string;
  propertyName: string;
  propertyDisplayName: string;
  propertyId: string;
  isSelected: boolean;
}

const GOOGLE_OAUTH_STATE_KEY = "google_oauth_state";
const GOOGLE_OAUTH_COMPANY_KEY = "google_oauth_company_id";
const GOOGLE_OAUTH_POST_CONNECT_KEY = "google_oauth_post_connect_service";

export function ConfiguracoesPage({ section }: ConfiguracoesPageProps) {
  const { userId, getToken } = useAuth();
  const { user } = useUser();
  const navigate = useNavigate();
  const supabase = useSupabaseClient();
  const { toast } = useToast();
  const companyId = useEffectiveCompanyId();
  const isAdmin = isSaasAdmin(user?.publicMetadata as Record<string, unknown> | undefined);
  const [companiesForAdmin, setCompaniesForAdmin] = useState<CompanyOption[]>([]);
  const [isLoadingCompanies, setIsLoadingCompanies] = useState(false);
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
  const [isGoogleConnecting, setIsGoogleConnecting] = useState(false);
  const [isGA4Connected, setIsGA4Connected] = useState(false);
  const [isAdsConnected, setIsAdsConnected] = useState(false);
  const [adsAccountDisplayName, setAdsAccountDisplayName] = useState<string | null>(null);
  const [isMyBusinessConnected, setIsMyBusinessConnected] = useState(false);
  const [isLoadingGoogleAnalyticsProperties, setIsLoadingGoogleAnalyticsProperties] = useState(false);
  const [isSavingGoogleAnalyticsProperty, setIsSavingGoogleAnalyticsProperty] = useState(false);
  const [googleAnalyticsProperties, setGoogleAnalyticsProperties] = useState<GoogleAnalyticsPropertyOption[]>([]);
  const [selectedGoogleAnalyticsPropertyName, setSelectedGoogleAnalyticsPropertyName] = useState<string | null>(null);
  const [selectedGoogleAnalyticsPropertyLabel, setSelectedGoogleAnalyticsPropertyLabel] = useState<string | null>(null);
  const [isLoadingMyBusinessLocations, setIsLoadingMyBusinessLocations] = useState(false);
  const [isSavingMyBusinessLocation, setIsSavingMyBusinessLocation] = useState(false);
  const [myBusinessLocations, setMyBusinessLocations] = useState<GoogleAnalyticsPropertyOption[]>([]);
  const [selectedMyBusinessPropertyName, setSelectedMyBusinessPropertyName] = useState<string | null>(null);
  const [selectedMyBusinessPropertyLabel, setSelectedMyBusinessPropertyLabel] = useState<string | null>(null);
  const [isInstagramConnected, setIsInstagramConnected] = useState(false);
  const [isFacebookConnected, setIsFacebookConnected] = useState(false);
  const [isMetaAdsConnected, setIsMetaAdsConnected] = useState(false);
  const [metaConnectingService, setMetaConnectingService] = useState<
    "instagram" | "facebook" | "meta_ads" | null
  >(null);
  const [isCreatingInstance, setIsCreatingInstance] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [isCheckingConnection, setIsCheckingConnection] = useState(false);
  const [isDeleteEvolutionOpen, setIsDeleteEvolutionOpen] = useState(false);
  const [isDeletingEvolution, setIsDeletingEvolution] = useState(false);

  const [isLoadingMetaAccounts, setIsLoadingMetaAccounts] = useState(false);
  const [metaAccounts, setMetaAccounts] = useState<MetaAccount[]>([]);
  const [isLoadingMetaInsights, setIsLoadingMetaInsights] = useState(false);
  const [selectedInstagramId, setSelectedInstagramId] = useState<string | null>(null);
  const [metaInsights, setMetaInsights] = useState<InstagramMetric[] | null>(null);

  const [isWhatsappConnecting, setIsWhatsappConnecting] = useState(false);
  const [isMetaSdkReady, setIsMetaSdkReady] = useState(false);
  const [metaSdkLoadFailed, setMetaSdkLoadFailed] = useState(false);
  const [wordpressSiteUrl, setWordpressSiteUrl] = useState("");
  const [wordpressToken, setWordpressToken] = useState("");
  const [isWordpressConnected, setIsWordpressConnected] = useState(false);
  const [isSavingWordpress, setIsSavingWordpress] = useState(false);
  const [whatsappPhoneNumbers, setWhatsappPhoneNumbers] = useState<WhatsappPhoneNumber[]>([]);
  const [selectedWhatsappPhoneId, setSelectedWhatsappPhoneId] = useState<string | null>(null);
  const [isWhatsappConnected, setIsWhatsappConnected] = useState(false);
  const [whatsappSelectedDisplay, setWhatsappSelectedDisplay] = useState<string | null>(null);
  const [isSelectingWhatsappNumber, setIsSelectingWhatsappNumber] = useState(false);

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

  const checkConnectionState = useCallback(async (): Promise<string | null> => {
    const instanceName = evolutionForm.getValues("evolution_instance_name")?.trim();
    if (!instanceName) return null;
    const { data, error } = await executeEvolutionProxy("connectionState", {
      instanceName,
    });
    if (error) {
      return null;
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
    return normalizedState;
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
      gmb_place_type: "",
      gmb_place_type_secondary: "",
      gmb_place_id: "",
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
            "instagram_url, facebook_url, linkedin_url, gmb_place_type, gmb_place_type_secondary, gmb_place_id"
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
        gmb_place_type: row?.gmb_place_type ?? "",
        gmb_place_type_secondary: row?.gmb_place_type_secondary ?? "",
        gmb_place_id: row?.gmb_place_id ?? "",
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

  // Carregar estado da conexão WhatsApp (meta_connections) ao abrir aba Integrações
  const loadWhatsappConnectionState = useCallback(async () => {
    if (!companyId) {
      setIsWhatsappConnected(false);
      setWhatsappSelectedDisplay(null);
      return;
    }
    try {
      const token = await getToken();
      if (!token) return;
      const res = await fetch(`${SUPABASE_URL}/functions/v1/whatsapp-integration`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
        },
        body: JSON.stringify({
          action: "getWhatsappConnection",
          company_id: companyId,
          token,
        }),
      });
      const raw = await res.text();
      const data = (() => {
        try {
          return JSON.parse(raw) as {
            connected?: boolean;
            display_phone_number?: string | null;
            error?: string;
          } | null;
        } catch {
          return null;
        }
      })();
      if (res.ok && data && !data.error) {
        setIsWhatsappConnected(Boolean(data.connected));
        setWhatsappSelectedDisplay(data.display_phone_number ?? null);
      } else {
        setIsWhatsappConnected(false);
        setWhatsappSelectedDisplay(null);
      }
    } catch {
      setIsWhatsappConnected(false);
      setWhatsappSelectedDisplay(null);
    }
  }, [companyId, getToken]);

  const loadGoogleConnectionState = useCallback(async () => {
    if (!companyId) {
      setIsGA4Connected(false);
      setIsAdsConnected(false);
      setAdsAccountDisplayName(null);
      setIsMyBusinessConnected(false);
      setSelectedGoogleAnalyticsPropertyName(null);
      setSelectedGoogleAnalyticsPropertyLabel(null);
      return;
    }
    try {
      const token = await getToken();
      if (!token) return;
      const res = await fetch(`${SUPABASE_URL}/functions/v1/google-oauth`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
          apikey: SUPABASE_ANON_KEY,
        },
        body: JSON.stringify({
          action: "getConnectionStatus",
          company_id: companyId,
          token,
        }),
      });
      const data = (await res.json().catch(() => null)) as {
        ga4?: boolean;
        ads?: boolean;
        mybusiness?: boolean;
        ga4SelectedPropertyName?: string | null;
        ga4SelectedPropertyDisplayName?: string | null;
        ga4SelectedAccountDisplayName?: string | null;
        adsSelectedAccountDisplayName?: string | null;
        mybusinessSelectedPropertyName?: string | null;
        mybusinessSelectedPropertyDisplayName?: string | null;
        mybusinessSelectedAccountDisplayName?: string | null;
      } | null;
      if (res.ok && data) {
        setIsGA4Connected(Boolean(data.ga4));
        setIsAdsConnected(Boolean(data.ads));
        setIsMyBusinessConnected(Boolean(data.mybusiness));
        setAdsAccountDisplayName(data.adsSelectedAccountDisplayName ?? null);
        setSelectedGoogleAnalyticsPropertyName(data.ga4SelectedPropertyName ?? null);
        setSelectedGoogleAnalyticsPropertyLabel(
          data.ga4SelectedPropertyDisplayName
            ? data.ga4SelectedAccountDisplayName
              ? `${data.ga4SelectedAccountDisplayName} — ${data.ga4SelectedPropertyDisplayName}`
              : data.ga4SelectedPropertyDisplayName
            : null,
        );
        setSelectedMyBusinessPropertyName(data.mybusinessSelectedPropertyName ?? null);
        setSelectedMyBusinessPropertyLabel(
          data.mybusinessSelectedPropertyDisplayName
            ? data.mybusinessSelectedAccountDisplayName
              ? `${data.mybusinessSelectedAccountDisplayName} — ${data.mybusinessSelectedPropertyDisplayName}`
              : data.mybusinessSelectedPropertyDisplayName
            : null,
        );
      } else {
        setIsGA4Connected(false);
        setIsAdsConnected(false);
        setIsMyBusinessConnected(false);
        setAdsAccountDisplayName(null);
        setSelectedGoogleAnalyticsPropertyName(null);
        setSelectedGoogleAnalyticsPropertyLabel(null);
        setSelectedMyBusinessPropertyName(null);
        setSelectedMyBusinessPropertyLabel(null);
      }
    } catch {
      setIsGA4Connected(false);
      setIsAdsConnected(false);
      setIsMyBusinessConnected(false);
      setAdsAccountDisplayName(null);
      setSelectedGoogleAnalyticsPropertyName(null);
      setSelectedGoogleAnalyticsPropertyLabel(null);
      setSelectedMyBusinessPropertyName(null);
      setSelectedMyBusinessPropertyLabel(null);
    }
  }, [companyId, getToken]);

  const handleGoogleConnect = useCallback(
    async (service: "ga4" | "ads" | "mybusiness") => {
      if (!companyId) {
        toast({ variant: "destructive", title: "Empresa não identificada", description: "Acesse o painel com uma empresa selecionada antes de conectar." });
        return;
      }
      setIsGoogleConnecting(true);
      try {
        const token = await getToken();
        if (!token) throw new Error("Token de autenticação indisponível. Faça login novamente.");
        window.sessionStorage.setItem(GOOGLE_OAUTH_COMPANY_KEY, companyId);
        const res = await fetch(`${SUPABASE_URL}/functions/v1/google-oauth`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
            apikey: SUPABASE_ANON_KEY,
          },
          body: JSON.stringify({ action: "getLoginUrl", service, company_id: companyId, token }),
        });
        const data = (await res.json().catch(() => null)) as { url?: string; state?: string; error?: string } | null;
        if (!res.ok || data?.error || !data?.url) throw new Error(data?.error ?? "Erro ao obter URL de autorização.");
        if (data.state) {
          window.sessionStorage.setItem(GOOGLE_OAUTH_STATE_KEY, data.state);
        }
        window.location.href = data.url;
      } catch (err) {
        toast({ variant: "destructive", title: "Erro ao conectar Google", description: getErrorMessage(err) });
        setIsGoogleConnecting(false);
      }
    },
    [companyId, getToken, toast],
  );

  const handleGoogleDisconnect = useCallback(
    async (service: "ga4" | "ads" | "mybusiness") => {
      const ok = window.confirm("Desconectar este serviço Google desta empresa? O refresh_token será removido.");
      if (!ok) return;
      try {
        const token = await getToken();
        if (!token) throw new Error("Token indisponível.");
        const res = await fetch(`${SUPABASE_URL}/functions/v1/google-oauth`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
            apikey: SUPABASE_ANON_KEY,
          },
          body: JSON.stringify({ action: "disconnect", service, company_id: companyId, token }),
        });
        const data = (await res.json().catch(() => null)) as { error?: string } | null;
        if (!res.ok || data?.error) throw new Error(data?.error ?? "Erro");
        if (service === "ga4") {
          setIsGA4Connected(false);
          setGoogleAnalyticsProperties([]);
          setSelectedGoogleAnalyticsPropertyName(null);
          setSelectedGoogleAnalyticsPropertyLabel(null);
        } else if (service === "mybusiness") {
          setIsMyBusinessConnected(false);
          setMyBusinessLocations([]);
          setSelectedMyBusinessPropertyName(null);
          setSelectedMyBusinessPropertyLabel(null);
        } else if (service === "ads") {
          setIsAdsConnected(false);
          setAdsAccountDisplayName(null);
        }
        toast({ title: "Google desconectado" });
      } catch (err) {
        toast({ variant: "destructive", title: "Erro ao desconectar", description: getErrorMessage(err) });
      }
    },
    [companyId, getToken, toast],
  );

  const fetchAdsAccountInfo = useCallback(async () => {
    if (!companyId) return;
    try {
      const token = await getToken();
      if (!token) return;
      const res = await fetch(`${SUPABASE_URL}/functions/v1/google-oauth`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
          apikey: SUPABASE_ANON_KEY,
        },
        body: JSON.stringify({ action: "getAdsAccountInfo", company_id: companyId, token }),
      });
      const data = (await res.json().catch(() => null)) as { accountDisplayName?: string; error?: string } | null;
      if (res.ok && data?.accountDisplayName) {
        setAdsAccountDisplayName(data.accountDisplayName);
      }
    } catch {
      // Silencioso - não bloqueia a UI
    }
  }, [companyId, getToken]);

  const handleLoadGoogleAnalyticsProperties = useCallback(async () => {
    if (!companyId) {
      toast({
        variant: "destructive",
        title: "Empresa não identificada",
        description: "Acesse o painel com uma empresa selecionada antes de listar propriedades do GA4.",
      });
      return;
    }

    setIsLoadingGoogleAnalyticsProperties(true);
    try {
      const token = await getToken();
      if (!token) {
        throw new Error("Token de autenticação indisponível. Faça login novamente.");
      }

      const res = await fetch(`${SUPABASE_URL}/functions/v1/google-oauth`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
          apikey: SUPABASE_ANON_KEY,
        },
        body: JSON.stringify({
          action: "listAnalyticsProperties",
          company_id: companyId,
          token,
        }),
      });

      const data = (await res.json().catch(() => null)) as {
        properties?: GoogleAnalyticsPropertyOption[];
        error?: string;
        hint?: string;
      } | null;

      if (!res.ok || data?.error) {
        const msg = data?.hint ? `${data.error ?? res.status} — ${data.hint}` : (data?.error ?? `Erro ${res.status}`);
        throw new Error(msg);
      }

      const properties = data?.properties ?? [];
      setGoogleAnalyticsProperties(properties);

      const selectedProperty = properties.find((property) => property.isSelected) ?? null;
      setSelectedGoogleAnalyticsPropertyName(selectedProperty?.propertyName ?? null);
      setSelectedGoogleAnalyticsPropertyLabel(
        selectedProperty
          ? `${selectedProperty.accountDisplayName} — ${selectedProperty.propertyDisplayName}`
          : null,
      );

      if (!properties.length) {
        toast({
          title: "Nenhuma propriedade encontrada",
          description: "A conta conectada não retornou propriedades do Google Analytics acessíveis.",
        });
      }
    } catch (err) {
      toast({
        variant: "destructive",
        title: "Erro ao listar propriedades do GA4",
        description: getErrorMessage(err),
      });
    } finally {
      setIsLoadingGoogleAnalyticsProperties(false);
    }
  }, [companyId, getToken, toast]);

  const handleSelectGoogleAnalyticsProperty = useCallback(async () => {
    if (!companyId) {
      toast({
        variant: "destructive",
        title: "Empresa não identificada",
        description: "Acesse o painel com uma empresa selecionada antes de salvar a propriedade do GA4.",
      });
      return;
    }

    const selectedProperty =
      googleAnalyticsProperties.find((property) => property.propertyName === selectedGoogleAnalyticsPropertyName) ?? null;

    if (!selectedProperty) {
      toast({
        variant: "destructive",
        title: "Selecione uma propriedade",
        description: "Escolha qual propriedade GA4 será vinculada a esta empresa antes de confirmar.",
      });
      return;
    }

    setIsSavingGoogleAnalyticsProperty(true);
    try {
      const token = await getToken();
      if (!token) {
        throw new Error("Token de autenticação indisponível. Faça login novamente.");
      }

      const res = await fetch(`${SUPABASE_URL}/functions/v1/google-oauth`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
          apikey: SUPABASE_ANON_KEY,
        },
        body: JSON.stringify({
          action: "selectAnalyticsProperty",
          company_id: companyId,
          accountName: selectedProperty.accountName,
          accountDisplayName: selectedProperty.accountDisplayName,
          propertyName: selectedProperty.propertyName,
          propertyDisplayName: selectedProperty.propertyDisplayName,
          token,
        }),
      });

      const data = (await res.json().catch(() => null)) as {
        success?: boolean;
        error?: string;
        hint?: string;
      } | null;

      if (!res.ok || data?.error || !data?.success) {
        const msg = data?.hint ? `${data.error ?? res.status} — ${data.hint}` : (data?.error ?? `Erro ${res.status}`);
        throw new Error(msg);
      }

      setGoogleAnalyticsProperties((current) =>
        current.map((property) => ({
          ...property,
          isSelected: property.propertyName === selectedProperty.propertyName,
        })),
      );
      setSelectedGoogleAnalyticsPropertyLabel(
        `${selectedProperty.accountDisplayName} — ${selectedProperty.propertyDisplayName}`,
      );
      toast({
        title: "Propriedade GA4 vinculada",
        description: "A propriedade selecionada será usada como padrão para esta empresa.",
      });
    } catch (err) {
      toast({
        variant: "destructive",
        title: "Erro ao salvar propriedade GA4",
        description: getErrorMessage(err),
      });
    } finally {
      setIsSavingGoogleAnalyticsProperty(false);
    }
  }, [companyId, getToken, googleAnalyticsProperties, selectedGoogleAnalyticsPropertyName, toast]);

  const handleLoadMyBusinessLocations = useCallback(async () => {
    if (!companyId) {
      toast({
        variant: "destructive",
        title: "Empresa não identificada",
        description: "Acesse o painel com uma empresa selecionada antes de listar perfis do Meu Negócio.",
      });
      return;
    }

    setIsLoadingMyBusinessLocations(true);
    try {
      const token = await getToken();
      if (!token) {
        throw new Error("Token de autenticação indisponível. Faça login novamente.");
      }

      const res = await fetch(`${SUPABASE_URL}/functions/v1/google-oauth`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
          apikey: SUPABASE_ANON_KEY,
        },
        body: JSON.stringify({
          action: "listMyBusinessLocations",
          company_id: companyId,
          token,
        }),
      });

      const data = (await res.json().catch(() => null)) as {
        locations?: GoogleAnalyticsPropertyOption[];
        error?: string;
        hint?: string;
        code?: string;
        googleStatus?: number;
        debug?: string;
      } | null;

      if (!res.ok || data?.error) {
        let msg = data?.hint ? `${data.error ?? res.status} — ${data.hint}` : (data?.error ?? `Erro ${res.status}`);
        if (data?.googleStatus) msg += ` [Google: ${data.googleStatus}]`;
        if (data?.debug) msg += ` | ${data.debug}`;
        throw new Error(msg);
      }

      const locations = data?.locations ?? [];
      setMyBusinessLocations(locations);

      const selectedLocation = locations.find((loc) => loc.isSelected) ?? null;
      setSelectedMyBusinessPropertyName(selectedLocation?.propertyName ?? null);
      setSelectedMyBusinessPropertyLabel(
        selectedLocation
          ? `${selectedLocation.accountDisplayName} — ${selectedLocation.propertyDisplayName}`
          : null,
      );

      if (!locations.length) {
        toast({
          title: "Nenhum perfil encontrado",
          description: "A conta conectada não retornou perfis do Google Meu Negócio acessíveis.",
        });
      }
    } catch (err) {
      toast({
        variant: "destructive",
        title: "Erro ao listar perfis do Meu Negócio",
        description: getErrorMessage(err),
      });
    } finally {
      setIsLoadingMyBusinessLocations(false);
    }
  }, [companyId, getToken, toast]);

  const handleSelectMyBusinessLocation = useCallback(async () => {
    if (!companyId) {
      toast({
        variant: "destructive",
        title: "Empresa não identificada",
        description: "Acesse o painel com uma empresa selecionada antes de salvar o perfil do Meu Negócio.",
      });
      return;
    }

    const selectedLocation =
      myBusinessLocations.find((loc) => loc.propertyName === selectedMyBusinessPropertyName) ?? null;

    if (!selectedLocation) {
      toast({
        variant: "destructive",
        title: "Selecione um perfil",
        description: "Escolha qual perfil do Meu Negócio será vinculado a esta empresa antes de confirmar.",
      });
      return;
    }

    setIsSavingMyBusinessLocation(true);
    try {
      const token = await getToken();
      if (!token) {
        throw new Error("Token de autenticação indisponível. Faça login novamente.");
      }

      const res = await fetch(`${SUPABASE_URL}/functions/v1/google-oauth`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
          apikey: SUPABASE_ANON_KEY,
        },
        body: JSON.stringify({
          action: "selectMyBusinessLocation",
          company_id: companyId,
          accountName: selectedLocation.accountName,
          accountDisplayName: selectedLocation.accountDisplayName,
          propertyName: selectedLocation.propertyName,
          propertyDisplayName: selectedLocation.propertyDisplayName,
          token,
        }),
      });

      const data = (await res.json().catch(() => null)) as {
        success?: boolean;
        error?: string;
        hint?: string;
      } | null;

      if (!res.ok || data?.error || !data?.success) {
        const msg = data?.hint ? `${data.error ?? res.status} — ${data.hint}` : (data?.error ?? `Erro ${res.status}`);
        throw new Error(msg);
      }

      setMyBusinessLocations((current) =>
        current.map((loc) => ({
          ...loc,
          isSelected: loc.propertyName === selectedLocation.propertyName,
        })),
      );
      setSelectedMyBusinessPropertyLabel(
        `${selectedLocation.accountDisplayName} — ${selectedLocation.propertyDisplayName}`,
      );
      toast({
        title: "Perfil Meu Negócio vinculado",
        description: "O perfil selecionado será usada como padrão para esta empresa.",
      });
    } catch (err) {
      toast({
        variant: "destructive",
        title: "Erro ao salvar perfil Meu Negócio",
        description: getErrorMessage(err),
      });
    } finally {
      setIsSavingMyBusinessLocation(false);
    }
  }, [companyId, getToken, myBusinessLocations, selectedMyBusinessPropertyName, toast]);

  const handleMetaDisconnect = useCallback(
    async (service: "instagram" | "facebook" | "meta_ads") => {
      const ok = window.confirm(
        `Desconectar ${service === "instagram" ? "Instagram" : service === "facebook" ? "Facebook" : "Meta Ads"} desta empresa?`,
      );
      if (!ok) return;
      try {
        const token = await getToken();
        if (!token) throw new Error("Token indisponível.");
        const res = await fetch(`${SUPABASE_URL}/functions/v1/meta-instagram`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
            apikey: SUPABASE_ANON_KEY,
          },
          body: JSON.stringify({ action: "disconnect", service, token }),
        });
        const data = (await res.json().catch(() => null)) as { error?: string } | null;
        if (!res.ok || data?.error) throw new Error(data?.error ?? "Erro");
        if (service === "instagram") {
          setIsInstagramConnected(false);
        } else if (service === "facebook") {
          setIsFacebookConnected(false);
        } else {
          setIsMetaAdsConnected(false);
        }
        setMetaAccounts([]);
        setSelectedInstagramId(null);
        setMetaInsights(null);
        toast({ title: "Meta desconectada" });
      } catch (err) {
        toast({ variant: "destructive", title: "Erro", description: getErrorMessage(err) });
      }
    },
    [getToken, toast],
  );

  const loadMetaConnectionState = useCallback(async () => {
    if (!companyId) {
      setIsInstagramConnected(false);
      setIsFacebookConnected(false);
      setIsMetaAdsConnected(false);
      return;
    }
    try {
      const token = await getToken();
      if (!token) return;
      const res = await fetch(`${SUPABASE_URL}/functions/v1/meta-instagram`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
          apikey: SUPABASE_ANON_KEY,
        },
        body: JSON.stringify({ action: "getConnectionStatus", token }),
      });
      const data = (await res.json().catch(() => null)) as {
        instagram?: boolean;
        facebook?: boolean;
        meta_ads?: boolean;
        error?: string;
      } | null;
      if (res.ok && data && !data.error) {
        setIsInstagramConnected(Boolean(data.instagram));
        setIsFacebookConnected(Boolean(data.facebook));
        setIsMetaAdsConnected(Boolean(data.meta_ads));
      } else {
        setIsInstagramConnected(false);
        setIsFacebookConnected(false);
        setIsMetaAdsConnected(false);
      }
    } catch {
      setIsInstagramConnected(false);
      setIsFacebookConnected(false);
      setIsMetaAdsConnected(false);
    }
  }, [companyId, getToken]);

  const loadWordpressConnection = useCallback(async () => {
    if (!companyId) {
      setIsWordpressConnected(false);
      setWordpressSiteUrl("");
      setWordpressToken("");
      return;
    }
    try {
      const { data, error } = await supabase
        .from("wordpress_connections")
        .select("site_url, token")
        .eq("company_id", companyId)
        .maybeSingle();
      if (!error && data) {
        setIsWordpressConnected(true);
        setWordpressSiteUrl(data.site_url ?? "");
        setWordpressToken(data.token ?? "");
      } else {
        setIsWordpressConnected(false);
        setWordpressSiteUrl("");
        setWordpressToken("");
      }
    } catch {
      setIsWordpressConnected(false);
      setWordpressSiteUrl("");
      setWordpressToken("");
    }
  }, [companyId, supabase]);

  const handleSaveWordpress = useCallback(async () => {
    if (!companyId) {
      toast({
        variant: "destructive",
        title: "Empresa não identificada",
        description: "Acesse o painel com uma empresa selecionada.",
      });
      return;
    }
    const url = wordpressSiteUrl.trim();
    const token = wordpressToken.trim();
    if (!url || !token) {
      toast({
        variant: "destructive",
        title: "Campos obrigatórios",
        description: "Informe a URL do site e o token.",
      });
      return;
    }
    setIsSavingWordpress(true);
    try {
      const { error } = await supabase
        .from("wordpress_connections")
        .upsert(
          {
            company_id: companyId,
            site_url: url,
            token,
            updated_at: new Date().toISOString(),
          },
          { onConflict: "company_id" },
        );
      if (error) throw error;
      setIsWordpressConnected(true);
      toast({ title: "WordPress conectado", description: "Credenciais salvas com sucesso." });
    } catch (err) {
      toast({
        variant: "destructive",
        title: "Erro ao salvar",
        description: getErrorMessage(err),
      });
    } finally {
      setIsSavingWordpress(false);
    }
  }, [companyId, wordpressSiteUrl, wordpressToken, supabase, toast]);

  const handleWordpressDisconnect = useCallback(async () => {
    const ok = window.confirm("Desconectar WordPress desta empresa?");
    if (!ok) return;
    if (!companyId) return;
    try {
      const { error } = await supabase
        .from("wordpress_connections")
        .delete()
        .eq("company_id", companyId);
      if (error) throw error;
      setIsWordpressConnected(false);
      setWordpressSiteUrl("");
      setWordpressToken("");
      toast({ title: "WordPress desconectado" });
    } catch (err) {
      toast({
        variant: "destructive",
        title: "Erro ao desconectar",
        description: getErrorMessage(err),
      });
    }
  }, [companyId, supabase, toast]);

  useEffect(() => {
    if (section === "integracoes") {
      void loadWhatsappConnectionState();
      void loadGoogleConnectionState();
      void loadMetaConnectionState();
      void loadWordpressConnection();
    }
  }, [section, loadWhatsappConnectionState, loadGoogleConnectionState, loadMetaConnectionState, loadWordpressConnection]);

  useEffect(() => {
    if (section === "integracoes" && companyId && isAdsConnected && !adsAccountDisplayName) {
      void fetchAdsAccountInfo();
    }
  }, [section, companyId, isAdsConnected, adsAccountDisplayName, fetchAdsAccountInfo]);

  // Carregar empresas para admin quando companyId é null (seletor de empresa)
  useEffect(() => {
    if (!isAdmin || companyId || section !== "integracoes") return;
    let cancelled = false;
    setIsLoadingCompanies(true);
    supabase
      .from("companies")
      .select("id, nome_fantasia, name")
      .order("nome_fantasia", { nullsFirst: false })
      .then(({ data, error }) => {
        if (cancelled) return;
        setIsLoadingCompanies(false);
        if (error) {
          console.error("Erro ao carregar empresas:", error);
          return;
        }
        setCompaniesForAdmin((data as CompanyOption[]) ?? []);
      });
    return () => {
      cancelled = true;
    };
  }, [isAdmin, companyId, section, supabase]);

  useEffect(() => {
    if (section !== "integracoes" || !companyId) return;
    const pendingService = window.sessionStorage.getItem(GOOGLE_OAUTH_POST_CONNECT_KEY);
    if (pendingService === "ga4" && isGA4Connected) {
      window.sessionStorage.removeItem(GOOGLE_OAUTH_POST_CONNECT_KEY);
      void handleLoadGoogleAnalyticsProperties();
    } else if (pendingService === "mybusiness" && isMyBusinessConnected) {
      window.sessionStorage.removeItem(GOOGLE_OAUTH_POST_CONNECT_KEY);
      void handleLoadMyBusinessLocations();
    }
  }, [section, companyId, isGA4Connected, isMyBusinessConnected, handleLoadGoogleAnalyticsProperties, handleLoadMyBusinessLocations]);

  // Poll para SDK da Meta (carregado dinamicamente em main.tsx)
  useEffect(() => {
    if ((window as unknown as { FB?: unknown }).FB) {
      setIsMetaSdkReady(true);
      setMetaSdkLoadFailed(false);
      return;
    }
    const timeout = setTimeout(() => {
      setMetaSdkLoadFailed(true);
    }, 15000);
    const interval = setInterval(() => {
      if ((window as unknown as { FB?: unknown }).FB) {
        setIsMetaSdkReady(true);
        setMetaSdkLoadFailed(false);
        clearInterval(interval);
        clearTimeout(timeout);
      }
    }, 500);
    return () => {
      clearInterval(interval);
      clearTimeout(timeout);
    };
  }, []);

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

  const handleMetaConnect = useCallback(
    async (service: "instagram" | "facebook" | "meta_ads") => {
      if (!companyId) {
        toast({
          variant: "destructive",
          title: "Empresa não identificada",
          description: "Acesse o painel com uma empresa selecionada antes de conectar a Meta.",
        });
        return;
      }
      setMetaConnectingService(service);
      try {
        const token = await getToken();
        if (!token) {
          throw new Error("Token de autenticação indisponível. Faça login novamente.");
        }
        const res = await fetch(`${SUPABASE_URL}/functions/v1/meta-instagram`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
            apikey: SUPABASE_ANON_KEY,
          },
          body: JSON.stringify({
            action: "getLoginUrl",
            service,
            token,
          }),
        });
        const raw = await res.text();
        const data = (() => {
          try {
            return JSON.parse(raw) as {
              url?: string;
              state?: string;
              error?: string;
              hint?: string;
              code?: string;
            } | null;
          } catch {
            return null;
          }
        })();

        if (!res.ok || data?.error) {
          const parts = [data?.error ?? `Erro ${res.status}`];
          if (data?.code) parts.push(`[${data.code}]`);
          if (data?.hint) parts.push(data.hint);
          throw new Error(parts.join(" — "));
        }

        if (!data?.url) {
          throw new Error("A função não retornou a URL de login da Meta.");
        }

        if (typeof data.state === "string") {
          window.sessionStorage.setItem("meta_oauth_state", data.state);
        }
        window.location.href = data.url;
      } catch (err) {
        toast({
          variant: "destructive",
          title: "Erro ao iniciar conexão com a Meta",
          description: getErrorMessage(err),
        });
        setMetaConnectingService(null);
      }
    },
    [companyId, getToken, toast],
  );

  async function handleWhatsappConnectClick() {
    if (!companyId) {
      toast({
        variant: "destructive",
        title: "Empresa não identificada",
        description:
          "Acesse o painel com uma empresa selecionada antes de conectar o WhatsApp.",
      });
      return;
    }

    setIsWhatsappConnecting(true);
    try {
      const res = await fetch(`${SUPABASE_URL}/functions/v1/whatsapp-integration`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
        },
        body: JSON.stringify({
          action: "getLoginUrl",
          state: companyId,
        }),
      });

      const raw = await res.text();
      const data = (() => {
        try {
          return JSON.parse(raw) as { url?: string; error?: string; hint?: string } | null;
        } catch {
          return null;
        }
      })();

      if (!res.ok || data?.error) {
        const msg = data?.hint ? `${data.error ?? res.status} — ${data.hint}` : (data?.error ?? `Erro ${res.status}`);
        throw new Error(msg);
      }

      if (!data?.url) {
        throw new Error("A função não retornou a URL de login da Meta.");
      }

      window.location.href = data.url;
    } catch (err) {
      toast({
        variant: "destructive",
        title: "Erro ao iniciar conexão WhatsApp",
        description: getErrorMessage(err),
      });
      setIsWhatsappConnecting(false);
    }
  }

  async function handleWhatsappSelectPhoneNumber() {
    if (!companyId) {
      toast({
        variant: "destructive",
        title: "Empresa não identificada",
        description:
          "Acesse o painel com uma empresa selecionada antes de configurar o número do WhatsApp.",
      });
      return;
    }

    const phoneNumberId = selectedWhatsappPhoneId;
    if (!phoneNumberId) {
      toast({
        variant: "destructive",
        title: "Selecione um número",
        description: "Escolha o número de WhatsApp que será usado pelo SDR antes de confirmar.",
      });
      return;
    }

    setIsSelectingWhatsappNumber(true);
    try {
      const token = await getToken();
      if (!token) {
        throw new Error("Token de autenticação indisponível. Faça login novamente.");
      }

      const res = await fetch(`${SUPABASE_URL}/functions/v1/whatsapp-integration`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
        },
        body: JSON.stringify({
          action: "selectPhoneNumber" as const,
          phone_number_id: phoneNumberId,
          token,
        }),
      });

      const raw = await res.text();
      const data = (() => {
        try {
          return JSON.parse(raw) as { success?: boolean; error?: string; hint?: string } | null;
        } catch {
          return null;
        }
      })();

      const isError = !data || data.error || !data.success;
      if (!res.ok || isError) {
        const parts = [
          data?.error ?? `Erro ${res.status}`,
          data?.hint ?? "",
        ].filter(Boolean);

        toast({
          variant: "destructive",
          title: "Erro ao salvar número de WhatsApp",
          description: parts.join(" — "),
        });
        return;
      }

      const selectedPhone = whatsappPhoneNumbers.find((p) => p.id === phoneNumberId) ?? null;
      setIsWhatsappConnected(true);
      if (selectedPhone) {
        const display =
          selectedPhone.verified_name && selectedPhone.verified_name.length > 0
            ? `${selectedPhone.display_phone_number} (${selectedPhone.verified_name})`
            : selectedPhone.display_phone_number;
        setWhatsappSelectedDisplay(display);
      }

      toast({
        title: "Número de WhatsApp selecionado",
        description:
          "O número escolhido será utilizado como remetente oficial nas mensagens do SDR.",
      });
    } catch (err) {
      toast({
        variant: "destructive",
        title: "Erro ao salvar número de WhatsApp",
        description: getErrorMessage(err),
      });
    } finally {
      setIsSelectingWhatsappNumber(false);
    }
  }

  async function handleLoadMetaAccounts() {
    if (!companyId) {
      toast({
        variant: "destructive",
        title: "Empresa não identificada",
        description: "Acesse o painel com uma empresa selecionada antes de listar contas.",
      });
      return;
    }
    const service = isInstagramConnected ? "instagram" : isFacebookConnected ? "facebook" : null;
    if (!service) return;
    setIsLoadingMetaAccounts(true);
    try {
      const token = await getToken();
      if (!token) {
        throw new Error("Token de autenticação indisponível. Faça login novamente.");
      }
      const res = await fetch(`${SUPABASE_URL}/functions/v1/meta-instagram`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
          apikey: SUPABASE_ANON_KEY,
        },
        body: JSON.stringify({
          action: "listAccounts",
          service,
          token,
        }),
      });
      const raw = await res.text();
      const data = (() => {
        try {
          return JSON.parse(raw) as {
            accounts?: MetaAccount[];
            error?: string;
            hint?: string;
          } | null;
        } catch {
          return null;
        }
      })();
      if (!res.ok || data?.error) {
        const msg = data?.hint ? `${data.error ?? res.status} — ${data.hint}` : (data?.error ?? `Erro ${res.status}`);
        throw new Error(msg);
      }
      const accounts = data?.accounts ?? [];
      setMetaAccounts(accounts);

      const selected = accounts.find((a) => a.isSelected && a.instagramBusinessId);
      if (selected?.instagramBusinessId) {
        // Carrega automaticamente insights da conta vinculada, se existir.
        void handleLoadMetaInsights(selected.instagramBusinessId);
      }

      if (!accounts.length) {
        toast({
          title: "Nenhuma página encontrada",
          description:
            "Conecte uma conta da Meta com páginas que possuam Instagram Business vinculado.",
        });
      }
    } catch (err) {
      toast({
        variant: "destructive",
        title: "Erro ao listar contas da Meta",
        description: getErrorMessage(err),
      });
    } finally {
      setIsLoadingMetaAccounts(false);
    }
  }

  async function handleSelectMetaAccount(account: MetaAccount) {
    if (!companyId) {
      toast({
        variant: "destructive",
        title: "Empresa não identificada",
        description: "Acesse o painel com uma empresa selecionada antes de selecionar a conta.",
      });
      return;
    }
    if (!account.instagramBusinessId) {
      toast({
        variant: "destructive",
        title: "Instagram não vinculado",
        description:
          "Esta página não possui um Instagram Business vinculado. Ajuste a vinculação no Business Manager antes de selecionar.",
      });
      return;
    }
    try {
      const token = await getToken();
      if (!token) {
        throw new Error("Token de autenticação indisponível. Faça login novamente.");
      }
      const res = await fetch(`${SUPABASE_URL}/functions/v1/meta-instagram`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
          apikey: SUPABASE_ANON_KEY,
        },
        body: JSON.stringify({
          action: "selectAccount",
          pageId: account.id,
          pageName: account.name,
          instagramId: account.instagramBusinessId,
          service: isInstagramConnected ? "instagram" : "facebook",
          token,
        }),
      });
      const raw = await res.text();
      const data = (() => {
        try {
          return JSON.parse(raw) as { success?: boolean; error?: string; hint?: string } | null;
        } catch {
          return null;
        }
      })();
      if (!res.ok || data?.error || !data?.success) {
        const msg = data?.hint ? `${data.error ?? res.status} — ${data.hint}` : (data?.error ?? `Erro ${res.status}`);
        throw new Error(msg);
      }

      toast({
        title: "Conta Meta vinculada à empresa",
        description:
          "A página selecionada será usada como padrão para os insights de Instagram desta empresa.",
      });

      // Recarrega lista para refletir a seleção única.
      void handleLoadMetaAccounts();
    } catch (err) {
      toast({
        variant: "destructive",
        title: "Erro ao vincular conta Meta",
        description: getErrorMessage(err),
      });
    }
  }

  async function handleLoadMetaInsights(instagramId: string | null) {
    if (!instagramId) {
      toast({
        variant: "destructive",
        title: "Conta do Instagram não vinculada",
        description:
          "Esta página não possui um Instagram Business vinculado. Ajuste a vinculação no Business Manager.",
      });
      return;
    }
    setSelectedInstagramId(instagramId);
    setIsLoadingMetaInsights(true);
    try {
      const token = await getToken();
      if (!token) {
        throw new Error("Token de autenticação indisponível. Faça login novamente.");
      }
      const res = await fetch(`${SUPABASE_URL}/functions/v1/meta-instagram`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
          apikey: SUPABASE_ANON_KEY,
        },
        body: JSON.stringify({
          action: "getInsights",
          instagramId,
          token,
        }),
      });
      const raw = await res.text();
      const data = (() => {
        try {
          return JSON.parse(raw) as { metrics?: InstagramMetric[]; error?: string; hint?: string } | null;
        } catch {
          return null;
        }
      })();
      if (!res.ok || data?.error) {
        const msg = data?.hint ? `${data.error ?? res.status} — ${data.hint}` : (data?.error ?? `Erro ${res.status}`);
        throw new Error(msg);
      }
      setMetaInsights(data?.metrics ?? null);
      if (!data?.metrics || data.metrics.length === 0) {
        toast({
          title: "Nenhuma métrica retornada",
          description: "A Meta não retornou dados de alcance ou impressões para este perfil.",
        });
      }
    } catch (err) {
      toast({
        variant: "destructive",
        title: "Erro ao buscar insights do Instagram",
        description: getErrorMessage(err),
      });
    } finally {
      setIsLoadingMetaInsights(false);
    }
  }

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
          gmb_place_type: values.gmb_place_type?.trim() || null,
          gmb_place_type_secondary: values.gmb_place_type_secondary?.trim() || null,
          gmb_place_id: values.gmb_place_id?.trim() || null,
        })
        .eq("id", companyId);

      if (error) throw error;

      toast({
        title: "Dados salvos",
        description: "As informações da empresa foram atualizadas.",
      });
    } catch (err) {
      const msg = getErrorMessage(err);
      const hint =
        msg.includes("gmb_place") || msg.includes("does not exist")
          ? " Execute as migrations de GMB no SQL Editor do Supabase."
          : "";
      toast({
        variant: "destructive",
        title: "Erro ao salvar",
        description: msg + hint,
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
    action: "create" | "connect" | "connectionState" | "fetchInstances" | "logout" | "setWebhook" | "delete"
  ) {
    const instanceName = evolutionForm.getValues("evolution_instance_name")?.trim();

    // Conectar: se já conectado, informar e não chamar API
    if (action === "connect" && connectionState === "open") {
      toast({ title: "Instância já conectada", description: "Sua instância WhatsApp já está conectada." });
      return;
    }

    if (action === "create") setIsCreatingInstance(true);
    if (action === "connect") setIsConnecting(true);
    if (action === "connectionState") setIsCheckingConnection(true);
    if (action === "delete") setIsDeletingEvolution(true);
    try {
      const { data, error } = await executeEvolutionProxy(action, {
        instanceName: instanceName || undefined,
      });
      if (error) {
        if (action === "create" && /forbidden|403/i.test(error)) {
          toast({
            title: "Instância já criada",
            description: "A instância já existe. Clique em Conectar para gerar o QR Code.",
          });
          return;
        }
        toast({
          variant: "destructive",
          title: "Erro",
          description: error,
        });
        return;
      }
      const res = data as Record<string, unknown> | null;
      if (action === "create") {
        if (res?.instanceAlreadyExists) {
          toast({
            title: "Instância já criada",
            description: "A instância já existe. Clique em Conectar para gerar o QR Code.",
          });
        } else {
          toast({
            title: "Instância criada com sucesso",
            description: "Clique em Conectar para gerar o QR Code.",
          });
        }
      }
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
        // Pode ser que já esteja conectado (Evolution não retorna QR nesse caso)
        const stateAfterConnect = await checkConnectionState();
        if (stateAfterConnect === "open") {
          toast({ title: "Instância já conectada", description: "Sua instância WhatsApp já está conectada." });
        } else {
          toast({
            variant: "destructive",
            title: "QR Code não retornado",
            description: "A Evolution API não retornou o QR Code. Verifique se a instância existe.",
          });
        }
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
    if (action === "delete") {
      stopConnectionPolling();
      setQrCodeBase64(null);
      setConnectionState(null);
      evolutionForm.setValue("evolution_instance_name", "");
      if (companyId) {
        await supabase
          .from("companies")
          .update({ evolution_instance_name: null })
          .eq("id", companyId);
      }
      toast({
        title: "Conexão excluída",
        description: "A instância foi removida com sucesso.",
      });
      setIsDeleteEvolutionOpen(false);
    }
    } finally {
      if (action === "create") setIsCreatingInstance(false);
      if (action === "connect") setIsConnecting(false);
      if (action === "connectionState") setIsCheckingConnection(false);
      if (action === "delete") setIsDeletingEvolution(false);
    }
  }

  return (
    <div className="space-y-4 pt-4">
      {section === "empresa" && (
        <>
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

                      {/* Google Business (avançado) */}
                      <div className="space-y-4">
                        <h4 className="text-sm font-medium text-foreground">Google Business (avançado)</h4>
                        <div className="grid gap-4 sm:grid-cols-2">
                          <div className="space-y-2 sm:col-span-2">
                            <Label htmlFor="empresa_gmb_place_id">Place ID (somente leitura)</Label>
                            <Input
                              id="empresa_gmb_place_id"
                              type="text"
                              value={empresaForm.watch("gmb_place_id") ?? ""}
                              readOnly
                              className="font-mono text-xs bg-muted"
                            />
                            <p className="text-xs text-muted-foreground">
                              Identificador do seu local no Google. Normalmente preenchido automaticamente pelo módulo
                              GMB Local.
                            </p>
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor="empresa_gmb_place_type">Categoria principal</Label>
                            <Input
                              id="empresa_gmb_place_type"
                              type="text"
                              placeholder="Ex: dentist, insurance_agent"
                              className="font-mono text-xs"
                              {...empresaForm.register("gmb_place_type")}
                            />
                            <p className="text-xs text-muted-foreground">
                              Categoria principal do Google Places. Usada para buscar concorrentes no GMB Local.
                            </p>
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor="empresa_gmb_place_type_secondary">Categoria secundária (opcional)</Label>
                            <Input
                              id="empresa_gmb_place_type_secondary"
                              type="text"
                              placeholder="Ex: doctor, health"
                              className="font-mono text-xs"
                              {...empresaForm.register("gmb_place_type_secondary")}
                            />
                            <p className="text-xs text-muted-foreground">
                              Categoria secundária opcional do Google Places. Pode ser usada para análises futuras.
                            </p>
                          </div>
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
        </>
      )}
      {section === "integracoes" && (
        <>
              {!companyId && (
                <Alert variant="destructive" className="mb-4">
                  <AlertTitle>Empresa não identificada</AlertTitle>
                  <AlertDescription asChild>
                    <div className="mt-2 space-y-3">
                      <p>Selecione uma empresa antes de conectar integrações.</p>
                      {isAdmin && (
                        <div className="flex flex-wrap items-center gap-2">
                          <Select
                            disabled={isLoadingCompanies || companiesForAdmin.length === 0}
                            onValueChange={(id) => {
                              if (id) {
                                setAdminPreviewCompanyId(id);
                                navigate(`/dashboard/configuracoes/integracoes?preview=${encodeURIComponent(id)}`, { replace: true });
                              }
                            }}
                          >
                            <SelectTrigger className="w-[280px]">
                              <SelectValue placeholder={isLoadingCompanies ? "Carregando empresas…" : "Selecione a empresa"} />
                            </SelectTrigger>
                            <SelectContent>
                              {companiesForAdmin.map((c) => (
                                <SelectItem key={c.id} value={c.id}>
                                  {c.nome_fantasia || c.name || c.id}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <span className="text-sm text-muted-foreground">
                            {companiesForAdmin.length === 0 && !isLoadingCompanies && "Nenhuma empresa encontrada."}
                          </span>
                        </div>
                      )}
                      {!isAdmin && (
                        <p className="text-sm">Acesse o painel com uma empresa vinculada ao seu perfil ou entre em contato com o suporte.</p>
                      )}
                    </div>
                  </AlertDescription>
                </Alert>
              )}
              <Card>
                <CardHeader>
                  <CardTitle>Integrações</CardTitle>
                  <CardDescription>
                    Conecte suas plataformas de marketing e vendas. Em breve você poderá integrar com os principais serviços.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
                    {[
                      {
                        id: "whatsapp",
                        name: "WhatsApp",
                        icon: SiWhatsapp,
                        connected: isWhatsappConnected,
                        connecting: isWhatsappConnecting,
                        onConnect: handleWhatsappConnectClick,
                        onDisconnect: undefined,
                        connectLabel: "Conectar",
                        disabled: !isMetaSdkReady && !metaSdkLoadFailed,
                        reloadHint: metaSdkLoadFailed,
                      },
                      {
                        id: "instagram",
                        name: "Instagram",
                        icon: SiInstagram,
                        connected: isInstagramConnected,
                        connecting: metaConnectingService === "instagram",
                        onConnect: () => handleMetaConnect("instagram"),
                        onDisconnect: () => handleMetaDisconnect("instagram"),
                        connectLabel: "Conectar",
                      },
                      {
                        id: "facebook",
                        name: "Facebook",
                        icon: SiFacebook,
                        connected: isFacebookConnected,
                        connecting: metaConnectingService === "facebook",
                        onConnect: () => handleMetaConnect("facebook"),
                        onDisconnect: () => handleMetaDisconnect("facebook"),
                        connectLabel: "Conectar",
                      },
                      {
                        id: "meta-ads",
                        name: "Meta Ads",
                        icon: SiMeta,
                        connected: isMetaAdsConnected,
                        connecting: metaConnectingService === "meta_ads",
                        onConnect: () => handleMetaConnect("meta_ads"),
                        onDisconnect: () => handleMetaDisconnect("meta_ads"),
                        connectLabel: "Conectar",
                      },
                      {
                        id: "google-analytics",
                        name: "Google Analytics",
                        icon: SiGoogleanalytics,
                        connected: isGA4Connected,
                        connecting: isGoogleConnecting,
                        onConnect: () => handleGoogleConnect("ga4"),
                        onDisconnect: () => handleGoogleDisconnect("ga4"),
                        connectLabel: "Conectar",
                      },
                      {
                        id: "google-ads",
                        name: "Google Ads",
                        icon: SiGoogleads,
                        connected: isAdsConnected,
                        connecting: isGoogleConnecting,
                        onConnect: () => handleGoogleConnect("ads"),
                        onDisconnect: () => handleGoogleDisconnect("ads"),
                        connectLabel: "Conectar",
                      },
                      {
                        id: "google-meu-negocio",
                        name: "Google Meu Negócio",
                        icon: SiGoogle,
                        connected: isMyBusinessConnected,
                        connecting: isGoogleConnecting,
                        onConnect: () => handleGoogleConnect("mybusiness"),
                        onDisconnect: () => handleGoogleDisconnect("mybusiness"),
                        connectLabel: "Conectar",
                      },
                    ].map((int) => {
                      const Icon = int.icon;
                      return (
                        <Card
                          key={int.id}
                          className={cn(
                            "flex flex-col items-center justify-between gap-3 p-4 transition-colors",
                            int.connected
                              ? "border-primary bg-primary/10"
                              : "border-border bg-muted/30"
                          )}
                        >
                          <div className="flex flex-col items-center gap-2">
                            <Icon className="h-10 w-10 shrink-0 text-foreground" style={{ width: 40, height: 40 }} />
                            <p className="text-sm font-medium text-foreground">{int.name}</p>
                            {int.id === "google-ads" && adsAccountDisplayName && (
                              <p className="text-xs font-mono text-muted-foreground">Conta: {adsAccountDisplayName}</p>
                            )}
                          </div>
                          <div className="flex w-full flex-col gap-1">
                            <Button
                              size="sm"
                              variant={int.connected ? "outline" : "default"}
                              disabled={int.connecting || (int.disabled ?? false) || !companyId}
                              className={cn(
                                "w-full",
                                int.connected && "border-primary text-primary hover:bg-primary/10"
                              )}
                              onClick={int.reloadHint ? () => window.location.reload() : int.onConnect}
                            >
                              {int.connecting ? (
                                <>
                                  <Loader2 className="mr-1 h-4 w-4 animate-spin" />
                                  Conectando…
                                </>
                              ) : int.connected ? (
                                <>
                                  <Check className="mr-1 h-4 w-4" />
                                  Conectado
                                </>
                              ) : int.reloadHint ? (
                                "Recarregar página"
                              ) : (
                                int.connectLabel ?? "Conectar"
                              )}
                            </Button>
                            {int.connected && int.onDisconnect && (
                              <Button
                                variant="ghost"
                                size="sm"
                                className="w-full text-muted-foreground hover:text-foreground"
                                disabled={int.connecting}
                                onClick={int.onDisconnect}
                              >
                                Desconectar
                              </Button>
                            )}
                          </div>
                        </Card>
                      );
                    })}
                    <Card
                      key="wordpress"
                      className={cn(
                        "flex flex-col gap-3 p-4 transition-colors",
                        isWordpressConnected
                          ? "border-primary bg-primary/10"
                          : "border-border bg-muted/30"
                      )}
                    >
                      <div className="flex flex-col items-center gap-2">
                        <SiWordpress className="h-10 w-10 shrink-0 text-foreground" style={{ width: 40, height: 40 }} />
                        <p className="text-sm font-medium text-foreground">WordPress</p>
                      </div>
                      <div className="flex w-full flex-col gap-2">
                        <div className="space-y-1">
                          <Label htmlFor="wordpress-url" className="text-xs">
                            URL do site
                          </Label>
                          <Input
                            id="wordpress-url"
                            type="url"
                            placeholder="https://seusite.com"
                            value={wordpressSiteUrl}
                            onChange={(e) => setWordpressSiteUrl(e.target.value)}
                            disabled={!companyId}
                            className="h-8 text-sm"
                          />
                        </div>
                        <div className="space-y-1">
                          <Label htmlFor="wordpress-token" className="text-xs">
                            Token
                          </Label>
                          <Input
                            id="wordpress-token"
                            type="password"
                            placeholder="Token de API"
                            value={wordpressToken}
                            onChange={(e) => setWordpressToken(e.target.value)}
                            disabled={!companyId}
                            className="h-8 text-sm"
                          />
                        </div>
                        {isWordpressConnected ? (
                          <>
                            <Button
                              size="sm"
                              variant="outline"
                              className="w-full border-primary text-primary hover:bg-primary/10"
                              disabled
                            >
                              <Check className="mr-1 h-4 w-4" />
                              Conectado
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              className="w-full"
                              disabled={isSavingWordpress || !wordpressSiteUrl.trim() || !wordpressToken.trim()}
                              onClick={handleSaveWordpress}
                            >
                              {isSavingWordpress ? (
                                <>
                                  <Loader2 className="mr-1 h-4 w-4 animate-spin" />
                                  Salvando…
                                </>
                              ) : (
                                "Atualizar"
                              )}
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="w-full text-muted-foreground hover:text-foreground"
                              disabled={isSavingWordpress}
                              onClick={handleWordpressDisconnect}
                            >
                              Desconectar
                            </Button>
                          </>
                        ) : (
                          <Button
                            size="sm"
                            className="w-full"
                            disabled={isSavingWordpress || !companyId || !wordpressSiteUrl.trim() || !wordpressToken.trim()}
                            onClick={handleSaveWordpress}
                          >
                            {isSavingWordpress ? (
                              <>
                                <Loader2 className="mr-1 h-4 w-4 animate-spin" />
                                Salvando…
                              </>
                            ) : (
                              "Salvar"
                            )}
                          </Button>
                        )}
                      </div>
                    </Card>
                  </div>

                  {isGA4Connected && googleAnalyticsProperties.length === 0 && (
                    <div className="mt-6 flex flex-col items-start gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={isLoadingGoogleAnalyticsProperties}
                        onClick={handleLoadGoogleAnalyticsProperties}
                      >
                        {isLoadingGoogleAnalyticsProperties ? (
                          <>
                            <Loader2 className="mr-1 h-4 w-4 animate-spin" />
                            Buscando propriedades…
                          </>
                        ) : (
                          <>Ver propriedades do GA4</>
                        )}
                      </Button>
                      <p className="text-xs text-muted-foreground">
                        {selectedGoogleAnalyticsPropertyLabel
                          ? `Propriedade atual: ${selectedGoogleAnalyticsPropertyLabel}`
                          : "Carregue as propriedades da conta Google conectada para escolher qual será vinculada a esta empresa."}
                      </p>
                    </div>
                  )}

                  {(googleAnalyticsProperties.length > 0 || selectedGoogleAnalyticsPropertyLabel) && (
                    <div className="mt-6 space-y-3">
                      <h3 className="text-sm font-medium">Selecionar propriedade do Google Analytics</h3>
                      <p className="text-xs text-muted-foreground">
                        Escolha qual propriedade GA4 da conta conectada será usada como padrão nesta empresa.
                      </p>
                      {selectedGoogleAnalyticsPropertyLabel && (
                        <p className="text-xs text-muted-foreground">
                          Seleção atual: {selectedGoogleAnalyticsPropertyLabel}
                        </p>
                      )}
                      {googleAnalyticsProperties.length > 0 && (
                        <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
                          <div className="w-full space-y-1 sm:max-w-xl">
                            <Label htmlFor="google-analytics-property">Propriedade GA4</Label>
                            <Select
                              value={selectedGoogleAnalyticsPropertyName ?? ""}
                              onValueChange={(value) => setSelectedGoogleAnalyticsPropertyName(value)}
                            >
                              <SelectTrigger id="google-analytics-property">
                                <SelectValue placeholder="Selecione uma propriedade" />
                              </SelectTrigger>
                              <SelectContent>
                                {googleAnalyticsProperties.map((property) => (
                                  <SelectItem key={property.propertyName} value={property.propertyName}>
                                    {property.accountDisplayName} — {property.propertyDisplayName}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                          <Button
                            type="button"
                            className="sm:ml-2"
                            disabled={!selectedGoogleAnalyticsPropertyName || isSavingGoogleAnalyticsProperty}
                            onClick={handleSelectGoogleAnalyticsProperty}
                          >
                            {isSavingGoogleAnalyticsProperty ? (
                              <>
                                <Loader2 className="mr-1 h-4 w-4 animate-spin" />
                                Salvando…
                              </>
                            ) : (
                              <>Confirmar propriedade</>
                            )}
                          </Button>
                        </div>
                      )}
                    </div>
                  )}

                  {isMyBusinessConnected && myBusinessLocations.length === 0 && (
                    <div className="mt-6 flex flex-col items-start gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={isLoadingMyBusinessLocations}
                        onClick={handleLoadMyBusinessLocations}
                      >
                        {isLoadingMyBusinessLocations ? (
                          <>
                            <Loader2 className="mr-1 h-4 w-4 animate-spin" />
                            Buscando perfis…
                          </>
                        ) : (
                          <>Ver perfis do Meu Negócio</>
                        )}
                      </Button>
                      <p className="text-xs text-muted-foreground">
                        {selectedMyBusinessPropertyLabel
                          ? `Perfil atual: ${selectedMyBusinessPropertyLabel}`
                          : "Carregue os perfis da conta Google conectada para escolher qual será vinculado a esta empresa."}
                      </p>
                    </div>
                  )}

                  {(myBusinessLocations.length > 0 || selectedMyBusinessPropertyLabel) && (
                    <div className="mt-6 space-y-3">
                      <h3 className="text-sm font-medium">Selecionar perfil do Google Meu Negócio</h3>
                      <p className="text-xs text-muted-foreground">
                        Escolha qual perfil da conta conectada será usado como padrão nesta empresa.
                      </p>
                      {selectedMyBusinessPropertyLabel && (
                        <p className="text-xs text-muted-foreground">
                          Seleção atual: {selectedMyBusinessPropertyLabel}
                        </p>
                      )}
                      {myBusinessLocations.length > 0 && (
                        <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
                          <div className="w-full space-y-1 sm:max-w-xl">
                            <Label htmlFor="mybusiness-location">Perfil Meu Negócio</Label>
                            <Select
                              value={selectedMyBusinessPropertyName ?? ""}
                              onValueChange={(value) => setSelectedMyBusinessPropertyName(value)}
                            >
                              <SelectTrigger id="mybusiness-location">
                                <SelectValue placeholder="Selecione um perfil" />
                              </SelectTrigger>
                              <SelectContent>
                                {myBusinessLocations.map((loc) => (
                                  <SelectItem key={loc.propertyName} value={loc.propertyName}>
                                    {loc.accountDisplayName} — {loc.propertyDisplayName}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                          <Button
                            type="button"
                            className="sm:ml-2"
                            disabled={!selectedMyBusinessPropertyName || isSavingMyBusinessLocation}
                            onClick={handleSelectMyBusinessLocation}
                          >
                            {isSavingMyBusinessLocation ? (
                              <>
                                <Loader2 className="mr-1 h-4 w-4 animate-spin" />
                                Salvando…
                              </>
                            ) : (
                              <>Confirmar perfil</>
                            )}
                          </Button>
                        </div>
                      )}
                    </div>
                  )}

                  {whatsappPhoneNumbers.length > 0 && (
                    <div className="mt-6 space-y-3">
                      <h3 className="text-sm font-medium">Selecione o número do WhatsApp</h3>
                      <p className="text-xs text-muted-foreground">
                        Escolha qual número oficial será utilizado pelo SDR para enviar mensagens.
                      </p>
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
                        <div className="w-full space-y-1 sm:max-w-xs">
                          <Label htmlFor="whatsapp-phone-number">Número do WhatsApp</Label>
                          <Select
                            value={selectedWhatsappPhoneId ?? ""}
                            onValueChange={(value) => setSelectedWhatsappPhoneId(value)}
                          >
                            <SelectTrigger id="whatsapp-phone-number">
                              <SelectValue placeholder="Selecione um número" />
                            </SelectTrigger>
                            <SelectContent>
                              {whatsappPhoneNumbers.map((phone) => (
                                <SelectItem key={phone.id} value={phone.id}>
                                  {phone.display_phone_number}
                                  {phone.verified_name ? ` — ${phone.verified_name}` : ""}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <Button
                          type="button"
                          className="sm:ml-2"
                          disabled={!selectedWhatsappPhoneId || isSelectingWhatsappNumber}
                          onClick={handleWhatsappSelectPhoneNumber}
                        >
                          {isSelectingWhatsappNumber ? (
                            <>
                              <Loader2 className="mr-1 h-4 w-4 animate-spin" />
                              Salvando…
                            </>
                          ) : (
                            <>Confirmar número</>
                          )}
                        </Button>
                      </div>
                    </div>
                  )}

                  {(isInstagramConnected || isFacebookConnected) && metaAccounts.length === 0 && (
                    <div className="mt-6 flex flex-col items-start gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={isLoadingMetaAccounts}
                        onClick={handleLoadMetaAccounts}
                      >
                        {isLoadingMetaAccounts ? (
                          <>
                            <Loader2 className="mr-1 h-4 w-4 animate-spin" />
                            Buscando contas…
                          </>
                        ) : (
                          <>Ver contas</>
                        )}
                      </Button>
                      <p className="text-xs text-muted-foreground">
                        Carregue as páginas Facebook conectadas para vincular uma conta à empresa.
                      </p>
                    </div>
                  )}

                  {metaAccounts.length > 0 && (
                    <div className="mt-6 space-y-3">
                      <h3 className="text-sm font-medium">Páginas Facebook conectadas</h3>
                      <p className="text-xs text-muted-foreground">
                        Clique em uma conta com Instagram vinculado para simular a leitura de
                        métricas de alcance e impressões. Use o botão de seleção para definir qual
                        conta será vinculada a esta empresa no Cliente Ideal.
                      </p>
                      <div className="grid gap-3 md:grid-cols-2">
                        {metaAccounts.map((account) => (
                          <div
                            key={account.id}
                            className="flex h-full flex-col items-stretch rounded-lg border border-border bg-muted/30 px-3 py-3 text-left transition-colors hover:bg-muted"
                          >
                            <button
                              type="button"
                              onClick={() => void handleLoadMetaInsights(account.instagramBusinessId)}
                              className="flex flex-1 flex-col items-stretch text-left"
                            >
                              <div className="flex items-center justify-between gap-2">
                                <div>
                                  <p className="text-sm font-semibold text-foreground">
                                    {account.name || "Página sem nome"}
                                  </p>
                                  <p className="text-[11px] text-muted-foreground">
                                    Page ID:{" "}
                                    <span className="font-mono text-[11px]">{account.id}</span>
                                  </p>
                                </div>
                                <div className="flex flex-col items-end gap-1">
                                  <div className="rounded-full bg-background px-2 py-1 text-[10px] font-medium text-muted-foreground">
                                    {account.instagramBusinessId
                                      ? "Instagram vinculado"
                                      : "Sem Instagram vinculado"}
                                  </div>
                                  {account.isSelected && account.instagramBusinessId && (
                                    <Badge variant="outline" className="text-[10px] px-2 py-0.5">
                                      Conta da empresa
                                    </Badge>
                                  )}
                                </div>
                              </div>
                              {account.instagramBusinessId && (
                                <p className="mt-1 text-[11px] text-muted-foreground">
                                  Instagram Business ID:{" "}
                                  <span className="font-mono text-[11px]">
                                    {account.instagramBusinessId}
                                  </span>
                                </p>
                              )}
                            </button>
                            <div className="mt-2 flex items-center justify-between gap-2">
                              <p className="text-[11px] text-muted-foreground">
                                {account.isSelected
                                  ? "Esta é a conta atualmente vinculada à empresa."
                                  : account.instagramBusinessId
                                    ? "Defina esta conta como padrão para os insights."
                                    : "Vincule um Instagram Business a esta página para utilizá-la."}
                              </p>
                              <Button
                                size="sm"
                                variant={account.isSelected ? "outline" : "default"}
                                disabled={isLoadingMetaAccounts || !account.instagramBusinessId}
                                onClick={() => void handleSelectMetaAccount(account)}
                                className="shrink-0"
                              >
                                {account.isSelected ? "Conta vinculada" : "Vincular à empresa"}
                              </Button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {selectedInstagramId && (
                    <div className="mt-6 space-y-3">
                      <h3 className="text-sm font-medium">
                        Métricas do Instagram{" "}
                        <span className="font-mono text-[11px] align-middle">
                          ({selectedInstagramId})
                        </span>
                      </h3>
                      {isLoadingMetaInsights ? (
                        <div className="flex min-h-[80px] items-center justify-center">
                          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                        </div>
                      ) : metaInsights && metaInsights.length > 0 ? (
                        <div className="grid gap-3 sm:grid-cols-2">
                          {metaInsights.map((metric) => {
                            const latest = metric.values[metric.values.length - 1];
                            const label =
                              metric.metric === "reach"
                                ? "Alcance (último dia)"
                                : metric.metric === "profile_views"
                                  ? "Visualizações de perfil (último dia)"
                                  : metric.metric;
                            return (
                              <Card key={metric.metric}>
                                <CardHeader className="pb-2">
                                  <CardTitle className="text-sm">{label}</CardTitle>
                                  <CardDescription>Período diário (period=day)</CardDescription>
                                </CardHeader>
                                <CardContent>
                                  <p className="text-2xl font-semibold">
                                    {latest ? latest.value.toLocaleString("pt-BR") : "—"}
                                  </p>
                                  {latest?.endTime && (
                                    <p className="mt-1 text-xs text-muted-foreground">
                                      Até {new Date(latest.endTime).toLocaleDateString("pt-BR")}
                                    </p>
                                  )}
                                </CardContent>
                              </Card>
                            );
                          })}
                        </div>
                      ) : (
                        <p className="text-sm text-muted-foreground">
                          Nenhuma métrica carregada ainda. Clique em uma conta com Instagram
                          vinculado para buscar os dados.
                        </p>
                      )}
                    </div>
                  )}

                </CardContent>
              </Card>

        </>
      )}
      {section === "whatsapp" && (
        <>
              <Card>
                <CardHeader>
                  <CardTitle>WhatsApp</CardTitle>
                  <CardDescription>
                    Integração atual via Evolution API (WhatsApp). Crie uma instância e conecte via QR Code.
                    A URL e a API Key da Evolution API são configuradas pelo administrador.
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
                            disabled={isCreatingInstance || isConnecting}
                          >
                            {isCreatingInstance ? (
                              <>
                                <Loader2 className="h-4 w-4 animate-spin" />
                                Criando instância…
                              </>
                            ) : (
                              "Criar instância"
                            )}
                          </Button>
                          <Button
                            type="button"
                            variant="outline"
                            onClick={() => handleEvolutionAction("connect")}
                            disabled={
                              !evolutionForm.watch("evolution_instance_name")?.trim() ||
                              isCreatingInstance ||
                              isConnecting
                            }
                          >
                            {isConnecting ? (
                              <>
                                <Loader2 className="h-4 w-4 animate-spin" />
                                Conectando…
                              </>
                            ) : (
                              "Conectar / Gerar QR Code"
                            )}
                          </Button>
                          <Button
                            type="button"
                            variant="outline"
                            onClick={() => handleEvolutionAction("connectionState")}
                            disabled={
                              !evolutionForm.watch("evolution_instance_name")?.trim() ||
                              isCheckingConnection ||
                              isCreatingInstance ||
                              isConnecting
                            }
                          >
                            {isCheckingConnection ? (
                              <>
                                <Loader2 className="h-4 w-4 animate-spin" />
                                Verificando…
                              </>
                            ) : (
                              "Verificar conexão"
                            )}
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
                          <Button
                            type="button"
                            variant="outline"
                            className="text-destructive hover:text-destructive hover:bg-destructive/10"
                            onClick={() => setIsDeleteEvolutionOpen(true)}
                            disabled={
                              !evolutionForm.watch("evolution_instance_name")?.trim() ||
                              connectionState !== "open"
                            }
                          >
                            <Trash2 className="h-4 w-4" />
                            Excluir conexão
                          </Button>
                        </div>
                      </div>

                      {qrCodeBase64 && connectionState !== "open" && (
                        <div className="space-y-2">
                          <p className="text-sm font-medium">
                            Escaneie com WhatsApp no celular
                          </p>
                          <p className="text-xs text-muted-foreground">
                            Use o WhatsApp atualizado. Se aparecer &quot;dispositivo não pode conectar&quot;, atualize o WhatsApp e tente novamente.
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
                            {connectionState === "open"
                              ? "Conectado"
                              : connectionState === "close" || connectionState === "disconnected"
                                ? "Desconectado. Clique em Conectar para gerar novo QR Code."
                                : connectionState}
                          </p>
                        </div>
                      )}

                      <div className="space-y-4 border-t pt-4">
                        <h4 className="text-sm font-medium">Branding do WhatsApp</h4>
                        <form
                          onSubmit={dadosForm.handleSubmit(onDadosSubmit)}
                          className="grid gap-4 sm:grid-cols-2"
                        >
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
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>

              <Dialog open={isDeleteEvolutionOpen} onOpenChange={setIsDeleteEvolutionOpen}>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Excluir conexão</DialogTitle>
                    <DialogDescription>
                      Isso removerá a instância da Evolution API. Você precisará criar uma nova instância e conectar novamente. Deseja continuar?
                    </DialogDescription>
                  </DialogHeader>
                  <DialogFooter>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => setIsDeleteEvolutionOpen(false)}
                    >
                      Cancelar
                    </Button>
                    <Button
                      type="button"
                      variant="destructive"
                      disabled={isDeletingEvolution}
                      onClick={async () => {
                        await handleEvolutionAction("delete");
                      }}
                    >
                      {isDeletingEvolution ? (
                        <>
                          <Loader2 className="h-4 w-4 animate-spin" />
                          Excluindo…
                        </>
                      ) : (
                        "Excluir"
                      )}
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
        </>
      )}
    </div>
  );
}
