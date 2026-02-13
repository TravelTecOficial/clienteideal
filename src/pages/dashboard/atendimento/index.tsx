import { useState, useEffect, useCallback, type ReactNode } from "react";
import { useAuth } from "@clerk/clerk-react";
import type { SupabaseClient } from "@supabase/supabase-js";

import { History, Info, Loader2 } from "lucide-react";

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
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useSupabaseClient } from "@/lib/supabase-context";
import { useToast } from "@/hooks/use-toast";

// --- Interfaces ---
interface ProfileRow {
  company_id: string | null;
}

interface VendedorOption {
  id: string;
  nome: string;
  clerk_id: string | null;
}

interface Atendimento {
  id: string;
  created_at: string;
  company_id: string;
  id_vendedor: string | null;
  id_conversa: string | null;
  score_final: number | null;
  classificacao: string | null;
  nome: string | null;
  celular: string;
  email: string | null;
  idade: string | null;
  preferencia: string | null;
  reuniao_date: string | null;
  lead_results: string | null;
  external_id: string | null;
  estagio: string | null;
  estado: string | null;
  cidade: string | null;
  utm_id: string | null;
  utm_campaing: string | null;
  utm_content: string | null;
  utm_medium: string | null;
  utm_source: string | null;
  gclid: string | null;
  fbclid: string | null;
  historico_json: unknown;
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
  try {
    return new Date(dateStr).toLocaleString("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return "—";
  }
}

function hasUtmData(a: Atendimento): boolean {
  return !!(
    a.utm_source ||
    a.utm_medium ||
    a.utm_campaing ||
    a.utm_content ||
    a.utm_id ||
    a.gclid ||
    a.fbclid
  );
}

function buildUtmTooltipText(a: Atendimento): string {
  const parts: string[] = [];
  if (a.utm_source) parts.push(`utm_source: ${a.utm_source}`);
  if (a.utm_medium) parts.push(`utm_medium: ${a.utm_medium}`);
  if (a.utm_campaing) parts.push(`utm_campaign: ${a.utm_campaing}`);
  if (a.utm_content) parts.push(`utm_content: ${a.utm_content}`);
  if (a.utm_id) parts.push(`utm_id: ${a.utm_id}`);
  if (a.gclid) parts.push(`gclid: ${a.gclid}`);
  if (a.fbclid) parts.push(`fbclid: ${a.fbclid}`);
  return parts.length ? `Origem do lead:\n${parts.join("\n")}` : "";
}

function renderHistorico(historico: unknown): ReactNode {
  if (historico == null) return <p className="text-muted-foreground">Sem histórico.</p>;
  if (Array.isArray(historico)) {
    return (
      <ul className="space-y-2 max-h-80 overflow-y-auto">
        {historico.map((item, i) => (
          <li key={i} className="rounded border border-border bg-muted/30 p-2 text-sm">
            {typeof item === "object" && item !== null ? (
              <pre className="whitespace-pre-wrap text-xs overflow-x-auto">
                {JSON.stringify(item, null, 2)}
              </pre>
            ) : (
              String(item)
            )}
          </li>
        ))}
      </ul>
    );
  }
  if (typeof historico === "object") {
    return (
      <pre className="rounded border border-border bg-muted/30 p-3 text-xs overflow-x-auto max-h-80 overflow-y-auto">
        {JSON.stringify(historico, null, 2)}
      </pre>
    );
  }
  return <p className="text-sm">{String(historico)}</p>;
}

export default function AtendimentoPageContent() {
  const { userId } = useAuth();
  const supabase = useSupabaseClient();
  const { toast } = useToast();

  const [atendimentos, setAtendimentos] = useState<Atendimento[]>([]);
  const [companyId, setCompanyId] = useState<string | null>(null);
  const [vendedores, setVendedores] = useState<VendedorOption[]>([]);
  const [isFetching, setIsFetching] = useState(true);
  const [selectedAtendimento, setSelectedAtendimento] = useState<Atendimento | null>(null);
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);

  const effectiveCompanyId = companyId;

  const vendedorMap = useCallback(() => {
    const map = new Map<string, string>();
    vendedores.forEach((v) => {
      if (v.clerk_id) map.set(v.clerk_id, v.nome);
    });
    return map;
  }, [vendedores]);

  const getVendedorName = (idVendedor: string | null | undefined): string => {
    if (!idVendedor) return "—";
    return vendedorMap().get(idVendedor) ?? "—";
  };

  // Buscar company_id
  useEffect(() => {
    async function init() {
      if (!userId) return;
      const cid = await fetchCompanyId(supabase, userId);
      setCompanyId(cid);
    }
    init();
  }, [userId, supabase]);

