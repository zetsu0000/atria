import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { CurrentProposalStage } from "@/components/landing/current-proposal-stage";
import { PreviewHeader } from "@/components/preview/preview-header";

export const metadata: Metadata = {
  title: "Prévia demonstrativa — Clínica Aurora | Atria",
  description:
    "Exemplo do formato de prévia da Atria: o site atual ao lado da proposta, com aprovação antes de qualquer publicação. Demonstração fictícia.",
};

const changes = [
  {
    label: "Primeira impressão",
    title: "A abertura passa a apresentar a clínica.",
    before:
      "A página abre com navegação densa e um título que não diz quem é a clínica nem o que ela faz.",
    after:
      "A proposta abre com a especialidade, uma mensagem clara e um caminho de contato visível — antes de pedir qualquer ação.",
    diagram: "/images/atria/diagrams/mudanca-primeira-impressao.svg",
  },
  {
    label: "Clareza",
    title: "Cada informação ganha uma camada própria.",
    before:
      "Especialidades, equipe e contato dividem espaço com blocos longos de texto, na mesma hierarquia.",
    after:
      "O conteúdo é reorganizado em camadas distintas, com o contato tratado como informação principal, não como rodapé.",
    diagram: "/images/atria/diagrams/mudanca-clareza.svg",
  },
  {
    label: "Experiência móvel",
    title: "O celular deixa de receber o desktop espremido.",
    before:
      "A versão móvel comprime a composição do desktop: leitura apertada e toques imprecisos.",
    after:
      "A proposta é recomposta para a tela pequena: leitura em coluna, módulos na ordem certa e contato ao alcance.",
    diagram: "/images/atria/diagrams/mudanca-mobile.svg",
  },
] as const;

export default function ClinicaAuroraPreview() {
  return (
    <>
      <a className="skip-link" href="#conteudo-previa">
        Ir para o conteúdo principal
      </a>

      <PreviewHeader />

      <main id="conteudo-previa" className="page-frame preview-page">
        <p className="preview-notice" role="note">
          <strong>Demonstração fictícia</strong> — nenhuma clínica real está
          sendo representada.
        </p>

        <section className="preview-opening" aria-labelledby="preview-title">
          <p className="preview-opening__descriptor">
            Exemplo de prévia · Clínica Aurora Dermatologia
          </p>
          <h1 id="preview-title">
            Uma prévia como a que <em>sua clínica</em> recebe.
          </h1>
          <div className="preview-opening__support">
            <p>
              Este é o formato que a Atria prepara antes de qualquer
              publicação: o site atual ao lado da proposta, para a clínica
              decidir vendo — não imaginando.
            </p>
            <Link
              className="editorial-link editorial-link--primary"
              href="/#solicitar"
            >
              Solicitar uma prévia como esta
            </Link>
          </div>
        </section>

        <section
          className="preview-comparison"
          aria-labelledby="preview-comparison-title"
        >
          <div className="section-index">
            <span>01</span>
            <p>Atual / Proposta</p>
          </div>
          <h2 id="preview-comparison-title">
            O mesmo conteúdo, em outra hierarquia.
          </h2>
          <CurrentProposalStage />
        </section>

        <section className="preview-changes" aria-labelledby="preview-changes-title">
          <div className="section-index">
            <span>02</span>
            <p>O que mudou e por quê</p>
          </div>
          <h2 id="preview-changes-title">O que mudou e por quê</h2>

          <div className="preview-change-list">
            {changes.map((change, index) => (
              <article key={change.label} className="preview-change">
                <span className="preview-change__number">
                  {String(index + 1).padStart(2, "0")}
                </span>
                <p className="preview-change__label">{change.label}</p>
                <div className="preview-change__body">
                  <h3>{change.title}</h3>
                  <dl>
                    <div>
                      <dt>Atual</dt>
                      <dd>{change.before}</dd>
                    </div>
                    <div>
                      <dt>Proposta</dt>
                      <dd>{change.after}</dd>
                    </div>
                  </dl>
                </div>
                <Image
                  className="preview-change__diagram"
                  src={change.diagram}
                  alt=""
                  aria-hidden="true"
                  width={800}
                  height={600}
                  unoptimized
                />
              </article>
            ))}
          </div>
        </section>

        <section className="preview-approval" aria-labelledby="preview-approval-title">
          <div className="section-index section-index--inverse">
            <span>03</span>
            <p>Aprovação</p>
          </div>
          <h2 id="preview-approval-title">
            Nada é publicado sem aprovação.
          </h2>
          <p>
            Em um projeto real, a prévia vive em um ambiente separado enquanto
            o site atual continua no ar. A publicação só é preparada depois da
            confirmação explícita da clínica.
          </p>
          <p className="preview-approval__note">
            Esta demonstração não pode ser aprovada nem publicada — ela existe
            apenas para mostrar o formato da decisão.
          </p>
        </section>

        <section className="preview-cta" aria-labelledby="preview-cta-title">
          <p>O próximo passo é simples e reversível.</p>
          <h2 id="preview-cta-title">
            Veja o seu site <em>neste formato</em>.
          </h2>
          <Link
            className="editorial-link editorial-link--primary"
            href="/#solicitar"
          >
            Solicitar uma prévia como esta
          </Link>
        </section>
      </main>

      <footer className="site-footer page-frame">
        <div className="site-footer__top">
          <p>Atria</p>
          <nav aria-label="Navegação do rodapé">
            <Link href="/">Página inicial</Link>
            <Link href="/#metodo">Como funciona</Link>
            <Link href="/#seguranca">Segurança</Link>
            <Link href="/#solicitar">Solicitar prévia</Link>
          </nav>
          <Link className="footer-request" href="/#solicitar">
            Solicitar prévia ↗
          </Link>
        </div>

        <div className="site-footer__bottom">
          <p>Produto B2B para modernização de sites de clínicas no Brasil.</p>
          <p>Demonstração fictícia — nenhuma clínica real está sendo representada.</p>
          <Link href="/">Voltar à página inicial ↑</Link>
        </div>
      </footer>
    </>
  );
}
