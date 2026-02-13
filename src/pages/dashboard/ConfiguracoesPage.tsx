import { useState, useEffect, useCallback } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "@clerk/clerk-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";

import { Plus, Loader2, Check, Database, Megaphone } from "lucide-react";

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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useSupabaseClient } from "@/lib/supabase-context";
import { useToast } from "@/hooks/use-toast";

// --- Interfaces ---
interface ProfileRow {
  company_id: string | null;
}

interface CompanyRow {
  celular_atendimento: string | null;
  email_atendimento: string | null;
}

interface Pagamento {
  id: string;
  data: string;
  plataforma: string;
  valor: number;
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
const dadosFormSchema = z.object({
  celular_atendimento: z.string().optional(),
  email_atendimento: z
    .union([z.string().email("E-mail inválido"), z.literal("")])
    .optional(),
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

type DadosFormValues = z.infer<typeof dadosFormSchema>;
type PagamentoFormValues = z.infer<typeof pagamentoFormSchema>;

const PLATAFORMA_OPTIONS = [
  { value: "Google Ads", label: "Google Ads" },
  { value: "Meta Ads", label: "Meta Ads" },
] as const;

// --- Component ---
export function ConfiguracoesPage() {
  const { userId } = useAuth();
  const supabase = useSupabaseClient();
  const { toast } = useToast();

  const [companyId, setCompanyId] = useState<string | null>(null);
  const [isFetchingDados, setIsFetchingDados] = useState(true);
  const [isSavingDados, setIsSavingDados] = useState(false);
  const [pagamentos, setPagamentos] = useState<Pagamento[]>([]);
  const [isFetchingPagamentos, setIsFetchingPagamentos] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSavingPagamento, setIsSavingPagamento] = useState(false);

  const dadosForm = useForm<DadosFormValues>({
    resolver: zodResolver(dadosFormSchema),
    defaultValues: {
      celular_atendimento: "",
      email_atendimento: "",
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

  // Buscar company_id
  useEffect(() => {
    async function init() {
      if (!userId) return;
      const cid = await fetchCompanyId(supabase, userId);
      setCompanyId(cid);
    }
    init();
  }, [userId, supabase]);

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
        .select("celular_atendimento, email_atendimento")
        .eq("id", companyId)
        .maybeSingle();

      if (error) throw error;
      const row = data as CompanyRow | null;
      dadosForm.reset({
        celular_atendimento: row?.celular_atendimento ?? "",
        email_atendimento: row?.email_atendimento ?? "",
      });
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

  // Salvar dados (aba Dados)
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
          celular_atendimento: values.celular_atendimento?.trim() || null,
          email_atendimento: values.email_atendimento?.trim() || null,
        })
        .eq("id", companyId);

      if (error) throw error;

      toast({
        title: "Dados salvos",
        description: "As informações de atendimento foram atualizadas.",
      });
    } catch (err) {
      toast({
        variant: "destructive",
        title: "Erro ao salvar",
        description: err instanceof Error ? err.message : "Erro desconhecido",
      });
    } finally {
      setIsSavingDados(false);
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
        description: err instanceof Error ? err.message : "Erro desconhecido",
      });
    } finally {
      setIsSavingPagamento(false);
    }
  }

  return (
    <SidebarProvider>
      <AppSidebar />
      <SidebarInset>
        <header className="flex h-16 shrink-0 items-center gap-2 border-b px-4">
          <SidebarTrigger className="-ml-1" />
          <Separator
            orientation="vertical"
            className="mr-2 data-[orientation=vertical]:h-4"
          />
          <Breadcrumb>
            <BreadcrumbList>
              <BreadcrumbItem className="hidden md:block">
                <BreadcrumbLink asChild>
                  <Link to="/dashboard">Dashboard</Link>
                </BreadcrumbLink>
              </BreadcrumbItem>
              <BreadcrumbSeparator className="hidden md:block" />
              <BreadcrumbItem>
                <BreadcrumbPage>Configurações</BreadcrumbPage>
              </BreadcrumbItem>
            </BreadcrumbList>
          </Breadcrumb>
        </header>
        <div className="flex flex-1 flex-col gap-4 p-4">
          <Tabs defaultValue="dados" className="w-full">
            <TabsList className="grid w-full max-w-[400px] grid-cols-2">
              <TabsTrigger value="dados" className="gap-2">
                <Database className="h-4 w-4" /> Dados
              </TabsTrigger>
              <TabsTrigger value="anuncios" className="gap-2">
                <Megaphone className="h-4 w-4" /> Anúncios
              </TabsTrigger>
            </TabsList>

            <TabsContent value="dados" className="space-y-4 pt-4">
              <Card>
                <CardHeader>
                  <CardTitle>Dados do atendimento</CardTitle>
                  <CardDescription>
                    Celular e e-mail para contato de atendimento.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {isFetchingDados ? (
                    <div className="flex min-h-[120px] items-center justify-center">
                      <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                    </div>
                  ) : (
                    <form
                      onSubmit={dadosForm.handleSubmit(onDadosSubmit)}
                      className="grid gap-4 sm:grid-cols-2"
                    >
                      <div className="space-y-2">
                        <Label htmlFor="celular_atendimento">
                          Celular do atendimento
                        </Label>
                        <Input
                          id="celular_atendimento"
                          type="tel"
                          placeholder="(00) 00000-0000"
                          {...dadosForm.register("celular_atendimento")}
                        />
                        {dadosForm.formState.errors.celular_atendimento && (
                          <p className="text-xs text-destructive">
                            {
                              dadosForm.formState.errors.celular_atendimento
                                .message
                            }
                          </p>
                        )}
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="email_atendimento">
                          E-mail do atendimento
                        </Label>
                        <Input
                          id="email_atendimento"
                          type="email"
                          placeholder="atendimento@empresa.com"
                          {...dadosForm.register("email_atendimento")}
                        />
                        {dadosForm.formState.errors.email_atendimento && (
                          <p className="text-xs text-destructive">
                            {
                              dadosForm.formState.errors.email_atendimento
                                .message
                            }
                          </p>
                        )}
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
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="anuncios" className="space-y-4 pt-4">
              <div className="flex flex-col gap-4">
                <div className="flex justify-between items-center">
                  <h3 className="text-lg font-semibold">Pagamentos</h3>
                  <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
                    <DialogTrigger asChild>
                      <Button
                        onClick={() => {
                          pagamentoForm.reset({
                            data: "",
                            plataforma: undefined,
                            valor: 0,
                          });
                        }}
                        className="gap-2"
                      >
                        <Plus className="h-4 w-4" />
                        Novo Pagamento
                      </Button>
                    </DialogTrigger>
                    <DialogContent className="sm:max-w-[425px]">
                      <DialogHeader>
                        <DialogTitle>Novo Pagamento</DialogTitle>
                        <DialogDescription>
                          Registre um pagamento de anúncio (Google Ads ou Meta
                          Ads).
                        </DialogDescription>
                      </DialogHeader>
                      <form
                        onSubmit={pagamentoForm.handleSubmit(onPagamentoSubmit)}
                        className="grid gap-4 py-4"
                      >
                        <div className="space-y-2">
                          <Label htmlFor="data">Data</Label>
                          <Input
                            id="data"
                            type="date"
                            {...pagamentoForm.register("data")}
                          />
                          {pagamentoForm.formState.errors.data && (
                            <p className="text-xs text-destructive">
                              {
                                pagamentoForm.formState.errors.data.message
                              }
                            </p>
                          )}
                        </div>
                        <div className="space-y-2">
                          <Label>Plataforma</Label>
                          <Select
                            value={pagamentoForm.watch("plataforma")}
                            onValueChange={(v: string) =>
                              pagamentoForm.setValue(
                                "plataforma",
                                v as PagamentoFormValues["plataforma"]
                              )
                            }
                          >
                            <SelectTrigger>
                              <SelectValue placeholder="Selecione" />
                            </SelectTrigger>
                            <SelectContent>
                              {PLATAFORMA_OPTIONS.map((opt) => (
                                <SelectItem
                                  key={opt.value}
                                  value={opt.value}
                                >
                                  {opt.label}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          {pagamentoForm.formState.errors.plataforma && (
                            <p className="text-xs text-destructive">
                              {
                                pagamentoForm.formState.errors.plataforma
                                  .message
                              }
                            </p>
                          )}
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="valor">Valor (R$)</Label>
                          <Input
                            id="valor"
                            type="number"
                            step="0.01"
                            min={0}
                            placeholder="0,00"
                            {...pagamentoForm.register("valor")}
                          />
                          {pagamentoForm.formState.errors.valor && (
                            <p className="text-xs text-destructive">
                              {
                                pagamentoForm.formState.errors.valor.message
                              }
                            </p>
                          )}
                        </div>
                        <DialogFooter>
                          <Button
                            type="button"
                            variant="outline"
                            onClick={() => setIsModalOpen(false)}
                          >
                            Cancelar
                          </Button>
                          <Button type="submit" disabled={isSavingPagamento}>
                            {isSavingPagamento ? (
                              <>
                                <Loader2 className="h-4 w-4 animate-spin" />
                                Salvando…
                              </>
                            ) : (
                              "Salvar"
                            )}
                          </Button>
                        </DialogFooter>
                      </form>
                    </DialogContent>
                  </Dialog>
                </div>

                <div className="rounded-md border">
                  {isFetchingPagamentos ? (
                    <div className="flex min-h-[200px] items-center justify-center p-8">
                      <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                    </div>
                  ) : (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Data</TableHead>
                          <TableHead>Plataforma</TableHead>
                          <TableHead className="text-right">Valor</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {pagamentos.length === 0 ? (
                          <TableRow>
                            <TableCell
                              colSpan={3}
                              className="h-24 text-center text-muted-foreground"
                            >
                              Nenhum pagamento cadastrado. Clique em Novo
                              Pagamento para adicionar.
                            </TableCell>
                          </TableRow>
                        ) : (
                          pagamentos.map((p) => (
                            <TableRow key={p.id}>
                              <TableCell>{formatDate(p.data)}</TableCell>
                              <TableCell>{p.plataforma}</TableCell>
                              <TableCell className="text-right">
                                {formatValor(p.valor)}
                              </TableCell>
                            </TableRow>
                          ))
                        )}
                      </TableBody>
                    </Table>
                  )}
                </div>
              </div>
            </TabsContent>
          </Tabs>
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}
