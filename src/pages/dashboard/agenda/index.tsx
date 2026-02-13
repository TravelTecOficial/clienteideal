import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@clerk/clerk-react";
import type { SupabaseClient } from "@supabase/supabase-js";
import { Calendar, dateFnsLocalizer } from "react-big-calendar";
import { format, parse, startOfWeek, getDay } from "date-fns";
import { ptBR } from "date-fns/locale";
import "react-big-calendar/lib/css/react-big-calendar.css";

import { Calendar as CalendarIcon, List, Plus, Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useSupabaseClient } from "@/lib/supabase-context";
import { useToast } from "@/hooks/use-toast";
import { AgendaForm, type AgendaFormValues, type VendedorOption } from "./components/AgendaForm";

// --- Interfaces ---
interface ProfileRow {
  company_id: string | null;
}

interface AgendaItem {
  id: string;
  data_hora: string;
  tipo_reuniao: string;
  vendedor_id: string | null;
  status: "Pendente" | "Confirmado" | "Cancelado" | "Finalizado";
  descricao: string | null;
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

const localizer = dateFnsLocalizer({
  format,
  parse,
  startOfWeek,
  getDay,
  locales: { "pt-BR": ptBR },
});

function formatDataHora(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toLocaleString("pt-BR");
}

function getStatusBadgeClass(status: string): string {
  const classes: Record<string, string> = {
    Pendente: "bg-yellow-100 text-yellow-800 border-yellow-200",
    Confirmado: "bg-green-100 text-green-800 border-green-200",
    Cancelado: "bg-red-100 text-red-800 border-red-200",
    Finalizado: "bg-blue-100 text-blue-800 border-blue-200",
  };
  return classes[status] ?? "";
}

export default function AgendaPage() {
  const { userId } = useAuth();
  const supabase = useSupabaseClient();
  const { toast } = useToast();

  const [agenda, setAgenda] = useState<AgendaItem[]>([]);
  const [companyId, setCompanyId] = useState<string | null>(null);
  const [vendedores, setVendedores] = useState<VendedorOption[]>([]);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isFetching, setIsFetching] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [view, setView] = useState<"table" | "calendar">("table");

