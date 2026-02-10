import { useState, useCallback } from "react"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { cn } from "@/lib/utils"
import { AlertCircle, AlertTriangle, CheckCircle2, Info } from "lucide-react"

const PRIMARY_SCALE = [50, 100, 200, 300, 400, 500, 600, 700, 800, 900] as const
const GREY_SCALE = [50, 100, 200, 300, 400, 500, 600, 700, 800, 900] as const

const SEMANTIC_TOKENS: { name: string; varName: string; bgClass: string }[] = [
  { name: "Background", varName: "--background", bgClass: "bg-background" },
  { name: "Foreground", varName: "--foreground", bgClass: "bg-foreground" },
  { name: "Card", varName: "--card", bgClass: "bg-card" },
  { name: "Primary", varName: "--primary", bgClass: "bg-primary" },
  { name: "Secondary", varName: "--secondary", bgClass: "bg-secondary" },
  { name: "Muted", varName: "--muted", bgClass: "bg-muted" },
  { name: "Accent", varName: "--accent", bgClass: "bg-accent" },
  { name: "Destructive", varName: "--destructive", bgClass: "bg-destructive" },
  { name: "Success", varName: "--success", bgClass: "bg-success" },
  { name: "Warning", varName: "--warning", bgClass: "bg-warning" },
  { name: "Info", varName: "--info", bgClass: "bg-info" },
  { name: "Border", varName: "--border", bgClass: "bg-border" },
]

