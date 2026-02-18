import { Link } from "react-router-dom"
import {
  Inbox,
  Bot,
  TrendingUp,
  Puzzle,
  Unlink,
  Clock,
  MousePointer,
  MessageSquare,
  BarChart3,
  Check,
} from "lucide-react"
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion"
import { cn } from "@/lib/utils"

const BENEFITS = [
  {
    icon: Inbox,
    title: "Nunca mais perca um lead",
    description:
      "Centralize todas as conversas do WhatsApp e Instagram em um único painel, fácil de acompanhar e gerir.",
  },
  {
    icon: Bot,
    title: "Automatize até 80%",
    description:
      "Respostas instantâneas, qualificações e follow-ups automáticos sem depender do esforço manual da equipa.",
  },
  {
    icon: TrendingUp,
    title: "Aumente as vendas em 35%",
    description:
      "Leads organizados e atendidos rapidamente são conduzidos com maestria até ao fecho do negócio.",
  },
  {
    icon: Puzzle,
    title: "Controle total do funil",
    description:
      "Saiba exatamente onde cada oportunidade está e identifique onde pode vender mais com clareza absoluta.",
  },
  {
    icon: Unlink,
    title: "Fim do caos de integrações",
    description:
      "Diga adeus a ferramentas soltas, planilhas confusas e informações desencontradas entre sistemas.",
  },
  {
    icon: Clock,
    title: "Poupe tempo e energia",
    description:
      "Deixe o trabalho repetitivo para a automação e foque o seu time no que realmente importa: fechar contratos.",
  },
  {
    icon: MousePointer,
    title: "Facilidade de uso",
    description:
      "Não precisa de equipa técnica. O sistema está pronto para escalar o seu negócio desde o primeiro dia.",
  },
  {
    icon: MessageSquare,
    title: "Atendimento humanizado",
    description:
      "IA que conversa de verdade, sem parecer robótica, mantendo a experiência do cliente sempre positiva.",
  },
  {
    icon: BarChart3,
    title: "Mais previsibilidade",
    description:
      "Métricas em tempo real para tomar decisões estratégicas seguras, eliminando surpresas desagradáveis.",
  },
] as const

const PLANS = [
  {
    type: "free" as const,
    title: "Free",
    price: "R$ 0",
    description: "Para começar",
    benefits: ["Até 50 leads por mês", "1 usuário", "Relatórios básicos", "Suporte por e-mail"],
  },
  {
    type: "pro" as const,
    title: "Pro",
    price: "R$ 49",
    description: "Acesso completo",
    benefits: ["Leads ilimitados", "Até 5 usuários", "Relatórios avançados", "Suporte prioritário", "Integrações de CRM", "API de acesso"],
  },
  {
    type: "enterprise" as const,
    title: "Enterprise",
    price: "Sob consulta",
    description: "Suporte dedicado",
    benefits: ["Tudo do Pro", "Usuários ilimitados", "SLA garantido", "Gerente de conta dedicado", "Onboarding personalizado", "Customizações sob medida"],
  },
] as const

