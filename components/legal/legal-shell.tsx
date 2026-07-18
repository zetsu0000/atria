import Link from "next/link";
import type { ReactNode } from "react";

type LegalShellProps = {
  title: string;
  description: string;
  children: ReactNode;
};

export function LegalShell({ title, description, children }: LegalShellProps) {
  return (
    <>
      <a className="skip-link" href="#conteudo-legal">
        Ir para o conteúdo principal
      </a>

      <header className="legal-header page-frame">
        <Link href="/" className="legal-header__brand">
          Atria
        </Link>
        <nav aria-label="Navegação legal">
          <Link href="/">Início</Link>
          <Link href="/#solicitar">Solicitar prévia</Link>
        </nav>
      </header>

      <main id="conteudo-legal" className="legal-page page-frame">
        <p className="legal-page__descriptor">Atria · documento informativo</p>
        <h1>{title}</h1>
        <p className="legal-page__lede">{description}</p>
        <aside className="legal-page__notice" role="note">
          <p>
            <strong>Revisão jurídica pendente.</strong> Este texto é um
            placeholder operacional e ainda não foi revisado por assessoria
            jurídica qualificada. Confirme entidade, endereço, contato e
            prazos antes do lançamento público.
          </p>
        </aside>
        <div className="legal-page__body">{children}</div>
      </main>
    </>
  );
}
