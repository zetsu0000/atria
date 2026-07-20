import Link from "next/link";

type Props = {
  searchParams: Promise<{ reason?: string }>;
};

const REASON_COPY: Record<string, string> = {
  not_configured:
    "A autenticação de operador ainda não está configurada neste ambiente.",
  unauthenticated: "Nenhuma sessão de operador válida foi encontrada.",
  forbidden: "A conta autenticada não está na allow-list de operadores.",
  unavailable: "Não foi possível validar a sessão neste momento.",
};

export default async function AcessoBloqueadoPage({ searchParams }: Props) {
  const params = await searchParams;
  const reason = params.reason ?? "unauthenticated";
  const detail =
    REASON_COPY[reason] ??
    "O acesso à área operacional está bloqueado por padrão.";

  return (
    <div className="op-shell">
      <article className="op-blocked">
        <h1>Acesso bloqueado</h1>
        <p>{detail}</p>
        <p className="op-muted">
          A área <code>/operacao</code> exige Supabase Auth + allow-list de
          e-mails. Não há login público nesta etapa.
        </p>
        <ul className="op-muted">
          <li>
            Defina <code>SUPABASE_ANON_KEY</code> (ou{" "}
            <code>NEXT_PUBLIC_SUPABASE_ANON_KEY</code>)
          </li>
          <li>
            Defina <code>OPERATIONS_OPERATOR_EMAILS</code> com e-mails
            autorizados
          </li>
          <li>Autentique um operador via Supabase Auth (sessão por cookie)</li>
        </ul>
        <p style={{ marginTop: "1rem" }}>
          <Link className="op-btn" href="/">
            Voltar ao site
          </Link>
        </p>
      </article>
    </div>
  );
}