export function LandingPage() {
  return (
    <main className="min-h-screen bg-background text-foreground antialiased">
      {/* Navegação */}
      <nav className="fixed w-full z-50 bg-background/90 backdrop-blur-md border-b border-muted">
        <div className="max-w-7xl mx-auto px-6 h-20 flex items-center justify-between">
          <Link
            to="/"
            className="text-2xl font-bold tracking-tighter flex items-center gap-2 text-secondary"
          >
            <img
              src="/logo-cliente-ideal.png"
              alt="Cliente Ideal"
              className="h-8 w-8 object-contain"
            />
            CLIENTE <span className="text-primary font-extrabold">IDEAL</span>
          </Link>

          <div className="hidden lg:flex space-x-8 text-sm font-semibold text-foreground/70">
            <a href="#proposta" className="hover:text-primary transition">
              Proposta
            </a>
            <a href="#beneficios" className="hover:text-primary transition">
              Benefícios
            </a>
            <a href="#precos" className="hover:text-primary transition">
              Preço
            </a>
            <a href="#faq" className="hover:text-primary transition">
              FAQ
            </a>
          </div>

          <div className="flex items-center gap-4">
            <Link
              to="/entrar"
              className="hidden sm:block text-sm font-bold text-secondary hover:text-primary transition"
            >
              Entrar
            </Link>
            <a
              href="#precos"
              className="px-5 py-2.5 rounded-xl-custom bg-primary text-primary-foreground text-sm font-bold hover:bg-secondary transition shadow-md"
            >
              Começar Agora
            </a>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <header className="relative pt-32 pb-20 md:pt-48 md:pb-32 hero-pattern">
        <div className="max-w-7xl mx-auto px-6 relative z-10 text-center">
          <div className="inline-block px-4 py-1.5 mb-6 rounded-full border border-primary/20 bg-primary/5 text-primary text-xs font-bold uppercase tracking-widest">
            Estratégia Conversacional Inteligente
          </div>
          <h1 className="text-4xl md:text-6xl lg:text-7xl font-extrabold tracking-tight mb-8 leading-tight text-secondary">
            Pare de perseguir leads frios. <br className="hidden md:block" />
            <span className="text-accent">Atraia o Cliente Ideal</span>
          </h1>
          <p className="max-w-2xl mx-auto text-lg md:text-xl text-foreground/70 leading-relaxed mb-10">
            O método definitivo para profissionais que cansaram de cliques vazios
            e querem uma agenda cheia de reuniões com alto potencial de
            fechamento.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <a
              href="#agendar"
              className="btn-olive px-10 py-4 rounded-xl-custom font-bold text-lg shadow-lg"
            >
              Quero Agenda Cheia
            </a>
            <a
              href="#beneficios"
              className="px-10 py-4 border border-secondary/10 text-secondary hover:bg-secondary/5 rounded-xl-custom font-bold text-lg transition"
            >
              Ver Como Funciona
            </a>
          </div>
        </div>
      </header>

      {/* Nossa Proposta */}
      <section id="proposta" className="py-24 bg-card">
        <div className="max-w-4xl mx-auto px-6 text-center">
          <h2 className="text-accent font-bold mb-4 uppercase tracking-widest text-sm">
            Nossa Missão
          </h2>
          <h3 className="text-3xl md:text-5xl font-extrabold mb-8 text-secondary">
            Um Funil Inteligente que{" "}
            <span className="text-primary">trabalha para si</span>, não o
            contrário.
          </h3>
          <p className="text-xl text-foreground/60 leading-relaxed mb-8">
            Com o Cliente Ideal, os seus leads são automaticamente organizados,
            respondidos e acompanhados do primeiro &quot;olá&quot; até à
            assinatura do contrato.
          </p>
          <div className="p-8 bg-background rounded-xl-custom border border-muted inline-block italic text-secondary font-medium shadow-sm">
            &quot;Menos esforço operacional, mais previsibilidade
            financeira.&quot;
          </div>
        </div>
      </section>

      {/* Benefícios Detalhados */}
      <section id="beneficios" className="py-24 bg-background border-y border-muted">
        <div className="max-w-7xl mx-auto px-6">
          <div className="text-center mb-16">
            <h2 className="text-accent font-bold mb-4 uppercase tracking-widest text-sm">
              Vantagens Reais
            </h2>
            <h3 className="text-3xl md:text-5xl font-extrabold text-secondary">
              O que Ganha com o Ecossistema
            </h3>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {BENEFITS.map(({ icon: Icon, title, description }) => (
              <div
                key={title}
                className="p-8 rounded-xl-custom bg-card card-shadow border border-muted hover:border-primary transition-all group"
              >
                <div className="w-12 h-12 bg-primary/10 text-primary rounded-lg flex items-center justify-center text-xl mb-6 group-hover:bg-primary group-hover:text-primary-foreground transition-all">
                  <Icon className="h-6 w-6" />
                </div>
                <h4 className="text-xl font-bold text-secondary mb-3">
                  {title}
                </h4>
                <p className="text-foreground/60 text-sm leading-relaxed">
                  {description}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Preços */}
      <section id="precos" className="py-24 bg-card">
        <div className="max-w-7xl mx-auto px-6">
          <div className="text-center mb-16">
            <h2 className="text-accent font-bold mb-4 uppercase tracking-widest text-sm">
              Investimento
            </h2>
            <h3 className="text-3xl md:text-5xl font-extrabold text-secondary">
              Planos para a sua Escala
            </h3>
          </div>
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3 max-w-5xl mx-auto">
            {PLANS.map((plan) => (
              <div
                key={plan.type}
                className={cn(
                  "p-8 rounded-xl-custom bg-card card-shadow border border-muted hover:border-primary transition-all flex flex-col",
                  plan.type === "pro" && "border-primary ring-2 ring-primary/20"
                )}
              >
                <span
                  className={cn(
                    "inline-block w-fit text-xs font-bold px-3 py-1 rounded-full uppercase tracking-widest mb-4",
                    plan.type === "pro"
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted text-muted-foreground"
                  )}
                >
                  {plan.title}
                </span>
                <p className="text-2xl font-bold text-secondary">{plan.price}</p>
                <p className="text-sm text-foreground/60 mt-1">{plan.description}</p>
                <ul className="mt-6 space-y-3 text-foreground/70 text-sm flex-1">
                  {plan.benefits.map((benefit) => (
                    <li key={benefit} className="flex items-start gap-2">
                      <Check className="h-4 w-4 shrink-0 text-primary mt-0.5" />
                      <span>{benefit}</span>
                    </li>
                  ))}
                </ul>
                <Link
                  to="/cadastrar"
                  className={cn(
                    "mt-8 block w-full text-center py-4 rounded-xl-custom font-bold transition shadow-lg",
                    plan.type === "pro"
                      ? "bg-primary text-primary-foreground hover:bg-secondary"
                      : "bg-muted text-muted-foreground hover:bg-muted/80"
                  )}
                >
                  {plan.type === "enterprise" ? "Falar com vendas" : "Começar"}
                </Link>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section id="faq" className="py-24 bg-background border-t border-muted">
        <div className="max-w-4xl mx-auto px-6">
          <h2 className="text-3xl md:text-5xl font-black text-secondary mb-16 text-center">
            Dúvidas Frequentes
          </h2>
          <Accordion type="single" collapsible className="w-full">
            <AccordionItem value="faq-1" className="faq-item border-0">
              <AccordionTrigger className="text-xl font-bold text-secondary hover:text-primary hover:no-underline py-6">
                Como funciona a implementação?
              </AccordionTrigger>
              <AccordionContent className="text-foreground/60 leading-relaxed">
                Integramos a nossa tecnologia diretamente com os seus canais
                oficiais (WhatsApp API e Instagram) e o seu CRM num prazo
                recorde de 48 horas.
              </AccordionContent>
            </AccordionItem>
            <AccordionItem value="faq-2" className="faq-item border-0">
              <AccordionTrigger className="text-xl font-bold text-secondary hover:text-primary hover:no-underline py-6">
                A IA substitui o atendimento humano?
              </AccordionTrigger>
              <AccordionContent className="text-foreground/60 leading-relaxed">
                Ela atua como um braço direito, fazendo a triagem e o trabalho
                repetitivo, passando o lead qualificado para o humano apenas no
                momento ideal de fechar.
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        </div>
      </section>

      {/* Call to Action */}
      <section id="agendar" className="py-24 bg-secondary relative overflow-hidden">
        <div className="max-w-4xl mx-auto px-6 text-center relative z-10">
          <h2 className="text-3xl md:text-5xl font-bold mb-8 text-primary-foreground">
            Cultive novos resultados hoje.
          </h2>
          <p className="text-xl text-primary-foreground/70 mb-10">
            Substitua o caos das planilhas pela elegância da automação orgânica.
          </p>
          <a
            href="#precos"
            className="inline-block px-12 py-5 bg-primary text-primary-foreground rounded-xl-custom font-black text-2xl hover:bg-accent hover:text-accent-foreground transition-all shadow-2xl"
          >
            Começar Agora
          </a>
        </div>
        <div className="absolute -bottom-10 -right-10 w-64 h-64 bg-primary/10 rounded-full blur-3xl" />
      </section>

      {/* Footer */}
      <footer className="footer-organic pt-16 pb-8">
        <div className="max-w-7xl mx-auto px-6">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-12 mb-16">
            <div className="md:col-span-2">
              <div className="flex items-center gap-2 text-2xl font-bold mb-6 text-primary-foreground">
                <img
                  src="/logo-cliente-ideal.png"
                  alt="Cliente Ideal"
                  className="h-10 w-10 object-contain"
                />
                CLIENTE <span className="opacity-80 font-normal">IDEAL</span>
              </div>
              <p className="text-primary-foreground/70 max-w-sm mb-8 leading-relaxed">
                O futuro do atendimento conversacional com design humanizado.
                Potencialize a sua marca com tecnologia de elite e estética
                orgânica.
              </p>
              <div className="flex gap-4 text-primary-foreground">
                <a
                  href="#"
                  className="w-10 h-10 rounded-full bg-primary-foreground/10 flex items-center justify-center hover:bg-accent hover:text-accent-foreground transition-all"
                  aria-label="Instagram"
                >
                  <svg
                    className="h-5 w-5"
                    fill="currentColor"
                    viewBox="0 0 24 24"
                    aria-hidden
                  >
                    <path
                      fillRule="evenodd"
                      d="M12.315 2c2.43 0 2.784.013 3.808.06 1.064.049 1.791.218 2.427.465a4.902 4.902 0 011.772 1.153 4.902 4.902 0 011.153 1.772c.247.636.416 1.363.465 2.427.048 1.067.06 1.407.06 4.123v.08c0 2.643-.012 2.987-.06 4.043-.049 1.064-.218 1.791-.465 2.427a4.902 4.902 0 01-1.153 1.772 4.902 4.902 0 01-1.772 1.153c-.636.247-1.363.416-2.427.465-1.067.048-1.407.06-4.123.06h-.08c-2.643 0-2.987-.012-4.043-.06-1.064-.049-1.791-.218-2.427-.465a4.902 4.902 0 01-1.772-1.153 4.902 4.902 0 01-1.153-1.772c-.247-.636-.416-1.363-.465-2.427-.048-1.067-.06-1.407-.06-4.123v-.08c0-2.643.012-2.987.06-4.043.049-1.064.218-1.791.465-2.427a4.902 4.902 0 011.153-1.772A4.902 4.902 0 015.45 2.525c.636-.247 1.363-.416 2.427-.465C8.901 2.013 9.256 2 11.685 2h.63zm0 0h.315zm-.315 0c-2.43 0-2.784.013-3.808.06-1.064.049-1.791.218-2.427.465a4.902 4.902 0 00-1.772 1.153 4.902 4.902 0 00-1.153 1.772c-.247.636-.416 1.363-.465 2.427-.048 1.067-.06 1.407-.06 4.123v.08c0 2.643.012 2.987.06 4.043.049 1.064.218 1.791.465 2.427a4.902 4.902 0 001.153 1.772 4.902 4.902 0 001.772 1.153c.636.247 1.363.416 2.427.465 1.067.048 1.407.06 4.123.06h.08c2.643 0 2.987-.012 4.043-.06 1.064-.049 1.791-.218 2.427-.465a4.902 4.902 0 001.772-1.153 4.902 4.902 0 001.153-1.772c.247-.636.416-1.363.465-2.427.048-1.067.06-1.407.06-4.123v-.08c0-2.643-.012-2.987-.06-4.043-.049-1.064-.218-1.791-.465-2.427a4.902 4.902 0 00-1.153-1.772 4.902 4.902 0 00-1.772-1.153c-.636-.247-1.363-.416-2.427-.465-1.067-.048-1.407-.06-4.123-.06h-.08z"
                      clipRule="evenodd"
                    />
                    <path
                      fillRule="evenodd"
                      d="M12 6.865a5.135 5.135 0 110 10.27 5.135 5.135 0 010-10.27zM12 8a4 4 0 100 8 4 4 0 000-8z"
                      clipRule="evenodd"
                    />
                    <path d="M18.406 5.84a1.2 1.2 0 110 2.4 1.2 1.2 0 010-2.4z" />
                  </svg>
                </a>
                <a
                  href="#"
                  className="w-10 h-10 rounded-full bg-primary-foreground/10 flex items-center justify-center hover:bg-accent hover:text-accent-foreground transition-all"
                  aria-label="LinkedIn"
                >
                  <svg
                    className="h-5 w-5"
                    fill="currentColor"
                    viewBox="0 0 24 24"
                    aria-hidden
                  >
                    <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" />
                  </svg>
                </a>
                <a
                  href="#"
                  className="w-10 h-10 rounded-full bg-primary-foreground/10 flex items-center justify-center hover:bg-accent hover:text-accent-foreground transition-all"
                  aria-label="YouTube"
                >
                  <svg
                    className="h-5 w-5"
                    fill="currentColor"
                    viewBox="0 0 24 24"
                    aria-hidden
                  >
                    <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z" />
                  </svg>
                </a>
              </div>
            </div>

            <div>
              <h5 className="font-bold text-lg mb-6 text-accent">Recursos</h5>
              <ul className="space-y-4 text-primary-foreground/60 text-sm">
                <li>
                  <a href="#" className="hover:text-primary-foreground transition">
                    Blog Orgânico
                  </a>
                </li>
                <li>
                  <a href="#" className="hover:text-primary-foreground transition">
                    Central de Ajuda
                  </a>
                </li>
                <li>
                  <a href="#" className="hover:text-primary-foreground transition">
                    Comunidade
                  </a>
                </li>
              </ul>
            </div>

            <div>
              <h5 className="font-bold text-lg mb-6 text-accent">Legal</h5>
              <ul className="space-y-4 text-primary-foreground/60 text-sm">
                <li>
                  <a href="#" className="hover:text-primary-foreground transition">
                    Privacidade
                  </a>
                </li>
                <li>
                  <a href="#" className="hover:text-primary-foreground transition">
                    Termos
                  </a>
                </li>
              </ul>
            </div>
          </div>

          <div className="pt-8 border-t border-primary-foreground/10 flex flex-col md:flex-row justify-between items-center gap-4 text-xs text-primary-foreground/40">
            <p>© 2026 Cliente Ideal. Estética Oliva &amp; Bege.</p>
            <p>Desenvolvido para Marcas de Alto Padrão</p>
          </div>
        </div>
      </footer>
    </main>
  )
}
