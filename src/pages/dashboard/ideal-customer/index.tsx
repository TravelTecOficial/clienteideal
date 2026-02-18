import { useEffect, useState, useCallback } from "react";
import { useAuth } from "@clerk/clerk-react";
import type { SupabaseClient } from "@supabase/supabase-js";
import { useSupabaseClient } from "@/lib/supabase-context";
import { SUPABASE_URL, SUPABASE_ANON_KEY } from "@/lib/supabase";
import { getErrorMessage } from "@/lib/utils";

// --- Helpers ---
interface ProfileRow {
  company_id: string | null;
}

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

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
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
import { useToast } from "@/hooks/use-toast";
import { User, Brain, ShoppingCart, Save, Loader2, Plus, Edit2, Trash2, ImageIcon, Copy } from "lucide-react";

// Schema de Validação
const idealCustomerSchema = z.object({
  profile_name: z.string().min(2, "O nome do perfil é obrigatório"),
  age_range: z.string().optional(),
  gender: z.string().optional(),
  location: z.string().optional(),
  income_level: z.string().optional(),
  job_title: z.string().optional(),
  goals_dreams: z.string().optional(),
  pain_points: z.string().optional(),
  values_list: z.string().optional(),
  hobbies_interests: z.string().optional(),
  buying_journey: z.string().optional(),
  decision_criteria: z.string().optional(),
  common_objections: z.string().optional(),
  target_product: z.string().optional(),
});

type IdealCustomerFormValues = z.infer<typeof idealCustomerSchema>;

interface IdealCustomerRow {
  id: string;
  profile_name: string | null;
  job_title: string | null;
  location: string | null;
  avatar_url: string | null;
}

interface PersonaTemplateRow {
  id: string;
  profile_name: string | null;
  description: string | null;
  job_title: string | null;
  location: string | null;
  avatar_url?: string | null;
  segment_type?: "geral" | "produtos" | "consorcio" | "seguros" | null;
  age_range?: string | null;
  gender?: string | null;
  income_level?: string | null;
  goals_dreams?: string | null;
  pain_points?: string | null;
  values_list?: string | null;
  hobbies_interests?: string | null;
  buying_journey?: string | null;
  decision_criteria?: string | null;
  common_objections?: string | null;
  target_product?: string | null;
}