export function StyleguidePage() {
  const [dark, setDark] = useState(false)

  const toggleDark = useCallback(() => {
    setDark((prev) => {
      const next = !prev
      if (next) {
        document.documentElement.classList.add("dark")
      } else {
        document.documentElement.classList.remove("dark")
      }
      return next
    })
  }, [])

  return (
    <div className="space-y-12 p-8">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-3xl font-bold tracking-tight text-foreground">
          Design System — Design Tokens
        </h1>
        <Button
          type="button"
          variant="outline"
          onClick={toggleDark}
          aria-pressed={dark}
          aria-label={dark ? "Ativar tema claro" : "Ativar tema escuro"}
        >
          {dark ? "Modo claro" : "Modo escuro"}
        </Button>
      </div>

      {/* Color palette: semantic tokens */}
      <section className="space-y-4">
        <h2 className="text-xl font-semibold text-foreground">Paleta de cores</h2>
        <p className="text-sm text-muted-foreground">
          Tokens semânticos (variáveis CSS). Contraste WCAG 2.1 considerado.
        </p>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
          {SEMANTIC_TOKENS.map((token) => (
            <div
              key={token.varName}
              className={cn(
                "flex flex-col overflow-hidden rounded-lg border border-border shadow-sm"
              )}
            >
              <div
                className={cn(
                  "h-20 w-full",
                  token.bgClass,
                  (token.varName === "--foreground" || token.varName === "--primary") &&
                    "border-b border-border"
                )}
              />
              <div className="bg-card p-2 text-card-foreground">
                <p className="truncate text-xs font-medium">{token.name}</p>
                <p className="truncate font-mono text-[10px] text-muted-foreground">
                  {token.varName}
                </p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Cores semânticas em uso */}
      <section className="space-y-4">
        <h2 className="text-xl font-semibold text-foreground">
          Cores semânticas em uso
        </h2>
        <p className="text-sm text-muted-foreground">
          Success, Warning e Info aplicados em Button, Badge e Alert para feedback e estados.
        </p>
        <div className="flex flex-wrap gap-3">
          <Button variant="success">Success</Button>
          <Button variant="warning">Warning</Button>
          <Button variant="info">Info</Button>
          <Badge variant="success">Success</Badge>
          <Badge variant="warning">Warning</Badge>
          <Badge variant="info">Info</Badge>
        </div>
        <div className="flex flex-col gap-3 max-w-xl">
          <Alert variant="success">
            <CheckCircle2 className="h-4 w-4" />
            <AlertTitle>Sucesso</AlertTitle>
            <AlertDescription>
              Operação concluída. Token success.
            </AlertDescription>
          </Alert>
          <Alert variant="warning">
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle>Atenção</AlertTitle>
            <AlertDescription>
              Verifique os dados. Token warning.
            </AlertDescription>
          </Alert>
          <Alert variant="info">
            <Info className="h-4 w-4" />
            <AlertTitle>Informação</AlertTitle>
            <AlertDescription>
              Dica ou contexto. Token info.
            </AlertDescription>
          </Alert>
        </div>
      </section>

      {/* Primary scale 50–900 */}
      <section className="space-y-4">
        <h2 className="text-xl font-semibold text-foreground">
          Escala Primary (50–900)
        </h2>
        <div className="flex flex-wrap gap-2">
          {PRIMARY_SCALE.map((n) => (
            <div
              key={n}
              className="flex flex-col items-center overflow-hidden rounded-lg border border-border shadow-sm"
            >
              <div
                className="h-14 w-20 rounded-t-lg"
                style={{
                  backgroundColor: `hsl(var(--primary-${n}))`,
                }}
              />
              <span className="bg-card px-2 py-1 font-mono text-xs text-card-foreground">
                {n}
              </span>
            </div>
          ))}
        </div>
      </section>

      {/* Grey scale 50–900 */}
      <section className="space-y-4">
        <h2 className="text-xl font-semibold text-foreground">
          Escala Grey (50–900)
        </h2>
        <div className="flex flex-wrap gap-2">
          {GREY_SCALE.map((n) => (
            <div
              key={n}
              className="flex flex-col items-center overflow-hidden rounded-lg border border-border shadow-sm"
            >
              <div
                className="h-14 w-20 rounded-t-lg"
                style={{
                  backgroundColor: `hsl(var(--grey-${n}))`,
                }}
              />
              <span className="bg-card px-2 py-1 font-mono text-xs text-card-foreground">
                {n}
              </span>
            </div>
          ))}
        </div>
      </section>

      {/* Typography */}
      <section className="space-y-4">
        <h2 className="text-xl font-semibold text-foreground">Tipografia</h2>
        <Card>
          <CardHeader>
            <CardTitle>Inter (font-family)</CardTitle>
            <CardDescription>
              Tamanhos e pesos usados no sistema.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-4xl font-bold">Heading 4xl Bold</p>
            <p className="text-2xl font-semibold">Heading 2xl Semibold</p>
            <p className="text-xl font-medium">Heading xl Medium</p>
            <p className="text-base font-normal">
              Body text base (16px) — legível e acessível.
            </p>
            <p className="text-sm text-muted-foreground">
              Texto secundário (sm, muted).
            </p>
          </CardContent>
        </Card>
      </section>

      {/* Radius */}
      <section className="space-y-4">
        <h2 className="text-xl font-semibold text-foreground">
          Raio da borda (--radius)
        </h2>
        <p className="text-sm text-muted-foreground">
          <code className="rounded bg-muted px-1.5 py-0.5">--radius: 0.5rem</code>{" "}
          (8px). Estilo arredondado.
        </p>
        <div className="flex flex-wrap gap-4">
          <div className="h-20 w-20 rounded-md border-2 border-primary bg-card" />
          <div className="h-20 w-20 rounded-lg border-2 border-primary bg-card" />
          <div className="h-10 rounded-full border-2 border-primary bg-muted px-4" />
        </div>
      </section>

      {/* Spacing */}
      <section className="space-y-4">
        <h2 className="text-xl font-semibold text-foreground">
          Escala de espaçamento
        </h2>
        <p className="text-sm text-muted-foreground">
          Ritmo base: múltiplos de 4px (1 = 0.25rem, 2 = 0.5rem, 4 = 1rem, 6 = 1.5rem, 8 = 2rem).
        </p>
        <div className="flex flex-wrap items-end gap-4">
          {([1, 2, 4, 6, 8] as const).map((n) => (
            <div key={n} className="flex flex-col items-center gap-2">
              <div
                className="bg-primary rounded-md"
                style={{ width: `${n * 4}px`, height: `${n * 4}px` }}
              />
              <span className="font-mono text-xs text-muted-foreground">
                {n * 4}px
              </span>
            </div>
          ))}
        </div>
      </section>

      {/* Shadows */}
      <section className="space-y-4">
        <h2 className="text-xl font-semibold text-foreground">Sombras</h2>
        <p className="text-sm text-muted-foreground">
          Estilo sutil (shadow-sm) em cartões; use shadow ou shadow-md para elevação maior.
        </p>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div className="rounded-lg border border-border bg-card p-6 shadow-sm">
            <p className="text-sm font-medium text-foreground">shadow-sm</p>
            <p className="text-xs text-muted-foreground">Cartões padrão</p>
          </div>
          <div className="rounded-lg border border-border bg-card p-6 shadow">
            <p className="text-sm font-medium text-foreground">shadow</p>
            <p className="text-xs text-muted-foreground">Elevação média</p>
          </div>
          <div className="rounded-lg border border-border bg-card p-6 shadow-md">
            <p className="text-sm font-medium text-foreground">shadow-md</p>
            <p className="text-xs text-muted-foreground">Modais / dropdowns</p>
          </div>
        </div>
      </section>

      {/* Billing (Cards) - como no exemplo */}
      <section className="space-y-4">
        <h2 className="text-xl font-semibold text-foreground">Billing (Cards)</h2>
        <p className="text-sm text-muted-foreground">
          Planos de faturamento usando Card, tokens de cor e radius.
        </p>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <Card className="bg-muted/50">
            <CardHeader>
              <CardTitle className="text-lg">Free</CardTitle>
              <CardDescription>Para começar</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold text-foreground">R$ 0</p>
              <p className="text-sm text-muted-foreground">/mês</p>
            </CardContent>
            <CardFooter>
              <Button variant="secondary" className="w-full">Selecionar</Button>
            </CardFooter>
          </Card>
          <Card className="border-primary shadow-sm">
            <CardHeader>
              <CardTitle className="text-lg">Pro</CardTitle>
              <CardDescription>Acesso completo</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold text-foreground">R$ 49</p>
              <p className="text-sm text-muted-foreground">/mês</p>
            </CardContent>
            <CardFooter>
              <Button className="w-full">Assinar</Button>
            </CardFooter>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Enterprise</CardTitle>
              <CardDescription>Suporte dedicado</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold text-foreground">Sob consulta</p>
              <p className="text-sm text-muted-foreground">/mês</p>
            </CardContent>
            <CardFooter>
              <Button variant="outline" className="w-full">Contato</Button>
            </CardFooter>
          </Card>
        </div>
      </section>

      {/* Events - lista como no exemplo */}
      <section className="space-y-4">
        <h2 className="text-xl font-semibold text-foreground">Events</h2>
        <p className="text-sm text-muted-foreground">
          Lista de eventos com badge de data e cards.
        </p>
        <ul className="space-y-3 max-w-xl">
          {[
            { date: "15 DEZ", title: "Webinar: Design System", desc: "Como usar tokens e componentes." },
            { date: "22 DEZ", title: "Sprint Review", desc: "Revisão do ciclo atual." },
            { date: "10 JAN", title: "Lançamento v2", desc: "Novos recursos e melhorias." },
          ].map((event, i) => (
            <li key={i}>
              <Card className="transition-shadow hover:shadow-sm">
                <CardContent className="flex items-start gap-4 p-4">
                  <div className="flex shrink-0 rounded-md bg-muted px-2.5 py-1.5 text-center text-xs font-semibold text-muted-foreground">
                    {event.date}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="font-medium text-foreground">{event.title}</p>
                    <p className="text-sm text-muted-foreground">{event.desc}</p>
                  </div>
                </CardContent>
              </Card>
            </li>
          ))}
        </ul>
      </section>

      {/* Components */}
      <section className="space-y-6">
        <h2 className="text-xl font-semibold text-foreground">Componentes</h2>

        <div className="space-y-2">
          <h3 className="text-lg font-medium text-foreground">Button</h3>
          <div className="flex flex-wrap gap-2">
            <Button variant="default">Default</Button>
            <Button variant="secondary">Secondary</Button>
            <Button variant="destructive">Destructive</Button>
            <Button variant="success">Success</Button>
            <Button variant="warning">Warning</Button>
            <Button variant="info">Info</Button>
            <Button variant="outline">Outline</Button>
            <Button variant="ghost">Ghost</Button>
            <Button variant="link">Link</Button>
          </div>
        </div>

        <div className="space-y-2">
          <h3 className="text-lg font-medium text-foreground">Card</h3>
          <Card className="max-w-sm">
            <CardHeader>
              <CardTitle>Plano Pro</CardTitle>
              <CardDescription>
                Acesso completo e suporte prioritário.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold text-foreground">R$ 49/mês</p>
            </CardContent>
            <CardFooter>
              <Button className="w-full">Assinar</Button>
            </CardFooter>
          </Card>
        </div>

        <div className="space-y-2">
          <h3 className="text-lg font-medium text-foreground">Badge</h3>
          <div className="flex flex-wrap gap-2">
            <Badge>Default</Badge>
            <Badge variant="secondary">Secondary</Badge>
            <Badge variant="destructive">Destructive</Badge>
            <Badge variant="success">Success</Badge>
            <Badge variant="warning">Warning</Badge>
            <Badge variant="info">Info</Badge>
            <Badge variant="outline">Outline</Badge>
          </div>
        </div>

        <div className="space-y-2">
          <h3 className="text-lg font-medium text-foreground">Alert</h3>
          <div className="flex flex-col gap-3 max-w-xl">
            <Alert>
              <Info className="h-4 w-4" />
              <AlertTitle>Default</AlertTitle>
              <AlertDescription>
                Mensagem informativa usando o token de cor do sistema.
              </AlertDescription>
            </Alert>
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>Erro</AlertTitle>
              <AlertDescription>
                Alerta destrutivo para erros ou ações irreversíveis.
              </AlertDescription>
            </Alert>
            <Alert variant="success">
              <CheckCircle2 className="h-4 w-4" />
              <AlertTitle>Sucesso</AlertTitle>
              <AlertDescription>
                Confirmação ou resultado positivo. Token success.
              </AlertDescription>
            </Alert>
            <Alert variant="warning">
              <AlertTriangle className="h-4 w-4" />
              <AlertTitle>Atenção</AlertTitle>
              <AlertDescription>
                Aviso que exige atenção. Token warning.
              </AlertDescription>
            </Alert>
            <Alert variant="info">
              <Info className="h-4 w-4" />
              <AlertTitle>Informação</AlertTitle>
              <AlertDescription>
                Dica ou contexto adicional. Token info.
              </AlertDescription>
            </Alert>
          </div>
        </div>

        <div className="space-y-2">
          <h3 className="text-lg font-medium text-foreground">Radio Group</h3>
          <RadioGroup defaultValue="option-one" className="flex gap-6">
            <div className="flex items-center gap-2">
              <RadioGroupItem value="option-one" id="r1" />
              <label htmlFor="r1" className="text-sm font-medium text-foreground">
                Opção A
              </label>
            </div>
            <div className="flex items-center gap-2">
              <RadioGroupItem value="option-two" id="r2" />
              <label htmlFor="r2" className="text-sm font-medium text-foreground">
                Opção B
              </label>
            </div>
            <div className="flex items-center gap-2">
              <RadioGroupItem value="option-three" id="r3" />
              <label htmlFor="r3" className="text-sm font-medium text-foreground">
                Opção C
              </label>
            </div>
          </RadioGroup>
        </div>
      </section>

      {/* Dark mode preview */}
      <section className="space-y-4">
        <h2 className="text-xl font-semibold text-foreground">
          Preview tema escuro
        </h2>
        <p className="text-sm text-muted-foreground">
          Use o botão no topo da página para alternar entre claro e escuro. Os
          tokens abaixo seguem o tema ativo.
        </p>
        <Card>
          <CardHeader>
            <CardTitle className="text-card-foreground">
              Card no tema atual
            </CardTitle>
            <CardDescription className="text-muted-foreground">
              Background, borda e texto usam as variáveis do tema.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button size="sm">Ação</Button>
          </CardContent>
        </Card>
      </section>
    </div>
  )
}