  // Note: UI-level check only. API enforcement required.
  const effectiveCompanyId = companyId;

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
    } catch (err) {
      console.error("Erro ao carregar vendedores:", err);
    }
  }, [effectiveCompanyId, supabase]);

  const loadAgenda = useCallback(async () => {
    if (!effectiveCompanyId) {
      setIsFetching(false);
      setAgenda([]);
      return;
    }
    setIsFetching(true);
    try {
      const { data, error } = await supabase
        .from("agenda")
        .select("id, data_hora, tipo_reuniao, vendedor_id, status, descricao")
        .eq("company_id", effectiveCompanyId)
        .order("data_hora", { ascending: true });

      if (error) throw error;
      setAgenda((data as AgendaItem[]) ?? []);
    } catch (err) {
      console.error("Erro ao carregar agenda:", err);
      toast({
        variant: "destructive",
        title: "Erro",
        description: "Falha ao carregar agenda.",
      });
      setAgenda([]);
    } finally {
      setIsFetching(false);
    }
  }, [effectiveCompanyId, supabase, toast]);

  useEffect(() => {
    async function init() {
      if (!userId) return;
      const cid = await fetchCompanyId(supabase, userId);
      setCompanyId(cid);
    }
    init();
  }, [userId, supabase]);

  useEffect(() => {
    loadVendedores();
  }, [loadVendedores]);

  useEffect(() => {
    loadAgenda();
  }, [loadAgenda]);

  const vendedorMap = useCallback(
    () => new Map(vendedores.map((v) => [v.id, v.nome])),
    [vendedores]
  );

  const getVendedorName = (vendedorId: string | null | undefined) => {
    if (!vendedorId) return "-";
    return vendedorMap().get(vendedorId) ?? "-";
  };

  const calendarEvents = agenda.map((item) => {
    const start = new Date(item.data_hora);
    const end = new Date(start.getTime() + 60 * 60 * 1000); // +1h
    return {
      id: item.id,
      title: item.tipo_reuniao,
      start,
      end,
    };
  });

  async function onSubmit(values: AgendaFormValues) {
    if (!effectiveCompanyId || !userId) {
      toast({
        variant: "destructive",
        title: "Erro",
        description: "Usuário ou empresa não identificados.",
      });
      return;
    }
    setIsSaving(true);
    try {
      // datetime-local retorna "YYYY-MM-DDTHH:mm"; converter para ISO para timestamptz
      const dataHoraIso = new Date(values.data_hora).toISOString();

      const { error } = await supabase.from("agenda").insert({
        company_id: effectiveCompanyId,
        data_hora: dataHoraIso,
        tipo_reuniao: values.tipo_reuniao.trim(),
        vendedor_id: values.vendedor_id || null,
        status: values.status,
        descricao: values.descricao?.trim() || null,
      });

      if (error) throw error;

      toast({
        title: "Agendamento criado",
        description: "A reunião foi cadastrada com sucesso.",
      });
      setIsDialogOpen(false);
      loadAgenda();
    } catch (err) {
      toast({
        variant: "destructive",
        title: "Erro ao criar",
        description: err instanceof Error ? err.message : "Erro desconhecido",
      });
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <div className="flex flex-col gap-6 p-8">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Agenda</h1>
          <p className="text-muted-foreground">
            Acompanhe e gerencie as reuniões qualificadas pela IA.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Tabs value={view} onValueChange={(v) => setView(v as "table" | "calendar")} className="w-fit">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="table" className="flex items-center gap-2">
                <List className="h-4 w-4" />
                <span className="hidden sm:inline">Lista</span>
              </TabsTrigger>
              <TabsTrigger value="calendar" className="flex items-center gap-2">
                <CalendarIcon className="h-4 w-4" />
                <span className="hidden sm:inline">Calendário</span>
              </TabsTrigger>
            </TabsList>
          </Tabs>

          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button className="flex items-center gap-2">
                <Plus className="h-4 w-4" /> Novo Agendamento
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[550px]">
              <DialogHeader>
                <DialogTitle>Novo Agendamento</DialogTitle>
                <DialogDescription>
                  Preencha os dados da reunião qualificada abaixo.
                </DialogDescription>
              </DialogHeader>
              <AgendaForm
                onSubmit={onSubmit}
                vendedores={vendedores}
                isSaving={isSaving}
              />
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <Card className="border border-border rounded-md bg-white shadow-sm">
        <CardContent className="p-0">
          {isFetching ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : view === "table" ? (
            <div className="flex-1 overflow-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Data/Hora</TableHead>
                    <TableHead>Tipo de Reunião</TableHead>
                    <TableHead>Vendedor</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {agenda.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={4} className="text-center py-8 text-muted-foreground">
                        Nenhum agendamento encontrado.
                      </TableCell>
                    </TableRow>
                  ) : (
                    agenda.map((item) => (
                      <TableRow key={item.id}>
                        <TableCell className="font-medium">
                          {formatDataHora(item.data_hora)}
                        </TableCell>
                        <TableCell>{item.tipo_reuniao}</TableCell>
                        <TableCell>{getVendedorName(item.vendedor_id)}</TableCell>
                        <TableCell>
                          <Badge
                            variant="outline"
                            className={getStatusBadgeClass(item.status)}
                          >
                            {item.status}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          ) : (
            <div className="p-4" style={{ height: 500 }}>
              <Calendar
                localizer={localizer}
                culture="pt-BR"
                events={calendarEvents}
                startAccessor="start"
                endAccessor="end"
                titleAccessor="title"
                views={["month", "week", "day", "agenda"]}
                defaultView="month"
                style={{ height: "100%" }}
              />
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
