/**
 * GmbProfileManager
 *
 * Tela de gerenciamento do perfil Google Meu Negócio:
 * - Identificar negócio por nome ou URL (place-from-name / place-from-url)
 * - Definir categoria GMB (primary / secondary)
 * - Configurar Late Account ID (tabela gmb_accounts)
 *
 * Usa company_id efetivo (preview ou do perfil) via useEffectiveCompanyId.
 */
import { useCallback, useEffect, useState } from "react";
import { Loader2, Save, Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useSupabaseClient } from "@/lib/supabase-context";
import { SUPABASE_URL, SUPABASE_ANON_KEY } from "@/lib/supabase";
import { useEffectiveCompanyId } from "@/hooks/use-effective-company-id";
import { useToast } from "@/hooks/use-toast";
import { getErrorMessage } from "@/lib/utils";
import { GMB_CATEGORIES } from "@/constants/gmb-categories";

interface CompanyData {
  nome_fantasia?: string | null;
  logradouro?: string | null;
  numero?: string | null;
  bairro?: string | null;
  cidade?: string | null;
  uf?: string | null;
  cep?: string | null;
  gmb_place_type?: string | null;
  gmb_place_type_secondary?: string | null;
  gmb_place_id?: string | null;
}

interface PlaceCandidate {
  placeId: string | null;
  displayName: string;
  formattedAddress: string;
  primaryType: string | null;
  types: string[];
  secondaryTypes: string[];
  location: {
    lat: number | null;
    lng: number | null;
  };
}

