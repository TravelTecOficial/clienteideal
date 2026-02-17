import { Link } from "react-router-dom"
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Check } from "lucide-react"
import { cn } from "@/lib/utils"

const PLANS = [
  {
    type: "free",
    title: "Free",
    price: "R$ 0",
    description: "Para começar",
    benefits: ["Até 50 leads por mês", "1 usuário", "Relatórios básicos", "Suporte por e-mail"],
  },
  {
    type: "pro",
    title: "Pro",
    price: "R$ 49",
    description: "Acesso completo",
    benefits: ["Leads ilimitados", "Até 5 usuários", "Relatórios avançados", "Suporte prioritário", "Integrações de CRM", "API de acesso"],
  },
  {
    type: "enterprise",
    title: "Enterprise",
    price: "Sob consulta",
    description: "Suporte dedicado",
    benefits: ["Tudo do Pro", "Usuários ilimitados", "SLA garantido", "Gerente de conta dedicado", "Onboarding personalizado", "Customizações sob medida"],
  },
] as const

export function PrecosPage() {
  return (
    <main className="min-h-screen bg-background">
      <header className="flex justify-between items-center gap-4 px-4 py-4 sm:px-6 lg:px-8 border-b border-border">
        <Link to="/" className="flex-shrink-0">
          <img
            src="/logo-cliente-ideal.png"
            alt="Cliente Ideal Online"
            className="h-10 md:h-12 w-auto object-contain"
          />
        </Link>
        <div className="flex items-center gap-2">
          <Link
            to="/entrar"
            className="rounded-md border border-border bg-background px-4 py-2 text-sm font-bold text-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            Entrar
          </Link>
          <Link
            to="/cadastrar"
            className="rounded-md bg-primary px-4 py-2 text-sm font-bold text-primary-foreground transition-colors hover:opacity-90"
          >
            Cadastrar
          </Link>
        </div>
      </header>

      <section className="py-16 md:py-24 px-4 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-5xl">
          <div className="text-center mb-12">
            <h1 className="text-3xl font-bold tracking-tight text-foreground">Preços</h1>
            <p className="mt-2 text-muted-foreground">Escolha o plano ideal para sua empresa</p>
          </div>

          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {PLANS.map((plan) => (
              <Card
                key={plan.type}
                className={cn(
                  "flex flex-col transition-shadow hover:shadow-md",
                  plan.type === "pro" && "border-primary ring-2 ring-primary/20"
                )}
              >
                <CardHeader>
                  <CardTitle className="text-xl font-semibold">{plan.title}</CardTitle>
                  <CardDescription>{plan.description}</CardDescription>
                </CardHeader>
                <CardContent className="flex-1 space-y-4">
                  <p className="text-2xl font-bold">{plan.price}</p>
                  <ul className="space-y-2">
                    {plan.benefits.map((benefit) => (
                      <li key={benefit} className="flex items-start gap-2 text-sm">
                        <Check className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                        <span>{benefit}</span>
                      </li>
                    ))}
                  </ul>
                </CardContent>
                <CardFooter>
                  <Button
                    variant={plan.type === "pro" ? "default" : "secondary"}
                    className="w-full"
                    asChild
                  >
                    <Link to="/cadastrar">
                      {plan.type === "enterprise" ? "Falar com vendas" : "Começar"}
                    </Link>
                  </Button>
                </CardFooter>
              </Card>
            ))}
          </div>
        </div>
      </section>
    </main>
  )
}
