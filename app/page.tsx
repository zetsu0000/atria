import Link from "next/link";
import { AtriaHeader } from "@/components/landing/atria-header";
import { CurrentProposalStage } from "@/components/landing/current-proposal-stage";
import { RequestForm } from "@/components/landing/request-form";
import { RequestPreviewLink } from "@/components/landing/request-preview-link";

const chapters = [
  {
    id: "current",
    label: "Atual",
    meta: "O site que existe hoje",
    title: "Entendemos o site de hoje sem tirá-lo do ar.",
  },
  {
    id: "proposal",
    label: "Proposta",
    meta: "Uma direção concreta",
    title: "Uma nova experiência, pronta para ser avaliada.",
  },
  {
    id: "approved",
    label: "Aprovado",
    meta: "Publicação sob controle",
    title: "A troca acontece só depois da sua confirmação.",
  },
] as const;

const opportunities = [
  {
    label: "Primeira impressão",
    title: "O site precisa apresentar a clínica antes de pedir atenção.",
    copy: "A estrutura, o ritmo e a linguagem devem ajudar alguém a entender onde chegou — sem depender de uma explicação da equipe.",
  },
  {
    label: "Clareza operacional",
    title: "Informação importante não deveria ficar escondida.",
    copy: "Especialidades, equipe, localização e contato ganham uma hierarquia legível, construída a partir do que a clínica realmente oferece.",
  },
  {
    label: "Experiência móvel",
    title: "A experiência precisa continuar precisa em uma tela pequena.",
    copy: "Navegação, leitura e pontos de contato são reorganizados para funcionar sem apertos, desvios ou elementos concorrendo entre si.",
  },
] as const;

const methodSteps = [
  {
    phase: "Leitura",
    title: "Analisamos o que o site comunica hoje.",
    summary: "Observamos a primeira impressão, a organização do conteúdo, a experiência móvel e os caminhos de contato.",
    clinic: "Compartilha o site atual e o contexto essencial da clínica.",
    atria: "Mapeia oportunidades e preserva o que ainda faz sentido.",
    control: "Nenhuma alteração é feita no site em funcionamento.",
  },
  {
    phase: "Direção",
    title: "Transformamos os achados em uma proposta visível.",
    summary: "A nova direção deixa de ser uma conversa abstrata e passa a existir como uma experiência navegável.",
    clinic: "Confirma prioridades, informações e limites da proposta.",
    atria: "Define hierarquia, composição, linguagem e direção visual.",
    control: "A proposta vive em um ambiente separado do site atual.",
  },
  {
    phase: "Revisão",
    title: "A clínica comenta sobre algo concreto.",
    summary: "Conteúdo e experiência são revistos com base na prévia, sem exigir uma decisão sobre promessas ou slides.",
    clinic: "Revisa a prévia e indica ajustes necessários antes do avanço.",
    atria: "Organiza os comentários e apresenta as correções no contexto.",
    control: "O que ainda está em revisão não é tratado como aprovado.",
  },
  {
    phase: "Aprovação",
    title: "A versão só avança depois da confirmação.",
    summary: "A publicação é uma etapa deliberada. A clínica sabe o que será colocado no ar antes da transição.",
    clinic: "Confirma a versão final e autoriza a preparação da publicação.",
    atria: "Consolida a versão aprovada e prepara a transição técnica.",
    control: "Sem aprovação explícita, o site atual continua como está.",
  },
  {
    phase: "Publicação",
    title: "Cuidamos da passagem para o novo site.",
    summary: "Domínio, hospedagem, SSL, backup e lançamento são tratados como parte da entrega, com a clínica informada.",
    clinic: "Acompanha a janela combinada e valida o resultado publicado.",
    atria: "Executa e verifica os passos técnicos previstos na entrega.",
    control: "A transição segue a versão aprovada e uma janela combinada.",
  },
] as const;

