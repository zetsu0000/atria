import {
  LandingNav,
  PreviewComparison,
  RequestPreviewLink,
  RequestForm,
} from "./landing-interactions";

const opportunities = [
  {
    title: "Primeira impressão",
    observation:
      "O site pode comunicar menos cuidado do que a clínica entrega no dia a dia.",
    improvement:
      "A proposta reorganiza a apresentação para tornar qualidade e confiança perceptíveis desde o primeiro contato.",
  },
  {
    title: "Clareza",
    observation:
      "Serviços, localização e formas de contato nem sempre aparecem na ordem em que as pessoas procuram.",
    improvement:
      "A informação ganha hierarquia, nomes diretos e caminhos mais curtos — sem promessas que o site não possa sustentar.",
  },
  {
    title: "Experiência mobile",
    observation:
      "No celular, textos longos, menus comprimidos e ações pouco visíveis aumentam o esforço.",
    improvement:
      "A proposta adapta navegação, leitura e contato para telas menores, em vez de apenas empilhar o desktop.",
  },
];

const process = [
  {
    title: "Auditoria",
    copy: "Lemos o site atual como uma pessoa que chega pela primeira vez.",
  },
  {
    title: "Proposta",
    copy: "Criamos uma direção concreta com conteúdo, estrutura e navegação reorganizados.",
  },
  {
    title: "Ajustes",
    copy: "Você revisa, comenta e pede correções antes de qualquer publicação.",
  },
  {
    title: "Aprovação",
    copy: "A versão só atravessa para a etapa final quando a clínica aprova.",
  },
  {
    title: "Publicação técnica",
    copy: "Depois do aceite, a Atria cuida da migração, do domínio, do SSL e do lançamento.",
  },
];

const assurances = [
  {
    title: "O site atual permanece ativo",
    copy: "A prévia é preparada em um ambiente separado. A operação da clínica não precisa parar.",
  },
  {
    title: "Nada é publicado sem aprovação",
    copy: "A clínica decide quando a proposta está pronta para substituir a versão atual.",
  },
  {
    title: "O domínio continua sob controle da clínica",
    copy: "Atria orienta e executa a parte técnica sem transformar o domínio em uma dependência comercial.",
  },
  {
    title: "A parte técnica fica com a Atria",
    copy: "Hospedagem, SSL, backup e publicação entram no plano de lançamento aprovado com a clínica.",
  },
];

export default function Home() {
  return (
    <>
      <a className="skip-link" href="#conteudo-principal">
        Ir para o conteúdo principal
      </a>

      <LandingNav />

      <main id="conteudo-principal">
        <section className="hero" aria-labelledby="hero-title">
          <div className="hero__copy">
            <p className="descriptor">Modernização digital para clínicas</p>
            <h1 id="hero-title">Seu novo site, aprovado antes de ir ao ar.</h1>
            <p className="hero__support">
              Modernizamos o site da sua clínica, mostramos o resultado antes
              da publicação e cuidamos de toda a parte técnica.
            </p>

            <div className="hero__actions" aria-label="Ações principais">
              <RequestPreviewLink className="button button--primary">
                Solicitar uma prévia do meu site
              </RequestPreviewLink>
              <a className="text-link" href="#exemplo">
                Ver exemplo de prévia
              </a>
            </div>
            <p className="cta-explainer">
              Você envia o endereço do site. Atria prepara a avaliação e
              apresenta a proposta antes de qualquer publicação.
            </p>
          </div>

          <div id="exemplo" className="hero__proof" aria-label="Exemplo de prévia">
            <PreviewComparison />
          </div>

          <div className="hero__reassurance" aria-label="Garantias iniciais">
            <p>Nenhuma alteração é feita no site atual.</p>
            <p>Publicação somente depois da sua aprovação.</p>
            <p>Atria cuida da parte técnica; a clínica mantém o controle.</p>
          </div>
        </section>

        <section className="opportunities section-shell" aria-labelledby="opportunities-title">
          <div className="section-intro">
            <p className="section-context">O que a prévia torna visível</p>
            <h2 id="opportunities-title">
              Melhorar não é trocar uma imagem. É reduzir o esforço para
              entender e agir.
            </h2>
          </div>

          <div className="opportunity-list">
            {opportunities.map((item) => (
              <article className="opportunity" key={item.title}>
                <h3>{item.title}</h3>
                <p>{item.observation}</p>
                <p className="opportunity__improvement">{item.improvement}</p>
              </article>
            ))}
          </div>
        </section>

        <section
          id="como-funciona"
          className="method section-shell"
          aria-labelledby="method-title"
        >
          <div className="method__heading">
            <p className="section-context">Preview Seguro</p>
            <h2 id="method-title">Uma decisão concreta, antes da mudança.</h2>
            <p>
              Você não precisa aprovar uma promessa abstrata. A conversa parte
              de uma proposta que pode ser vista, revisada e ajustada.
            </p>
          </div>

          <ol className="process-list">
            {process.map((step) => (
              <li key={step.title}>
                <h3>{step.title}</h3>
                <p>{step.copy}</p>
              </li>
            ))}
          </ol>

          <div className="approval-checkpoint" aria-label="Aprovação antes da publicação">
            <div className="approval-checkpoint__before">
              <span>Proposta pronta para revisão</span>
              <strong>Aguardando sua confirmação</strong>
            </div>
            <div className="approval-checkpoint__interval" aria-hidden="true" />
            <div className="approval-checkpoint__after">
              <span>Publicação técnica</span>
              <strong>Bloqueada até sua aprovação</strong>
            </div>
            <p className="approval-checkpoint__status">
              Publicação somente após sua aprovação.
            </p>
          </div>
        </section>

        <section
          id="seguranca"
          className="security section-shell"
          aria-labelledby="security-title"
        >
          <div className="security__statement">
            <p className="section-context">Controle durante todo o processo</p>
            <h2 id="security-title">O seu site continua sendo seu.</h2>
            <p>
              A modernização acontece ao lado da versão atual. Você avalia o
              que mudou, mantém o que faz sentido e só autoriza a publicação
              quando estiver seguro da decisão.
            </p>
          </div>

          <div className="assurance-list">
            {assurances.map((item) => (
              <article key={item.title}>
                <h3>{item.title}</h3>
                <p>{item.copy}</p>
              </article>
            ))}
          </div>
        </section>

        <section
          id="solicitar"
          className="request section-shell"
          aria-labelledby="request-title"
        >
          <div className="request__intro">
            <p className="section-context">Solicitar uma prévia</p>
            <h2 id="request-title" tabIndex={-1}>
              Comece pelo site que sua clínica já tem.
            </h2>
            <p>
              Envie o endereço atual e um contexto breve. A primeira conversa
              serve para entender o cenário e explicar os próximos passos —
              sem alterar nada no seu site.
            </p>
            <div className="request__notes">
              <p>Não pedimos acesso ao domínio nesta etapa.</p>
              <p>Não envie dados de pacientes ou informações de saúde.</p>
            </div>
          </div>

          <RequestForm />
        </section>
      </main>

      <footer className="footer">
        <div>
          <a className="wordmark" href="#conteudo-principal" aria-label="Atria, início">
            Atria
          </a>
          <p>Modernização digital para clínicas</p>
        </div>
        <p className="footer__promise">
          Seu novo site, aprovado antes de ir ao ar.
        </p>
        <p className="footer__legal">
          Atria não é uma clínica nem presta atendimento médico.
        </p>
      </footer>
    </>
  );
}
