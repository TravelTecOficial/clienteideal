import * as React from "react"
import { Bar, BarChart, CartesianGrid, XAxis } from "recharts"
import {
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"

/** Dados de exemplo tipados (sem any). */
interface ChartDataPoint {
  month: string
  desktop: number
  mobile: number
}

/** Cores do design system (hex para ChartConfig). */
const CHART_COLORS = {
  primary: "#7D7A67",
  success: "#545E4D",
} as const

const CHART_DATA: ChartDataPoint[] = [
  { month: "Janeiro", desktop: 186, mobile: 80 },
  { month: "Fevereiro", desktop: 305, mobile: 200 },
  { month: "Março", desktop: 237, mobile: 120 },
  { month: "Abril", desktop: 73, mobile: 190 },
  { month: "Maio", desktop: 209, mobile: 130 },
  { month: "Junho", desktop: 214, mobile: 140 },
]

const chartConfig = {
  desktop: {
    label: "Desktop",
    color: CHART_COLORS.primary,
  },
  mobile: {
    label: "Mobile",
    color: CHART_COLORS.success,
  },
} satisfies ChartConfig

export function BarChartShowcase() {
  const [loading, setLoading] = React.useState(false)

  return (
    <div className="space-y-12 p-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-foreground">
          Bar Chart
        </h1>
        <p className="mt-2 text-muted-foreground">
          Gráfico de barras (shadcn/ui + Recharts). Cores mapeadas aos tokens do design system.
        </p>
      </div>

      {/* Variante: padrão com eixos e grid */}
      <section className="space-y-4">
        <h2 className="text-xl font-semibold text-foreground">Variantes</h2>
        <h3 className="text-lg font-medium text-foreground">Padrão (eixos + grid)</h3>
        <ChartContainer
          config={chartConfig}
          className="min-h-[200px] w-full"
          aria-label="Gráfico de barras: acessos Desktop e Mobile por mês"
        >
          <BarChart accessibilityLayer data={CHART_DATA}>
            <CartesianGrid vertical={false} />
            <XAxis
              dataKey="month"
              tickLine={false}
              tickMargin={10}
              axisLine={false}
              tickFormatter={(value: string) => value.slice(0, 3)}
            />
            <Bar dataKey="desktop" fill="var(--color-desktop)" radius={4} />
            <Bar dataKey="mobile" fill="var(--color-mobile)" radius={4} />
          </BarChart>
        </ChartContainer>
      </section>

      {/* Variante: com tooltip e legenda */}
      <section className="space-y-4">
        <h3 className="text-lg font-medium text-foreground">Com tooltip e legenda</h3>
        <ChartContainer
          config={chartConfig}
          className="min-h-[200px] w-full"
          aria-label="Gráfico de barras com tooltip: Desktop e Mobile por mês"
        >
          <BarChart accessibilityLayer data={CHART_DATA}>
            <CartesianGrid vertical={false} />
            <XAxis
              dataKey="month"
              tickLine={false}
              tickMargin={10}
              axisLine={false}
              tickFormatter={(value: string) => value.slice(0, 3)}
            />
            <ChartTooltip content={<ChartTooltipContent />} />
            <ChartLegend content={<ChartLegendContent />} />
            <Bar dataKey="desktop" fill="var(--color-desktop)" radius={4} />
            <Bar dataKey="mobile" fill="var(--color-mobile)" radius={4} />
          </BarChart>
        </ChartContainer>
      </section>

      {/* Estado: loading (placeholder) */}
      <section className="space-y-4">
        <h2 className="text-xl font-semibold text-foreground">Estados</h2>
        <p className="text-sm text-muted-foreground">
          Estado de carregamento: exibir placeholder ou skeleton até os dados chegarem.
        </p>
        <div className="flex items-center gap-4">
        <button
          type="button"
          onClick={() => setLoading((l) => !l)}
          className="rounded-md border border-border bg-card px-3 py-2 text-sm font-medium text-card-foreground hover:bg-muted"
        >
          {loading ? "Mostrar gráfico" : "Simular loading"}
        </button>
        </div>
        {loading ? (
          <div
            className="flex min-h-[200px] w-full items-center justify-center rounded-lg border border-border bg-muted/30"
            aria-busy="true"
            aria-live="polite"
          >
            <span className="text-sm text-muted-foreground">Carregando dados…</span>
          </div>
        ) : (
          <ChartContainer
            config={chartConfig}
            className="min-h-[200px] w-full"
            aria-label="Gráfico de barras: exemplo sem loading"
          >
            <BarChart accessibilityLayer data={CHART_DATA}>
              <CartesianGrid vertical={false} />
              <XAxis
                dataKey="month"
                tickLine={false}
                tickMargin={10}
                axisLine={false}
                tickFormatter={(value: string) => value.slice(0, 3)}
              />
              <Bar dataKey="desktop" fill="var(--color-desktop)" radius={4} />
              <Bar dataKey="mobile" fill="var(--color-mobile)" radius={4} />
            </BarChart>
          </ChartContainer>
        )}
      </section>

      {/* Exemplos de código */}
      <section className="space-y-4">
        <h2 className="text-xl font-semibold text-foreground">Exemplos de código</h2>
        <Card>
          <CardHeader>
            <CardTitle>Import</CardTitle>
            <CardDescription>Componentes do Chart e Recharts.</CardDescription>
          </CardHeader>
          <CardContent>
            <pre className="overflow-x-auto rounded-md border border-border bg-muted p-4 text-sm text-foreground">
{`import { Bar, BarChart, CartesianGrid, XAxis } from "recharts"
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart"`}
            </pre>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Config e uso básico</CardTitle>
            <CardDescription>ChartConfig com cores e BarChart com accessibilityLayer.</CardDescription>
          </CardHeader>
          <CardContent>
            <pre className="overflow-x-auto rounded-md border border-border bg-muted p-4 text-sm text-foreground">
{`const chartConfig = {
  desktop: { label: "Desktop", color: "#7D7A67" },
  mobile:  { label: "Mobile",  color: "#545E4D" },
} satisfies ChartConfig

<ChartContainer config={chartConfig} className="min-h-[200px] w-full" aria-label="…">
  <BarChart accessibilityLayer data={data}>
    <CartesianGrid vertical={false} />
    <XAxis dataKey="month" tickLine={false} axisLine={false} />
    <ChartTooltip content={<ChartTooltipContent />} />
    <Bar dataKey="desktop" fill="var(--color-desktop)" radius={4} />
    <Bar dataKey="mobile"  fill="var(--color-mobile)"  radius={4} />
  </BarChart>
</ChartContainer>`}
            </pre>
          </CardContent>
        </Card>
      </section>
    </div>
  )
}
