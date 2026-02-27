import { useState, useEffect, useCallback, useRef } from "react"
import { useUser } from "@clerk/clerk-react"
import { Navigate } from "react-router-dom"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import * as z from "zod"
import { useSupabaseClient } from "@/lib/supabase-context"
import { AdminLayout } from "@/components/admin-layout"
import { isSaasAdmin } from "@/lib/use-saas-admin"
import { useToast } from "@/hooks/use-toast"
import { getErrorMessage } from "@/lib/utils"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Plus, Trash2, TrendingUp, Loader2 } from "lucide-react"

interface SaasCost {
  id: string
  description: string
  category: string
  monthly_value: number
}

interface PricingConfig {
  cnae_tax_percent: number
  desired_margin_percent: number
  target_licenses: number
  plan_price_base: number
}

const DEFAULT_CONFIG: PricingConfig = {
  cnae_tax_percent: 6,
  desired_margin_percent: 30,
  target_licenses: 100,
  plan_price_base: 490,
}

const COST_CATEGORIES = [
  "Infraestrutura",
  "Marketing",
  "Pessoal",
  "Software",
  "Outros",
] as const

const costSchema = z.object({
  description: z.string().min(2, "Descrição deve ter pelo menos 2 caracteres"),
  category: z.string().min(1, "Selecione uma categoria"),
  monthly_value: z.number().min(0, "Valor deve ser maior ou igual a zero"),
})

type CostFormValues = z.infer<typeof costSchema>

