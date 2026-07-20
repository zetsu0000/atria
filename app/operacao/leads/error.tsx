"use client";

export default function LeadsError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="op-shell">
      <div className="op-blocked" role="alert">
        <h1>Erro ao carregar leads</h1>
        <p className="op-muted">Tente novamente em instantes.</p>
        <button type="button" className="op-btn op-btn-primary" onClick={reset}>
          Tentar de novo
        </button>
      </div>
    </div>
  );
}
