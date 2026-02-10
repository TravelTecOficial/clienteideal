import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Button } from "@/components/ui/button"

export function CardShowcase() {
  return (
    <div className="space-y-12 p-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-foreground">
          Card
        </h1>
        <p className="mt-2 text-muted-foreground">
          Cartão (shadcn/ui). Usa tokens bg-card, border, shadow-sm e radius do design system.
        </p>
      </div>

      <section className="space-y-4">
        <h2 className="text-xl font-semibold text-foreground">Variantes</h2>

        <h3 className="text-lg font-medium text-foreground">Simples (header + content)</h3>
        <Card className="max-w-sm">
          <CardHeader>
            <CardTitle>Título</CardTitle>
            <CardDescription>Descrição opcional do cartão.</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-foreground">Conteúdo do cartão.</p>
          </CardContent>
        </Card>

        <h3 className="text-lg font-medium text-foreground">Com footer e ação</h3>
        <Card className="max-w-sm">
          <CardHeader>
            <CardTitle>Plano Pro</CardTitle>
            <CardDescription>Acesso completo e suporte.</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-foreground">R$ 49</p>
            <p className="text-sm text-muted-foreground">/mês</p>
          </CardContent>
          <CardFooter>
            <Button className="w-full">Assinar</Button>
          </CardFooter>
        </Card>

        <h3 className="text-lg font-medium text-foreground">Múltiplos cards (grid)</h3>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <Card>
            <CardHeader>
              <CardTitle>Card A</CardTitle>
              <CardDescription>Conteúdo A</CardDescription>
            </CardHeader>
            <CardContent>Texto.</CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Card B</CardTitle>
              <CardDescription>Conteúdo B</CardDescription>
            </CardHeader>
            <CardContent>Texto.</CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Card C</CardTitle>
              <CardDescription>Conteúdo C</CardDescription>
            </CardHeader>
            <CardContent>Texto.</CardContent>
          </Card>
        </div>
      </section>

      <section className="space-y-4">
        <h2 className="text-xl font-semibold text-foreground">Exemplo de código</h2>
        <Card>
          <CardHeader>
            <CardTitle>Import e uso</CardTitle>
            <CardDescription>Componentes do Card.</CardDescription>
          </CardHeader>
          <CardContent>
            <pre className="overflow-x-auto rounded-md border border-border bg-muted p-4 text-sm text-foreground">
{`import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"

<Card>
  <CardHeader>
    <CardTitle>Título</CardTitle>
    <CardDescription>Descrição</CardDescription>
  </CardHeader>
  <CardContent>Conteúdo</CardContent>
  <CardFooter><Button>Ação</Button></CardFooter>
</Card>`}
            </pre>
          </CardContent>
        </Card>
      </section>
    </div>
  )
}
