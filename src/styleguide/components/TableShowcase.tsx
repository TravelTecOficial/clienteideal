import * as React from "react"
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"

/** Dados de exemplo tipados (sem any). */
interface InvoiceRow {
  id: string
  invoice: string
  paymentStatus: "paid" | "pending" | "unpaid"
  paymentMethod: string
  totalAmount: string
}

const SAMPLE_INVOICES: InvoiceRow[] = [
  { id: "1", invoice: "INV001", paymentStatus: "paid", paymentMethod: "Cartão", totalAmount: "R$ 250,00" },
  { id: "2", invoice: "INV002", paymentStatus: "pending", paymentMethod: "PIX", totalAmount: "R$ 150,00" },
  { id: "3", invoice: "INV003", paymentStatus: "unpaid", paymentMethod: "Boleto", totalAmount: "R$ 350,00" },
  { id: "4", invoice: "INV004", paymentStatus: "paid", paymentMethod: "Cartão", totalAmount: "R$ 450,00" },
]

function StatusBadge({ status }: { status: InvoiceRow["paymentStatus"] }) {
  const config: Record<
    InvoiceRow["paymentStatus"],
    { label: string; variant: "default" | "secondary" | "destructive" | "outline" }
  > = {
    paid: { label: "Pago", variant: "default" },
    pending: { label: "Pendente", variant: "secondary" },
    unpaid: { label: "Não pago", variant: "destructive" },
  }
  const { label, variant } = config[status]
  return <Badge variant={variant}>{label}</Badge>
}

export function TableShowcase() {
  const [selectedId, setSelectedId] = React.useState<string | null>(null)

  return (
    <div className="space-y-12 p-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-foreground">
          Table
        </h1>
        <p className="mt-2 text-muted-foreground">
          Componente de tabela (shadcn/ui). Usa tokens de borda, fundo e texto do design system.
        </p>
      </div>

      {/* Variantes: tabela padrão */}
      <section className="space-y-4">
        <h2 className="text-xl font-semibold text-foreground">Variantes</h2>
        <h3 className="text-lg font-medium text-foreground">Padrão (com caption e footer)</h3>
        <div className="overflow-hidden rounded-lg border border-border bg-card shadow-sm">
          <Table aria-label="Lista de faturas recentes">
            <TableCaption>Lista de faturas recentes.</TableCaption>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[100px]">Fatura</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Método</TableHead>
                <TableHead className="text-right">Valor</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {SAMPLE_INVOICES.map((row) => (
                <TableRow key={row.id}>
                  <TableCell className="font-medium">{row.invoice}</TableCell>
                  <TableCell>
                    <StatusBadge status={row.paymentStatus} />
                  </TableCell>
                  <TableCell>{row.paymentMethod}</TableCell>
                  <TableCell className="text-right">{row.totalAmount}</TableCell>
                </TableRow>
              ))}
            </TableBody>
            <TableFooter>
              <TableRow>
                <TableCell colSpan={3}>Total</TableCell>
                <TableCell className="text-right">R$ 1.200,00</TableCell>
              </TableRow>
            </TableFooter>
          </Table>
        </div>
      </section>

      {/* Estados: hover, selected, disabled */}
      <section className="space-y-4">
        <h2 className="text-xl font-semibold text-foreground">Estados</h2>
        <p className="text-sm text-muted-foreground">
          Hover na linha (nativo), linha selecionada (data-state) e linha desabilitada (visual).
        </p>
        <div className="overflow-hidden rounded-lg border border-border bg-card shadow-sm">
          <Table aria-label="Exemplo de estados de linha">
            <TableHeader>
              <TableRow>
                <TableHead>Fatura</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              <TableRow>
                <TableCell className="font-medium">INV001</TableCell>
                <TableCell>Padrão</TableCell>
              </TableRow>
              <TableRow
                data-state={selectedId === "2" ? "selected" : undefined}
                onClick={() => setSelectedId(selectedId === "2" ? null : "2")}
                className="cursor-pointer"
              >
                <TableCell className="font-medium">INV002</TableCell>
                <TableCell>Clique para selecionar</TableCell>
              </TableRow>
              <TableRow
                className="cursor-not-allowed opacity-50"
                aria-disabled="true"
              >
                <TableCell className="font-medium">INV003</TableCell>
                <TableCell>Desabilitada</TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </div>
      </section>

      {/* Tabela compacta (variante de densidade) */}
      <section className="space-y-4">
        <h3 className="text-lg font-medium text-foreground">Compacta</h3>
        <div className="overflow-hidden rounded-lg border border-border bg-card shadow-sm">
          <Table aria-label="Tabela compacta">
            <TableHeader>
              <TableRow>
                <TableHead className="h-8 px-3">Nome</TableHead>
                <TableHead className="h-8 px-3">Valor</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              <TableRow>
                <TableCell className="px-3 py-2">Item A</TableCell>
                <TableCell className="px-3 py-2">R$ 100,00</TableCell>
              </TableRow>
              <TableRow>
                <TableCell className="px-3 py-2">Item B</TableCell>
                <TableCell className="px-3 py-2">R$ 200,00</TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </div>
      </section>

      {/* Código de exemplo */}
      <section className="space-y-4">
        <h2 className="text-xl font-semibold text-foreground">Exemplos de código</h2>
        <Card>
          <CardHeader>
            <CardTitle>Import</CardTitle>
            <CardDescription>Componentes exportados do Table.</CardDescription>
          </CardHeader>
          <CardContent>
            <pre className="overflow-x-auto rounded-md border border-border bg-muted p-4 text-sm text-foreground">
{`import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"`}
            </pre>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Uso básico</CardTitle>
            <CardDescription>Estrutura semântica com caption e acessibilidade.</CardDescription>
          </CardHeader>
          <CardContent>
            <pre className="overflow-x-auto rounded-md border border-border bg-muted p-4 text-sm text-foreground">
{`<Table aria-label="Descrição da tabela">
  <TableCaption>Legenda opcional.</TableCaption>
  <TableHeader>
    <TableRow>
      <TableHead>Coluna 1</TableHead>
      <TableHead className="text-right">Coluna 2</TableHead>
    </TableRow>
  </TableHeader>
  <TableBody>
    <TableRow>
      <TableCell>Dado</TableCell>
      <TableCell className="text-right">Valor</TableCell>
    </TableRow>
  </TableBody>
  <TableFooter>
    <TableRow>
      <TableCell>Total</TableCell>
      <TableCell className="text-right">R$ 0,00</TableCell>
    </TableRow>
  </TableFooter>
</Table>`}
            </pre>
          </CardContent>
        </Card>
      </section>
    </div>
  )
}
