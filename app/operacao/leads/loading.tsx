export default function LeadsLoading() {
  return (
    <div className="op-shell" aria-busy="true">
      <div className="op-top">
        <h1>Leads</h1>
        <p>Carregando fila…</p>
      </div>
      <div className="op-panel op-skeleton">
        <span style={{ width: "30%" }} />
        <span style={{ width: "95%" }} />
        <span style={{ width: "90%" }} />
        <span style={{ width: "88%" }} />
        <span style={{ width: "70%" }} />
      </div>
    </div>
  );
}
