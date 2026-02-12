import { useEffect, useState, useCallback } from "react";
import { useAuth, useOrganization } from "@clerk/clerk-react";
import type { SupabaseClient } from "@supabase/supabase-js";
import { useSupabaseClient } from "@/lib/supabase-context";

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
import { User, Brain, ShoppingCart, Save, Loader2, Plus, Edit2, Trash2 } from "lucide-react";

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
}

export default function IdealCustomerPage() {
  const { userId } = useAuth();
  const { organization } = useOrganization();
  const supabase = useSupabaseClient();
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [isFetching, setIsFetching] = useState(true);
  const [companyId, setCompanyId] = useState<string | null>(null);
  const [clientes, setClientes] = useState<IdealCustomerRow[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  const effectiveCompanyId = companyId ?? organization?.id ?? null;

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
        .select("id, profile_name, job_title, location")
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

  const handleOpenNew = () => {
    setEditingId(null);
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
    if (!effectiveCompanyId || !userId) return;

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
        updated_at: new Date().toISOString(),
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
      const msg = err instanceof Error ? err.message : "Erro ao salvar.";
      toast({
        variant: "destructive",
        title: "Erro ao salvar",
        description: msg,
      });
    } finally {
      setIsLoading(false);
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
        description: err instanceof Error ? err.message : "Erro desconhecido",
      });
    }
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
        <Button onClick={handleOpenNew} disabled={!effectiveCompanyId}>
          <Plus className="mr-2 h-4 w-4" /> Novo Cliente Ideal
        </Button>
      </div>

      <div className="rounded-md border bg-white">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="text-foreground">Perfil</TableHead>
              <TableHead className="text-foreground">Cargo</TableHead>
              <TableHead className="text-foreground">Localização</TableHead>
              <TableHead className="text-right text-foreground">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isFetching ? (
              <TableRow>
                <TableCell colSpan={4} className="text-center py-10">
                  <Loader2 className="mx-auto h-8 w-8 animate-spin text-primary" />
                </TableCell>
              </TableRow>
            ) : clientes.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={4}
                  className="text-center py-10 text-muted-foreground"
                >
                  Nenhum cliente ideal cadastrado. Clique em &quot;Novo Cliente Ideal&quot; para começar.
                </TableCell>
              </TableRow>
            ) : (
              clientes.map((c) => (
                <TableRow key={c.id}>
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
                      <Input
                        {...form.register("decision_criteria")}
                        placeholder="Ex: Atendimento, Suporte, Preço"
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
    </div>
  );
}
