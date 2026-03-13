/**
 * GMB Local - Business Intelligence
 *
 * Integração Supabase com Clerk Bearer Token.
 * Dados de gmb_health_checks e gmb_audit_items filtrados por company_id (useEffectiveCompanyId).
 * Reviews via Edge Function gmb-reviews (Google My Business API v4).
 * RLS garante isolamento por empresa. Validação frontend é UX; API enforcement via RLS.
 */
import { useState, useEffect, useCallback } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Search,
  BarChart3,
  Activity,
  CheckCircle2,
  XCircle,
  MapPin,
  Phone,
  Filter,
  Loader2,
  MessageSquare,
  Star,
  HelpCircle,
} from "lucide-react";
import { useAuth } from "@clerk/clerk-react";
import { useSupabaseClient } from "@/lib/supabase-context";
import { SUPABASE_URL, SUPABASE_ANON_KEY } from "@/lib/supabase";
import { useEffectiveCompanyId } from "@/hooks/use-effective-company-id";
import { useToast } from "@/hooks/use-toast";
import { getErrorMessage, cn } from "@/lib/utils";
import { CompanyMap, type CompetitorPlace as CompanyMapCompetitor } from "@/components/CompanyMap";

// --- Interfaces (tipagem estrita para respostas Supabase) ---
interface GmbHealthCheck {
  id: string;
  company_id: string;
  score: number;
  fraco_count: number;
  razoavel_count: number;
  bom_count: number;
}

interface GmbAuditItem {
  id: string;
  company_id: string;
  category: string | null;
  item_name: string;
  status: "ok" | "error";
  action_label: string | null;
  ordem: number;
}

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

/** Review do Google Business Profile (API v4). */
interface GmbReview {
  name?: string | null;
  reviewId?: string | null;
  reviewer?: { displayName?: string | null; profilePhotoUrl?: string | null } | null;
  starRating?: string | null;
  comment?: string | null;
  createTime?: string | null;
  updateTime?: string | null;
  reviewReply?: { comment?: string | null; updateTime?: string | null } | null;
}

/** Pergunta do Google Business Profile Q&A API. */
interface GmbQuestion {
  name?: string | null;
  author?: { displayName?: string | null } | null;
  text?: string | null;
  createTime?: string | null;
  updateTime?: string | null;
  upvoteCount?: number | null;
  totalAnswerCount?: number | null;
  topAnswers?: Array<{ author?: { displayName?: string | null } | null; text?: string | null } | null> | null;
}

// Fallback quando não há dados no banco
const DEFAULT_HEALTH: Pick<
  GmbHealthCheck,
  "score" | "fraco_count" | "razoavel_count" | "bom_count"
> = {
  score: 91,
  fraco_count: 2,
  razoavel_count: 0,
  bom_count: 22,
};

interface GMBLocalProps {
  className?: string;
}