  // Buscar vendedores para mapear id_vendedor -> nome
  const loadVendedores = useCallback(async () => {
    if (!effectiveCompanyId) return;
    try {
      const { data, error } = await supabase
        .from("vendedores")
        .select("id, nome, clerk_id")
        .eq("company_id", effectiveCompanyId)
        .eq("status", true);

      if (error) throw error;
      setVendedores((data as VendedorOption[]) ?? []);
    } catch (err) {
      console.error("Erro ao carregar vendedores:", err);
    }
  }, [effectiveCompanyId, supabase]);

  // Buscar atendimentos
  const loadAtendimentos = useCallback(async () => {
    if (!effectiveCompanyId) {
      setIsFetching(false);
      setAtendimentos([]);
      return;
    }
    setIsFetching(true);
    try {
      const { data, error } = await supabase
        .from("atendimentos_ia")
        .select("*")
        .eq("company_id", effectiveCompanyId)
        .order("created_at", { ascending: false });

      if (error) throw error;
      setAtendimentos((data as Atendimento[]) ?? []);
    } catch (err) {
      console.error("Erro ao carregar atendimentos:", err);
      toast({
        variant: "destructive",
        title: "Erro",
        description: "Falha ao carregar atendimentos.",
      });
      setAtendimentos([]);
    } finally {
      setIsFetching(false);
    }
  }, [effectiveCompanyId, supabase, toast]);

  useEffect(() => {
    loadVendedores();
  }, [loadVendedores]);

  useEffect(() => {
    loadAtendimentos();
  }, [loadAtendimentos]);

  function openHistory(a: Atendimento) {
    setSelectedAtendimento(a);
    setIsHistoryOpen(true);
  }

  return (
    <div className="flex-1 space-y-4">
      <div>
        <h2 className="text-3xl font-bold tracking-tight">Atendimentos</h2>
        <p className="text-muted-foreground">
          Histórico de conversas com a IA. Somente leitura.
        </p>
      </div>

      <div className="rounded-md border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[180px]">Nome</TableHead>
              <TableHead>Celular</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Classificação</TableHead>
              <TableHead className="w-[80px]">Score</TableHead>
              <TableHead>Vendedor</TableHead>
              <TableHead>Data</TableHead>
              <TableHead className="text-right w-[120px]">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isFetching ? (
              <TableRow>
                <TableCell colSpan={8} className="h-24 text-center text-muted-foreground">
                  <span className="flex items-center justify-center gap-2">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Carregando...
                  </span>
                </TableCell>
              </TableRow>
            ) : atendimentos.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="h-24 text-center text-muted-foreground">
                  Nenhum atendimento encontrado.
                </TableCell>
              </TableRow>
            ) : (
              atendimentos.map((a) => (
                <TableRow key={a.id}>
                  <TableCell>
                    <div className="flex flex-col">
                      <span className="font-medium">{a.nome ?? "—"}</span>
                    </div>
                  </TableCell>
                  <TableCell className="font-mono text-sm">{a.celular}</TableCell>
                  <TableCell className="text-sm">{a.email ?? "—"}</TableCell>
                  <TableCell>
                    {a.classificacao ? (
                      <Badge variant="secondary">{a.classificacao}</Badge>
                    ) : (
                      "—"
                    )}
                  </TableCell>
                  <TableCell>{a.score_final ?? "—"}</TableCell>
                  <TableCell className="text-sm">{getVendedorName(a.id_vendedor)}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {formatDate(a.created_at)}
                  </TableCell>
                  <TableCell className="text-right">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="gap-1"
                      onClick={() => openHistory(a)}
                    >
                      <History className="h-4 w-4" />
                      Ver histórico
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Modal de Histórico */}
      <Dialog open={isHistoryOpen} onOpenChange={setIsHistoryOpen}>
        <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <div className="flex items-center gap-2">
              <DialogTitle>
                Histórico - {selectedAtendimento?.nome ?? selectedAtendimento?.celular ?? "Atendimento"}
              </DialogTitle>
              {selectedAtendimento && hasUtmData(selectedAtendimento) && (
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0">
                        <Info className="h-4 w-4 text-muted-foreground" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent side="bottom" className="max-w-xs whitespace-pre-wrap">
                      {buildUtmTooltipText(selectedAtendimento)}
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              )}
            </div>
            <DialogDescription>
              Log da conversa com a IA.
            </DialogDescription>
          </DialogHeader>
          <div className="mt-2">
            {selectedAtendimento && renderHistorico(selectedAtendimento.historico_json)}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
