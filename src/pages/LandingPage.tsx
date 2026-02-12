import { Link } from "react-router-dom"
import { Filter, Zap, Target } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion"

const BENEFITS = [
  {
    icon: Filter,
    title: "Qualificação Automática",
    description:
      "Chega de perder tempo com curiosos. Nosso sistema identifica o perfil ideal antes mesmo de você abrir o WhatsApp.",
  },
  {
    icon: Zap,
    title: "Escalabilidade Real",
    description:
      "Enquanto você foca na estratégia, o Cliente Ideal Online trabalha 24/7 encontrando as melhores oportunidades de negócio.",
  },
  {
    icon: Target,
    title: "Segmentação Ninja",
    description:
      "Vá direto onde seu público está, falando a língua que eles entendem e eliminando o desperdício de verba.",
  },
] as const

const TESTIMONIALS = [
  {
    author: "Ricardo Menezes",
    metric: "+45% em Vendas",
    quote:
      "Antes eu recebia muita mensagem de gente sem dinheiro. Com o Cliente Ideal Online, meu time comercial só fala com quem tem o perfil certo.",
  },
  {
    author: "Ana Paula Silva",
    metric: "Redução de 30% no CAC",
    quote:
      "O filtro é impressionante. O custo por lead caiu porque paramos de atrair o público errado. Mudou o jogo aqui na agência.",
  },
  {
    author: "Bruno Fontana",
    metric: "ROI 5x",
    quote:
      "Implementamos o Cliente Ideal Online em duas semanas e o retorno foi imediato. O processo de triagem é o que faltava no nosso funil.",
  },
] as const

export function LandingPage() {
  return (
    <main className="min-h-screen bg-background text-foreground">
      {/* Header */}
      <header className="flex justify-between items-center gap-4 px-4 py-4 sm:px-6 lg:px-8">
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

      {/* Hero Section */}
      <section className="py-16 md:py-24 px-4 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-4xl text-center">
          <h1 className="text-3xl md:text-4xl lg:text-5xl font-extrabold text-foreground mb-6">
            Pare de perseguir leads frios.{" "}
            <span className="text-primary font-extrabold">Atraia o seu Cliente Ideal</span>
            {" "}e mostra também quem realmente quer comprar de você, com um sistema automático que filtra e qualifica.
          </h1>
          <p className="text-lg md:text-xl font-bold text-muted-foreground max-w-2xl mx-auto mb-10">
            O método definitivo para profissionais e empresas que cansaram de
            cliques vazios e querem uma agenda cheia de reuniões com alto
            potencial de fechamento.
          </p>
          <Button asChild size="lg" className="font-bold">
            <Link to="/cadastrar">
              Quero Ativar Meu Cliente Ideal Online Agora
            </Link>
          </Button>
        </div>
      </section>

      {/* Seção de Benefícios */}
      <section className="py-16 md:py-24 px-4 sm:px-6 lg:px-8 bg-muted/30">
        <div className="mx-auto max-w-6xl">
          <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-3">
            {BENEFITS.map(({ icon: Icon, title, description }) => (
              <Card key={title} className="border-border">
                <CardHeader>
                  <div className="mb-2 flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10 text-primary">
                    <Icon className="h-6 w-6" />
                  </div>
                  <CardTitle className="text-xl font-bold">{title}</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-muted-foreground font-semibold">{description}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Seção de Prova Social */}
      <section className="py-16 md:py-24 px-4 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-6xl">
          <h2 className="text-2xl md:text-3xl font-extrabold text-center mb-12 text-foreground">
            O que dizem quem já usa
          </h2>
          <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-3">
            {TESTIMONIALS.map(({ author, metric, quote }) => (
              <Card key={author} className="border-border">
                <CardHeader>
                  <CardTitle className="text-lg font-bold">{author}</CardTitle>
                  <p className="text-sm font-bold text-primary">{metric}</p>
                </CardHeader>
                <CardContent>
                  <p className="text-muted-foreground font-semibold italic">&quot;{quote}&quot;</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Seção de Autoridade / Como Funciona */}
      <section className="py-16 md:py-24 px-4 sm:px-6 lg:px-8 bg-muted/30">
        <div className="mx-auto max-w-3xl text-center">
          <h2 className="text-2xl md:text-3xl font-extrabold text-foreground mb-6">
            Transforme o seu marketing numa máquina de atração.
          </h2>
          <p className="text-lg font-bold text-muted-foreground">
            O sistema Cliente Ideal Online não é apenas um funil, é um filtro
            inteligente. Ele separa os interessados dos compradores reais,
            permitindo que você escale o seu negócio sem aumentar a sua carga de
            trabalho manual.
          </p>
        </div>
      </section>

      {/* FAQ */}
      <section className="py-16 md:py-24 px-4 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-2xl">
          <h2 className="text-2xl md:text-3xl font-extrabold text-center mb-12 text-foreground">
            Perguntas Frequentes
          </h2>
          <Accordion type="single" collapsible className="w-full">
            <AccordionItem value="faq-1">
              <AccordionTrigger className="font-bold">
                Para quem é o Cliente Ideal Online?
              </AccordionTrigger>
              <AccordionContent className="font-semibold">
                Para qualquer prestador de serviços ou empresa que venda
                produtos de alto valor e precise de leads qualificados.
              </AccordionContent>
            </AccordionItem>
            <AccordionItem value="faq-2">
              <AccordionTrigger className="font-bold">
                Preciso de conhecimentos técnicos?
              </AccordionTrigger>
              <AccordionContent className="font-semibold">
                Não, o sistema é desenhado para ser intuitivo e implementado
                rapidamente.
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-16 px-4 sm:px-6 lg:px-8 bg-muted border-t border-border">
        <div className="mx-auto max-w-2xl text-center">
          <p className="text-lg font-bold text-foreground mb-6">
            Pronto para mudar o nível do seu jogo?
          </p>
          <Button asChild size="lg" className="font-bold">
            <Link to="/cadastrar">Começar Agora</Link>
          </Button>
          <p className="mt-10 text-sm font-semibold text-muted-foreground">
            Copyright © 2024 Cliente Ideal Online - Todos os direitos
            reservados.
          </p>
        </div>
      </footer>
    </main>
  )
}
