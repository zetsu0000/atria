export default function OperacaoLoading() {
  return (
    <div className="op-shell" aria-busy="true" aria-live="polite">
      <div className="op-top">
        <h1>Operação</h1>
        <p>Carregando…</p>
      </div>
      <div className="op-panel op-skeleton">
        <span style={{ width: "40%" }} />
        <span style={{ width: "90%" }} />
        <span style={{ width: "75%" }} />
        <span style={{ width: "85%" }} />
        <span style={{ width: "60%" }} />
      </div>
    </div>
  );
}
