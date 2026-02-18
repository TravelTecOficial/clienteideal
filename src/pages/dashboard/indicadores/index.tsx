/**
 * Dashboard de Performance - Indicadores.
 * Note: UI-level. RLS valida company_id no Supabase.
 */

import { useState } from "react"
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  XAxis,
  YAxis,
} from "recharts"
import {
  Activity,
  BarChart3,
  Calendar,
  DollarSign,
  Headphones,
  ShoppingCart,
} from "lucide-react"

import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Skeleton } from "@/components/ui/skeleton"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  MOCK_CANAIS,
  MOCK_HISTORICO,
  MOCK_KPI_COMERCIAL,
  MOCK_TEMPERATURA,
} from "./mock-data"
import {
  useDashboardKpis,
  type DashboardKpis,
} from "./use-dashboard-kpis"
import {
  getPeriodRange,
  hasVariacao,
  PERIOD_OPTIONS,
  type PeriodoKey,
} from "./period-utils"

function formatCurrency(value: number): string {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value)
}

const historicoChartConfig = {
  fechamentos: {
    label: "Fechamentos",
    color: "#636F4E",
  },
} satisfies ChartConfig

const temperaturaChartConfig = {
  Quente: { label: "Quente", color: "#b91c1c" },
  Morno: { label: "Morno", color: "#d97706" },
  Frio: { label: "Frio", color: "#2563eb" },
} satisfies ChartConfig

const engajamentoChartConfig: ChartConfig = {
  engajamento: { label: "Engajamento (%)", color: "#636F4E" },
}

const FUNIL_ETAPAS = [
  { key: "atendimentos" as const, label: "Atendimentos", color: "#2563eb" },
  { key: "agendamentos" as const, label: "Agendamentos", color: "#d97706" },
  { key: "reunioes" as const, label: "Reuniões", color: "#ea580c" },
  { key: "vendas" as const, label: "Vendas", color: "#636F4E" },
] as const

interface FunilVendasProps {
  kpis: DashboardKpis
  isLoading: boolean
}

function FunilVendas({ kpis, isLoading }: FunilVendasProps) {
  const maxVal = Math.max(
    kpis.atendimentos,
    kpis.agendamentos,
    kpis.reunioes,
    kpis.vendas,
    1
  )

  const etapas = FUNIL_ETAPAS.map((e) => ({
    ...e,
    valor: kpis[e.key],
    width: `${Math.max(15, (kpis[e.key] / maxVal) * 100)}%`,
  }))

  if (isLoading) {
    return (
      <div className="flex flex-col items-center gap-2">
        {[1, 2, 3, 4].map((i) => (
          <Skeleton key={i} className="h-12 w-full max-w-[280px]" />
        ))}
      </div>
    )
  }

  return (
    <div className="flex flex-col items-center gap-2">
      {etapas.map((etapa, i) => (
        <div key={etapa.label} className="flex w-full flex-col items-center gap-1">
          <div
            className="flex h-12 items-center justify-center rounded-md border px-4 transition-all hover:opacity-90"
            style={{
              width: etapa.width,
              minWidth: 120,
              backgroundColor: `${etapa.color}20`,
              border: "1px solid var(--border)",
              borderLeft: `4px solid ${etapa.color}`,
            }}
          >
            <span className="font-black text-foreground">
              {etapa.valor.toLocaleString("pt-BR")}
            </span>
            <span className="ml-2 text-sm text-muted-foreground">
              {etapa.label}
            </span>
          </div>
          {i < etapas.length - 1 && (
            <div className="h-3 w-px bg-border" aria-hidden />
          )}
        </div>
      ))}
    </div>
  )
}

