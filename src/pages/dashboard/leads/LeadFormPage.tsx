import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@clerk/clerk-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { useParams, useNavigate, Link } from "react-router-dom";

import {
  ChevronDown,
  Loader2,
  ArrowLeft,
  Save,
} from "lucide-react";

import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/app-sidebar";
import { ProfileDropdown } from "@/components/profile-dropdown";
import { useSupabaseClient } from "@/lib/supabase-context";
import { useToast } from "@/hooks/use-toast";
import { useEffectiveCompanyId } from "@/hooks/use-effective-company-id";

// --- Interfaces ---
interface VendedorOption {
  id: string;
  nome: string;
}

interface ItemOption {
  id: string;
  name: string;
  type: "product" | "service";
}

// --- Helpers ---
const cepRegex = /^\d{5}-?\d{3}$/;

const leadFormSchema = z.object({
  name: z.string().min(2, "O nome deve ter pelo menos 2 caracteres"),
  email: z.string().optional(),
  phone: z.string().optional(),
  external_id: z.string().optional(),
  status: z.enum(["Novo", "Em Contato", "Qualificado", "Perdido"]),
  classificacao: z.enum(["Frio", "Morno", "Quente"]).optional().nullable(),
  is_cliente: z.boolean().optional(),
  seller_id: z.string().optional(),
  data_nascimento: z.string().optional(),
  idade: z
    .string()
    .optional()
    .refine((v) => !v || v === "" || (parseInt(v, 10) >= 0 && parseInt(v, 10) <= 150),
      { message: "Idade deve ser entre 0 e 150" }
    ),
  cep: z
    .string()
    .optional()
    .refine((v) => !v || v.trim() === "" || cepRegex.test(v.replace(/\s/g, "")), {
      message: "CEP inválido (use 12345-678 ou 12345678)",
    }),
  item_id: z.string().optional(),
  utm_source: z.string().optional(),
  utm_medium: z.string().optional(),
  utm_campaign: z.string().optional(),
  utm_term: z.string().optional(),
  utm_content: z.string().optional(),
  utm_id: z.string().optional(),
  fbclid: z.string().optional(),
  gclid: z.string().optional(),
});

type LeadFormValues = z.infer<typeof leadFormSchema>;

const STATUS_OPTIONS = [
  { value: "Novo", label: "Novo" },
  { value: "Em Contato", label: "Em Contato" },
  { value: "Qualificado", label: "Qualificado" },
  { value: "Perdido", label: "Perdido" },
] as const;

const CLASSIFICACAO_OPTIONS = [
  { value: "none", label: "Não definido" },
  { value: "Frio", label: "Frio" },
  { value: "Morno", label: "Morno" },
  { value: "Quente", label: "Quente" },
] as const;

function normalizeClassificacao(value: string | null | undefined): "Frio" | "Morno" | "Quente" | null {
  if (!value || typeof value !== "string") return null;
  const lower = value.trim().toLowerCase();
  if (lower === "frio") return "Frio";
  if (lower === "morno") return "Morno";
  if (lower === "quente") return "Quente";
  return null;
}

const defaultFormValues: LeadFormValues = {
  name: "",
  email: "",
  phone: "",
  external_id: "",
  status: "Novo",
  classificacao: null,
  is_cliente: false,
  seller_id: "",
  data_nascimento: "",
  idade: "",
  cep: "",
  item_id: "",
  utm_source: "",
  utm_medium: "",
  utm_campaign: "",
  utm_term: "",
  utm_content: "",
  utm_id: "",
  fbclid: "",
  gclid: "",
};

