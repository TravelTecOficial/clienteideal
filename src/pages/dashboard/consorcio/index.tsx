import { useState, useEffect, useCallback } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "@clerk/clerk-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";

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
import { Button } from "@/components/ui/button";
import { Plus, Home, Car, Trash2, Edit, Loader2 } from "lucide-react";
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
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useSupabaseClient } from "@/lib/supabase-context";
import { useToast } from "@/hooks/use-toast";
import { getErrorMessage } from "@/lib/utils";

// --- Interfaces ---
interface ProfileRow {
  company_id: string | null;
}

interface CotaImovel {
  id: number;
  meses: number;
  credito: number;
  mensal: number;
}

interface CotaVeiculo {
  id: number;
  meses: number;
  credito: number;
  pf_mensal: number;
  pj_mensal: number;
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

function formatCurrency(value: number): string {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(value);
}

// --- Schemas ---
const cotaImovelSchema = z.object({
  meses: z.number().min(1, "Prazo deve ser pelo menos 1 mês"),
  credito: z.number().min(0, "Crédito deve ser maior ou igual a zero"),
  mensal: z.number().min(0, "Parcela deve ser maior ou igual a zero"),
});

const cotaVeiculoSchema = z.object({
  meses: z.number().min(1, "Prazo deve ser pelo menos 1 mês"),
  credito: z.number().min(0, "Crédito deve ser maior ou igual a zero"),
  pf_mensal: z.number().min(0, "Mensal PF deve ser maior ou igual a zero"),
  pj_mensal: z.number().min(0, "Mensal PJ deve ser maior ou igual a zero"),
});

type CotaImovelFormValues = z.infer<typeof cotaImovelSchema>;
type CotaVeiculoFormValues = z.infer<typeof cotaVeiculoSchema>;

// --- Component ---
export default function ConsorcioPage() {
  const { userId } = useAuth();
  const supabase = useSupabaseClient();
  const { toast } = useToast();

  const [companyId, setCompanyId] = useState<string | null>(null);
  const [cotasImoveis, setCotasImoveis] = useState<CotaImovel[]>([]);
  const [cotasVeiculos, setCotasVeiculos] = useState<CotaVeiculo[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"imoveis" | "veiculos">("imoveis");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const [editingImovel, setEditingImovel] = useState<CotaImovel | null>(null);
  const [editingVeiculo, setEditingVeiculo] = useState<CotaVeiculo | null>(null);

  const imovelForm = useForm<CotaImovelFormValues>({
    resolver: zodResolver(cotaImovelSchema),
    defaultValues: { meses: 0, credito: 0, mensal: 0 },
  });

  const veiculoForm = useForm<CotaVeiculoFormValues>({
    resolver: zodResolver(cotaVeiculoSchema),
    defaultValues: { meses: 0, credito: 0, pf_mensal: 0, pj_mensal: 0 },
  });

  const fetchData = useCallback(async () => {
    if (!companyId) {
      setLoading(false);
      return;
    }
    try {
      setLoading(true);
      const { data: imoveis, error: errImoveis } = await supabase
        .from("cotas_imoveis")
        .select("id, meses, credito, mensal")
        .eq("company_id", companyId)
        .order("meses", { ascending: true });

      const { data: veiculos, error: errVeiculos } = await supabase
        .from("cotas_veiculos")
        .select("id, meses, credito, pf_mensal, pj_mensal")
        .eq("company_id", companyId)
        .order("meses", { ascending: true });

      if (errImoveis) throw errImoveis;
      if (errVeiculos) throw errVeiculos;

      setCotasImoveis((imoveis as CotaImovel[]) ?? []);
      setCotasVeiculos((veiculos as CotaVeiculo[]) ?? []);
    } catch (error) {
      toast({ title: "Erro ao carregar dados", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, [companyId, supabase, toast]);

  useEffect(() => {
    async function init() {
      if (!userId) return;
      const cid = await fetchCompanyId(supabase, userId);
      setCompanyId(cid);
    }
    init();
  }, [userId, supabase]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleOpenModal = (edit?: CotaImovel | CotaVeiculo) => {
    if (activeTab === "imoveis") {
      if (edit) {
        const e = edit as CotaImovel;
        setEditingImovel(e);
        imovelForm.reset({
          meses: e.meses,
          credito: e.credito,
          mensal: e.mensal,
        });
      } else {
        setEditingImovel(null);
        imovelForm.reset({ meses: 0, credito: 0, mensal: 0 });
      }
    } else {
      if (edit) {
        const e = edit as CotaVeiculo;
        setEditingVeiculo(e);
        veiculoForm.reset({
          meses: e.meses,
          credito: e.credito,
          pf_mensal: e.pf_mensal,
          pj_mensal: e.pj_mensal,
        });
      } else {
        setEditingVeiculo(null);
        veiculoForm.reset({ meses: 0, credito: 0, pf_mensal: 0, pj_mensal: 0 });
      }
    }
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setEditingImovel(null);
    setEditingVeiculo(null);
  };

  const onImovelSubmit = async (values: CotaImovelFormValues) => {
    if (!companyId || !userId) {
      toast({ variant: "destructive", title: "Erro", description: "Empresa não identificada." });
      return;
    }
    setIsSaving(true);
    try {
      if (editingImovel) {
        const { error } = await supabase
          .from("cotas_imoveis")
          .update({
            meses: values.meses,
            credito: values.credito,
            mensal: values.mensal,
          })
          .eq("id", editingImovel.id)
          .eq("company_id", companyId);

        if (error) throw error;
        toast({ title: "Cota atualizada", description: "A cota de imóvel foi atualizada." });
      } else {
        const { error } = await supabase.from("cotas_imoveis").insert({
          company_id: companyId,
          user_id: userId,
          meses: values.meses,
          credito: values.credito,
          mensal: values.mensal,
        });

        if (error) throw error;
        toast({ title: "Cota criada", description: "A cota de imóvel foi adicionada." });
      }
      handleCloseModal();
      fetchData();
    } catch (err) {
      toast({
        variant: "destructive",
        title: "Erro ao salvar",
        description: getErrorMessage(err),
      });
    } finally {
      setIsSaving(false);
    }
  };

  const onVeiculoSubmit = async (values: CotaVeiculoFormValues) => {
    if (!companyId || !userId) {
      toast({ variant: "destructive", title: "Erro", description: "Empresa não identificada." });
      return;
    }
    setIsSaving(true);
    try {
      if (editingVeiculo) {
        const { error } = await supabase
          .from("cotas_veiculos")
          .update({
            meses: values.meses,
            credito: values.credito,
            pf_mensal: values.pf_mensal,
            pj_mensal: values.pj_mensal,
          })
          .eq("id", editingVeiculo.id)
          .eq("company_id", companyId);

        if (error) throw error;
        toast({ title: "Cota atualizada", description: "A cota de veículo foi atualizada." });
      } else {
        const { error } = await supabase.from("cotas_veiculos").insert({
          company_id: companyId,
          user_id: userId,
          meses: values.meses,
          credito: values.credito,
          pf_mensal: values.pf_mensal,
          pj_mensal: values.pj_mensal,
        });

        if (error) throw error;
        toast({ title: "Cota criada", description: "A cota de veículo foi adicionada." });
      }
      handleCloseModal();
      fetchData();
    } catch (err) {
      toast({
        variant: "destructive",
        title: "Erro ao salvar",
        description: getErrorMessage(err),
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (type: "imovel" | "veiculo", id: number) => {
    const confirmed = window.confirm("Excluir esta cota? Esta ação não pode ser desfeita.");
    if (!confirmed || !companyId) return;
    try {
      const table = type === "imovel" ? "cotas_imoveis" : "cotas_veiculos";
      const { error } = await supabase
        .from(table)
        .delete()
        .eq("id", id)
        .eq("company_id", companyId);

      if (error) throw error;
      toast({ title: "Cota excluída", description: "A cota foi removida." });
      fetchData();
    } catch (err) {
      toast({
        variant: "destructive",
        title: "Erro ao excluir",
        description: getErrorMessage(err),
      });
    }
  };

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
                <BreadcrumbPage>Consórcios</BreadcrumbPage>
              </BreadcrumbItem>
            </BreadcrumbList>
          </Breadcrumb>
          <ProfileDropdown className="ml-auto" />
        </header>
        <div className="flex flex-1 flex-col gap-4 p-4">
    <div className="p-6 space-y-6 bg-[#f9fafb] min-h-screen">
      <div className="flex justify-between items-center bg-white p-6 rounded-xl border shadow-sm">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Tabelas de Consórcio</h1>
          <p className="text-sm text-gray-500">Gerencie planos e parcelas para simulações.</p>
        </div>
        <Button
          className="bg-[#4a5d3f] hover:bg-[#3d4d34]"
          onClick={() => handleOpenModal()}
          disabled={!companyId}
        >
          <Plus className="mr-2 h-4 w-4" /> Nova Cota
        </Button>
      </div>

      <Tabs
        value={activeTab}
        onValueChange={(v) => setActiveTab(v as "imoveis" | "veiculos")}
        className="w-full bg-white rounded-xl border shadow-sm p-2"
      >
        <TabsList className="grid w-full grid-cols-2 max-w-[400px] mb-4">
          <TabsTrigger value="imoveis" className="flex gap-2">
            <Home className="w-4 h-4" /> Imóveis
          </TabsTrigger>
          <TabsTrigger value="veiculos" className="flex gap-2">
            <Car className="w-4 h-4" /> Veículos
          </TabsTrigger>
        </TabsList>

        <TabsContent value="imoveis">
          <div className="overflow-hidden rounded-lg border border-border bg-card shadow-sm">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Prazo (Meses)</TableHead>
                  <TableHead>Crédito (R$)</TableHead>
                  <TableHead>Parcela Mensal</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center py-10">
                      <Loader2 className="mx-auto h-8 w-8 animate-spin text-[#4a5d3f]" />
                    </TableCell>
                  </TableRow>
                ) : cotasImoveis.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center py-10 text-muted-foreground">
                      Nenhuma cota de imóvel cadastrada. Clique em Nova Cota para adicionar.
                    </TableCell>
                  </TableRow>
                ) : (
                  cotasImoveis.map((row) => (
                    <TableRow key={row.id}>
                      <TableCell>{row.meses}</TableCell>
                      <TableCell>{formatCurrency(Number(row.credito))}</TableCell>
                      <TableCell>{formatCurrency(Number(row.mensal))}</TableCell>
                      <TableCell className="text-right">
                        <div className="flex gap-2 justify-end">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-[#4a5d3f] hover:bg-[#4a5d3f]/10"
                            onClick={() => handleOpenModal(row)}
                          >
                            <Edit className="w-4 h-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-red-400 hover:bg-red-50"
                            onClick={() => handleDelete("imovel", row.id)}
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </TabsContent>

        <TabsContent value="veiculos">
          <div className="overflow-hidden rounded-lg border border-border bg-card shadow-sm">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Prazo (Meses)</TableHead>
                  <TableHead>Crédito (R$)</TableHead>
                  <TableHead>Mensal PF</TableHead>
                  <TableHead>Mensal PJ</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center py-10">
                      <Loader2 className="mx-auto h-8 w-8 animate-spin text-[#4a5d3f]" />
                    </TableCell>
                  </TableRow>
                ) : cotasVeiculos.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center py-10 text-muted-foreground">
                      Nenhuma cota de veículo cadastrada. Clique em Nova Cota para adicionar.
                    </TableCell>
                  </TableRow>
                ) : (
                  cotasVeiculos.map((row) => (
                    <TableRow key={row.id}>
                      <TableCell>{row.meses}</TableCell>
                      <TableCell>{formatCurrency(Number(row.credito))}</TableCell>
                      <TableCell>{formatCurrency(Number(row.pf_mensal))}</TableCell>
                      <TableCell>{formatCurrency(Number(row.pj_mensal))}</TableCell>
                      <TableCell className="text-right">
                        <div className="flex gap-2 justify-end">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-[#4a5d3f] hover:bg-[#4a5d3f]/10"
                            onClick={() => handleOpenModal(row)}
                          >
                            <Edit className="w-4 h-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-red-400 hover:bg-red-50"
                            onClick={() => handleDelete("veiculo", row.id)}
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </TabsContent>
      </Tabs>

      {/* Modal Nova/Editar Cota */}
      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="border-border bg-background">
          <DialogHeader>
            <DialogTitle>
              {activeTab === "imoveis"
                ? editingImovel
                  ? "Editar Cota Imóvel"
                  : "Nova Cota Imóvel"
                : editingVeiculo
                  ? "Editar Cota Veículo"
                  : "Nova Cota Veículo"}
            </DialogTitle>
            <DialogDescription>
              {activeTab === "imoveis"
                ? "Preencha os dados da cota de imóvel."
                : "Preencha os dados da cota de veículo."}
            </DialogDescription>
          </DialogHeader>
          {activeTab === "imoveis" ? (
            <form onSubmit={imovelForm.handleSubmit(onImovelSubmit)} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="meses">Prazo (meses)</Label>
                <Input
                  id="meses"
                  type="number"
                  min={1}
                  {...imovelForm.register("meses", { valueAsNumber: true })}
                />
                {imovelForm.formState.errors.meses && (
                  <p className="text-sm text-destructive">{imovelForm.formState.errors.meses.message}</p>
                )}
              </div>
              <div className="space-y-2">
                <Label htmlFor="credito">Crédito (R$)</Label>
                <Input
                  id="credito"
                  type="number"
                  step="0.01"
                  min={0}
                  {...imovelForm.register("credito", { valueAsNumber: true })}
                />
                {imovelForm.formState.errors.credito && (
                  <p className="text-sm text-destructive">{imovelForm.formState.errors.credito.message}</p>
                )}
              </div>
              <div className="space-y-2">
                <Label htmlFor="mensal">Parcela Mensal (R$)</Label>
                <Input
                  id="mensal"
                  type="number"
                  step="0.01"
                  min={0}
                  {...imovelForm.register("mensal", { valueAsNumber: true })}
                />
                {imovelForm.formState.errors.mensal && (
                  <p className="text-sm text-destructive">{imovelForm.formState.errors.mensal.message}</p>
                )}
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={handleCloseModal} disabled={isSaving}>
                  Cancelar
                </Button>
                <Button type="submit" className="bg-[#4a5d3f] hover:bg-[#3d4d34]" disabled={isSaving}>
                  {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                  Salvar
                </Button>
              </DialogFooter>
            </form>
          ) : (
            <form onSubmit={veiculoForm.handleSubmit(onVeiculoSubmit)} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="veiculo-meses">Prazo (meses)</Label>
                <Input
                  id="veiculo-meses"
                  type="number"
                  min={1}
                  {...veiculoForm.register("meses", { valueAsNumber: true })}
                />
                {veiculoForm.formState.errors.meses && (
                  <p className="text-sm text-destructive">{veiculoForm.formState.errors.meses.message}</p>
                )}
              </div>
              <div className="space-y-2">
                <Label htmlFor="veiculo-credito">Crédito (R$)</Label>
                <Input
                  id="veiculo-credito"
                  type="number"
                  step="0.01"
                  min={0}
                  {...veiculoForm.register("credito", { valueAsNumber: true })}
                />
                {veiculoForm.formState.errors.credito && (
                  <p className="text-sm text-destructive">{veiculoForm.formState.errors.credito.message}</p>
                )}
              </div>
              <div className="space-y-2">
                <Label htmlFor="pf_mensal">Mensal PF (R$)</Label>
                <Input
                  id="pf_mensal"
                  type="number"
                  step="0.01"
                  min={0}
                  {...veiculoForm.register("pf_mensal", { valueAsNumber: true })}
                />
                {veiculoForm.formState.errors.pf_mensal && (
                  <p className="text-sm text-destructive">{veiculoForm.formState.errors.pf_mensal.message}</p>
                )}
              </div>
              <div className="space-y-2">
                <Label htmlFor="pj_mensal">Mensal PJ (R$)</Label>
                <Input
                  id="pj_mensal"
                  type="number"
                  step="0.01"
                  min={0}
                  {...veiculoForm.register("pj_mensal", { valueAsNumber: true })}
                />
                {veiculoForm.formState.errors.pj_mensal && (
                  <p className="text-sm text-destructive">{veiculoForm.formState.errors.pj_mensal.message}</p>
                )}
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={handleCloseModal} disabled={isSaving}>
                  Cancelar
                </Button>
                <Button type="submit" className="bg-[#4a5d3f] hover:bg-[#3d4d34]" disabled={isSaving}>
                  {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                  Salvar
                </Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>

    </div>
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}