const diagnostics = [
  {
    dimension: "Hierarquia",
    current: "Informações competindo pela mesma atenção.",
    proposal: "Uma sequência clara para conhecer, entender e entrar em contato.",
  },
  {
    dimension: "Leitura",
    current: "Blocos longos e pouca distinção entre assuntos.",
    proposal: "Escala, contraste e ritmo orientando cada camada de conteúdo.",
  },
  {
    dimension: "Mobile",
    current: "A versão pequena apenas comprime a composição existente.",
    proposal: "A experiência é recomposta para toque, leitura e continuidade.",
  },
] as const;

const assurances = [
  ["Site atual preservado", "A prévia é preparada sem substituir o que está em funcionamento."],
  ["Resultado antes da publicação", "A clínica recebe uma direção visível antes de autorizar a troca."],
  ["Revisão em contexto", "Os ajustes são avaliados na própria experiência, não em uma lista abstrata."],
  ["Aprovação explícita", "A preparação da publicação começa somente depois da confirmação."],
  ["Operação técnica assistida", "Domínio, hospedagem, SSL, backup e lançamento fazem parte do suporte."],
  ["Transição combinada", "A mudança segue a versão aprovada e uma janela conhecida pela clínica."],
] as const;

function ChapterVisual({ id }: { id: (typeof chapters)[number]["id"] }) {
  if (id === "current") {
    return (
      <div className="chapter-visual chapter-visual--current" aria-hidden="true">
        <span className="chapter-current__nav" />
        <span className="chapter-current__title" />
        <span className="chapter-current__copy" />
        <span className="chapter-current__copy chapter-current__copy--short" />
        <span className="chapter-current__image" />
        <span className="chapter-current__footer" />
      </div>
    );
  }

  if (id === "proposal") {
    return (
      <div className="chapter-visual chapter-visual--proposal" aria-hidden="true">
        <span className="chapter-proposal__line" />
        <span className="chapter-proposal__line chapter-proposal__line--two" />
        <span className="chapter-proposal__field" />
        <span className="chapter-proposal__contact" />
      </div>
    );
  }

  return (
    <div className="chapter-visual chapter-visual--approved" aria-hidden="true">
      <span className="chapter-approved__before" />
      <span className="chapter-approved__threshold" />
      <span className="chapter-approved__after" />
      <span className="chapter-approved__signal">A</span>
    </div>
  );
}

