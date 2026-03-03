import type { ReactElement } from "react"

export function PoliticaPrivacidadePage(): ReactElement {
  const today = new Date().toLocaleDateString("pt-BR")

  return (
    <main className="min-h-screen bg-background text-foreground">
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-4 py-10 lg:py-16">
        <header>
          <h1 className="text-3xl font-bold tracking-tight">Política de Privacidade</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Esta Política de Privacidade descreve como a plataforma <strong>Cliente Ideal Online</strong> (&quot;nós&quot;,
            &quot;nosso&quot;) coleta, utiliza, armazena e protege os dados pessoais dos usuários que acessam e utilizam o
            site{" "}
            <a href="https://clienteideal.online" className="underline">
              clienteideal.online
            </a>{" "}
            e serviços relacionados.
          </p>
        </header>

        <section className="space-y-3 text-sm leading-relaxed">
          <h2 className="text-lg font-semibold">1. Controlador dos dados</h2>
          <p>
            O controlador dos dados pessoais tratados na plataforma Cliente Ideal Online é o responsável pela operação do site{" "}
            <strong>clienteideal.online</strong>. Em caso de dúvidas ou solicitações relacionadas à privacidade, você pode
            entrar em contato pelo e-mail{" "}
            <a href="mailto:clienteidealonline@gmail.com" className="underline">
              clienteidealonline@gmail.com
            </a>
            .
          </p>
        </section>

        <section className="space-y-3 text-sm leading-relaxed">
          <h2 className="text-lg font-semibold">2. Dados pessoais que coletamos</h2>
          <p>Podemos coletar e tratar as seguintes categorias de dados pessoais, de acordo com o seu uso da plataforma:</p>
          <ul className="ml-5 list-disc space-y-1">
            <li>
              <strong>Dados de identificação</strong>: nome completo, e-mail, número de telefone, empresa, cargo e outras
              informações fornecidas voluntariamente em cadastros, formulários e integrações.
            </li>
            <li>
              <strong>Dados de acesso</strong>: identificadores de usuário, dados de autenticação via provedores de identidade
              e registros de acesso (datas, horários, IPs).
            </li>
            <li>
              <strong>Dados de uso da plataforma</strong>: páginas acessadas, recursos utilizados, interações com atendimentos
              de IA, cadastros de leads, oportunidades e demais objetos de negócio.
            </li>
            <li>
              <strong>Dados técnicos</strong>: endereço IP, tipo e versão do navegador, sistema operacional, informações de
              cookies e identificadores de dispositivo.
            </li>
            <li>
              <strong>Dados provenientes de integrações</strong>: informações vindas de ferramentas de terceiros (como APIs de
              WhatsApp, n8n, provedores de e-mail e outros serviços conectados), na medida em que sejam necessárias para operar
              a plataforma.
            </li>
          </ul>
        </section>

        <section className="space-y-3 text-sm leading-relaxed">
          <h2 className="text-lg font-semibold">3. Bases legais para o tratamento</h2>
          <p>O tratamento dos seus dados pessoais ocorre com base nas seguintes hipóteses previstas na LGPD:</p>
          <ul className="ml-5 list-disc space-y-1">
            <li>
              <strong>Execução de contrato</strong>: para viabilizar o uso da plataforma e a prestação dos serviços
              contratados.
            </li>
            <li>
              <strong>Cumprimento de obrigação legal ou regulatória</strong>: para atender exigências legais aplicáveis.
            </li>
            <li>
              <strong>Interesse legítimo</strong>: para aprimorar a experiência do usuário, melhorar funcionalidades, prevenir
              fraudes e garantir a segurança da plataforma, sempre observando seus direitos e liberdades fundamentais.
            </li>
            <li>
              <strong>Consentimento</strong>: quando exigido por lei, como para o envio de comunicações de marketing. Nesses
              casos, o consentimento poderá ser revogado a qualquer momento, mediante solicitação.
            </li>
          </ul>
        </section>

        <section className="space-y-3 text-sm leading-relaxed">
          <h2 className="text-lg font-semibold">4. Finalidades do uso dos dados</h2>
          <p>Utilizamos os dados pessoais coletados para as seguintes finalidades principais:</p>
          <ul className="ml-5 list-disc space-y-1">
            <li>Permitir o cadastro, autenticação e gerenciamento de contas de usuários.</li>
            <li>Viabilizar a operação dos módulos da plataforma (leads, oportunidades, agenda, atendimentos de IA etc.).</li>
            <li>
              Enviar comunicações transacionais e de suporte relacionadas ao uso da plataforma, incidentes, alterações de
              funcionalidade e segurança.
            </li>
            <li>
              Melhorar a experiência de uso, realizando análises estatísticas, métricas de desempenho e testes de novas
              funcionalidades.
            </li>
            <li>
              Prevenir fraudes, incidentes de segurança e usos abusivos, bem como cumprir obrigações legais ou regulatórias.
            </li>
          </ul>
        </section>

        <section className="space-y-3 text-sm leading-relaxed">
          <h2 className="text-lg font-semibold">5. Compartilhamento de dados</h2>
          <p>
            Podemos compartilhar dados pessoais com terceiros estritamente necessários para a operação da plataforma, sempre
            observando padrões de segurança e confidencialidade:
          </p>
          <ul className="ml-5 list-disc space-y-1">
            <li>
              <strong>Provedores de infraestrutura</strong>: serviços de hospedagem, banco de dados, armazenamento e redes.
            </li>
            <li>
              <strong>Provedores de autenticação e comunicação</strong>: serviços de login, e-mail transacional, mensageria e
              integrações (por exemplo, APIs de WhatsApp, n8n, Evolution API, Supabase).
            </li>
            <li>
              <strong>Parceiros de análise e monitoramento</strong>: ferramentas de analytics, logs e monitoramento de
              performance e segurança.
            </li>
            <li>
              <strong>Autoridades públicas</strong>: quando exigido por lei, decisão judicial ou requisição de autoridade
              competente.
            </li>
          </ul>
          <p>
            Não vendemos, alugamos ou comercializamos os dados pessoais de usuários de forma isolada, sem vínculo com um
            serviço claramente identificado e contratado.
          </p>
        </section>

        <section className="space-y-3 text-sm leading-relaxed">
          <h2 className="text-lg font-semibold">6. Cookies e tecnologias de rastreamento</h2>
          <p>
            Podemos utilizar cookies e tecnologias semelhantes para melhorar sua experiência, lembrar preferências, entender
            como a plataforma é utilizada e personalizar conteúdos. Você pode gerenciar cookies diretamente nas configurações
            do seu navegador, ciente de que a desativação de determinados cookies pode impactar algumas funcionalidades.
          </p>
        </section>

        <section className="space-y-3 text-sm leading-relaxed">
          <h2 className="text-lg font-semibold">7. Direitos do titular de dados</h2>
          <p>
            De acordo com a Lei Geral de Proteção de Dados (LGPD), você possui, entre outros, os seguintes direitos em relação
            aos seus dados pessoais:
          </p>
          <ul className="ml-5 list-disc space-y-1">
            <li>Confirmação da existência de tratamento.</li>
            <li>Acesso aos dados.</li>
            <li>Correção de dados incompletos, inexatos ou desatualizados.</li>
            <li>Anonimização, bloqueio ou eliminação de dados desnecessários, excessivos ou tratados em desconformidade.</li>
            <li>Portabilidade dos dados a outro fornecedor de serviço ou produto, mediante requisição expressa.</li>
            <li>Eliminação dos dados pessoais tratados com consentimento, salvo hipóteses legais de retenção.</li>
            <li>Informação sobre compartilhamento de dados com entidades públicas e privadas.</li>
            <li>Revogação do consentimento, quando esta for a base legal aplicável.</li>
          </ul>
          <p>
            Para exercer quaisquer desses direitos, entre em contato pelo e-mail{" "}
            <a href="mailto:clienteidealonline@gmail.com" className="underline">
              clienteidealonline@gmail.com
            </a>
            .
          </p>
        </section>

        <section className="space-y-3 text-sm leading-relaxed">
          <h2 className="text-lg font-semibold">8. Segurança da informação</h2>
          <p>
            Adotamos medidas técnicas e organizacionais razoáveis para proteger os dados pessoais contra acessos não
            autorizados, perda, uso indevido, alteração ou destruição. Isso inclui o uso de conexões seguras, controle de
            acesso, segregação de ambientes, mecanismos de autenticação e, quando aplicável, regras de segurança em nível de
            banco de dados.
          </p>
          <p>
            Ainda assim, nenhum sistema é totalmente imune a riscos. Por isso, incentivamos que você também adote boas práticas,
            como o uso de senhas fortes e o não compartilhamento de credenciais com terceiros.
          </p>
        </section>

        <section className="space-y-3 text-sm leading-relaxed">
          <h2 className="text-lg font-semibold">9. Retenção e eliminação de dados</h2>
          <p>
            Os dados pessoais são mantidos apenas pelo tempo necessário para cumprir as finalidades para as quais foram
            coletados, inclusive para cumprimento de obrigações legais, contratuais ou de prestação de contas. Após esse período,
            os dados poderão ser eliminados ou anonimizados, salvo nas hipóteses em que a lei ou regulamento aplicável exigir
            sua manutenção por prazo superior.
          </p>
        </section>

        <section className="space-y-3 text-sm leading-relaxed">
          <h2 className="text-lg font-semibold">10. Transferências internacionais</h2>
          <p>
            Alguns dos provedores de serviço utilizados podem estar localizados ou processar dados em outros países. Nesses
            casos, buscaremos assegurar que o tratamento ocorra em conformidade com a legislação aplicável e com níveis
            adequados de proteção de dados pessoais.
          </p>
        </section>

        <section className="space-y-3 text-sm leading-relaxed">
          <h2 className="text-lg font-semibold">11. Atualizações desta Política</h2>
          <p>
            Esta Política de Privacidade poderá ser atualizada periodicamente para refletir mudanças na legislação, na
            tecnologia ou nos serviços oferecidos. Sempre que houver uma alteração relevante, poderemos comunicar pelos canais
            apropriados ou destacar a atualização na própria plataforma.
          </p>
          <p className="text-xs text-muted-foreground">Última atualização: {today}.</p>
        </section>

        <section className="space-y-3 text-sm leading-relaxed">
          <h2 className="text-lg font-semibold">12. Contato</h2>
          <p>
            Em caso de dúvidas sobre esta Política de Privacidade ou sobre o tratamento de seus dados pessoais, entre em
            contato pelo e-mail{" "}
            <a href="mailto:clienteidealonline@gmail.com" className="underline">
              clienteidealonline@gmail.com
            </a>
            .
          </p>
        </section>
      </div>
    </main>
  )
}

