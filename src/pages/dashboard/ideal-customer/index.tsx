import { useEffect, useState, useCallback } from "react";
import { useAuth } from "@clerk/clerk-react";
import { useNavigate } from "react-router-dom";
import { useSupabaseClient } from "@/lib/supabase-context";
import { SUPABASE_URL, SUPABASE_ANON_KEY } from "@/lib/supabase";
import { getErrorMessage } from "@/lib/utils";
import { useEffectiveCompanyId } from "@/hooks/use-effective-company-id";

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
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { User, Loader2, Plus, Edit2, Trash2, ImageIcon, Copy } from "lucide-react";

interface IdealCustomerRow {
  id: string;
  profile_name: string | null;
  identifying_phrase: string | null;
  job_title: string | null;
  location: string | null;
  avatar_url: string | null;
}

interface IdealCustomerRowWithoutAvatar {
  id: string;
  profile_name: string | null;
  identifying_phrase?: string | null;
  job_title: string | null;
  location: string | null;
}

interface PersonaTemplateRow {
  id: string;
  profile_name: string | null;
  description: string | null;
  identifying_phrase?: string | null;
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
  const navigate = useNavigate();
  const { userId, getToken } = useAuth();
  const supabase = useSupabaseClient();
  const { toast } = useToast();
  const effectiveCompanyId = useEffectiveCompanyId();
  const [isFetching, setIsFetching] = useState(true);
  const [clientes, setClientes] = useState<IdealCustomerRow[]>([]);
  const [generatingAvatarId, setGeneratingAvatarId] = useState<string | null>(null);
  const [isCopyModalOpen, setIsCopyModalOpen] = useState(false);
  const [templates, setTemplates] = useState<PersonaTemplateRow[]>([]);
  const [isLoadingTemplates, setIsLoadingTemplates] = useState(false);
  const [copyingTemplateId, setCopyingTemplateId] = useState<string | null>(null);
  const [companySegmentType, setCompanySegmentType] = useState<string>("produtos");
  const [isAvatarPreviewOpen, setIsAvatarPreviewOpen] = useState(false);
  const [previewAvatarUrl, setPreviewAvatarUrl] = useState<string | null>(null);
  const [previewAvatarName, setPreviewAvatarName] = useState<string>("persona");

  const loadClientes = useCallback(async () => {
    if (!effectiveCompanyId) {
      setIsFetching(false);
      setClientes([]);
      return;
    }
    setIsFetching(true);
    try {
      let { data, error } = await supabase
        .from("ideal_customers")
        .select("id, profile_name, identifying_phrase, job_title, location, avatar_url")
        .eq("company_id", effectiveCompanyId)
        .order("created_at", { ascending: false });

      const missingColumn =
        (error as { code?: string; message?: string } | null)?.code === "42703";

      if (missingColumn) {
        const fallback = await supabase
          .from("ideal_customers")
          .select("id, profile_name, job_title, location")
          .eq("company_id", effectiveCompanyId)
          .order("created_at", { ascending: false });

        error = fallback.error;
        data = ((fallback.data as IdealCustomerRowWithoutAvatar[] | null) ?? []).map((row) => ({
          ...row,
          identifying_phrase: null,
          avatar_url: null,
        }));
      }

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
        .select("id, profile_name, description, identifying_phrase, job_title, location, avatar_url, segment_type, age_range, gender, income_level, goals_dreams, pain_points, values_list, hobbies_interests, buying_journey, decision_criteria, common_objections, target_product")
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
  }, [supabase, toast, companySegmentType]);

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
        identifying_phrase: t.identifying_phrase ?? null,
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

  async function handleGenerateAvatar(c: IdealCustomerRow) {
    if (!effectiveCompanyId) return;
    setGeneratingAvatarId(c.id);
    try {
      const token = (await getToken()) ?? (await getToken({ template: "supabase" }));
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
        body: JSON.stringify({ persona_id: c.id, token, company_id: effectiveCompanyId }),
      });

      const data = (await res.json().catch(() => ({}))) as { error?: string; avatar_url?: string };
      if (!res.ok) {
        throw new Error(data?.error ?? `Erro ${res.status}`);
      }
      if (data?.error) throw new Error(data.error);

      toast({ title: "Rosto gerado!", description: "O avatar do persona foi criado com sucesso." });
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
          <Button
            onClick={() => navigate("/dashboard/cliente-ideal/novo/perfil")}
            disabled={!effectiveCompanyId}
          >
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
              <TableHead className="text-foreground">Frase</TableHead>
              <TableHead className="text-foreground">Cargo</TableHead>
              <TableHead className="text-foreground">Localização</TableHead>
              <TableHead className="text-right text-foreground">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isFetching ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-10">
                  <Loader2 className="mx-auto h-8 w-8 animate-spin text-primary" />
                </TableCell>
              </TableRow>
            ) : clientes.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={6}
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
                  <TableCell className="text-muted-foreground max-w-[200px] truncate" title={c.identifying_phrase ?? undefined}>
                    {c.identifying_phrase ?? "—"}
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
                        onClick={() => navigate(`/dashboard/cliente-ideal/${c.id}/perfil`)}
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