function MethodDiagram({ step }: { step: number }) {
  return (
    <div className="method-diagram" data-step={step} aria-hidden="true">
      <span className="method-diagram__frame" />
      <span className="method-diagram__plane method-diagram__plane--one" />
      <span className="method-diagram__plane method-diagram__plane--two" />
      <span className="method-diagram__axis" />
      <span className="method-diagram__point">{String(step).padStart(2, "0")}</span>
    </div>
  );
}
export default function Home() {
  return (
    <>
      <a className="skip-link" href="#conteudo-principal">
        Ir para o conteúdo principal
      </a>

      <AtriaHeader />

      <main id="conteudo-principal" className="page-frame">
        <section id="visao" className="hero" aria-labelledby="hero-title">
          <div className="hero-lead">
            <p className="hero-descriptor">
              Modernização digital para clínicas
            </p>

            <h1 id="hero-title">
              <span>Seu novo site,</span>
              <span>
                <em>aprovado antes</em> de ir ao ar.
              </span>
            </h1>

            <div className="hero-support">
              <span className="hero-support__signal" aria-hidden="true">
                <i />
              </span>
              <p>
                Modernizamos o site da sua clínica, mostramos o resultado antes
                da publicação e cuidamos de toda a parte técnica.
              </p>
            </div>

            <div className="hero-actions" aria-label="Ações principais">
              <RequestPreviewLink className="editorial-link editorial-link--primary">
                Solicitar uma prévia do meu site
              </RequestPreviewLink>
              <Link className="editorial-link" href="/previa/clinica-aurora">
                Ver exemplo de prévia
              </Link>
            </div>
          </div>

          <div className="hero-gallery" aria-label="Etapas do mecanismo Atria">
            {chapters.map((chapter) => (
              <article
                key={chapter.id}
                className={`media-chapter media-chapter--${chapter.id}`}
              >
                <ChapterVisual id={chapter.id} />
                <div className="media-chapter__copy">
                  <div>
                    <span>{chapter.label}</span>
                    <small>{chapter.meta}</small>
                  </div>
                  <h2>{chapter.title}</h2>
                </div>
              </article>
            ))}
          </div>
        </section>

        <section id="tese" className="thesis" aria-labelledby="thesis-title">
          <div className="section-index">
            <span>01</span>
            <p>Tese</p>
          </div>

          <div className="thesis-heading">
            <h2 id="thesis-title">
              A primeira impressão da clínica acontece no site.
            </h2>
          </div>

          <div className="thesis-intro">
            <p>
              Quando a estrutura envelhece, a clínica pode parecer menos clara,
              cuidadosa ou atual do que realmente é.
            </p>
            <p>
              Modernizar não é apagar o que existe. É tornar o valor da clínica
              legível, testável e aprovável antes de qualquer troca.
            </p>
          </div>

          <div className="thesis-statement" aria-label="Princípio Atria">
            <p>O que muda não começa no código.</p>
            <h3>
              Começa no modo como a clínica é percebida — e no controle sobre o
              que será publicado.
            </h3>
          </div>

          <div className="opportunity-list" aria-label="Oportunidades da modernização">
            {opportunities.map((opportunity, index) => (
              <article key={opportunity.label} className="opportunity-row">
                <span>{String(index + 1).padStart(2, "0")}</span>
                <p>{opportunity.label}</p>
                <h3>{opportunity.title}</h3>
                <p>{opportunity.copy}</p>
              </article>
            ))}
          </div>

          <div className="thesis-action">
            <p>Uma direção concreta reduz a distância entre imaginar e decidir.</p>
            <RequestPreviewLink className="editorial-link editorial-link--primary">
              Solicitar uma prévia do meu site
            </RequestPreviewLink>
          </div>
        </section>

        <section id="metodo" className="method" aria-labelledby="method-title">
          <header className="method-heading">
            <div className="section-index">
              <span>02</span>
              <p>Como funciona</p>
            </div>
            <h2 id="method-title">Método</h2>
          </header>

          <div className="method-panels">
            {methodSteps.map((item, index) => (
              <article
                key={item.phase}
                className={`method-panel method-panel--${index + 1}`}
              >
                <header className="method-panel__header">
                  <span>{String(index + 1).padStart(2, "0")}</span>
                  <p>{item.phase}</p>
                </header>

                <div className="method-panel__body">
                  <div className="method-panel__copy">
                    <h3>{item.title}</h3>
                    <p>{item.summary}</p>
                  </div>

                  <MethodDiagram step={index + 1} />

                  <dl className="method-responsibilities">
                    <div>
                      <dt>Clínica</dt>
                      <dd>{item.clinic}</dd>
                    </div>
                    <div>
                      <dt>Atria</dt>
                      <dd>{item.atria}</dd>
                    </div>
                    <div>
                      <dt>Controle</dt>
                      <dd>{item.control}</dd>
                    </div>
                  </dl>
                </div>
              </article>
            ))}
          </div>
        </section>

        <section
          id="comparacao"
          className="comparison-proof"
          aria-labelledby="comparison-title"
        >
          <div className="comparison-proof__heading">
            <h2 id="comparison-title">Atual / Proposta</h2>
            <p>Uma decisão concreta, não uma promessa abstrata.</p>
          </div>
          <CurrentProposalStage />

          <p className="comparison-more">
            <Link
              className="editorial-link editorial-link--primary"
              href="/previa/clinica-aurora"
            >
              Ver a prévia completa da Clínica Aurora
            </Link>
          </p>

          <div className="comparison-diagnostics" aria-label="Leitura da transformação demonstrada">
            <div className="comparison-diagnostics__heading">
              <p>O que a proposta reorganiza</p>
              <p>Exemplo ilustrativo, não resultado de uma clínica real.</p>
            </div>
            {diagnostics.map((item, index) => (
              <article key={item.dimension} className="diagnostic-row">
                <span>{String(index + 1).padStart(2, "0")}</span>
                <h3>{item.dimension}</h3>
                <div>
                  <p>Atual</p>
                  <p>{item.current}</p>
                </div>
                <div>
                  <p>Proposta</p>
                  <p>{item.proposal}</p>
                </div>
              </article>
            ))}
          </div>
        </section>

        <section id="seguranca" className="assurance" aria-labelledby="assurance-title">
          <div className="assurance-opening">
            <div className="section-index">
              <span>04</span>
              <p>Segurança operacional</p>
            </div>
            <h2 id="assurance-title">Nada muda sem sua aprovação.</h2>
            <p>
              A modernização acontece ao lado do site atual. A clínica vê,
              revisa e confirma a versão antes da publicação.
            </p>
          </div>

          <div className="assurance-threshold" aria-hidden="true">
            <div>
              <span>Atual</span>
              <span>Em funcionamento</span>
            </div>
            <i><span>Aprovado</span></i>
            <div>
              <span>Novo site</span>
              <span>Pronto para publicar</span>
            </div>
          </div>

          <div className="assurance-index">
            <div className="assurance-index__heading">
              <p>Compromissos do serviço</p>
              <p>O que a clínica pode esperar do processo Atria.</p>
            </div>
            {assurances.map(([title, copy], index) => (
              <article key={title} className="assurance-row">
                <span>{String(index + 1).padStart(2, "0")}</span>
                <h3>{title}</h3>
                <p>{copy}</p>
                <span aria-hidden="true">↗</span>
              </article>
            ))}
          </div>
        </section>

        <section id="solicitar" className="request-section" aria-labelledby="request-title">
          <div className="request-intro">
            <div className="section-index section-index--inverse">
              <span>05</span>
              <p>Solicitar prévia</p>
            </div>
            <h2 id="request-title" tabIndex={-1}>
              Veja primeiro. Decida depois.
            </h2>
            <p>
              Conte qual é o site da sua clínica. A solicitação abaixo é uma
              demonstração local: nenhum dado será enviado.
            </p>
            <dl>
              <div>
                <dt>Entrada</dt>
                <dd>Site atual e contexto essencial</dd>
              </div>
              <div>
                <dt>Próxima etapa</dt>
                <dd>Análise e direção para uma prévia</dd>
              </div>
              <div>
                <dt>Publicação</dt>
                <dd>Somente depois da aprovação</dd>
              </div>
            </dl>
          </div>

          <RequestForm />
        </section>

        <section className="closing-statement" aria-labelledby="closing-title">
          <p>Modernização digital para clínicas</p>
          <h2 id="closing-title">
            Seu novo site, <em>aprovado antes</em> de ir ao ar.
          </h2>
        </section>
      </main>

      <footer className="site-footer page-frame">
        <div className="site-footer__top">
          <p>Atria</p>
          <nav aria-label="Navegação do rodapé">
            <a href="#tese">Por que mudar</a>
            <a href="#metodo">Como funciona</a>
            <a href="#comparacao">Atual / Proposta</a>
            <a href="#seguranca">Segurança</a>
          </nav>
          <RequestPreviewLink className="footer-request">
            Solicitar prévia ↗
          </RequestPreviewLink>
        </div>

        <div className="site-footer__signature" aria-hidden="true">Atria</div>

        <div className="site-footer__bottom">
          <p>Produto B2B para modernização de sites de clínicas no Brasil.</p>
          <p>Protótipo interno de paridade · 2026</p>
          <a href="#visao">Voltar ao início ↑</a>
        </div>
      </footer>
    </>
  );
}
