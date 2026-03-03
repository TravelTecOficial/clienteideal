import type { ReactElement } from "react"

export function TermosUsoPage(): ReactElement {
  const today = new Date().toLocaleDateString("pt-BR")

  return (
    <main className="min-h-screen bg-background text-foreground">
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-4 py-10 lg:py-16">
        <header>
          <h1 className="text-3xl font-bold tracking-tight">Termos de Uso</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Estes Termos de Uso regulam o acesso e a utilização da plataforma <strong>Cliente Ideal Online</strong>, disponível
            em{" "}
            <a href="https://clienteideal.online" className="underline">
              clienteideal.online
            </a>
            . Ao utilizar a plataforma, você concorda integralmente com as condições abaixo.
          </p>
        </header>

        <section className="space-y-3 text-sm leading-relaxed">
          <h2 className="text-lg font-semibold">1. Aceitação dos Termos</h2>
          <p>
            Ao criar uma conta, acessar ou utilizar qualquer funcionalidade da plataforma Cliente Ideal Online, você declara
            ter lido, compreendido e concordado com estes Termos de Uso e com a nossa Política de Privacidade. Caso não concorde
            com qualquer condição aqui prevista, você não deve utilizar a plataforma.
          </p>
        </section>

        <section className="space-y-3 text-sm leading-relaxed">
          <h2 className="text-lg font-semibold">2. Cadastro e contas de usuário</h2>
          <ul className="ml-5 list-disc space-y-1">
            <li>O acesso à plataforma pode exigir cadastro e autenticação por meio de provedores de identidade integrados.</li>
            <li>
              Você se compromete a fornecer informações verdadeiras, completas e atualizadas, sendo responsável por mantê-las
              corretas ao longo do tempo.
            </li>
            <li>
              O login e a senha (ou credenciais equivalentes) são pessoais e intransferíveis. Você é responsável por manter a
              confidencialidade dessas credenciais e por todas as atividades realizadas em sua conta.
            </li>
            <li>
              Em caso de suspeita de uso indevido ou acesso não autorizado à conta, você deve nos comunicar imediatamente pelo
              e-mail{" "}
              <a href="mailto:clienteidealonline@gmail.com" className="underline">
                clienteidealonline@gmail.com
              </a>
              .
            </li>
          </ul>
        </section>

        <section className="space-y-3 text-sm leading-relaxed">
          <h2 className="text-lg font-semibold">3. Planos, pagamentos e cancelamento</h2>
          <p>
            A plataforma pode oferecer diferentes planos de uso (incluindo, mas não se limitando a planos gratuitos e pagos),
            com funcionalidades e limites específicos. As condições comerciais (preços, formas de pagamento, período de
            faturamento, política de cancelamento e eventuais períodos de teste) serão apresentadas no momento da contratação.
          </p>
          <p>
            Você é responsável pela verificação das condições aplicáveis ao plano selecionado. Em caso de atraso no pagamento
            ou descumprimento das condições comerciais, a plataforma poderá suspender ou limitar o acesso à conta até a
            regularização, sem prejuízo de outras medidas previstas em contrato ou na legislação.
          </p>
        </section>

        <section className="space-y-3 text-sm leading-relaxed">
          <h2 className="text-lg font-semibold">4. Uso permitido da plataforma</h2>
          <p>Ao utilizar a plataforma Cliente Ideal Online, você se compromete a:</p>
          <ul className="ml-5 list-disc space-y-1">
            <li>Respeitar a legislação vigente, incluindo normas de proteção de dados, anti-spam e de propriedade intelectual.</li>
            <li>
              Utilizar a plataforma apenas para fins lícitos, relacionados à gestão de leads, oportunidades, atendimentos e
              processos comerciais da sua organização.
            </li>
            <li>
              Não utilizar a plataforma para a veiculação, transmissão ou armazenamento de conteúdos ilegais, ofensivos, abusivos,
              discriminatórios, difamatórios ou que violem direitos de terceiros.
            </li>
            <li>
              Não tentar contornar limitações técnicas, de segurança ou de acesso impostas pela plataforma, incluindo tentativas
              de engenharia reversa, exploração de vulnerabilidades ou uso automatizado não autorizado.
            </li>
          </ul>
        </section>

        <section className="space-y-3 text-sm leading-relaxed">
          <h2 className="text-lg font-semibold">5. Conteúdos e responsabilidade do usuário</h2>
          <p>
            Você é exclusivamente responsável pelos dados, textos, arquivos, registros de leads, oportunidades, mensagens,
            documentos e quaisquer outros conteúdos inseridos, importados ou gerados a partir da sua utilização da plataforma.
          </p>
          <p>
            A plataforma não se responsabiliza por decisões de negócio tomadas com base nas informações registradas ou
            processadas no sistema, cabendo a você avaliar a adequação e a suficiência dos dados para seus objetivos específicos.
          </p>
        </section>

        <section className="space-y-3 text-sm leading-relaxed">
          <h2 className="text-lg font-semibold">6. Propriedade intelectual</h2>
          <p>
            Todos os elementos da plataforma Cliente Ideal Online — incluindo, mas não se limitando a código-fonte, interfaces,
            layout, logotipos, marcas, textos institucionais e materiais visuais — são protegidos por direitos de propriedade
            intelectual e não podem ser copiados, reproduzidos, modificados, distribuídos ou explorados comercialmente sem
            autorização prévia e por escrito.
          </p>
          <p>
            O uso da plataforma não implica qualquer cessão ou transferência de direitos de propriedade intelectual, sendo
            concedida apenas uma licença limitada, revogável e não exclusiva para uso conforme estes Termos de Uso.
          </p>
        </section>

        <section className="space-y-3 text-sm leading-relaxed">
          <h2 className="text-lg font-semibold">7. Integrações com terceiros</h2>
          <p>
            A plataforma pode se integrar com serviços de terceiros (por exemplo, ferramentas de automação, APIs de mensageria,
            provedores de autenticação, soluções de analytics, entre outros). O uso dessas integrações pode estar sujeito a
            termos de uso e políticas de privacidade específicos de cada terceiro.
          </p>
          <p>
            Você é responsável por conhecer e concordar com esses termos ao optar por utilizar tais integrações, isentando a
            plataforma, na medida permitida pela legislação, de responsabilidades decorrentes de serviços, falhas ou condutas de
            terceiros.
          </p>
        </section>

        <section className="space-y-3 text-sm leading-relaxed">
          <h2 className="text-lg font-semibold">8. Limitação de responsabilidade</h2>
          <p>
            Na máxima extensão permitida pela legislação aplicável, a plataforma Cliente Ideal Online não se responsabiliza por
            danos diretos ou indiretos decorrentes:
          </p>
          <ul className="ml-5 list-disc space-y-1">
            <li>Do uso ou impossibilidade de uso da plataforma.</li>
            <li>De falhas de disponibilidade, interrupções, atrasos ou erros de funcionamento, ainda que previsíveis.</li>
            <li>
              De decisões tomadas com base em relatórios, dados, dashboards ou recomendações apresentados pela plataforma ou por
              integrações de terceiros.
            </li>
            <li>
              De incidentes de segurança decorrentes de falhas em dispositivos, redes ou aplicações sob responsabilidade do
              próprio usuário.
            </li>
          </ul>
          <p>
            Nada nestes Termos tem a intenção de excluir ou limitar responsabilidades em desacordo com a legislação
            obrigatória aplicável.
          </p>
        </section>

        <section className="space-y-3 text-sm leading-relaxed">
          <h2 className="text-lg font-semibold">9. Suporte e comunicação</h2>
          <p>
            Poderão ser disponibilizados canais de suporte para dúvidas técnicas e operacionais. O tempo de resposta, horário de
            atendimento e escopo do suporte podem variar de acordo com o plano contratado e com a disponibilidade da equipe.
          </p>
          <p>
            Comunicações importantes relacionadas à conta, segurança, alterações contratuais ou incidentes poderão ser enviadas
            para o e-mail cadastrado pelo usuário ou exibidas diretamente na plataforma.
          </p>
        </section>

        <section className="space-y-3 text-sm leading-relaxed">
          <h2 className="text-lg font-semibold">10. Suspensão e encerramento de contas</h2>
          <p>
            Podemos suspender ou encerrar o acesso à conta, total ou parcialmente, em caso de descumprimento destes Termos,
            suspeita de fraude, uso indevido da plataforma, ordem judicial ou por determinação de autoridade competente.
          </p>
          <p>
            Sempre que possível, buscaremos notificar o usuário sobre a suspensão ou encerramento, indicando, quando aplicável,
            as razões que motivaram a medida, respeitadas eventuais restrições legais ou determinações de sigilo.
          </p>
        </section>

        <section className="space-y-3 text-sm leading-relaxed">
          <h2 className="text-lg font-semibold">11. Alterações destes Termos</h2>
          <p>
            Estes Termos de Uso podem ser atualizados periodicamente para refletir mudanças na plataforma, em obrigações legais
            ou em modelos de negócio. As versões atualizadas serão publicadas em{" "}
            <a href="https://clienteideal.online/termos-de-uso" className="underline">
              clienteideal.online/termos-de-uso
            </a>
            , com indicação da data da última atualização.
          </p>
          <p className="text-xs text-muted-foreground">Última atualização: {today}.</p>
        </section>

        <section className="space-y-3 text-sm leading-relaxed">
          <h2 className="text-lg font-semibold">12. Foro e legislação aplicável</h2>
          <p>
            Estes Termos de Uso são regidos pela legislação brasileira. Fica eleito o foro da comarca que melhor atenda aos
            interesses do controlador da plataforma, salvo disposição legal em sentido diverso aplicável ao caso concreto.
          </p>
        </section>
      </div>
    </main>
  )
}