export function LeadFormPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { userId } = useAuth();
  const supabase = useSupabaseClient();
  const { toast } = useToast();
  const effectiveCompanyId = useEffectiveCompanyId();

  const isNew = id === "novo";
  const editingId = isNew ? null : id ?? null;
  const [vendedores, setVendedores] = useState<VendedorOption[]>([]);
  const [items, setItems] = useState<ItemOption[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isFetching, setIsFetching] = useState(!isNew);

  const form = useForm<LeadFormValues>({
    resolver: zodResolver(leadFormSchema),
    defaultValues: defaultFormValues,
  });

  const loadVendedores = useCallback(async () => {
    if (!effectiveCompanyId) return;
    try {
      const { data, error } = await supabase
        .from("vendedores")
        .select("id, nome")
        .eq("company_id", effectiveCompanyId)
        .eq("status", true);
      if (error) throw error;
      setVendedores((data as VendedorOption[]) ?? []);
      // #region agent log
      const vendedoresPayload = {
        sessionId: "8ad401",
        runId: "leads-debug",
        hypothesisId: "H12",
        location: "LeadFormPage.tsx:loadVendedores:success",
        message: "Loaded vendedores for lead form",
        data: {
          effectiveCompanyId,
          count: Array.isArray(data) ? data.length : 0,
        },
        timestamp: Date.now(),
      };
      fetch("http://127.0.0.1:7243/ingest/bc96f30d-a63c-4828-beaf-5cec801979c8", {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-Debug-Session-Id": "8ad401" },
        body: JSON.stringify(vendedoresPayload),
      }).catch(() => {});
      console.log("[debug 8ad401]", vendedoresPayload);
      // #endregion
    } catch (err) {
      console.error("Erro ao carregar vendedores:", err);
      // #region agent log
      const vendedoresErrorPayload = {
        sessionId: "8ad401",
        runId: "leads-debug",
        hypothesisId: "H13",
        location: "LeadFormPage.tsx:loadVendedores:error",
        message: "Failed loading vendedores",
        data: {
          effectiveCompanyId,
          errorMessage: err instanceof Error ? err.message : String(err),
        },
        timestamp: Date.now(),
      };
      fetch("http://127.0.0.1:7243/ingest/bc96f30d-a63c-4828-beaf-5cec801979c8", {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-Debug-Session-Id": "8ad401" },
        body: JSON.stringify(vendedoresErrorPayload),
      }).catch(() => {});
      console.log("[debug 8ad401]", vendedoresErrorPayload);
      // #endregion
    }
  }, [effectiveCompanyId, supabase]);

  const loadItems = useCallback(async () => {
    if (!effectiveCompanyId) return;
    try {
      const { data, error } = await supabase
        .from("items")
        .select("id, name, type")
        .eq("company_id", effectiveCompanyId)
        .in("type", ["product", "service"]);
      if (error) throw error;
      setItems(
        (data ?? []).map((r: { id: string; name: string; type: string }) => ({
          id: r.id,
          name: r.name ?? "",
          type: r.type === "service" ? "service" : "product",
        }))
      );
    } catch (err) {
      console.error("Erro ao carregar produtos e serviços:", err);
    }
  }, [effectiveCompanyId, supabase]);

  const loadLead = useCallback(async () => {
    if (!editingId || !effectiveCompanyId) return;
    setIsFetching(true);
    // #region agent log
    const loadLeadStartPayload = {
      sessionId: "8ad401",
      runId: "leads-debug",
      hypothesisId: "H12",
      location: "LeadFormPage.tsx:loadLead:start",
      message: "Starting loadLead",
      data: { editingId, effectiveCompanyId },
      timestamp: Date.now(),
    };
    fetch("http://127.0.0.1:7243/ingest/bc96f30d-a63c-4828-beaf-5cec801979c8", {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Debug-Session-Id": "8ad401" },
      body: JSON.stringify(loadLeadStartPayload),
    }).catch(() => {});
    console.log("[debug 8ad401]", loadLeadStartPayload);
    // #endregion
    try {
      const { data, error } = await supabase
        .from("leads")
        .select("id, name, email, phone, external_id, status, classificacao, is_cliente, seller_id, data_nascimento, idade, cep, item_id, utm_source, utm_medium, utm_campaign, utm_term, utm_content, utm_id, fbclid, gclid")
        .eq("id", editingId)
        .eq("company_id", effectiveCompanyId)
        .single();

      if (error) throw error;
      if (data) {
        const normalizedClassificacao = normalizeClassificacao(data.classificacao);
        const normalizedStatus = data.status === "Cliente" ? "Qualificado" : data.status;
        form.reset({
          name: data.name ?? "",
          email: data.email ?? "",
          phone: data.phone ?? "",
          external_id: data.external_id ?? "",
          status: normalizedStatus,
          classificacao: normalizedClassificacao,
          is_cliente: data.is_cliente ?? false,
          seller_id: data.seller_id ?? "",
          data_nascimento: data.data_nascimento ?? "",
          idade: data.idade != null ? String(data.idade) : "",
          cep: data.cep ?? "",
          item_id: data.item_id ?? "",
          utm_source: data.utm_source ?? "",
          utm_medium: data.utm_medium ?? "",
          utm_campaign: data.utm_campaign ?? "",
          utm_term: data.utm_term ?? "",
          utm_content: data.utm_content ?? "",
          utm_id: data.utm_id ?? "",
          fbclid: data.fbclid ?? "",
          gclid: data.gclid ?? "",
        });
      }
      // #region agent log
      const loadLeadSuccessPayload = {
        sessionId: "8ad401",
        runId: "leads-debug",
        hypothesisId: "H12",
        location: "LeadFormPage.tsx:loadLead:success",
        message: "loadLead succeeded",
        data: { editingId, effectiveCompanyId, found: Boolean(data) },
        timestamp: Date.now(),
      };
      fetch("http://127.0.0.1:7243/ingest/bc96f30d-a63c-4828-beaf-5cec801979c8", {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-Debug-Session-Id": "8ad401" },
        body: JSON.stringify(loadLeadSuccessPayload),
      }).catch(() => {});
      console.log("[debug 8ad401]", loadLeadSuccessPayload);
      // #endregion
    } catch {
      // #region agent log
      const loadLeadErrorPayload = {
        sessionId: "8ad401",
        runId: "leads-debug",
        hypothesisId: "H13",
        location: "LeadFormPage.tsx:loadLead:error",
        message: "loadLead failed",
        data: { editingId, effectiveCompanyId },
        timestamp: Date.now(),
      };
      fetch("http://127.0.0.1:7243/ingest/bc96f30d-a63c-4828-beaf-5cec801979c8", {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-Debug-Session-Id": "8ad401" },
        body: JSON.stringify(loadLeadErrorPayload),
      }).catch(() => {});
      console.log("[debug 8ad401]", loadLeadErrorPayload);
      // #endregion
      toast({
        variant: "destructive",
        title: "Erro",
        description: "Falha ao carregar dados do lead.",
      });
      navigate("/dashboard/leads");
    } finally {
      setIsFetching(false);
    }
  }, [editingId, effectiveCompanyId, supabase, toast, navigate, form]);

  useEffect(() => {
    if (effectiveCompanyId) {
      loadVendedores();
      loadItems();
    }
  }, [effectiveCompanyId, loadVendedores, loadItems]);

  useEffect(() => {
    if (!isNew && editingId && effectiveCompanyId) {
      loadLead();
    }
  }, [isNew, editingId, effectiveCompanyId, loadLead]);

  async function onSubmit(values: LeadFormValues) {
    if (!effectiveCompanyId || !userId) {
      toast({
        variant: "destructive",
        title: "Erro",
        description: "Usuário ou empresa não identificados.",
      });
      return;
    }

    setIsLoading(true);
    try {
      const payload = {
        company_id: effectiveCompanyId,
        user_id: userId,
        name: values.name.trim(),
        email: values.email?.trim() || null,
        phone: values.phone?.trim() || null,
        external_id: values.external_id?.trim() || null,
        seller_id: values.seller_id || null,
        status: values.status,
        classificacao: values.classificacao || null,
        is_cliente: values.is_cliente ?? false,
        data_nascimento: values.data_nascimento?.trim() || null,
        idade: values.idade ? parseInt(String(values.idade), 10) : null,
        cep: values.cep?.trim() || null,
        item_id: values.item_id || null,
        utm_source: values.utm_source?.trim() || null,
        utm_medium: values.utm_medium?.trim() || null,
        utm_campaign: values.utm_campaign?.trim() || null,
        utm_term: values.utm_term?.trim() || null,
        utm_content: values.utm_content?.trim() || null,
        utm_id: values.utm_id?.trim() || null,
        fbclid: values.fbclid?.trim() || null,
        gclid: values.gclid?.trim() || null,
      };

      if (editingId) {
        const { error } = await supabase
          .from("leads")
          .update(payload)
          .eq("id", editingId)
          .eq("company_id", effectiveCompanyId);

        if (error) throw error;
        toast({
          title: "Lead atualizado",
          description: "As alterações foram salvas.",
        });
      } else {
        const { data, error } = await supabase
          .from("leads")
          .insert(payload)
          .select("id")
          .single();

        if (error) throw error;
        toast({
          title: "Lead criado",
          description: `${values.name} foi cadastrado com sucesso.`,
        });
        if (data?.id) {
          navigate(`/dashboard/leads/${data.id}`);
          return;
        }
      }

      navigate("/dashboard/leads");
    } catch (err) {
      const msg =
        err instanceof Error
          ? err.message
          : (err && typeof err === "object" && "message" in err)
            ? String((err as { message: unknown }).message)
            : "Erro desconhecido";
      toast({
        variant: "destructive",
        title: "Erro ao salvar",
        description: msg,
      });
    } finally {
      setIsLoading(false);
    }
  }

  if (isFetching && !isNew) {
    return (
      <SidebarProvider>
        <AppSidebar />
        <SidebarInset>
          <header className="flex h-16 shrink-0 items-center gap-2 border-b border-border px-4">
            <SidebarTrigger className="-ml-1" />
            <Separator orientation="vertical" className="mr-2 data-[orientation=vertical]:h-4" />
            <Breadcrumb>
              <BreadcrumbList>
                <BreadcrumbItem className="hidden md:block">
                  <BreadcrumbLink asChild>
                    <Link to="/dashboard">Dashboard</Link>
                  </BreadcrumbLink>
                </BreadcrumbItem>
                <BreadcrumbSeparator className="hidden md:block" />
                <BreadcrumbItem>
                  <BreadcrumbLink asChild>
                    <Link to="/dashboard/leads">Leads</Link>
                  </BreadcrumbLink>
                </BreadcrumbItem>
                <BreadcrumbSeparator className="hidden md:block" />
                <BreadcrumbItem>
                  <BreadcrumbPage>Carregando...</BreadcrumbPage>
                </BreadcrumbItem>
              </BreadcrumbList>
            </Breadcrumb>
            <ProfileDropdown className="ml-auto" />
          </header>
          <div className="flex flex-1 items-center justify-center p-8">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        </SidebarInset>
      </SidebarProvider>
    );
  }

  return (
    <SidebarProvider>
      <AppSidebar />
      <SidebarInset>
        <header className="flex h-16 shrink-0 items-center gap-2 border-b border-border px-4">
          <SidebarTrigger className="-ml-1" />
          <Separator orientation="vertical" className="mr-2 data-[orientation=vertical]:h-4" />
          <Breadcrumb>
            <BreadcrumbList>
              <BreadcrumbItem className="hidden md:block">
                <BreadcrumbLink asChild>
                  <Link to="/dashboard">Dashboard</Link>
                </BreadcrumbLink>
              </BreadcrumbItem>
              <BreadcrumbSeparator className="hidden md:block" />
              <BreadcrumbItem>
                <BreadcrumbLink asChild>
                  <Link to="/dashboard/leads">Leads</Link>
                </BreadcrumbLink>
              </BreadcrumbItem>
              <BreadcrumbSeparator className="hidden md:block" />
              <BreadcrumbItem>
                <BreadcrumbPage>
                  {isNew ? "Novo Lead" : "Editar Lead"}
                </BreadcrumbPage>
              </BreadcrumbItem>
            </BreadcrumbList>
          </Breadcrumb>
          <ProfileDropdown className="ml-auto" />
        </header>

        <div className="flex flex-1 flex-col gap-4 p-4 overflow-auto">
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="icon" asChild>
              <Link to="/dashboard/leads">
                <ArrowLeft className="h-4 w-4" />
              </Link>
            </Button>
            <div>
              <h2 className="text-2xl font-bold tracking-tight">
                {isNew ? "Cadastrar Novo Lead" : "Editar Lead"}
              </h2>
              <p className="text-sm text-muted-foreground">
                {isNew
                  ? "Preencha as informações para iniciar o rastreio do lead."
                  : "Altere as informações do lead conforme necessário."}
              </p>
            </div>
          </div>

          <Card className="max-w-2xl">
            <CardHeader>
              <CardTitle>Dados do Lead</CardTitle>
              <CardDescription>
                Informações básicas, contato e rastreamento.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form
                className="grid gap-6"
                onSubmit={form.handleSubmit(onSubmit)}
              >
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="name">Nome Completo</Label>
                    <Input id="name" placeholder="Ex: João Silva" {...form.register("name")} />
                    {form.formState.errors.name && (
                      <p className="text-xs text-destructive">{form.formState.errors.name.message}</p>
                    )}
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="external_id">External ID</Label>
                    <Input id="external_id" placeholder="ID do CRM" {...form.register("external_id")} />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="email">Email</Label>
                    <Input id="email" type="email" placeholder="email@exemplo.com" {...form.register("email")} />
                    {form.formState.errors.email && (
                      <p className="text-xs text-destructive">{form.formState.errors.email.message}</p>
                    )}
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="phone">Telefone</Label>
                    <Input id="phone" placeholder="(00) 00000-0000" {...form.register("phone")} />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Classificação</Label>
                    <Select
                      value={form.watch("classificacao") ?? "none"}
                      onValueChange={(v: string) =>
                        form.setValue("classificacao", v === "none" ? null : (v as "Frio" | "Morno" | "Quente"))
                      }
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione..." />
                      </SelectTrigger>
                      <SelectContent>
                        {CLASSIFICACAO_OPTIONS.map((opt) => (
                          <SelectItem key={opt.value} value={opt.value}>
                            {opt.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Status</Label>
                    <Select
                      value={form.watch("status")}
                      onValueChange={(v: string) => form.setValue("status", v as LeadFormValues["status"])}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {STATUS_OPTIONS.map((opt) => (
                          <SelectItem key={opt.value} value={opt.value}>
                            {opt.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Atribuir Vendedor</Label>
                    <Select
                      value={form.watch("seller_id") || "none"}
                      onValueChange={(v: string) => form.setValue("seller_id", v === "none" ? "" : v)}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione..." />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">Nenhum</SelectItem>
                        {vendedores.map((v) => (
                          <SelectItem key={v.id} value={v.id}>
                            {v.nome}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  {!isNew && (
                    <div className="flex items-center space-x-2">
                      <Switch
                        id="is_cliente"
                        checked={form.watch("is_cliente") ?? false}
                        onCheckedChange={(checked) => form.setValue("is_cliente", checked)}
                      />
                      <Label htmlFor="is_cliente" className="cursor-pointer">
                        Marcar como cliente (convertido)
                      </Label>
                    </div>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="data_nascimento">Data de Nascimento</Label>
                    <Input id="data_nascimento" type="date" {...form.register("data_nascimento")} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="idade">Idade</Label>
                    <Input
                      id="idade"
                      type="number"
                      min={0}
                      max={150}
                      placeholder="Ex: 35"
                      {...form.register("idade")}
                    />
                    {form.formState.errors.idade && (
                      <p className="text-xs text-destructive">{form.formState.errors.idade.message}</p>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="cep">CEP</Label>
                    <Input id="cep" placeholder="12345-678" {...form.register("cep")} />
                    {form.formState.errors.cep && (
                      <p className="text-xs text-destructive">{form.formState.errors.cep.message}</p>
                    )}
                  </div>
                  <div className="space-y-2">
                    <Label>Produto ou Serviço</Label>
                    <Select
                      value={form.watch("item_id") || "none"}
                      onValueChange={(v: string) => form.setValue("item_id", v === "none" ? "" : v)}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione..." />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">Nenhum</SelectItem>
                        <SelectGroup>
                          <SelectLabel>Produtos</SelectLabel>
                          {items
                            .filter((i) => i.type === "product")
                            .map((p) => (
                              <SelectItem key={p.id} value={p.id}>
                                {p.name}
                              </SelectItem>
                            ))}
                        </SelectGroup>
                        <SelectGroup>
                          <SelectLabel>Serviços</SelectLabel>
                          {items
                            .filter((i) => i.type === "service")
                            .map((s) => (
                              <SelectItem key={s.id} value={s.id}>
                                {s.name}
                              </SelectItem>
                            ))}
                        </SelectGroup>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <Collapsible>
                  <CollapsibleTrigger asChild>
                    <Button type="button" variant="outline" className="w-full justify-between">
                      Rastreamento (UTM, GCLID, FBCLID)
                      <ChevronDown className="h-4 w-4" />
                    </Button>
                  </CollapsibleTrigger>
                  <CollapsibleContent>
                    <div className="grid grid-cols-2 gap-4 pt-4">
                      <div className="space-y-2">
                        <Label htmlFor="utm_source">UTM Source</Label>
                        <Input id="utm_source" placeholder="google" {...form.register("utm_source")} />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="utm_medium">UTM Medium</Label>
                        <Input id="utm_medium" placeholder="cpc" {...form.register("utm_medium")} />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="utm_campaign">UTM Campaign</Label>
                        <Input id="utm_campaign" placeholder="campanha" {...form.register("utm_campaign")} />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="utm_id">UTM ID</Label>
                        <Input id="utm_id" placeholder="ID" {...form.register("utm_id")} />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="utm_term">UTM Term</Label>
                        <Input id="utm_term" placeholder="termo" {...form.register("utm_term")} />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="utm_content">UTM Content</Label>
                        <Input id="utm_content" placeholder="conteúdo" {...form.register("utm_content")} />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="gclid">GCLID</Label>
                        <Input id="gclid" placeholder="Google Click ID" {...form.register("gclid")} />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="fbclid">FBCLID</Label>
                        <Input id="fbclid" placeholder="Facebook Click ID" {...form.register("fbclid")} />
                      </div>
                    </div>
                  </CollapsibleContent>
                </Collapsible>

                <div className="flex gap-2 pt-2">
                  <Button variant="outline" type="button" asChild>
                    <Link to="/dashboard/leads">Cancelar</Link>
                  </Button>
                  <Button type="submit" disabled={isLoading}>
                    {isLoading ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Salvando...
                      </>
                    ) : (
                      <>
                        <Save className="mr-2 h-4 w-4" />
                        {isNew ? "Salvar Lead" : "Salvar Alterações"}
                      </>
                    )}
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}