export function GmbProfileManager() {
  const supabase = useSupabaseClient();
  const effectiveCompanyId = useEffectiveCompanyId();
  const { toast } = useToast();

  const [companyData, setCompanyData] = useState<CompanyData | null>(null);
  const [gmbMapsUrl, setGmbMapsUrl] = useState("");
  const [isIdentifyingGmb, setIsIdentifyingGmb] = useState(false);
  const [gmbSearchName, setGmbSearchName] = useState("");
  const [gmbSearchLoading, setGmbSearchLoading] = useState(false);
  const [gmbCandidates, setGmbCandidates] = useState<PlaceCandidate[]>([]);

  const [lateAccountId, setLateAccountId] = useState("");
  const [gmbAccountLoading, setGmbAccountLoading] = useState(false);
  const [gmbAccountSaving, setGmbAccountSaving] = useState(false);

  const loadCompany = useCallback(async () => {
    if (!effectiveCompanyId) {
      setCompanyData(null);
      return;
    }
    try {
      const { data, error } = await supabase
        .from("companies")
        .select(
          "nome_fantasia, logradouro, numero, bairro, cidade, uf, cep, gmb_place_type, gmb_place_type_secondary, gmb_place_id"
        )
        .eq("id", effectiveCompanyId)
        .maybeSingle();
      if (!error) {
        setCompanyData((data as CompanyData) ?? null);
      }
    } catch (err) {
      const msg = getErrorMessage(err);
      toast({
        variant: "destructive",
        title: "Erro ao carregar dados da empresa",
        description: msg,
      });
    }
  }, [effectiveCompanyId, supabase, toast]);

  const loadGmbAccount = useCallback(async () => {
    if (!effectiveCompanyId) {
      setLateAccountId("");
      return;
    }
    setGmbAccountLoading(true);
    try {
      const { data, error } = await supabase
        .from("gmb_accounts")
        .select("late_account_id")
        .eq("company_id", effectiveCompanyId)
        .maybeSingle();
      if (!error && data) {
        setLateAccountId(
          (data as { late_account_id: string | null }).late_account_id ?? ""
        );
      } else {
        setLateAccountId("");
      }
    } catch {
      setLateAccountId("");
    } finally {
      setGmbAccountLoading(false);
    }
  }, [effectiveCompanyId, supabase]);

  useEffect(() => {
    void loadCompany();
    void loadGmbAccount();
  }, [loadCompany, loadGmbAccount]);

  useEffect(() => {
    if (companyData?.nome_fantasia && !gmbSearchName) {
      setGmbSearchName(companyData.nome_fantasia);
    }
  }, [companyData?.nome_fantasia, gmbSearchName]);

  async function handleIdentifyGmb() {
    const url = gmbMapsUrl.trim();
    if (!url) {
      toast({
        variant: "destructive",
        title: "URL obrigatória",
        description: "Cole o link do seu negócio no Google Maps.",
      });
      return;
    }
    if (!effectiveCompanyId) {
      toast({
        variant: "destructive",
        title: "Erro",
        description: "Empresa não identificada.",
      });
      return;
    }
    setIsIdentifyingGmb(true);
    try {
      const res = await fetch(`${SUPABASE_URL}/functions/v1/place-from-url`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
        },
        body: JSON.stringify({ mapsUrl: url }),
      });
      const rawText = await res.text();
      type PlaceFromUrlResponse = {
        placeId?: string;
        primaryType?: string;
        displayName?: string;
        types?: string[];
        error?: string;
      };
      let data: PlaceFromUrlResponse | null = null;
      try {
        data = JSON.parse(rawText) as PlaceFromUrlResponse;
      } catch {
        /* ignore */
      }
      if (!res.ok || (data && data.error)) {
        toast({
          variant: "destructive",
          title: "Erro ao identificar",
          description: data?.error ?? `Erro ${res.status}`,
        });
        return;
      }
      const primaryType = data?.primaryType?.trim();
      if (!primaryType) {
        toast({
          variant: "destructive",
          title: "Categoria não encontrada",
          description: "O Google não retornou a categoria deste negócio.",
        });
        return;
      }

      const placeId = data?.placeId?.trim() || null;

      setCompanyData((prev) => ({
        ...(prev ?? {}),
        gmb_place_type: primaryType,
        gmb_place_type_secondary:
          (data?.types ?? []).find((t) => t && t !== primaryType) ?? null,
        gmb_place_id: placeId,
      }));

      const { error } = await supabase
        .from("companies")
        .update({
          gmb_place_type: primaryType,
          gmb_place_type_secondary:
            (data?.types ?? []).find((t) => t && t !== primaryType) ?? null,
          gmb_place_id: placeId,
        })
        .eq("id", effectiveCompanyId);
      if (error) throw error;
      setGmbMapsUrl("");
      toast({
        title: "Negócio identificado",
        description: `${data?.displayName || "Negócio"} — Categoria: ${primaryType}. Dados gravados.`,
      });
    } catch (err) {
      const msg = getErrorMessage(err);
      toast({
        variant: "destructive",
        title: "Erro ao gravar",
        description: msg,
      });
    } finally {
      setIsIdentifyingGmb(false);
    }
  }

  async function handleSearchGmbByName() {
    const query = gmbSearchName.trim();
    if (!query) {
      toast({
        variant: "destructive",
        title: "Informe o nome da empresa",
        description: "Digite o nome da sua empresa como aparece no Google.",
      });
      return;
    }
    if (!effectiveCompanyId) {
      toast({
        variant: "destructive",
        title: "Erro",
        description: "Empresa não identificada.",
      });
      return;
    }
    setGmbSearchLoading(true);
    setGmbCandidates([]);
    try {
      const res = await fetch(`${SUPABASE_URL}/functions/v1/place-from-name`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
        },
        body: JSON.stringify({
          textQuery: query,
          city: companyData?.cidade ?? undefined,
          state: companyData?.uf ?? undefined,
          country: "BR",
          maxResults: 5,
        }),
      });
      const rawText = await res.text();
      type PlaceFromNameRawCandidate = {
        placeId?: string | null;
        displayName?: string;
        formattedAddress?: string;
        primaryType?: string | null;
        types?: string[];
        secondaryTypes?: string[];
        location?: { lat?: number | null; lng?: number | null };
      };
      type PlaceFromNameResponse = {
        candidates?: PlaceFromNameRawCandidate[];
        error?: string;
        message?: string;
      };
      let data: PlaceFromNameResponse | null = null;
      try {
        data = JSON.parse(rawText) as PlaceFromNameResponse;
      } catch {
        /* ignore */
      }
      if (!res.ok || (data && data.error)) {
        toast({
          variant: "destructive",
          title: "Erro ao buscar empresa",
          description: data?.error ?? `Erro ${res.status}`,
        });
        return;
      }
      const rawCandidates = data?.candidates ?? [];
      const candidates: PlaceCandidate[] = rawCandidates.map((c) => {
        const types = (c.types ?? []).filter(
          (t): t is string => typeof t === "string" && !!t
        );
        const primaryType = (c.primaryType ?? types[0] ?? null) as string | null;
        const secondaryTypes =
          c.secondaryTypes && c.secondaryTypes.length > 0
            ? c.secondaryTypes
            : types.filter((t) => t !== primaryType);
        return {
          placeId: (c.placeId ?? null) as string | null,
          displayName: c.displayName ?? "",
          formattedAddress: c.formattedAddress ?? "",
          primaryType,
          types,
          secondaryTypes,
          location: {
            lat:
              typeof c.location?.lat === "number" ? c.location.lat : null,
            lng:
              typeof c.location?.lng === "number" ? c.location.lng : null,
          },
        };
      });
      if (!candidates.length) {
        toast({
          title: "Nenhum negócio encontrado",
          description:
            data?.message ??
            "Ajuste o nome ou o endereço e tente novamente.",
        });
        return;
      }
      setGmbCandidates(candidates);
    } catch (err) {
      const msg = getErrorMessage(err);
      toast({
        variant: "destructive",
        title: "Erro ao buscar empresa",
        description: msg,
      });
    } finally {
      setGmbSearchLoading(false);
    }
  }

  async function handleSelectGmbCandidate(candidate: PlaceCandidate) {
    if (!effectiveCompanyId) {
      toast({
        variant: "destructive",
        title: "Erro",
        description: "Empresa não identificada.",
      });
      return;
    }
    const placeId = candidate.placeId?.trim() || null;
    const primaryType =
      candidate.primaryType?.trim() || candidate.types[0]?.trim() || null;
    if (!primaryType) {
      toast({
        variant: "destructive",
        title: "Categoria não encontrada",
        description: "O Google não retornou a categoria deste negócio.",
      });
      return;
    }
    const secondaryType =
      candidate.secondaryTypes.find((t) => t && t !== primaryType) ??
      candidate.types.find((t) => t && t !== primaryType) ??
      null;

    try {
      setCompanyData((prev) => ({
        ...(prev ?? {}),
        gmb_place_type: primaryType,
        gmb_place_type_secondary: secondaryType,
        gmb_place_id: placeId,
      }));

      const { error } = await supabase
        .from("companies")
        .update({
          gmb_place_type: primaryType,
          gmb_place_type_secondary: secondaryType,
          gmb_place_id: placeId,
        })
        .eq("id", effectiveCompanyId);
      if (error) throw error;

      toast({
        title: "Negócio identificado",
        description: `${candidate.displayName || "Negócio"} — Categoria: ${primaryType}. Dados gravados.`,
      });
    } catch (err) {
      const msg = getErrorMessage(err);
      toast({
        variant: "destructive",
        title: "Erro ao gravar",
        description: msg,
      });
    }
  }

  const saveGmbAccount = useCallback(async () => {
    if (!effectiveCompanyId) return;
    const trimmed = lateAccountId.trim();
    if (!trimmed) {
      toast({ variant: "destructive", title: "Informe o Late Account ID." });
      return;
    }
    setGmbAccountSaving(true);
    try {
      const { error } = await supabase.from("gmb_accounts").upsert(
        {
          company_id: effectiveCompanyId,
          late_account_id: trimmed,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "company_id" }
      );
      if (error) throw error;
      toast({ title: "Late Account ID salvo com sucesso." });
      loadGmbAccount();
    } catch (err) {
      toast({
        variant: "destructive",
        title: "Erro ao salvar",
        description: getErrorMessage(err),
      });
    } finally {
      setGmbAccountSaving(false);
    }
  }, [effectiveCompanyId, lateAccountId, supabase, toast, loadGmbAccount]);

  if (!effectiveCompanyId) {
    return (
      <div className="text-sm text-muted-foreground">
        Selecione uma empresa no topo da tela para configurar o Google Meu
        Negócio.
      </div>
    );
  }

  return (
    <Card className="w-full border-border">
      <CardHeader className="border-b border-border">
        <CardTitle className="text-lg">Gerenciar Perfil Google Meu Negócio</CardTitle>
      </CardHeader>
      <CardContent className="p-6 space-y-6">
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="gmb-search-name">Buscar empresa pelo nome</Label>
            <div className="flex flex-col gap-2 sm:flex-row">
              <Input
                id="gmb-search-name"
                type="text"
                placeholder="Nome da empresa no Google"
                value={gmbSearchName}
                onChange={(e) => setGmbSearchName(e.target.value)}
                disabled={gmbSearchLoading}
              />
              <Button
                type="button"
                variant="secondary"
                onClick={handleSearchGmbByName}
                disabled={gmbSearchLoading || !gmbSearchName.trim()}
                className="sm:shrink-0"
              >
                {gmbSearchLoading ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <>
                    <Search className="w-4 h-4 mr-1" />
                    Buscar
                  </>
                )}
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              Digite o nome exatamente como aparece no Google. Vamos buscar os
              estabelecimentos e você escolhe o seu.
            </p>
            {companyData?.cidade && companyData?.uf && (
              <p className="text-[11px] text-muted-foreground">
                Cidade detectada: {companyData.cidade} / {companyData.uf}. Ajuste
                na aba Empresa se necessário.
              </p>
            )}
          </div>

          {gmbCandidates.length > 0 && (
            <div className="space-y-2 rounded-lg border border-border bg-muted/30 p-3">
              <p className="text-xs font-medium text-muted-foreground">
                Selecione abaixo o seu negócio do Google.
              </p>
              <div className="space-y-2 max-h-64 overflow-auto">
                {gmbCandidates.map((c, idx) => (
                  <button
                    key={`${c.placeId ?? c.displayName}-${idx}`}
                    type="button"
                    onClick={() => handleSelectGmbCandidate(c)}
                    className="w-full text-left rounded-md border border-border bg-background px-3 py-2 text-sm hover:bg-muted transition-colors"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-semibold text-foreground">
                        {c.displayName || "Sem nome"}
                      </span>
                      {idx === 0 && (
                        <span className="text-[10px] font-medium text-primary uppercase">
                          Sugestão principal
                        </span>
                      )}
                    </div>
                    {c.formattedAddress && (
                      <p className="text-[11px] text-muted-foreground mt-0.5">
                        {c.formattedAddress}
                      </p>
                    )}
                    {c.primaryType && (
                      <p className="text-[10px] text-muted-foreground mt-0.5">
                        Categoria:{" "}
                        <span className="font-mono">{c.primaryType}</span>
                      </p>
                    )}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="gmb-maps-url">Link do Google Maps (opcional)</Label>
            <div className="flex gap-2">
              <Input
                id="gmb-maps-url"
                type="url"
                placeholder="https://maps.app.goo.gl/... ou link do seu negócio no Google Maps"
                value={gmbMapsUrl}
                onChange={(e) => setGmbMapsUrl(e.target.value)}
                disabled={isIdentifyingGmb}
              />
              <Button
                type="button"
                variant="secondary"
                onClick={handleIdentifyGmb}
                disabled={isIdentifyingGmb || !gmbMapsUrl.trim()}
              >
                {isIdentifyingGmb ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <>
                    <Search className="w-4 h-4 mr-1" />
                    Identificar
                  </>
                )}
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              Opcional: cole o link do seu negócio no Google Maps e clique em
              Identificar. A categoria será obtida automaticamente e gravada.
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="gmb_place_type">
              Categoria GMB (identificada ou manual)
            </Label>
            <Input
              id="gmb_place_type"
              list="gmb_place_type_options"
              placeholder="Preenchido ao identificar ou digite manualmente (ex: dentist, insurance_agent)"
              value={companyData?.gmb_place_type ?? ""}
              onChange={(e) =>
                setCompanyData((prev) => ({
                  ...(prev ?? {}),
                  gmb_place_type: e.target.value,
                }))
              }
            />
            <datalist id="gmb_place_type_options">
              {GMB_CATEGORIES.map((opt) => (
                <option key={opt.value} value={opt.value} label={opt.label} />
              ))}
            </datalist>
            <p className="text-xs text-muted-foreground">
              Usado nas análises do GMB Local para buscar concorrentes próximos.
            </p>
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="gmb-late-account-id">Late Account ID</Label>
          <div className="flex gap-2">
            <Input
              id="gmb-late-account-id"
              value={lateAccountId}
              onChange={(e) => setLateAccountId(e.target.value)}
              placeholder="Ex: 69a485a9dc8cab9432b00b28"
              disabled={gmbAccountLoading}
              className="font-mono text-sm"
            />
            <Button
              onClick={() => void saveGmbAccount()}
              disabled={gmbAccountSaving || gmbAccountLoading}
              className="gap-2 shrink-0"
            >
              {gmbAccountSaving ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <>
                  <Save className="w-4 h-4" />
                  Salvar
                </>
              )}
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            Obtenha o Account ID no dashboard da Late após conectar seu Google
            Meu Negócio.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}

