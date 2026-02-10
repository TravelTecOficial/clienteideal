import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"

/** Item do accordion tipado. */
interface AccordionEntry {
  value: string
  title: string
  content: string
}

const FAQ_ITEMS: AccordionEntry[] = [
  {
    value: "item-1",
    title: "É acessível?",
    content:
      "Sim. O componente segue o padrão WAI-ARIA para accordion: teclado (Enter/Space, setas), roles e estados expandido/colapsado.",
  },
  {
    value: "item-2",
    title: "Como personalizar as cores?",
    content:
      "Use as variáveis do design system (--border, --foreground, --muted-foreground) ou classes Tailwind como text-primary, border-primary.",
  },
  {
    value: "item-3",
    title: "Posso abrir vários itens ao mesmo tempo?",
    content:
      "Sim. Use type=\"multiple\" no Accordion e opcionalmente defaultValue={[\"item-1\", \"item-2\"]} para itens abertos por padrão.",
  },
]

export function AccordionShowcase() {
  return (
    <div className="space-y-12 p-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-foreground">
          Accordion
        </h1>
        <p className="mt-2 text-muted-foreground">
          Acordeão (shadcn/ui + Radix). Bordas e texto usam os tokens do design system. Acessível por teclado e leitores de tela.
        </p>
      </div>

      {/* Variante: single collapsible (padrão) */}
      <section className="space-y-4">
        <h2 className="text-xl font-semibold text-foreground">Variantes</h2>
        <h3 className="text-lg font-medium text-foreground">
          Single collapsible (um item aberto, pode fechar todos)
        </h3>
        <Accordion
          type="single"
          collapsible
          defaultValue="item-1"
          className="w-full max-w-xl rounded-lg border border-border bg-card px-4 shadow-sm"
        >
          {FAQ_ITEMS.map((item) => (
            <AccordionItem key={item.value} value={item.value}>
              <AccordionTrigger>{item.title}</AccordionTrigger>
              <AccordionContent>{item.content}</AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </section>

      {/* Variante: multiple */}
      <section className="space-y-4">
        <h3 className="text-lg font-medium text-foreground">
          Multiple (vários itens abertos)
        </h3>
        <Accordion
          type="multiple"
          defaultValue={["item-1"]}
          className="w-full max-w-xl rounded-lg border border-border bg-card px-4 shadow-sm"
        >
          <AccordionItem value="product">
            <AccordionTrigger>Informações do produto</AccordionTrigger>
            <AccordionContent>
              Design e materiais premium. Interface intuitiva e desempenho avançado.
            </AccordionContent>
          </AccordionItem>
          <AccordionItem value="shipping">
            <AccordionTrigger>Entrega</AccordionTrigger>
            <AccordionContent>
              Envio em 3–5 dias úteis. Expresso em 1–2 dias. Rastreamento incluído.
            </AccordionContent>
          </AccordionItem>
          <AccordionItem value="returns">
            <AccordionTrigger>Devoluções</AccordionTrigger>
            <AccordionContent>
              30 dias para devolução. Reembolso em até 48h após recebimento do item.
            </AccordionContent>
          </AccordionItem>
        </Accordion>
      </section>

      {/* Estado: single não collapsible (sempre um aberto) */}
      <section className="space-y-4">
        <h3 className="text-lg font-medium text-foreground">
          Single não collapsible (sempre um item aberto)
        </h3>
        <Accordion
          type="single"
          defaultValue="a"
          className="w-full max-w-xl rounded-lg border border-border bg-card px-4 shadow-sm"
        >
          <AccordionItem value="a">
            <AccordionTrigger>Opção A</AccordionTrigger>
            <AccordionContent>Conteúdo A. Não é possível fechar todos.</AccordionContent>
          </AccordionItem>
          <AccordionItem value="b">
            <AccordionTrigger>Opção B</AccordionTrigger>
            <AccordionContent>Conteúdo B.</AccordionContent>
          </AccordionItem>
        </Accordion>
      </section>

      {/* Exemplos de código */}
      <section className="space-y-4">
        <h2 className="text-xl font-semibold text-foreground">Exemplos de código</h2>
        <Card>
          <CardHeader>
            <CardTitle>Import</CardTitle>
            <CardDescription>Componentes do Accordion.</CardDescription>
          </CardHeader>
          <CardContent>
            <pre className="overflow-x-auto rounded-md border border-border bg-muted p-4 text-sm text-foreground">
{`import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion"`}
            </pre>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Uso básico (single collapsible)</CardTitle>
            <CardDescription>
              type="single" collapsible e defaultValue para item aberto inicial.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <pre className="overflow-x-auto rounded-md border border-border bg-muted p-4 text-sm text-foreground">
{`<Accordion type="single" collapsible defaultValue="item-1" className="w-full">
  <AccordionItem value="item-1">
    <AccordionTrigger>É acessível?</AccordionTrigger>
    <AccordionContent>
      Sim. Segue o padrão WAI-ARIA (teclado e leitores de tela).
    </AccordionContent>
  </AccordionItem>
</Accordion>`}
            </pre>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Vários itens abertos (multiple)</CardTitle>
            <CardDescription>type="multiple" e defaultValue como array.</CardDescription>
          </CardHeader>
          <CardContent>
            <pre className="overflow-x-auto rounded-md border border-border bg-muted p-4 text-sm text-foreground">
{`<Accordion type="multiple" defaultValue={["item-1", "item-2"]}>
  <AccordionItem value="item-1">...</AccordionItem>
  <AccordionItem value="item-2">...</AccordionItem>
</Accordion>`}
            </pre>
          </CardContent>
        </Card>
      </section>
    </div>
  )
}
