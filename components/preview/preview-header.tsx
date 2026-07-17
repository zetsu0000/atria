import Link from "next/link";

export function PreviewHeader() {
  return (
    <>
      <header className="site-header">
        <Link
          className="preview-return"
          href="/"
          aria-label="Voltar para a página inicial da Atria"
        >
          <span aria-hidden="true">←</span>
        </Link>

        <Link className="wordmark" href="/" aria-label="Atria, página inicial">
          Atria
        </Link>

        <p className="header-status">
          <span aria-hidden="true" />
          Prévia demonstrativa
        </p>

        <Link className="header-cta" href="/#solicitar">
          <span aria-hidden="true">↗</span>
          Solicitar uma prévia
        </Link>
      </header>

      <div className="side-rail" aria-hidden="true">
        <span className="side-rail__line" />
        <span className="side-rail__position" />
      </div>
    </>
  );
}
