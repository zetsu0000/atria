import Link from "next/link";

export default function LeadNotFound() {
  return (
    <div className="op-shell">
      <div className="op-blocked" role="status">
        <h1>Lead não encontrado</h1>
        <p className="op-muted">
          O identificador informado não corresponde a um lead disponível.
        </p>
        <Link className="op-btn op-btn-primary" href="/operacao/leads">
          Voltar à lista
        </Link>
      </div>
    </div>
  );
}
