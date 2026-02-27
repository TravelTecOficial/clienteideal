import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@clerk/clerk-react";
import { Calendar, dateFnsLocalizer } from "react-big-calendar";
import { format, parse, startOfWeek, getDay } from "date-fns";
import { ptBR } from "date-fns/locale";
import "react-big-calendar/lib/css/react-big-calendar.css";

import { Calendar as CalendarIcon, Edit2, List, Loader2, Plus, XCircle } from "lucide-react";

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
import { getErrorMessage } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { useEffectiveCompanyId } from "@/hooks/use-effective-company-id";
import { AgendaForm, type AgendaFormValues, type VendedorOption } from "./components/AgendaForm";

// --- Interfaces ---
interface AgendaItem {
  id: string;
  data_hora: string;
  tipo_reuniao: string;
  vendedor_id: string | null;
  status: "Pendente" | "Confirmado" | "Cancelado" | "Finalizado";
  descricao: string | null;
}

// --- Helpers ---
const localizer = dateFnsLocalizer({
  format,
  parse,
  startOfWeek,
  getDay,
  locales: { "pt-BR": ptBR },
});

function formatDataHora(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" });
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

function toDateTimeLocal(iso: string): string {
  const d = new Date(iso);
  const formatter = new Intl.DateTimeFormat("fr-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
  const parts = formatter.formatToParts(d);
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "";
  return `${get("year")}-${get("month")}-${get("day")}T${get("hour")}:${get("minute")}`;
}

export default function AgendaPage() {
  const { userId } = useAuth();
  const supabase = useSupabaseClient();
  const { toast } = useToast();
  const effectiveCompanyId = useEffectiveCompanyId();

  const [agenda, setAgenda] = useState<AgendaItem[]>([]);
  const [vendedores, setVendedores] = useState<VendedorOption[]>([]);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [selectedItem, setSelectedItem] = useState<AgendaItem | null>(null);
  const [isFetching, setIsFetching] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isCancelling, setIsCancelling] = useState(false);
  const [view, setView] = useState<"table" | "calendar">("table");

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

      if (values.include_as_opportunity) {
        const dataHora = new Date(values.data_hora);
        const expectedDate = dataHora.toISOString().slice(0, 10);
        const stage = values.opportunity_stage ?? "novo";
        const { error: oppErr } = await supabase.from("opportunities").insert({
          company_id: effectiveCompanyId,
          user_id: userId,
          title: values.tipo_reuniao.trim(),
          value: 0,
          expected_closing_date: expectedDate,
          stage,
          seller_id: values.vendedor_id || null,
        });
        if (oppErr) {
          console.error("Erro ao criar oportunidade:", oppErr);
          toast({
            variant: "destructive",
            title: "Agendamento criado",
            description: "A reunião foi cadastrada, mas falha ao criar oportunidade.",
          });
        } else {
          toast({
            title: "Agendamento criado",
            description: "A reunião e a oportunidade foram cadastradas com sucesso.",
          });
        }
      } else {
        toast({
          title: "Agendamento criado",
          description: "A reunião foi cadastrada com sucesso.",
        });
      }
      setIsDialogOpen(false);
      loadAgenda();
    } catch (err) {
      toast({
        variant: "destructive",
        title: "Erro ao criar",
        description: getErrorMessage(err),
      });
    } finally {
      setIsSaving(false);
    }
  }

  async function onUpdate(values: AgendaFormValues) {
    if (!selectedItem) return;
    setIsSaving(true);
    try {
      const dataHoraIso = new Date(values.data_hora).toISOString();
      const { error } = await supabase
        .from("agenda")
        .update({
          data_hora: dataHoraIso,
          tipo_reuniao: values.tipo_reuniao.trim(),
          vendedor_id: values.vendedor_id || null,
          status: values.status,
          descricao: values.descricao?.trim() || null,
        })
        .eq("id", selectedItem.id);

      if (error) throw error;

      toast({
        title: "Agendamento atualizado",
        description: "As alterações foram salvas com sucesso.",
      });
      setSelectedItem(null);
      loadAgenda();
    } catch (err) {
      toast({
        variant: "destructive",
        title: "Erro ao atualizar",
        description: getErrorMessage(err),
      });
    } finally {
      setIsSaving(false);
    }
  }

  async function handleCancelAgenda(item?: AgendaItem) {
    const target = item ?? selectedItem;
    if (!target) return;
    setIsCancelling(true);
    try {
      const { error } = await supabase
        .from("agenda")
        .update({ status: "Cancelado" })
        .eq("id", target.id);

      if (error) throw error;

      toast({
        title: "Agendamento cancelado",
        description: "O agendamento foi cancelado com sucesso.",
      });
      if (!item) setSelectedItem(null);
      loadAgenda();
    } catch (err) {
      toast({
        variant: "destructive",
        title: "Erro ao cancelar",
        description: getErrorMessage(err),
      });
    } finally {
      setIsCancelling(false);
    }
  }

  function openEditModal(item: AgendaItem) {
    setSelectedItem(item);
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
                showIncludeOpportunity
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
                    <TableHead className="w-[100px] text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {agenda.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                        Nenhum agendamento encontrado.
                      </TableCell>
                    </TableRow>
                  ) : (
                    agenda.map((item) => (
                      <TableRow
                        key={item.id}
                        className="hover:bg-muted/50 transition-colors"
                      >
                        <TableCell
                          className="font-medium cursor-pointer"
                          onClick={() => openEditModal(item)}
                        >
                          {formatDataHora(item.data_hora)}
                        </TableCell>
                        <TableCell
                          className="cursor-pointer"
                          onClick={() => openEditModal(item)}
                        >
                          {item.tipo_reuniao}
                        </TableCell>
                        <TableCell
                          className="cursor-pointer"
                          onClick={() => openEditModal(item)}
                        >
                          {getVendedorName(item.vendedor_id)}
                        </TableCell>
                        <TableCell
                          className="cursor-pointer"
                          onClick={() => openEditModal(item)}
                        >
                          <Badge
                            variant="outline"
                            className={getStatusBadgeClass(item.status)}
                          >
                            {item.status}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-1">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => openEditModal(item)}
                              aria-label={`Editar agendamento ${item.tipo_reuniao}`}
                            >
                              <Edit2 className="h-4 w-4" />
                            </Button>
                            {item.status !== "Cancelado" && (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  if (window.confirm("Cancelar esta reunião?")) {
                                    handleCancelAgenda(item);
                                  }
                                }}
                                aria-label={`Cancelar reunião ${item.tipo_reuniao}`}
                                className="text-destructive hover:text-destructive"
                              >
                                <XCircle className="h-4 w-4" />
                              </Button>
                            )}
                          </div>
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
                onSelectEvent={(event) => {
                  const item = agenda.find((a) => a.id === event.id);
                  if (item) openEditModal(item);
                }}
              />
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog
        open={selectedItem !== null}
        onOpenChange={(open) => !open && setSelectedItem(null)}
      >
        <DialogContent className="sm:max-w-[550px]">
          <DialogHeader>
            <DialogTitle>Editar Agendamento</DialogTitle>
            <DialogDescription>
              Altere as informações da reunião ou cancele o agendamento.
            </DialogDescription>
          </DialogHeader>
          {selectedItem && (
            <AgendaForm
              key={selectedItem.id}
              mode="edit"
              onSubmit={onUpdate}
              defaultValues={{
                data_hora: toDateTimeLocal(selectedItem.data_hora),
                tipo_reuniao: selectedItem.tipo_reuniao,
                vendedor_id: selectedItem.vendedor_id || "",
                status: selectedItem.status,
                descricao: selectedItem.descricao || "",
              }}
              vendedores={vendedores}
              isSaving={isSaving}
              onCancelAgenda={handleCancelAgenda}
              isCancelling={isCancelling}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