export default function IdealCustomerPage() {
  const { userId, getToken } = useAuth();
  const supabase = useSupabaseClient();
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [isFetching, setIsFetching] = useState(true);
  const [companyId, setCompanyId] = useState<string | null>(null);
  const [clientes, setClientes] = useState<IdealCustomerRow[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [generatingAvatarId, setGeneratingAvatarId] = useState<string | null>(null);
  const [editingAvatarUrl, setEditingAvatarUrl] = useState<string | null>(null);
  const [isCopyModalOpen, setIsCopyModalOpen] = useState(false);
  const [templates, setTemplates] = useState<PersonaTemplateRow[]>([]);
  const [isLoadingTemplates, setIsLoadingTemplates] = useState(false);
  const [copyingTemplateId, setCopyingTemplateId] = useState<string | null>(null);
  const [companySegmentType, setCompanySegmentType] = useState<string>("produtos");
  const [isAvatarPreviewOpen, setIsAvatarPreviewOpen] = useState(false);
  const [previewAvatarUrl, setPreviewAvatarUrl] = useState<string | null>(null);
  const [previewAvatarName, setPreviewAvatarName] = useState<string>("persona");

  const effectiveCompanyId = companyId;

  // Buscar company_id do perfil (como nas outras páginas do dashboard)
  useEffect(() => {
    async function init() {
      if (!userId) return;
      const cid = await fetchCompanyId(supabase, userId);
      setCompanyId(cid);
    }
    init();
  }, [userId, supabase]);

  const form = useForm<IdealCustomerFormValues>({
    resolver: zodResolver(idealCustomerSchema),
    defaultValues: {
      profile_name: "",
      job_title: "",
      goals_dreams: "",
      pain_points: "",
      common_objections: "",
    },
  });

  const loadClientes = useCallback(async () => {
    if (!effectiveCompanyId) {
      setIsFetching(false);
      setClientes([]);
      return;
    }
    setIsFetching(true);
    try {
      const { data, error } = await supabase
        .from("ideal_customers")
        .select("id, profile_name, job_title, location, avatar_url")
        .eq("company_id", effectiveCompanyId)
        .order("created_at", { ascending: false });

      if (error) throw error;
      setClientes((data as IdealCustomerRow[]) ?? []);
    } catch (err) {
      console.error("Erro ao carregar clientes ideais:", err);
      toast({
        variant: "destructive",
        title: "Erro",
        description: "Falha ao carregar lista de clientes ideais.",
      });
    } finally {
      setIsFetching(false);
    }
  }, [effectiveCompanyId, supabase, toast]);

  useEffect(() => {
    loadClientes();
  }, [loadClientes]);

  useEffect(() => {
    async function loadCompanySegment() {
      if (!effectiveCompanyId) return;
      const { data, error } = await supabase
        .from("companies")
        .select("segment_type")
        .eq("id", effectiveCompanyId)
        .maybeSingle();
      if (error) {
        console.error("Erro ao carregar segmento da empresa:", error);
        return;
      }
      const segment = (data as { segment_type?: string | null } | null)?.segment_type;
      if (segment) setCompanySegmentType(segment);
    }
    loadCompanySegment();
  }, [effectiveCompanyId, supabase]);

  const loadTemplates = useCallback(async () => {
    setIsLoadingTemplates(true);
    try {
      const { data, error } = await supabase
        .from("persona_templates")
        .select("id, profile_name, description, job_title, location, avatar_url, segment_type, age_range, gender, income_level, goals_dreams, pain_points, values_list, hobbies_interests, buying_journey, decision_criteria, common_objections, target_product")
        .order("created_at", { ascending: false });

      if (error) throw error;
      const allTemplates = (data as PersonaTemplateRow[]) ?? [];
      const allowedTemplates = allTemplates.filter((t) => {
        const segment = t.segment_type ?? "geral";
        return segment === "geral" || segment === companySegmentType;
      });
      setTemplates(allowedTemplates);
    } catch (err) {
      console.error("Erro ao carregar modelos:", err);
      toast({
        variant: "destructive",
        title: "Erro",
        description: "Falha ao carregar modelos de persona.",
      });
    } finally {
      setIsLoadingTemplates(false);
    }
  }, [supabase, toast]);

  const handleOpenCopyModal = useCallback(() => {
    setIsCopyModalOpen(true);
    loadTemplates();
  }, [loadTemplates]);

  async function handleCopyTemplate(t: PersonaTemplateRow) {
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
      const payload = {
        profile_name: t.profile_name ?? "",
        age_range: t.age_range ?? null,
        gender: t.gender ?? null,
        location: t.location ?? null,
        income_level: t.income_level ?? null,
        job_title: t.job_title ?? null,
        goals_dreams: t.goals_dreams ?? null,
        pain_points: t.pain_points ?? null,
        values_list: t.values_list ?? null,
        hobbies_interests: t.hobbies_interests ?? null,
        buying_journey: t.buying_journey ?? null,
        decision_criteria: t.decision_criteria ?? null,
        common_objections: t.common_objections ?? null,
        target_product: t.target_product ?? null,
        avatar_url: t.avatar_url ?? null,
        user_id: userId,
        company_id: effectiveCompanyId,
      };

      const { error } = await supabase
        .from("ideal_customers")
        .insert(payload);

      if (error) throw error;
      toast({
        title: "Copiado!",
        description: `Persona "${t.profile_name ?? "modelo"}" copiado para sua empresa.`,
      });
      setIsCopyModalOpen(false);
      loadClientes();
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

  const handleOpenNew = () => {
    setEditingId(null);
    setEditingAvatarUrl(null);
    form.reset({
      profile_name: "",
      age_range: "",
      gender: "",
      location: "",
      income_level: "",
      job_title: "",
      goals_dreams: "",
      pain_points: "",
      values_list: "",
      hobbies_interests: "",
      buying_journey: "",
      decision_criteria: "",
      common_objections: "",
      target_product: "",
    });
    setIsModalOpen(true);
  };

  const handleOpenEdit = async (id: string) => {
    setEditingId(id);
    try {
      const { data, error } = await supabase
        .from("ideal_customers")
        .select("*")
        .eq("id", id)
        .single();

      if (error) throw error;
      if (data) {
        form.reset({
          profile_name: data.profile_name ?? "",
          age_range: data.age_range ?? "",
          gender: data.gender ?? "",
          location: data.location ?? "",
          income_level: data.income_level ?? "",
          job_title: data.job_title ?? "",
          goals_dreams: data.goals_dreams ?? "",
          pain_points: data.pain_points ?? "",
          values_list: data.values_list ?? "",
          hobbies_interests: data.hobbies_interests ?? "",
          buying_journey: data.buying_journey ?? "",
          decision_criteria: data.decision_criteria ?? "",
          common_objections: data.common_objections ?? "",
          target_product: data.target_product ?? "",
        });
        setEditingAvatarUrl(data.avatar_url ?? null);
      }
    } catch (err) {
      toast({
        variant: "destructive",
        title: "Erro",
        description: "Falha ao carregar dados do cliente ideal.",
      });
    }
    setIsModalOpen(true);
  };

  async function onSubmit(values: IdealCustomerFormValues) {
    if (!userId) {
      toast({
        variant: "destructive",
        title: "Erro ao salvar",
        description: "Sessão inválida. Faça login novamente.",
      });
      return;
    }
    if (!effectiveCompanyId) {
      toast({
        variant: "destructive",
        title: "Erro ao salvar",
        description: "Empresa não vinculada. Configure sua empresa em Configurações.",
      });
      return;
    }

    setIsLoading(true);
    try {
      const payload = {
        profile_name: values.profile_name.trim(),
        age_range: values.age_range?.trim() || null,
        gender: values.gender?.trim() || null,
        location: values.location?.trim() || null,
        income_level: values.income_level?.trim() || null,
        job_title: values.job_title?.trim() || null,
        goals_dreams: values.goals_dreams?.trim() || null,
        pain_points: values.pain_points?.trim() || null,
        values_list: values.values_list?.trim() || null,
        hobbies_interests: values.hobbies_interests?.trim() || null,
        buying_journey: values.buying_journey?.trim() || null,
        decision_criteria: values.decision_criteria?.trim() || null,
        common_objections: values.common_objections?.trim() || null,
        target_product: values.target_product?.trim() || null,
        user_id: userId,
        company_id: effectiveCompanyId,
      };

      if (editingId) {
        const { error } = await supabase
          .from("ideal_customers")
          .update(payload)
          .eq("id", editingId)
          .eq("company_id", effectiveCompanyId);

        if (error) throw error;
        toast({
          title: "Atualizado!",
          description: "Cliente ideal atualizado com sucesso.",
        });
      } else {
        const { error } = await supabase
          .from("ideal_customers")
          .insert(payload);

        if (error) throw error;
        toast({
          title: "Cadastrado!",
          description: "Cliente ideal cadastrado com sucesso.",
        });
      }

      setIsModalOpen(false);
      loadClientes();
    } catch (err: unknown) {
      console.error("[Cliente Ideal] Erro ao gravar:", err);
      toast({
        variant: "destructive",
        title: "Erro ao salvar",
        description: getErrorMessage(err, "Erro ao salvar."),
      });
    } finally {
      setIsLoading(false);
    }
  }

  async function handleGenerateAvatar(c: IdealCustomerRow) {
    if (!effectiveCompanyId) return;
    setGeneratingAvatarId(c.id);
    try {
      const token = (await getToken()) ?? (await getToken({ template: "supabase" }));
      // #region agent log
      const logPayload = {
        sessionId: "4cee35",
        location: "ideal-customer/index.tsx:handleGenerateAvatar",
        message: "handleGenerateAvatar pre-fetch",
        data: {
          tokenPresent: !!token,
          tokenStartsWithEyJ: typeof token === "string" ? token.startsWith("eyJ") : false,
          tokenLength: typeof token === "string" ? token.length : 0,
          personaId: c.id,
        },
        timestamp: Date.now(),
        hypothesisId: "H2",
      };
      console.debug("[DEBUG 4cee35]", logPayload);
      fetch("http://127.0.0.1:7243/ingest/bc96f30d-a63c-4828-beaf-5cec801979c8", {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-Debug-Session-Id": "4cee35" },
        body: JSON.stringify(logPayload),
      }).catch(() => {});
      // #endregion
      if (!token) {
        toast({ variant: "destructive", title: "Erro", description: "Sessão inválida. Faça login novamente." });
        return;
      }
      // Padrão evolution-proxy: anon key no header (gateway), Clerk token no body
      const res = await fetch(`${SUPABASE_URL}/functions/v1/persona-generate-avatar`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
        },
        body: JSON.stringify({ persona_id: c.id, token }),
      });

      const data = (await res.json().catch(() => ({}))) as { error?: string; avatar_url?: string };
      // #region agent log
      const postLog = {
        sessionId: "4cee35",
        location: "ideal-customer/index.tsx:handleGenerateAvatar",
        message: "handleGenerateAvatar post-fetch",
        data: { status: res.status, ok: res.ok, error: data?.error },
        timestamp: Date.now(),
        hypothesisId: "H1",
      };
      console.debug("[DEBUG 4cee35]", postLog);
      fetch("http://127.0.0.1:7243/ingest/bc96f30d-a63c-4828-beaf-5cec801979c8", {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-Debug-Session-Id": "4cee35" },
        body: JSON.stringify(postLog),
      }).catch(() => {});
      // #endregion
      if (!res.ok) {
        throw new Error(data?.error ?? `Erro ${res.status}`);
      }
      if (data?.error) throw new Error(data.error);

      toast({ title: "Rosto gerado!", description: "O avatar do persona foi criado com sucesso." });
      if (data?.avatar_url) setEditingAvatarUrl(data.avatar_url);
      loadClientes();
    } catch (err) {
      console.error("[Cliente Ideal] Erro ao gerar rosto:", err);
      toast({
        variant: "destructive",
        title: "Erro ao gerar rosto",
        description: err instanceof Error ? err.message : "Falha na geração. Verifique se a STABILITY_API_KEY está configurada.",
      });
    } finally {
      setGeneratingAvatarId(null);
    }
  }

  async function handleDelete(c: IdealCustomerRow) {
    if (!effectiveCompanyId) return;
    const confirmed = window.confirm(
      `Excluir o cliente ideal "${c.profile_name ?? "Sem nome"}"? Esta ação não pode ser desfeita.`
    );
    if (!confirmed) return;

    try {
      const { error } = await supabase
        .from("ideal_customers")
        .delete()
        .eq("id", c.id)
        .eq("company_id", effectiveCompanyId);

      if (error) throw error;
      toast({
        title: "Excluído",
        description: "Cliente ideal removido.",
      });
      loadClientes();
    } catch (err) {
      toast({
        variant: "destructive",
        title: "Erro ao excluir",
        description: getErrorMessage(err),
      });
    }
  }

  function handleOpenAvatarPreview(avatarUrl: string | null, profileName: string | null) {
    if (!avatarUrl) return;
    setPreviewAvatarUrl(avatarUrl);
    setPreviewAvatarName(profileName?.trim() || "persona");
    setIsAvatarPreviewOpen(true);
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">
            Cliente Ideal (Persona)
          </h1>
          <p className="text-muted-foreground">
            Cadastre e gerencie os perfis de clientes ideais para a IA.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={handleOpenCopyModal} disabled={!effectiveCompanyId}>
            <Copy className="mr-2 h-4 w-4" /> Copiar de modelo
          </Button>
          <Button onClick={handleOpenNew} disabled={!effectiveCompanyId}>
            <Plus className="mr-2 h-4 w-4" /> Novo Cliente Ideal
          </Button>
        </div>
      </div>

      <div className="rounded-md border bg-white">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="text-foreground w-24">Rosto</TableHead>
              <TableHead className="text-foreground">Perfil</TableHead>
              <TableHead className="text-foreground">Cargo</TableHead>
              <TableHead className="text-foreground">Localização</TableHead>
              <TableHead className="text-right text-foreground">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isFetching ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center py-10">
                  <Loader2 className="mx-auto h-8 w-8 animate-spin text-primary" />
                </TableCell>
              </TableRow>
            ) : clientes.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={5}
                  className="text-center py-10 text-muted-foreground"
                >
                  Nenhum cliente ideal cadastrado. Clique em &quot;Novo Cliente Ideal&quot; para começar.
                </TableCell>
              </TableRow>
            ) : (
              clientes.map((c) => (
                <TableRow key={c.id}>
                  <TableCell className="w-24">
                    {c.avatar_url ? (
                      <button
                        type="button"
                        onClick={() => handleOpenAvatarPreview(c.avatar_url, c.profile_name)}
                        className="rounded-full focus:outline-none focus:ring-2 focus:ring-primary/40"
                        aria-label={`Abrir foto de ${c.profile_name ?? "persona"}`}
                      >
                        <img
                          src={c.avatar_url}
                          alt={`Rosto de ${c.profile_name ?? "persona"}`}
                          className="h-20 w-20 rounded-full object-cover border border-border cursor-zoom-in transition-transform hover:scale-105"
                        />
                      </button>
                    ) : (
                      <div className="h-20 w-20 rounded-full bg-muted flex items-center justify-center">
                        <User className="h-7 w-7 text-muted-foreground" />
                      </div>
                    )}
                  </TableCell>
                  <TableCell className="font-medium text-foreground">
                    {c.profile_name ?? "—"}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {c.job_title ?? "—"}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {c.location ?? "—"}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleGenerateAvatar(c)}
                        disabled={generatingAvatarId === c.id}
                        aria-label={`Gerar rosto para ${c.profile_name ?? "cliente"}`}
                        title="Gerar rosto"
                      >
                        {generatingAvatarId === c.id ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <ImageIcon className="h-4 w-4" />
                        )}
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleOpenEdit(c.id)}
                        aria-label={`Editar ${c.profile_name ?? "cliente"}`}
                      >
                        <Edit2 className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-destructive hover:text-destructive hover:bg-destructive/10"
                        onClick={() => handleDelete(c)}
                        aria-label={`Excluir ${c.profile_name ?? "cliente"}`}
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

      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-foreground">
              {editingId ? "Editar Cliente Ideal" : "Novo Cliente Ideal"}
            </DialogTitle>
            <DialogDescription className="text-muted-foreground">
              Preencha as informações para que a IA conheça seu público-alvo.
            </DialogDescription>
          </DialogHeader>

          {editingId && (
            <div className="flex items-center gap-4 py-2 border-b border-border">
              <div className="flex-shrink-0">
                {editingAvatarUrl ? (
                  <button
                    type="button"
                    onClick={() =>
                      handleOpenAvatarPreview(
                        editingAvatarUrl,
                        form.getValues("profile_name") || null
                      )
                    }
                    className="rounded-full focus:outline-none focus:ring-2 focus:ring-primary/40"
                    aria-label="Abrir foto do persona"
                  >
                    <img
                      src={editingAvatarUrl}
                      alt="Rosto do persona"
                      className="h-16 w-16 rounded-full object-cover border border-border cursor-zoom-in transition-transform hover:scale-105"
                    />
                  </button>
                ) : (
                  <div className="h-16 w-16 rounded-full bg-muted flex items-center justify-center">
                    <User className="h-8 w-8 text-muted-foreground" />
                  </div>
                )}
              </div>
              <div className="flex-1">
                <p className="text-sm text-muted-foreground mb-1">Rosto do persona</p>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => handleGenerateAvatar({ id: editingId, profile_name: null, job_title: null, location: null, avatar_url: editingAvatarUrl })}
                  disabled={generatingAvatarId === editingId}
                >
                  {generatingAvatarId === editingId ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <ImageIcon className="mr-2 h-4 w-4" />
                  )}
                  {editingAvatarUrl ? "Gerar novo rosto" : "Gerar rosto"}
                </Button>
              </div>
            </div>
          )}

          <form onSubmit={form.handleSubmit(onSubmit)}>
            <Tabs defaultValue="demographics" className="w-full">
              <TabsList className="grid w-full grid-cols-3 mb-4">
                <TabsTrigger value="demographics">
                  <User className="w-4 h-4 mr-2" /> Demográficos
                </TabsTrigger>
                <TabsTrigger value="psychographics">
                  <Brain className="w-4 h-4 mr-2" /> Psicográficos
                </TabsTrigger>
                <TabsTrigger value="behavior">
                  <ShoppingCart className="w-4 h-4 mr-2" /> Comportamento
                </TabsTrigger>
              </TabsList>

              <TabsContent value="demographics">
                <Card>
                  <CardHeader>
                    <CardTitle>Dados Demográficos</CardTitle>
                    <CardDescription>Quem é o seu cliente ideal?</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>Nome Fictício do Perfil</Label>
                        <Input
                          {...form.register("profile_name")}
                          placeholder="Ex: Pedro Empreendedor"
                        />
                        {form.formState.errors.profile_name && (
                          <p className="text-red-500 text-xs">
                            {form.formState.errors.profile_name.message}
                          </p>
                        )}
                      </div>
                      <div className="space-y-2">
                        <Label>Cargo / Profissão</Label>
                        <Input
                          {...form.register("job_title")}
                          placeholder="Ex: Diretor de Vendas"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Faixa Etária</Label>
                        <Input
                          {...form.register("age_range")}
                          placeholder="Ex: 30-45 anos"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Localização</Label>
                        <Input
                          {...form.register("location")}
                          placeholder="Ex: São Paulo / Brasil"
                        />
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="psychographics">
                <Card>
                  <CardHeader>
                    <CardTitle>Dados Psicográficos</CardTitle>
                    <CardDescription>O que seu cliente pensa e sente?</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="space-y-2">
                      <Label>Dores e Problemas (O que tira o sono dele?)</Label>
                      <Textarea
                        {...form.register("pain_points")}
                        placeholder="Descreva as dificuldades atuais..."
                        className="min-h-[100px]"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Objetivos e Sonhos (Onde ele quer chegar?)</Label>
                      <Textarea
                        {...form.register("goals_dreams")}
                        placeholder="O que ele deseja conquistar..."
                        className="min-h-[100px]"
                      />
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="behavior">
                <Card>
                  <CardHeader>
                    <CardTitle>Comportamento de Compra</CardTitle>
                    <CardDescription>Como ele toma decisões de compra?</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="space-y-2">
                      <Label>Objeções Comuns (Por que ele não compraria?)</Label>
                      <Textarea
                        {...form.register("common_objections")}
                        placeholder="Ex: Preço alto, falta de tempo..."
                        className="min-h-[100px]"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Critérios de Decisão</Label>
                      <Textarea
                        {...form.register("decision_criteria")}
                        placeholder="Ex: Atendimento, Suporte, Preço"
                        className="min-h-[100px]"
                      />
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>

            <div className="flex justify-end gap-3 pt-6 border-t border-border mt-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsModalOpen(false)}
              >
                Cancelar
              </Button>
              <Button type="submit" disabled={isLoading}>
                {isLoading ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Save className="mr-2 h-4 w-4" />
                )}
                {editingId ? "Atualizar" : "Salvar"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={isCopyModalOpen} onOpenChange={setIsCopyModalOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-foreground">
              Copiar de modelo
            </DialogTitle>
            <DialogDescription className="text-muted-foreground">
              Selecione um modelo para copiar para sua empresa. Você poderá editar após a cópia.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2 max-h-[300px] overflow-y-auto">
            {isLoadingTemplates ? (
              <div className="flex justify-center py-8">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
              </div>
            ) : templates.length === 0 ? (
              <p className="text-center py-8 text-muted-foreground">
                Nenhum modelo disponível.
              </p>
            ) : (
              templates.map((t) => (
                <div
                  key={t.id}
                  className="flex items-center justify-between rounded-lg border border-border p-3 hover:bg-muted/50 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    {t.avatar_url ? (
                      <img
                        src={t.avatar_url}
                        alt={`Avatar de ${t.profile_name ?? "modelo"}`}
                        className="h-12 w-12 rounded-full object-cover border border-border"
                      />
                    ) : (
                      <div className="h-12 w-12 rounded-full bg-muted flex items-center justify-center">
                        <User className="h-5 w-5 text-muted-foreground" />
                      </div>
                    )}
                    <div>
                    <p className="font-medium text-foreground">{t.profile_name ?? "—"}</p>
                    <p className="text-sm text-muted-foreground">
                      {t.job_title ?? ""} {t.location ? `• ${t.location}` : ""}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Segmento:{" "}
                      {t.segment_type === "consorcio"
                        ? "Consórcio"
                        : t.segment_type === "seguros"
                          ? "Seguros"
                          : t.segment_type === "produtos"
                            ? "Produtos & Serviços"
                            : "Geral"}
                    </p>
                    </div>
                  </div>
                  <Button
                    size="sm"
                    onClick={() => handleCopyTemplate(t)}
                    disabled={!!copyingTemplateId}
                  >
                    {copyingTemplateId === t.id ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <>
                        <Copy className="mr-1 h-4 w-4" /> Copiar
                      </>
                    )}
                  </Button>
                </div>
              ))
            )}
          </div>
        </DialogContent>
      </Dialog>

      <Dialog
        open={isAvatarPreviewOpen}
        onOpenChange={(open) => {
          setIsAvatarPreviewOpen(open);
          if (!open) {
            setPreviewAvatarUrl(null);
          }
        }}
      >
        <DialogContent className="max-w-3xl p-0 overflow-hidden">
          <DialogHeader className="px-6 pt-6">
            <DialogTitle className="text-foreground">
              Foto de {previewAvatarName}
            </DialogTitle>
            <DialogDescription className="text-muted-foreground">
              Visualização ampliada do rosto da persona.
            </DialogDescription>
          </DialogHeader>
          <div className="flex items-center justify-center bg-muted/20 p-6">
            {previewAvatarUrl ? (
              <img
                src={previewAvatarUrl}
                alt={`Foto ampliada de ${previewAvatarName}`}
                className="max-h-[75vh] w-auto max-w-full rounded-md object-contain border border-border"
              />
            ) : null}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