export default function GMBLocal({ className }: GMBLocalProps) {
  const supabase = useSupabaseClient();
  const effectiveCompanyId = useEffectiveCompanyId();
  const { getToken } = useAuth();
  const { toast } = useToast();

  const [healthCheck, setHealthCheck] = useState<GmbHealthCheck | null>(null);
  const [auditItems, setAuditItems] = useState<GmbAuditItem[]>([]);
  const [companyData, setCompanyData] = useState<CompanyData | null>(null);
  const [competitors, setCompetitors] = useState<CompanyMapCompetitor[]>([]);
  const [competitorsLoading, setCompetitorsLoading] = useState(false);
  const [companyCoords, setCompanyCoords] = useState<[number, number] | null>(null);
  const [loading, setLoading] = useState(true);
  const [competitorsPage, setCompetitorsPage] = useState(1);
  const [radiusKm, setRadiusKm] = useState<1 | 2 | 3 | 4 | 5>(3);
  const [reviews, setReviews] = useState<GmbReview[]>([]);
  const [reviewsLoading, setReviewsLoading] = useState(false);
  const [reviewsTotalCount, setReviewsTotalCount] = useState(0);
  const [reviewsAverageRating, setReviewsAverageRating] = useState<number | null>(null);
  const [replyModal, setReplyModal] = useState<{ review: GmbReview; comment: string } | null>(null);
  const [replySubmitting, setReplySubmitting] = useState(false);
  const [questions, setQuestions] = useState<GmbQuestion[]>([]);
  const [questionsLoading, setQuestionsLoading] = useState(false);
  const [answerModal, setAnswerModal] = useState<{ question: GmbQuestion; text: string } | null>(null);
  const [answerSubmitting, setAnswerSubmitting] = useState(false);
  const COMPETITORS_PER_PAGE = 10;
  const RADIUS_OPTIONS = [1, 2, 3, 4, 5] as const;


  const loadData = useCallback(async () => {
    if (!effectiveCompanyId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const [healthRes, auditRes, companyRes] = await Promise.all([
        supabase
          .from("gmb_health_checks")
          .select("*")
          .eq("company_id", effectiveCompanyId)
          .maybeSingle(),
        supabase
          .from("gmb_audit_items")
          .select("*")
          .eq("company_id", effectiveCompanyId)
          .order("ordem", { ascending: true }),
        supabase
          .from("companies")
          .select(
            "nome_fantasia, logradouro, numero, bairro, cidade, uf, cep, gmb_place_type, gmb_place_type_secondary, gmb_place_id"
          )
          .eq("id", effectiveCompanyId)
          .maybeSingle(),
      ]);

      if (healthRes.error) throw healthRes.error;
      if (auditRes.error) throw auditRes.error;

      setHealthCheck((healthRes.data as GmbHealthCheck | null) ?? null);
      setAuditItems((auditRes.data as GmbAuditItem[]) ?? []);
      if (!companyRes.error) {
        setCompanyData((companyRes.data as CompanyData | null) ?? null);
      }
    } catch (err) {
      const msg = getErrorMessage(err);
      const code = err && typeof err === "object" && "code" in err ? (err as { code?: string }).code : undefined;
      if (code === "PGRST301" || code === "401" || code === "403") {
        toast({
          variant: "destructive",
          title: "Acesso negado",
          description: "Verifique suas permissões ou faça login novamente.",
        });
      } else {
        toast({
          variant: "destructive",
          title: "Erro ao carregar dados",
          description: msg,
        });
      }
    } finally {
      setLoading(false);
    }
  }, [effectiveCompanyId, supabase, toast]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  useEffect(() => {
    setCompanyCoords(null);
    setCompetitors([]);
    setCompetitorsPage(1);
  }, [effectiveCompanyId]);

  useEffect(() => {
    setCompetitorsPage(1);
  }, [radiusKm]);

  const fetchCompetitors = useCallback(
    async (lat: number, lng: number, placeType: string, radiusMeters: number) => {
      if (!placeType) {
        setCompetitors([]);
        return;
      }
      setCompetitorsLoading(true);
      setCompetitors([]);
      try {
        const url = `${SUPABASE_URL}/functions/v1/places-search-nearby`;
        const res = await fetch(url, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
          },
          body: JSON.stringify({ lat, lng, placeType, radius: radiusMeters }),
        });
        const rawText = await res.text();
        type PlacesResponse = { places?: CompanyMapCompetitor[]; error?: string; debug?: string };
        let parsed: PlacesResponse | null = null;
        try {
          parsed = JSON.parse(rawText) as PlacesResponse;
        } catch {
          /* ignore */
        }
        if (!res.ok) {
          const msg = parsed?.error ?? `Erro ${res.status}`;
          toast({
            variant: "destructive",
            title: "Erro ao buscar concorrentes",
            description: msg,
          });
          setCompetitors([]);
          return;
        }
        if (parsed?.error) {
          toast({
            variant: "destructive",
            title: "Erro ao buscar concorrentes",
            description: parsed.error,
          });
          setCompetitors([]);
          return;
        }
        const places = (parsed?.places ?? []).filter(
          (p) => p.businessStatus !== "CLOSED_PERMANENTLY"
        );
        const PRIOR_AVG = 4.0;
        const PRIOR_COUNT = 10;
        const compositeScore = (r: number | null, c: number | null): number => {
          const rating = r ?? 0;
          const count = Math.max(0, c ?? 0);
          if (rating <= 0) return 0;
          return (rating * count + PRIOR_AVG * PRIOR_COUNT) / (count + PRIOR_COUNT);
        };
        const statusOrder = (s: string | null | undefined): number => {
          if (s === "OPERATIONAL") return 0;
          if (s === "CLOSED_TEMPORARILY") return 1;
          return 2;
        };
        const sorted = [...places].sort((a, b) => {
          const orderA = statusOrder(a.businessStatus);
          const orderB = statusOrder(b.businessStatus);
          if (orderA !== orderB) return orderA - orderB;
          const scoreA = compositeScore(a.rating, a.userRatingCount);
          const scoreB = compositeScore(b.rating, b.userRatingCount);
          if (scoreB !== scoreA) return scoreB - scoreA;
          const distA =
            a.lat != null && a.lng != null
              ? Math.hypot(a.lat - lat, a.lng - lng)
              : Infinity;
          const distB =
            b.lat != null && b.lng != null
              ? Math.hypot(b.lat - lat, b.lng - lng)
              : Infinity;
          return distA - distB;
        });
        setCompetitors(sorted);
        setCompetitorsPage(1);
      } catch (err) {
        const msg = getErrorMessage(err);
        toast({
          variant: "destructive",
          title: "Erro ao buscar concorrentes",
          description: msg,
        });
        setCompetitors([]);
      } finally {
        setCompetitorsLoading(false);
      }
    },
    [toast]
  );

  const loadReviews = useCallback(async () => {
    if (!effectiveCompanyId || !getToken) return;
    setReviewsLoading(true);
    setReviews([]);
    try {
      const token = await getToken();
      const res = await fetch(`${SUPABASE_URL}/functions/v1/gmb-reviews`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token ?? ""}`,
        },
        body: JSON.stringify({
          action: "listReviews",
          company_id: effectiveCompanyId,
          pageSize: 50,
        }),
      });
      const data = (await res.json().catch(() => null)) as {
        reviews?: GmbReview[];
        totalReviewCount?: number;
        averageRating?: number;
        error?: string;
        hint?: string;
        code?: string;
      };
      if (!res.ok) {
        const code = data?.code;
        if (code === "NOT_CONNECTED" || code === "NO_LOCATION_SELECTED") {
          toast({
            variant: "destructive",
            title: "Google Meu Negócio não conectado",
            description: "Conecte e selecione o perfil em Configurações > Integrações > Google Meu Negócio.",
          });
        } else {
          toast({
            variant: "destructive",
            title: data?.error ?? "Erro ao carregar reviews",
            description: data?.hint,
          });
        }
        return;
      }
      setReviews(data?.reviews ?? []);
      setReviewsTotalCount(data?.totalReviewCount ?? 0);
      setReviewsAverageRating(data?.averageRating ?? null);
    } catch (err) {
      toast({
        variant: "destructive",
        title: "Erro ao carregar reviews",
        description: getErrorMessage(err),
      });
    } finally {
      setReviewsLoading(false);
    }
  }, [effectiveCompanyId, getToken, toast]);

  const handleReplySubmit = useCallback(async () => {
    if (!replyModal || !effectiveCompanyId || !getToken) return;
    const { review, comment } = replyModal;
    const reviewName = review?.name ?? review?.reviewId ?? "";
    if (!reviewName || !comment.trim()) return;
    setReplySubmitting(true);
    try {
      const token = await getToken();
      const res = await fetch(`${SUPABASE_URL}/functions/v1/gmb-reviews`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token ?? ""}`,
        },
        body: JSON.stringify({
          action: "replyToReview",
          company_id: effectiveCompanyId,
          reviewId: reviewName,
          comment: comment.trim(),
        }),
      });
      const data = (await res.json().catch(() => null)) as { success?: boolean; error?: string; hint?: string };
      if (!res.ok) {
        toast({
          variant: "destructive",
          title: data?.error ?? "Erro ao responder",
          description: data?.hint,
        });
        return;
      }
      toast({ title: "Resposta enviada com sucesso." });
      setReplyModal(null);
      void loadReviews();
    } catch (err) {
      toast({
        variant: "destructive",
        title: "Erro ao responder",
        description: getErrorMessage(err),
      });
    } finally {
      setReplySubmitting(false);
    }
  }, [replyModal, effectiveCompanyId, getToken, loadReviews, toast]);

  const loadQuestions = useCallback(async () => {
    if (!effectiveCompanyId || !getToken) return;
    setQuestionsLoading(true);
    setQuestions([]);
    try {
      const token = await getToken();
      const res = await fetch(`${SUPABASE_URL}/functions/v1/gmb-qa`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token ?? ""}`,
        },
        body: JSON.stringify({
          action: "listQuestions",
          company_id: effectiveCompanyId,
          pageSize: 10,
        }),
      });
      const data = (await res.json().catch(() => null)) as {
        questions?: GmbQuestion[];
        error?: string;
        hint?: string;
        code?: string;
      };
      if (!res.ok) {
        const code = data?.code;
        if (code === "NOT_CONNECTED" || code === "NO_LOCATION_SELECTED") {
          return;
        }
        toast({
          variant: "destructive",
          title: data?.error ?? "Erro ao carregar perguntas",
          description: data?.hint,
        });
        return;
      }
      setQuestions(data?.questions ?? []);
    } catch (err) {
      toast({
        variant: "destructive",
        title: "Erro ao carregar perguntas",
        description: getErrorMessage(err),
      });
    } finally {
      setQuestionsLoading(false);
    }
  }, [effectiveCompanyId, getToken, toast]);

  const handleAnswerSubmit = useCallback(async () => {
    if (!answerModal || !effectiveCompanyId || !getToken) return;
    const { question, text } = answerModal;
    const questionName = question?.name ?? "";
    if (!questionName || !text.trim()) return;
    setAnswerSubmitting(true);
    try {
      const token = await getToken();
      const res = await fetch(`${SUPABASE_URL}/functions/v1/gmb-qa`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token ?? ""}`,
        },
        body: JSON.stringify({
          action: "upsertAnswer",
          company_id: effectiveCompanyId,
          questionId: questionName,
          text: text.trim(),
        }),
      });
      const data = (await res.json().catch(() => null)) as { success?: boolean; error?: string; hint?: string };
      if (!res.ok) {
        toast({
          variant: "destructive",
          title: data?.error ?? "Erro ao responder",
          description: data?.hint,
        });
        return;
      }
      toast({ title: "Resposta enviada com sucesso." });
      setAnswerModal(null);
      void loadQuestions();
    } catch (err) {
      toast({
        variant: "destructive",
        title: "Erro ao responder",
        description: getErrorMessage(err),
      });
    } finally {
      setAnswerSubmitting(false);
    }
  }, [answerModal, effectiveCompanyId, getToken, loadQuestions, toast]);

  useEffect(() => {
    const placeType = companyData?.gmb_place_type?.trim();
    if (companyCoords && placeType) {
      fetchCompetitors(companyCoords[0], companyCoords[1], placeType, radiusKm * 1000);
    } else {
      setCompetitors([]);
    }
  }, [companyCoords, companyData?.gmb_place_type, radiusKm, fetchCompetitors]);

  const score = healthCheck?.score ?? DEFAULT_HEALTH.score;
  const fracoCount = healthCheck?.fraco_count ?? DEFAULT_HEALTH.fraco_count;
  const razoavelCount = healthCheck?.razoavel_count ?? DEFAULT_HEALTH.razoavel_count;
  const bomCount = healthCheck?.bom_count ?? DEFAULT_HEALTH.bom_count;

  // Velocímetro: rotação do arco (0–100 → -45deg a 225deg)
  const speedometerRotation = (score / 100) * 270 - 45;

  return (
    <div className={cn("flex flex-col h-full w-full min-h-0", className)}>
      <header className="flex justify-between items-center bg-primary text-primary-foreground p-4 rounded-lg shadow-md shrink-0">
        <div className="flex items-center gap-3">
          <MapPin className="w-6 h-6" />
          <h1 className="text-xl font-bold uppercase tracking-tight">
            GMB Local - Business Intelligence
          </h1>
        </div>
        <Badge variant="outline" className="text-primary-foreground border-primary-foreground/50 bg-transparent">
          Licença Ativa
        </Badge>
      </header>

      {!effectiveCompanyId && (
        <div className="rounded-lg border border-border bg-muted p-4 text-muted-foreground text-sm mt-4 shrink-0">
          Selecione uma empresa para visualizar os dados do GMB Local.
        </div>
      )}

      <Tabs
        defaultValue="explorar"
        className="flex flex-col flex-1 min-h-0 w-full mt-4"
        onValueChange={(v) => {
          if (v === "audit") {
            void loadReviews();
            void loadQuestions();
          }
        }}
      >
        <TabsList className="grid w-full grid-cols-3 max-w-3xl mb-4 shrink-0">
          <TabsTrigger value="explorar" className="gap-2">
            <Search className="w-4 h-4" /> 1. Explorar
          </TabsTrigger>
          <TabsTrigger value="audit" className="gap-2">
            <BarChart3 className="w-4 h-4" /> 2. GMB Audit
          </TabsTrigger>
          <TabsTrigger value="gestao" className="gap-2">
            <Activity className="w-4 h-4" /> 3. Saúde do Negócio
          </TabsTrigger>
        </TabsList>

        {/* ABA 1: EXPLORAR (MAPA + LISTA) */}
        <TabsContent value="explorar" className="flex-1 min-h-0 flex flex-col gap-4 mt-0 data-[state=inactive]:hidden">
          {companyData?.gmb_place_type && (
            <div className="flex items-center gap-2 shrink-0">
              <span className="text-sm text-muted-foreground">Raio:</span>
              <div className="flex gap-1">
                {RADIUS_OPTIONS.map((km) => (
                  <button
                    key={km}
                    type="button"
                    onClick={() => setRadiusKm(km)}
                    className={cn(
                      "px-3 py-1.5 text-sm font-medium rounded-md transition-colors",
                      radiusKm === km
                        ? "bg-primary text-primary-foreground"
                        : "bg-muted hover:bg-muted/80 text-muted-foreground hover:text-foreground"
                    )}
                  >
                    {km} km
                  </button>
                ))}
              </div>
            </div>
          )}
          <div className="flex gap-4 flex-1 min-h-0">
          <Card className="w-1/3 min-w-[280px] overflow-y-auto bg-card border-border">
            <CardHeader className="flex flex-row items-center justify-between border-b border-border">
              <CardTitle className="text-xs uppercase text-muted-foreground">
                Resultados Próximos
              </CardTitle>
              {companyData?.gmb_place_type ? (
                <span className="text-[10px] text-muted-foreground">
                  {competitorsLoading ? (
                    <Loader2 className="w-4 h-4 animate-spin inline" />
                  ) : (
                    `${competitors.length} encontrados`
                  )}
                </span>
              ) : (
                <Filter className="w-4 h-4 text-muted-foreground" />
              )}
            </CardHeader>
            <CardContent className="p-4 space-y-4">
              {!companyData?.gmb_place_type ? (
                <div className="p-4 rounded-lg border border-dashed border-border bg-muted/30">
                  <p className="text-sm text-muted-foreground">
                    Cadastre a categoria GMB em{" "}
                    <span className="font-medium">
                      Configurações &rarr; Integrações &rarr; Google Meu Negócio
                    </span>{" "}
                    para listar concorrentes próximos.
                  </p>
                </div>
              ) : competitorsLoading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
                </div>
              ) : competitors.length === 0 ? (
                <div className="p-4 rounded-lg border border-dashed border-border bg-muted/30 space-y-2">
                  <p className="text-sm text-muted-foreground font-medium">
                    Nenhum concorrente encontrado.
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Verifique: 1) Endereço completo em Configurações (o mapa deve exibir sua localização);
                    2) Categoria correta; 3) Há negócios do tipo na região.
                  </p>
                </div>
              ) : (
                <>
                  {competitors
                    .slice(
                      (competitorsPage - 1) * COMPETITORS_PER_PAGE,
                      competitorsPage * COMPETITORS_PER_PAGE
                    )
                    .map((c, i) => {
                      const globalIndex = (competitorsPage - 1) * COMPETITORS_PER_PAGE + i;
                      const isLeader = globalIndex === 0;
                      return (
                      <div
                        key={`${c.name}-${i}`}
                        className={`p-4 rounded-lg border-l-4 ${
                          isLeader ? "bg-muted/50 border-primary" : "bg-muted/30 border-transparent"
                        }`}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <p className="font-bold text-sm text-foreground">{c.name}</p>
                          {isLeader && (
                            <span className="text-[10px] font-medium text-primary shrink-0">
                              Melhor avaliado
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-accent">
                          {c.rating != null
                            ? `${c.rating.toFixed(1)} ★ (${c.userRatingCount ?? 0})`
                            : "Sem avaliações"}
                        </p>
                        {c.address && (
                          <p className="text-[10px] text-muted-foreground mt-1">{c.address}</p>
                        )}
                      </div>
                    );})}
                  {competitors.length > COMPETITORS_PER_PAGE && (
                    <div className="flex items-center justify-between gap-2 pt-2">
                      <button
                        type="button"
                        onClick={() => setCompetitorsPage((p) => Math.max(1, p - 1))}
                        disabled={competitorsPage <= 1}
                        className="text-xs font-medium text-accent hover:text-accent/80 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        Anterior
                      </button>
                      <span className="text-xs text-muted-foreground">
                        Página {competitorsPage} de {Math.ceil(competitors.length / COMPETITORS_PER_PAGE)}
                      </span>
                      <button
                        type="button"
                        onClick={() =>
                          setCompetitorsPage((p) =>
                            Math.min(Math.ceil(competitors.length / COMPETITORS_PER_PAGE), p + 1)
                          )
                        }
                        disabled={competitorsPage >= Math.ceil(competitors.length / COMPETITORS_PER_PAGE)}
                        className="text-xs font-medium text-accent hover:text-accent/80 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        Próxima
                      </button>
                    </div>
                  )}
                </>
              )}
            </CardContent>
          </Card>
          <CompanyMap
            address={
              companyData
                ? {
                    logradouro: companyData.logradouro,
                    numero: companyData.numero,
                    bairro: companyData.bairro,
                    cidade: companyData.cidade,
                    uf: companyData.uf,
                    cep: companyData.cep,
                  }
                : null
            }
            companyName={companyData?.nome_fantasia ?? undefined}
            className="flex-1 min-h-[400px]"
            minHeight={400}
            onLocationReady={(lat, lng) => setCompanyCoords([lat, lng])}
            competitors={competitors}
          />
          </div>
        </TabsContent>

        {/* ABA 2: GMB AUDIT (BOTÕES + REVIEWS) */}
        <TabsContent value="audit" className="flex-1 min-h-0 flex flex-col gap-6 py-6 overflow-auto mt-0 data-[state=inactive]:hidden">
          <Card className="w-full max-w-2xl border-t-4 border-t-accent shadow-md shrink-0">
            <CardHeader className="flex flex-row justify-between border-b border-border">
              <div>
                <CardTitle className="text-2xl font-bold">
                  {companyData?.nome_fantasia ?? "Empresa"}
                </CardTitle>
                <p className="text-sm text-muted-foreground">
                  {[companyData?.gmb_place_type, companyData?.cidade, companyData?.uf]
                    .filter(Boolean)
                    .join(" • ")}
                  {![companyData?.gmb_place_type, companyData?.cidade].some(Boolean)] && "—"}
                </p>
              </div>
              <Badge
                variant={reviewsTotalCount > 0 ? "secondary" : "destructive"}
                className="uppercase text-[10px]"
              >
                {reviewsTotalCount > 0
                  ? `${reviewsTotalCount} review${reviewsTotalCount !== 1 ? "s" : ""}`
                  : "Sem Reviews"}
              </Badge>
            </CardHeader>
            <CardContent className="p-8 grid grid-cols-2 gap-4">
              {["Basic Audit", "Teleport", "Review Audit", "Post Audit"].map(
                (btn) => (
                  <button
                    key={btn}
                    type="button"
                    className="bg-accent/10 text-accent-foreground p-6 rounded-xl font-black text-sm border-2 border-accent/20 hover:bg-accent/20 transition uppercase"
                  >
                    {btn}
                  </button>
                )
              )}
            </CardContent>
          </Card>

          {/* Seção Reviews */}
          <Card className="w-full max-w-2xl border-border shrink-0">
            <CardHeader className="border-b border-border">
              <CardTitle className="flex items-center gap-2 text-lg">
                <MessageSquare className="w-5 h-5" />
                Reviews do Google
                {reviewsAverageRating != null && (
                  <span className="text-sm font-normal text-muted-foreground">
                    ({reviewsAverageRating.toFixed(1)} ★ média)
                  </span>
                )}
              </CardTitle>
              <p className="text-sm text-muted-foreground">
                Responda às avaliações dos clientes diretamente pelo painel.
              </p>
            </CardHeader>
            <CardContent className="p-4">
              {reviewsLoading ? (
                <div className="flex justify-center py-8">
                  <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
                </div>
              ) : reviews.length === 0 ? (
                <div className="p-6 rounded-lg border border-dashed border-border bg-muted/30 text-center text-sm text-muted-foreground">
                  {reviewsTotalCount === 0 && !reviewsLoading
                    ? "Nenhum review encontrado. Conecte o Google Meu Negócio em Configurações > Integrações se ainda não conectou."
                    : "Nenhum review para exibir."}
                </div>
              ) : (
                <div className="space-y-4">
                  {reviews.map((r) => {
                    const rating = r.starRating ? parseInt(r.starRating, 10) : null;
                    const hasReply = Boolean(r.reviewReply?.comment?.trim());
                    return (
                      <div
                        key={r.name ?? r.reviewId ?? Math.random()}
                        className="p-4 rounded-lg border border-border bg-card"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              {rating != null && (
                                <span className="flex items-center gap-0.5 text-accent font-medium">
                                  {Array.from({ length: 5 }, (_, i) => (
                                    <Star
                                      key={i}
                                      className={cn(
                                        "w-4 h-4",
                                        i < rating ? "fill-current" : "opacity-40"
                                      )}
                                    />
                                  ))}
                                </span>
                              )}
                              <span className="text-sm font-medium text-foreground">
                                {r.reviewer?.displayName ?? "Anônimo"}
                              </span>
                            </div>
                            {r.comment && (
                              <p className="text-sm text-foreground mt-1 whitespace-pre-wrap">
                                {r.comment}
                              </p>
                            )}
                            {hasReply && (
                              <div className="mt-2 pl-3 border-l-2 border-primary/30">
                                <p className="text-xs text-muted-foreground font-medium">
                                  Sua resposta:
                                </p>
                                <p className="text-sm text-foreground mt-0.5">
                                  {r.reviewReply?.comment}
                                </p>
                              </div>
                            )}
                          </div>
                          {!hasReply && (
                            <Button
                              variant="outline"
                              size="sm"
                              className="shrink-0"
                              onClick={() =>
                                setReplyModal({
                                  review: r,
                                  comment: r.reviewReply?.comment ?? "",
                                })
                              }
                            >
                              Responder
                            </Button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Seção Q&A */}
          <Card className="w-full max-w-2xl border-border shrink-0">
            <CardHeader className="border-b border-border">
              <CardTitle className="flex items-center gap-2 text-lg">
                <HelpCircle className="w-5 h-5" />
                Perguntas e Respostas
              </CardTitle>
              <p className="text-sm text-muted-foreground">
                Responda às perguntas dos clientes no Google. A API de Q&A será descontinuada em nov/2025.
              </p>
            </CardHeader>
            <CardContent className="p-4">
              {questionsLoading ? (
                <div className="flex justify-center py-8">
                  <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
                </div>
              ) : questions.length === 0 ? (
                <div className="p-6 rounded-lg border border-dashed border-border bg-muted/30 text-center text-sm text-muted-foreground">
                  Nenhuma pergunta encontrada.
                </div>
              ) : (
                <div className="space-y-4">
                  {questions.map((q) => {
                    const hasAnswer = (q.topAnswers?.length ?? 0) > 0;
                    return (
                      <div
                        key={q.name ?? q.text ?? Math.random()}
                        className="p-4 rounded-lg border border-border bg-card"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-foreground">
                              {q.author?.displayName ?? "Anônimo"} perguntou:
                            </p>
                            {q.text && (
                              <p className="text-sm text-foreground mt-1 whitespace-pre-wrap">
                                {q.text}
                              </p>
                            )}
                            {hasAnswer && q.topAnswers?.[0] && (
                              <div className="mt-2 pl-3 border-l-2 border-primary/30">
                                <p className="text-xs text-muted-foreground font-medium">
                                  Sua resposta:
                                </p>
                                <p className="text-sm text-foreground mt-0.5">
                                  {q.topAnswers[0]?.text}
                                </p>
                              </div>
                            )}
                          </div>
                          {!hasAnswer && (
                            <Button
                              variant="outline"
                              size="sm"
                              className="shrink-0"
                              onClick={() =>
                                setAnswerModal({
                                  question: q,
                                  text: q.topAnswers?.[0]?.text ?? "",
                                })
                              }
                            >
                              Responder
                            </Button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Modal Responder Review */}
        <Dialog
          open={!!replyModal}
          onOpenChange={(open) => !open && setReplyModal(null)}
        >
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Responder ao review</DialogTitle>
              <DialogDescription>
                Sua resposta será publicada no Google e visível para outros clientes.
              </DialogDescription>
            </DialogHeader>
            {replyModal && (
              <>
                <div className="space-y-2">
                  <p className="text-sm text-muted-foreground">
                    Review: &quot;{replyModal.review.comment?.slice(0, 100)}
                    {replyModal.review.comment && replyModal.review.comment.length > 100 ? "…" : ""}&quot;
                  </p>
                  <Textarea
                    placeholder="Digite sua resposta..."
                    value={replyModal.comment}
                    onChange={(e) =>
                      setReplyModal((prev) =>
                        prev ? { ...prev, comment: e.target.value } : null
                      )
                    }
                    rows={4}
                    className="resize-none"
                  />
                </div>
                <DialogFooter>
                  <Button
                    variant="outline"
                    onClick={() => setReplyModal(null)}
                    disabled={replySubmitting}
                  >
                    Cancelar
                  </Button>
                  <Button
                    onClick={() => void handleReplySubmit()}
                    disabled={replySubmitting || !replyModal.comment.trim()}
                  >
                    {replySubmitting ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        Enviando...
                      </>
                    ) : (
                      "Enviar resposta"
                    )}
                  </Button>
                </DialogFooter>
              </>
            )}
          </DialogContent>
        </Dialog>

        {/* Modal Responder Pergunta (Q&A) */}
        <Dialog
          open={!!answerModal}
          onOpenChange={(open) => !open && setAnswerModal(null)}
        >
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Responder à pergunta</DialogTitle>
              <DialogDescription>
                Sua resposta será publicada no Google.
              </DialogDescription>
            </DialogHeader>
            {answerModal && (
              <>
                <div className="space-y-2">
                  <p className="text-sm text-muted-foreground">
                    Pergunta: &quot;{answerModal.question.text?.slice(0, 150)}
                    {answerModal.question.text && answerModal.question.text.length > 150 ? "…" : ""}&quot;
                  </p>
                  <Textarea
                    placeholder="Digite sua resposta..."
                    value={answerModal.text}
                    onChange={(e) =>
                      setAnswerModal((prev) =>
                        prev ? { ...prev, text: e.target.value } : null
                      )
                    }
                    rows={4}
                    className="resize-none"
                  />
                </div>
                <DialogFooter>
                  <Button
                    variant="outline"
                    onClick={() => setAnswerModal(null)}
                    disabled={answerSubmitting}
                  >
                    Cancelar
                  </Button>
                  <Button
                    onClick={() => void handleAnswerSubmit()}
                    disabled={answerSubmitting || !answerModal.text.trim()}
                  >
                    {answerSubmitting ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        Enviando...
                      </>
                    ) : (
                      "Enviar resposta"
                    )}
                  </Button>
                </DialogFooter>
              </>
            )}
          </DialogContent>
        </Dialog>

        {/* ABA 3: GESTÃO DE SAÚDE (VELOCÍMETRO + CHECKLIST) */}
        <TabsContent value="gestao" className="flex-1 min-h-0 overflow-auto grid grid-cols-1 lg:grid-cols-3 gap-6 mt-0 data-[state=inactive]:hidden">
          <div className="lg:col-span-2 space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Card className="flex flex-col items-center justify-center p-8 text-center border-primary/20">
                <div className="relative w-32 h-16 overflow-hidden">
                  <div className="w-32 h-32 rounded-full border-[12px] border-muted border-b-transparent border-l-transparent -rotate-45" />
                  <div
                    className="absolute top-0 w-32 h-32 rounded-full border-[12px] border-primary border-b-transparent border-l-transparent"
                    style={{ transform: `rotate(${speedometerRotation}deg)` }}
                  />
                  <div className="absolute bottom-0 w-full text-3xl font-black text-foreground">
                    {score}
                  </div>
                </div>
                <p className="text-[10px] font-bold text-muted-foreground uppercase mt-2">
                  Health Score
                </p>
              </Card>
              <Card className="grid grid-cols-3 p-8 items-center text-center border-border">
                <div>
                  <div className="text-2xl font-black text-destructive">
                    {fracoCount}
                  </div>
                  <p className="text-[10px] font-bold text-muted-foreground uppercase">
                    Fraco
                  </p>
                </div>
                <div className="border-x border-border">
                  <div className="text-2xl font-black text-warning">
                    {razoavelCount}
                  </div>
                  <p className="text-[10px] font-bold text-muted-foreground uppercase">
                    Razoável
                  </p>
                </div>
                <div>
                  <div className="text-2xl font-black text-success">
                    {bomCount}
                  </div>
                  <p className="text-[10px] font-bold text-muted-foreground uppercase">
                    Bom
                  </p>
                </div>
              </Card>
            </div>

            <Card className="overflow-hidden border-border">
              {loading ? (
                <div className="flex items-center justify-center p-12">
                  <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
                </div>
              ) : (
                <Table>
                  <TableHeader className="bg-muted/50">
                    <TableRow>
                      <TableHead className="w-12">Status</TableHead>
                      <TableHead>Item de Verificação</TableHead>
                      <TableHead className="text-right">Ação</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {auditItems.length === 0 ? (
                      <TableRow>
                        <TableCell
                          colSpan={3}
                          className="text-center text-muted-foreground py-8"
                        >
                          Nenhum item de auditoria cadastrado.
                        </TableCell>
                      </TableRow>
                    ) : (
                      auditItems.map((item) => (
                        <TableRow key={item.id}>
                          <TableCell>
                            {item.status === "ok" ? (
                              <CheckCircle2 className="text-success w-5 h-5" />
                            ) : (
                              <XCircle className="text-destructive w-5 h-5" />
                            )}
                          </TableCell>
                          <TableCell className="text-sm font-bold">
                            {item.category
                              ? `${item.category} - ${item.item_name}`
                              : item.item_name}
                          </TableCell>
                          <TableCell className="text-right">
                            <Badge
                              variant={
                                item.status === "ok" ? "secondary" : "outline"
                              }
                              className={
                                item.status === "error"
                                  ? "cursor-pointer"
                                  : undefined
                              }
                            >
                              {item.action_label ?? (item.status === "ok" ? "OK" : "Resolver")}
                            </Badge>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              )}
            </Card>
          </div>

          <Card className="h-fit sticky top-6 overflow-hidden border-border">
            <div className="h-32 bg-muted bg-[url('https://images.unsplash.com/photo-1497366216548-37526070297c?auto=format&fit=crop&w=400')] bg-cover" />
            <CardContent className="p-5 space-y-4">
              <div>
                <h3 className="font-black text-foreground">
                  Sua Empresa Licenciada
                </h3>
                <p className="text-xs text-accent font-bold">
                  4.6 ★★★★★ (78 reviews)
                </p>
              </div>
              <div className="space-y-3 text-xs text-muted-foreground">
                <div className="flex items-start gap-2">
                  <MapPin className="w-4 h-4 text-muted-foreground shrink-0" />
                  <span>Av. Paulista, 1000 - SP</span>
                </div>
                <div className="flex items-center gap-2">
                  <Phone className="w-4 h-4 text-muted-foreground shrink-0" />
                  <span>(11) 98888-7777</span>
                </div>
              </div>
              <div className="flex flex-col gap-2 pt-4">
                <button
                  type="button"
                  className="w-full text-[10px] font-bold p-2 bg-muted hover:bg-muted/80 rounded uppercase border border-border transition-colors"
                >
                  Ver no Maps
                </button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

      </Tabs>
    </div>
  );
}
