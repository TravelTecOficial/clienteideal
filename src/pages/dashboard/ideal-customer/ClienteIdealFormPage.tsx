import { useEffect, useState, useCallback } from "react";
import { useAuth } from "@clerk/clerk-react";
import { useParams, useNavigate, Link, useSearchParams } from "react-router-dom";
import { useSupabaseClient } from "@/lib/supabase-context";
import { useEffectiveCompanyId } from "@/hooks/use-effective-company-id";
import { SUPABASE_URL, SUPABASE_ANON_KEY } from "@/lib/supabase";
import { getErrorMessage } from "@/lib/utils";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
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
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  User,
  Brain,
  Save,
  Loader2,
  ArrowLeft,
  ImageIcon,
  MessageSquare,
  ShoppingCart,
} from "lucide-react";

const idealCustomerSchema = z.object({
  profile_name: z.string().min(2, "O nome do perfil é obrigatório"),
  identifying_phrase: z.string().optional(),
  prompt_atendimento_id: z.string().optional(),
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

interface ClienteIdealFormPageProps {
  /** Quando true, renderiza apenas o conteúdo (sem layout próprio). Usado dentro do layout contextual. */
  embedInLayout?: boolean;
}

export function ClienteIdealFormPage({ embedInLayout = false }: ClienteIdealFormPageProps) {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const returnTo = searchParams.get("returnTo") ?? searchParams.get("from");
  const { userId, getToken } = useAuth();
  const supabase = useSupabaseClient();
  const { toast } = useToast();
  const effectiveCompanyId = useEffectiveCompanyId();
  const [isLoading, setIsLoading] = useState(false);
  const [generatingAvatarId, setGeneratingAvatarId] = useState<string | null>(null);
  const [editingAvatarUrl, setEditingAvatarUrl] = useState<string | null>(null);
  const [isAvatarPreviewOpen, setIsAvatarPreviewOpen] = useState(false);
  const [previewAvatarUrl, setPreviewAvatarUrl] = useState<string | null>(null);
  const [previewAvatarName, setPreviewAvatarName] = useState<string>("persona");

  const isNew = id === "novo";
  const editingId = isNew ? null : id ?? null;

  const [prompts, setPrompts] = useState<{ id: string; label: string }[]>([]);

  const form = useForm<IdealCustomerFormValues>({
    resolver: zodResolver(idealCustomerSchema),
    defaultValues: {
      profile_name: "",
      identifying_phrase: "",
      prompt_atendimento_id: "",
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
    },
  });

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

  const loadData = useCallback(async () => {
    if (!editingId || !effectiveCompanyId) return;
    try {
      const { data, error } = await supabase
        .from("ideal_customers")
        .select("*")
        .eq("id", editingId)
        .eq("company_id", effectiveCompanyId)
        .maybeSingle();

      if (error) throw error;
      if (!data) {
        toast({
          variant: "destructive",
          title: "Erro",
          description: "Cliente ideal não encontrado.",
        });
        navigate(embedInLayout && id ? `/dashboard/cliente-ideal/${id}/perfil` : "/dashboard/cliente-ideal");
        return;
      }
      form.reset({
          profile_name: data.profile_name ?? "",
          identifying_phrase: data.identifying_phrase ?? "",
          prompt_atendimento_id: data.prompt_atendimento_id ?? "",
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
    } catch {
      toast({
        variant: "destructive",
        title: "Erro",
        description: "Falha ao carregar dados do cliente ideal.",
      });
      navigate(embedInLayout && id ? `/dashboard/cliente-ideal/${id}/perfil` : "/dashboard/cliente-ideal");
    }
  }, [editingId, effectiveCompanyId, supabase, toast, navigate, form, embedInLayout, id]);

  useEffect(() => {
    if (!isNew && editingId && effectiveCompanyId) {
      loadData();
    }
  }, [isNew, editingId, effectiveCompanyId, loadData]);

  useEffect(() => {
    if (effectiveCompanyId) loadPrompts();
  }, [effectiveCompanyId, loadPrompts]);

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
      const promptId = values.prompt_atendimento_id?.trim() || null;
      const payload = {
        profile_name: values.profile_name.trim(),
        identifying_phrase: values.identifying_phrase?.trim() || null,
        prompt_atendimento_id: promptId,
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
        const { data: current, error: selectError } = await supabase
          .from("ideal_customers")
          .select("prompt_atendimento_id")
          .eq("id", editingId)
          .eq("company_id", effectiveCompanyId)
          .maybeSingle();

        if (selectError) throw selectError;

        const previousPromptId = (current as { prompt_atendimento_id: string | null } | null)?.prompt_atendimento_id;

        const { error } = await supabase
          .from("ideal_customers")
          .update(payload)
          .eq("id", editingId)
          .eq("company_id", effectiveCompanyId);

        if (error) throw error;

        if (previousPromptId && previousPromptId !== promptId) {
          await supabase
            .from("prompt_atendimento")
            .update({ persona_id: null })
            .eq("id", previousPromptId)
            .eq("company_id", effectiveCompanyId);
        }
        if (promptId) {
          await supabase
            .from("prompt_atendimento")
            .update({ persona_id: editingId })
            .eq("id", promptId)
            .eq("company_id", effectiveCompanyId);
        }

        toast({
          title: "Atualizado!",
          description: "Cliente ideal atualizado com sucesso.",
        });
      } else {
        const { data, error } = await supabase
          .from("ideal_customers")
          .insert(payload)
          .select("id")
          .single();

        if (error) throw error;

        const newPersonaId = data?.id;
        if (newPersonaId && promptId) {
          await supabase
            .from("prompt_atendimento")
            .update({ persona_id: newPersonaId })
            .eq("id", promptId)
            .eq("company_id", effectiveCompanyId);
        }

        toast({
          title: "Cadastrado!",
          description: "Cliente ideal cadastrado com sucesso.",
        });
        if (returnTo) {
          navigate(returnTo);
          return;
        }
        if (newPersonaId) {
          navigate(embedInLayout ? `/dashboard/cliente-ideal/${newPersonaId}/perfil` : `/dashboard/cliente-ideal/${newPersonaId}`);
          return;
        }
      }

      navigate(returnTo ?? (embedInLayout ? `/dashboard/cliente-ideal/${editingId ?? ""}/perfil` : "/dashboard/cliente-ideal"));
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

  async function handleGenerateAvatar() {
    if (!effectiveCompanyId || !editingId) return;
    setGeneratingAvatarId(editingId);
    try {
      const token = (await getToken()) ?? (await getToken({ template: "supabase" }));
      if (!token) {
        toast({
          variant: "destructive",
          title: "Erro",
          description: "Sessão inválida. Faça login novamente.",
        });
        return;
      }
      const bodyPayload = { persona_id: editingId, token, company_id: effectiveCompanyId };
      const res = await fetch(`${SUPABASE_URL}/functions/v1/persona-generate-avatar`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
        },
        body: JSON.stringify(bodyPayload),
      });

      const data = (await res.json().catch(() => ({}))) as { error?: string; avatar_url?: string };
      if (!res.ok) {
        throw new Error(data?.error ?? `Erro ${res.status}`);
      }
      if (data?.error) throw new Error(data.error);

      toast({
        title: "Rosto gerado!",
        description: "O avatar do persona foi criado com sucesso.",
      });
      if (data?.avatar_url) {
        // Cache-bust: mesma URL sobrescreve o arquivo; o navegador usa cache. Forçar reload.
        const separator = data.avatar_url.includes("?") ? "&" : "?";
        setEditingAvatarUrl(`${data.avatar_url}${separator}t=${Date.now()}`);
      }
    } catch (err) {
      console.error("[Cliente Ideal] Erro ao gerar rosto:", err);
      toast({
        variant: "destructive",
        title: "Erro ao gerar rosto",
        description:
          err instanceof Error
            ? err.message
            : "Falha na geração. Verifique se a STABILITY_API_KEY está configurada.",
      });
    } finally {
      setGeneratingAvatarId(null);
    }
  }

  function handleOpenAvatarPreview(avatarUrl: string | null, profileName: string | null) {
    if (!avatarUrl) return;
    setPreviewAvatarUrl(avatarUrl);
    setPreviewAvatarName(profileName?.trim() || "persona");
    setIsAvatarPreviewOpen(true);
  }

  if (!effectiveCompanyId && !embedInLayout) {
    return (
      <SidebarProvider>
        <AppSidebar />
        <SidebarInset>
          <header className="flex h-16 shrink-0 items-center gap-2 border-b px-4">
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
                    <Link to="/dashboard/cliente-ideal">Cliente Ideal</Link>
                  </BreadcrumbLink>
                </BreadcrumbItem>
                <BreadcrumbSeparator className="hidden md:block" />
                <BreadcrumbItem>
                  <BreadcrumbPage>{isNew ? "Novo" : "Editar"}</BreadcrumbPage>
                </BreadcrumbItem>
              </BreadcrumbList>
            </Breadcrumb>
            <ProfileDropdown className="ml-auto" />
          </header>
          <div className="flex flex-1 flex-col gap-4 p-4">
            <p className="text-muted-foreground">
              Empresa não vinculada. Configure sua empresa em Configurações.
            </p>
            <Button variant="outline" asChild>
              <Link to="/dashboard/cliente-ideal">
                <ArrowLeft className="mr-2 h-4 w-4" /> Voltar
              </Link>
            </Button>
          </div>
        </SidebarInset>
      </SidebarProvider>
    );
  }

  if (!effectiveCompanyId && embedInLayout) {
    return (
      <p className="text-muted-foreground">
        Empresa não vinculada. Configure sua empresa em Configurações.
      </p>
    );
  }

  const backLink = embedInLayout && id ? `/dashboard/cliente-ideal` : "/dashboard/cliente-ideal";

  const formContent = (
    <>
      <div className="flex items-center gap-4">
        <Button variant="outline" size="sm" asChild>
          <Link to={backLink}>
            <ArrowLeft className="mr-2 h-4 w-4" /> Voltar
          </Link>
        </Button>
        <h1 className="text-2xl font-bold tracking-tight text-foreground">
          {isNew ? "Novo Cliente Ideal" : "Editar Cliente Ideal"}
        </h1>
      </div>

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
                  onClick={handleGenerateAvatar}
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
                    <div className="space-y-2">
                      <Label>Frase de identificação</Label>
                      <Input
                        {...form.register("identifying_phrase")}
                        placeholder="Ex: Quero sair do aluguel, quero comprar meu carro novo"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label className="flex items-center gap-2">
                        <MessageSquare className="h-4 w-4" />
                        Prompt de Atendimento
                      </Label>
                      <Select
                        value={form.watch("prompt_atendimento_id") || "__none__"}
                        onValueChange={(v) =>
                          form.setValue("prompt_atendimento_id", v === "__none__" ? "" : v)
                        }
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Selecione o prompt associado a este persona" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="__none__">Nenhum</SelectItem>
                          {prompts.map((p) => (
                            <SelectItem key={p.id} value={p.id}>
                              {p.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <p className="text-xs text-muted-foreground">
                        O prompt de atendimento que a IA usará quando o lead for identificado como este persona.{" "}
                        <Link
                          to={editingId ? `/dashboard/prompt-atendimento?personaId=${editingId}` : "/dashboard/prompt-atendimento"}
                          className="underline hover:no-underline font-medium"
                        >
                          Criar novo prompt
                        </Link>
                      </p>
                    </div>
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
              <Button type="button" variant="outline" asChild>
                <Link to={backLink}>Cancelar</Link>
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
    </>
  );

  if (embedInLayout) {
    return (
      <>
        <div className="flex flex-1 flex-col gap-4 overflow-auto">{formContent}</div>
        <Dialog
        open={isAvatarPreviewOpen}
        onOpenChange={(open) => {
          setIsAvatarPreviewOpen(open);
          if (!open) setPreviewAvatarUrl(null);
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
      </>
    );
  }

  return (
    <SidebarProvider>
      <AppSidebar />
      <SidebarInset>
        <header className="flex h-16 shrink-0 items-center gap-2 border-b px-4">
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
                  <Link to="/dashboard/cliente-ideal">Cliente Ideal</Link>
                </BreadcrumbLink>
              </BreadcrumbItem>
              <BreadcrumbSeparator className="hidden md:block" />
              <BreadcrumbItem>
                <BreadcrumbPage>{isNew ? "Novo" : "Editar"}</BreadcrumbPage>
              </BreadcrumbItem>
            </BreadcrumbList>
          </Breadcrumb>
          <ProfileDropdown className="ml-auto" />
        </header>
        <div className="flex flex-1 flex-col gap-4 p-4 overflow-auto">
          {formContent}
        </div>
        <Dialog
        open={isAvatarPreviewOpen}
        onOpenChange={(open) => {
          setIsAvatarPreviewOpen(open);
          if (!open) setPreviewAvatarUrl(null);
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
      </SidebarInset>
    </SidebarProvider>
  );
}
