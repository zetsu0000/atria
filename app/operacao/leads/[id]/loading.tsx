export default function LeadDetailLoading() {
  return (
    <div className="op-shell" aria-busy="true">
      <div className="op-top">
        <h1>Lead</h1>
        <p>Carregando detalhe…</p>
      </div>
      <div className="op-panel op-skeleton">
        <span style={{ width: "45%" }} />
        <span style={{ width: "80%" }} />
        <span style={{ width: "70%" }} />
        <span style={{ width: "90%" }} />
      </div>
    </div>
  );
}
