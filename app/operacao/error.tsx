"use client";

export default function OperacaoError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="op-shell">
      <div className="op-blocked" role="alert">
        <h1>Não foi possível carregar a operação</h1>
        <p className="op-muted">
          Ocorreu um erro ao preparar esta área. Tente novamente.
        </p>
        <button type="button" className="op-btn op-btn-primary" onClick={reset}>
          Tentar de novo
        </button>
      </div>
    </div>
  );
}
