import { useEffect, useState } from "react";
import { useAuth, useOrganization } from "@clerk/clerk-react";
import { useSupabaseClient } from "@/lib/supabase-context";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { User, Brain, ShoppingCart, Save, Loader2 } from "lucide-react";

// 1. Schema de Validação
const idealCustomerSchema = z.object({
  profile_name: z.string().min(2, "O nome do perfil é obrigatório"),
  age_range: z.string().optional(),
  gender: z.string().optional(),
  location: z.string().optional(),
  income_level: z.string().optional(),
  job_title: z.string().optional(),
  goals_dreams: z.string().min(5, "Descreva os objetivos"),
  pain_points: z.string().min(5, "Descreva as dores"),
  values_list: z.string().optional(),
  hobbies_interests: z.string().optional(),
  buying_journey: z.string().optional(),
  decision_criteria: z.string().optional(),
  common_objections: z.string().optional(),
  target_product: z.string().optional(),
});

type IdealCustomerFormValues = z.infer<typeof idealCustomerSchema>;

export default function IdealCustomerPage() {
  const { userId } = useAuth();
  const { organization } = useOrganization();
  const supabase = useSupabaseClient();
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [isFetching, setIsFetching] = useState(true);

  const companyId = organization?.id || "personal"; // Fallback para conta pessoal se não houver org

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

  // 2. Carregar dados existentes
  useEffect(() => {
    async function loadData() {
      if (!companyId) return;
      try {
        const { data, error } = await supabase
          .from("ideal_customers")
          .select("*")
          .eq("company_id", companyId)
          .maybeSingle();

        if (error) {
          console.error("Erro ao carregar dados:", error);
        } else if (data) {
          form.reset(data);
        }
      } catch (err) {
        console.error("Erro ao carregar dados:", err);
      } finally {
        setIsFetching(false);
      }
    }
    loadData();
  }, [companyId, form]);

  // 3. Salvar / Upsert
  async function onSubmit(values: IdealCustomerFormValues) {
    setIsLoading(true);
    try {
      const { error } = await supabase.from("ideal_customers").upsert({
        ...values,
        user_id: userId,
        company_id: companyId,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'company_id' }); // Ajuste o conflito conforme sua lógica de negócio

      if (error) throw error;

      toast({
        title: "Sucesso!",
        description: "Perfil do Cliente Ideal salvo corretamente.",
      });
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Erro ao salvar",
        description: error.message,
      });
    } finally {
      setIsLoading(false);
    }
  }

  if (isFetching) {
    return (
      <div className="flex items-center justify-center h-screen">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="container mx-auto py-10 space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Cliente Ideal (Persona)</h1>
        <p className="text-muted-foreground">Preencha as informações para que a IA conheça seu público-alvo.</p>
      </div>

      <form onSubmit={form.handleSubmit(onSubmit)}>
        <Tabs defaultValue="demographics" className="w-full">
          <TabsList className="grid w-full grid-cols-3 mb-8">
            <TabsTrigger value="demographics"><User className="w-4 h-4 mr-2" /> Demográficos</TabsTrigger>
            <TabsTrigger value="psychographics"><Brain className="w-4 h-4 mr-2" /> Psicográficos</TabsTrigger>
            <TabsTrigger value="behavior"><ShoppingCart className="w-4 h-4 mr-2" /> Comportamento</TabsTrigger>
          </TabsList>

          {/* ABA 1: DEMOGRÁFICOS */}
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
                    <Input {...form.register("profile_name")} placeholder="Ex: Pedro Empreendedor" />
                    {form.formState.errors.profile_name && <p className="text-red-500 text-xs">{form.formState.errors.profile_name.message}</p>}
                  </div>
                  <div className="space-y-2">
                    <Label>Cargo / Profissão</Label>
                    <Input {...form.register("job_title")} placeholder="Ex: Diretor de Vendas" />
                  </div>
                  <div className="space-y-2">
                    <Label>Faixa Etária</Label>
                    <Input {...form.register("age_range")} placeholder="Ex: 30-45 anos" />
                  </div>
                  <div className="space-y-2">
                    <Label>Localização</Label>
                    <Input {...form.register("location")} placeholder="Ex: São Paulo / Brasil" />
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* ABA 2: PSICOGRÁFICOS */}
          <TabsContent value="psychographics">
            <Card>
              <CardHeader>
                <CardTitle>Dados Psicográficos</CardTitle>
                <CardDescription>O que seu cliente pensa e sente?</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label>Dores e Problemas (O que tira o sono dele?)</Label>
                  <Textarea {...form.register("pain_points")} placeholder="Descreva as dificuldades atuais..." className="min-h-[100px]" />
                </div>
                <div className="space-y-2">
                  <Label>Objetivos e Sonhos (Onde ele quer chegar?)</Label>
                  <Textarea {...form.register("goals_dreams")} placeholder="O que ele deseja conquistar..." className="min-h-[100px]" />
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* ABA 3: COMPORTAMENTO */}
          <TabsContent value="behavior">
            <Card>
              <CardHeader>
                <CardTitle>Comportamento de Compra</CardTitle>
                <CardDescription>Como ele toma decisões de compra?</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label>Objeções Comuns (Por que ele não compraria?)</Label>
                  <Textarea {...form.register("common_objections")} placeholder="Ex: Preço alto, falta de tempo..." className="min-h-[100px]" />
                </div>
                <div className="space-y-2">
                  <Label>Critérios de Decisão</Label>
                  <Input {...form.register("decision_criteria")} placeholder="Ex: Atendimento, Suporte, Preço" />
                </div>
                <Button type="submit" className="w-full" disabled={isLoading}>
                  {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                  Salvar Configurações da Persona
                </Button>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </form>
    </div>
  );
}