export default function IndicadoresPageContent() {
  const [periodoKey, setPeriodoKey] = useState<PeriodoKey>("todo")
  const periodo = getPeriodRange(periodoKey)
  const { kpis, isLoading, error } = useDashboardKpis(periodo)
  const showVariacao = hasVariacao(periodoKey)

  return (
    <div className="space-y-6">
      {/* Seletor de período */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <label htmlFor="periodo-select" className="text-sm font-medium">
          Período
        </label>
        <Select
          value={periodoKey}
          onValueChange={(v) => setPeriodoKey(v as PeriodoKey)}
        >
          <SelectTrigger id="periodo-select" className="w-full sm:w-[220px]">
            <SelectValue placeholder="Selecione o período" />
          </SelectTrigger>
          <SelectContent>
            {PERIOD_OPTIONS.map((opt) => (
              <SelectItem key={opt.value} value={opt.value}>
                {opt.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {error && (
        <div className="rounded-md border border-destructive/50 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {error}
        </div>
      )}

      <Tabs defaultValue="comercial" className="w-full">
        <TabsList className="grid w-full grid-cols-2 lg:w-auto lg:inline-grid">
          <TabsTrigger value="comercial">Performance Comercial</TabsTrigger>
          <TabsTrigger value="social">Insights Redes Sociais</TabsTrigger>
        </TabsList>

        <TabsContent value="comercial" className="mt-6 space-y-6">
          {/* KPIs - Padrão ShadCN: 4 cards + Financeiro em destaque */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Investimento Ads
                </CardTitle>
                <DollarSign className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                {isLoading ? (
                  <Skeleton className="h-8 w-24" />
                ) : (
                  <div className="text-2xl font-bold">
                    {formatCurrency(kpis.investimentoAds)}
                  </div>
                )}
                <p className="text-xs text-muted-foreground pt-1">
                  {showVariacao ? "— vs. mês anterior" : "—"}
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Atendimentos
                </CardTitle>
                <Headphones className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                {isLoading ? (
                  <Skeleton className="h-8 w-24" />
                ) : (
                  <div className="text-2xl font-bold">
                    {kpis.atendimentos.toLocaleString("pt-BR")}
                  </div>
                )}
                <p className="text-xs text-muted-foreground">
                  {showVariacao ? "— vs. mês anterior" : "—"}
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Agendamentos
                </CardTitle>
                <Calendar className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                {isLoading ? (
                  <Skeleton className="h-8 w-24" />
                ) : (
                  <div className="text-2xl font-bold">
                    {kpis.agendamentos.toLocaleString("pt-BR")}
                  </div>
                )}
                <p className="text-xs text-muted-foreground">
                  {showVariacao ? "— vs. mês anterior" : "—"}
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Vendas
                </CardTitle>
                <ShoppingCart className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                {isLoading ? (
                  <Skeleton className="h-8 w-24" />
                ) : (
                  <div className="text-2xl font-bold">
                    {kpis.vendas.toLocaleString("pt-BR")}
                  </div>
                )}
                <p className="text-xs text-muted-foreground">
                  {showVariacao ? "— vs. mês anterior" : "—"}
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Card Financeiro em destaque - mantém mock (não conectado ao período) */}
          <Card className="border-primary/20 bg-primary/5">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                <DollarSign className="h-4 w-4" />
                Financeiro
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <CardDescription>Faturamento</CardDescription>
                  <p className="text-2xl font-bold text-foreground">
                    {formatCurrency(MOCK_KPI_COMERCIAL.faturamento)}
                  </p>
                </div>
                <div>
                  <CardDescription>Lucro</CardDescription>
                  <p className="text-2xl font-bold text-foreground">
                    {formatCurrency(MOCK_KPI_COMERCIAL.lucro)}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Gráficos: Funil + AreaChart + PieChart (padrão ShadCN) */}
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
            <Card className="lg:col-span-5">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-base font-semibold">
                  Funil de Vendas
                </CardTitle>
                <Activity className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <FunilVendas kpis={kpis} isLoading={isLoading} />
              </CardContent>
            </Card>

            <Card className="lg:col-span-7">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-base font-semibold">
                  Histórico de Fechamentos
                </CardTitle>
                <BarChart3 className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <ChartContainer
                  config={historicoChartConfig}
                  className="min-h-[200px] w-full"
                  aria-label="Histórico de fechamentos por mês"
                >
                  <AreaChart accessibilityLayer data={MOCK_HISTORICO}>
                    <defs>
                      <linearGradient id="fillFechamentos" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#636F4E" stopOpacity={0.8} />
                        <stop offset="95%" stopColor="#636F4E" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid vertical={false} strokeDasharray="3 3" />
                    <XAxis
                      dataKey="mes"
                      tickLine={false}
                      tickMargin={10}
                      axisLine={false}
                    />
                    <YAxis tickLine={false} axisLine={false} />
                    <ChartTooltip content={<ChartTooltipContent />} />
                    <Area
                      type="monotone"
                      dataKey="fechamentos"
                      stroke="#636F4E"
                      fill="url(#fillFechamentos)"
                      strokeWidth={2}
                    />
                  </AreaChart>
                </ChartContainer>
              </CardContent>
            </Card>

            <Card className="lg:col-span-4">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-base font-semibold">
                  Temperatura dos Leads
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ChartContainer
                  config={temperaturaChartConfig}
                  className="mx-auto min-h-[200px] w-full max-w-[280px]"
                  aria-label="Distribuição de leads por temperatura"
                >
                  <PieChart>
                    <Pie
                      data={MOCK_TEMPERATURA}
                      dataKey="valor"
                      nameKey="nome"
                      cx="50%"
                      cy="50%"
                      innerRadius={50}
                      outerRadius={80}
                      paddingAngle={2}
                    >
                      {MOCK_TEMPERATURA.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.cor} />
                      ))}
                    </Pie>
                    <ChartTooltip content={<ChartTooltipContent />} />
                  </PieChart>
                </ChartContainer>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="social" className="mt-6 space-y-6">
          {/* 4 Cards de métricas - Redes Sociais (padrão ShadCN) */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {MOCK_CANAIS.map((canal) => (
              <Card
                key={canal.canal}
                className="overflow-hidden border-l-4"
                style={{ borderLeftColor: canal.cor }}
              >
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">
                    {canal.canal}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">
                    {canal.seguidores.toLocaleString("pt-BR")}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    seguidores · {canal.engajamento}% engajamento
                  </p>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* BarChart Engajamento por canal */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-base font-semibold">
                Engajamento por Canal
              </CardTitle>
              <BarChart3 className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <ChartContainer
                config={engajamentoChartConfig}
                className="min-h-[200px] w-full"
                aria-label="Engajamento por canal de rede social"
              >
                <BarChart accessibilityLayer data={MOCK_CANAIS}>
                  <CartesianGrid vertical={false} />
                  <XAxis
                    dataKey="canal"
                    tickLine={false}
                    tickMargin={10}
                    axisLine={false}
                  />
                  <YAxis
                    tickLine={false}
                    axisLine={false}
                    tickFormatter={(v: number) => `${v}%`}
                  />
                  <ChartTooltip content={<ChartTooltipContent />} />
                  <Bar
                    dataKey="engajamento"
                    fill="var(--color-engajamento)"
                    radius={4}
                  />
                </BarChart>
              </ChartContainer>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