export default function PrecificacaoPage() {
  const { isLoaded, isSignedIn, user } = useUser()

  const supabase = useSupabaseClient()
  const { toast } = useToast()

  const [costs, setCosts] = useState<SaasCost[]>([])
  const [config, setConfig] = useState<PricingConfig>(DEFAULT_CONFIG)
  const [configId, setConfigId] = useState<string | null>(null)
  const [configLoaded, setConfigLoaded] = useState(false)
  const [loading, setLoading] = useState(true)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [savingCost, setSavingCost] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const saveConfigTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const form = useForm<CostFormValues>({
    resolver: zodResolver(costSchema),
    defaultValues: {
      description: "",
      category: "",
      monthly_value: 0,
    },
  })

  const fetchCosts = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from("saas_costs")
        .select("id, description, category, monthly_value")
        .order("created_at", { ascending: false })

      if (error) throw error
      setCosts((data ?? []) as SaasCost[])
    } catch (err) {
      toast({
        variant: "destructive",
        title: "Erro ao carregar despesas",
        description: getErrorMessage(err),
      })
    } finally {
      setLoading(false)
    }
  }, [supabase, toast])

  const fetchConfig = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from("saas_pricing_config")
        .select("id, cnae_tax_percent, desired_margin_percent, target_licenses, plan_price_base")
        .limit(1)
        .maybeSingle()

      if (error) throw error
      if (data) {
        setConfigId((data as { id: string }).id)
        setConfig({
          cnae_tax_percent: Number((data as { cnae_tax_percent?: number }).cnae_tax_percent) ?? DEFAULT_CONFIG.cnae_tax_percent,
          desired_margin_percent: Number((data as { desired_margin_percent?: number }).desired_margin_percent) ?? DEFAULT_CONFIG.desired_margin_percent,
          target_licenses: Number((data as { target_licenses?: number }).target_licenses) ?? DEFAULT_CONFIG.target_licenses,
          plan_price_base: Number((data as { plan_price_base?: number }).plan_price_base) ?? DEFAULT_CONFIG.plan_price_base,
        })
      }
      setConfigLoaded(true)
    } catch (err) {
      toast({
        variant: "destructive",
        title: "Erro ao carregar configuração",
        description: getErrorMessage(err),
      })
      setConfigLoaded(true)
    }
  }, [supabase, toast])

  useEffect(() => {
    if (!isLoaded || !isSignedIn || !user) return
    if (!isSaasAdmin(user.publicMetadata as Record<string, unknown>)) return

    setLoading(true)
    void fetchCosts()
    void fetchConfig()
  }, [isLoaded, isSignedIn, user, fetchCosts, fetchConfig])

  const saveConfig = useCallback(
    async (cfg: PricingConfig) => {
      try {
        if (configId) {
          const { error } = await supabase
            .from("saas_pricing_config")
            .update({
              cnae_tax_percent: cfg.cnae_tax_percent,
              desired_margin_percent: cfg.desired_margin_percent,
              target_licenses: cfg.target_licenses,
              plan_price_base: cfg.plan_price_base,
              updated_at: new Date().toISOString(),
            })
            .eq("id", configId)

          if (error) throw error
        } else {
          const { data, error } = await supabase
            .from("saas_pricing_config")
            .insert({
              cnae_tax_percent: cfg.cnae_tax_percent,
              desired_margin_percent: cfg.desired_margin_percent,
              target_licenses: cfg.target_licenses,
              plan_price_base: cfg.plan_price_base,
            })
            .select("id")
            .single()

          if (error) throw error
          if (data) setConfigId((data as { id: string }).id)
        }
      } catch (err) {
        toast({
          variant: "destructive",
          title: "Erro ao salvar configuração",
          description: getErrorMessage(err),
        })
      }
    },
    [configId, supabase, toast]
  )

  useEffect(() => {
    if (!isLoaded || !isSignedIn || !user) return
    if (!isSaasAdmin(user.publicMetadata as Record<string, unknown>)) return
    if (!configLoaded) return

    if (saveConfigTimeoutRef.current) {
      clearTimeout(saveConfigTimeoutRef.current)
    }

    saveConfigTimeoutRef.current = setTimeout(() => {
      saveConfigTimeoutRef.current = null
      void saveConfig(config)
    }, 500)

    return () => {
      if (saveConfigTimeoutRef.current) {
        clearTimeout(saveConfigTimeoutRef.current)
      }
    }
  }, [config, configLoaded, isLoaded, isSignedIn, user, saveConfig])

  const handleSubmitCost = form.handleSubmit(async (values) => {
    setSavingCost(true)
    try {
      const { error } = await supabase.from("saas_costs").insert({
        description: values.description,
        category: values.category,
        monthly_value: values.monthly_value,
      })

      if (error) throw error

      toast({ title: "Despesa cadastrada", description: "A despesa foi adicionada com sucesso." })
      setIsModalOpen(false)
      form.reset()
      await fetchCosts()
    } catch (err) {
      toast({
        variant: "destructive",
        title: "Erro ao cadastrar",
        description: getErrorMessage(err),
      })
    } finally {
      setSavingCost(false)
    }
  })

  const handleDeleteCost = async (id: string) => {
    setDeletingId(id)
    try {
      const { error } = await supabase.from("saas_costs").delete().eq("id", id)

      if (error) throw error

      toast({ title: "Despesa removida", description: "A despesa foi excluída." })
      await fetchCosts()
    } catch (err) {
      toast({
        variant: "destructive",
        title: "Erro ao excluir",
        description: getErrorMessage(err),
      })
    } finally {
      setDeletingId(null)
    }
  }

  const totalFixedCosts = costs.reduce(
    (acc, curr) => acc + Number(curr.monthly_value),
    0
  )
  const costPerLicense =
    config.target_licenses > 0 ? totalFixedCosts / config.target_licenses : 0
  const taxValue =
    config.plan_price_base * (config.cnae_tax_percent / 100)
  const netProfitPerLicense =
    config.plan_price_base - costPerLicense - taxValue
  const totalMonthlyProfit = netProfitPerLicense * config.target_licenses

  if (!isLoaded) return null
  if (!isSignedIn) return <Navigate to="/entrar" replace />
  if (!isSaasAdmin(user?.publicMetadata as Record<string, unknown>)) {
    return <Navigate to="/dashboard" replace />
  }

  return (
    <AdminLayout
      breadcrumb={{
        label: "Precificação",
        parent: { label: "Conta", href: "/admin/configuracoes" },
      }}
    >
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <h1 className="text-3xl font-bold tracking-tight">Precificação SaaS</h1>
          <Button onClick={() => setIsModalOpen(true)}>
            <Plus className="mr-2 h-4 w-4" /> Nova Despesa
          </Button>
        </div>

        <Tabs defaultValue="costs" className="w-full">
          <TabsList>
            <TabsTrigger value="costs">Custos Operacionais</TabsTrigger>
            <TabsTrigger value="simulator">Calculadora de Lucro</TabsTrigger>
          </TabsList>

          <TabsContent value="costs" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Listagem de Despesas Fixas</CardTitle>
              </CardHeader>
              <CardContent>
                {loading ? (
                  <div className="flex min-h-[120px] items-center justify-center">
                    <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Descrição</TableHead>
                        <TableHead>Categoria</TableHead>
                        <TableHead className="text-right">Valor Mensal</TableHead>
                        <TableHead className="w-[100px]" />
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {costs.map((cost) => (
                        <TableRow key={cost.id}>
                          <TableCell className="font-medium">
                            {cost.description}
                          </TableCell>
                          <TableCell>{cost.category}</TableCell>
                          <TableCell className="text-right">
                            R${" "}
                            {Number(cost.monthly_value).toLocaleString("pt-BR")}
                          </TableCell>
                          <TableCell>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleDeleteCost(cost.id)}
                              disabled={deletingId === cost.id}
                              aria-label="Excluir despesa"
                            >
                              {deletingId === cost.id ? (
                                <Loader2 className="h-4 w-4 animate-spin text-red-500" />
                              ) : (
                                <Trash2 className="h-4 w-4 text-red-500" />
                              )}
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                      <TableRow className="bg-muted/50 font-bold">
                        <TableCell colSpan={2}>Custo Fixo Total</TableCell>
                        <TableCell className="text-right text-red-600">
                          R$ {totalFixedCosts.toLocaleString("pt-BR")}
                        </TableCell>
                        <TableCell />
                      </TableRow>
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="simulator">
            <div className="grid md:grid-cols-4 gap-4 mb-6">
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium">
                    Imposto CNAE (%)
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <Input
                    type="number"
                    value={config.cnae_tax_percent}
                    onChange={(e) =>
                      setConfig({
                        ...config,
                        cnae_tax_percent: Number(e.target.value),
                      })
                    }
                  />
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium">
                    Qtd. Licenças Alvo
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <Input
                    type="number"
                    value={config.target_licenses}
                    onChange={(e) =>
                      setConfig({
                        ...config,
                        target_licenses: Number(e.target.value),
                      })
                    }
                  />
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium">
                    Preço do Plano (R$)
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <Input
                    type="number"
                    value={config.plan_price_base}
                    onChange={(e) =>
                      setConfig({
                        ...config,
                        plan_price_base: Number(e.target.value),
                      })
                    }
                  />
                </CardContent>
              </Card>
              <Card className="bg-primary text-primary-foreground">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium">
                    Lucro Mensal Projetado
                  </CardTitle>
                </CardHeader>
                <CardContent className="text-2xl font-bold">
                  R$ {totalMonthlyProfit.toLocaleString("pt-BR")}
                </CardContent>
              </Card>
            </div>

            <Card className="border-2 border-green-500">
              <CardHeader>
                <CardTitle className="flex items-center">
                  <TrendingUp className="mr-2 text-green-500" /> Resultado por
                  Unidade
                </CardTitle>
              </CardHeader>
              <CardContent className="grid md:grid-cols-3 gap-8">
                <div className="text-center p-4">
                  <p className="text-sm text-muted-foreground">
                    Custo Fixo/Licença
                  </p>
                  <p className="text-2xl font-bold">
                    R$ {costPerLicense.toLocaleString("pt-BR")}
                  </p>
                </div>
                <div className="text-center p-4">
                  <p className="text-sm text-muted-foreground">Imposto/Venda</p>
                  <p className="text-2xl font-bold text-orange-600">
                    R$ {taxValue.toLocaleString("pt-BR")}
                  </p>
                </div>
                <div className="text-center p-4 bg-green-50 dark:bg-green-950/30 rounded-lg">
                  <p className="text-sm text-green-700 dark:text-green-400">
                    Lucro Líquido p/ Licença
                  </p>
                  <p className="text-3xl font-black text-green-700 dark:text-green-400">
                    R$ {netProfitPerLicense.toLocaleString("pt-BR")}
                  </p>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>

      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Nova Despesa</DialogTitle>
            <DialogDescription>
              Cadastre uma despesa fixa mensal para o cálculo de precificação.
            </DialogDescription>
          </DialogHeader>
          <form
            onSubmit={handleSubmitCost}
            className="grid gap-4 py-4"
          >
            <div className="space-y-2">
              <Label htmlFor="description">Descrição</Label>
              <Input
                id="description"
                placeholder="Ex: Servidor AWS"
                {...form.register("description")}
              />
              {form.formState.errors.description && (
                <p className="text-xs text-destructive">
                  {form.formState.errors.description.message}
                </p>
              )}
            </div>
            <div className="space-y-2">
              <Label>Categoria</Label>
              <Select
                value={form.watch("category")}
                onValueChange={(v) => form.setValue("category", v)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione uma categoria" />
                </SelectTrigger>
                <SelectContent>
                  {COST_CATEGORIES.map((cat) => (
                    <SelectItem key={cat} value={cat}>
                      {cat}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {form.formState.errors.category && (
                <p className="text-xs text-destructive">
                  {form.formState.errors.category.message}
                </p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="monthly_value">Valor Mensal (R$)</Label>
              <Input
                id="monthly_value"
                type="number"
                step="0.01"
                min={0}
                placeholder="0,00"
                {...form.register("monthly_value", { valueAsNumber: true })}
              />
              {form.formState.errors.monthly_value && (
                <p className="text-xs text-destructive">
                  {form.formState.errors.monthly_value.message}
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
              <Button type="submit" disabled={savingCost}>
                {savingCost ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : null}
                Salvar
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </AdminLayout>
  )
}
