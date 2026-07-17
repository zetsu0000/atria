/**
 * Representações demonstrativas da Clínica Aurora Dermatologia.
 *
 * Conteúdo fictício, sem CTA funcional. Deve sempre aparecer acompanhado do
 * aviso: "Demonstração fictícia — nenhuma clínica real está sendo representada."
 */

export function CurrentClinicSite() {
  return (
    <div className="clinic-site clinic-site--current" aria-hidden="true">
      <div className="clinic-site__current-header">
        <strong>Clínica Aurora</strong>
        <span>Início</span>
        <span>A clínica</span>
        <span>Tratamentos</span>
        <span>Contato</span>
      </div>
      <div className="clinic-site__current-hero">
        <div>
          <small>Dermatologia clínica e estética</small>
          <h3>Cuidado de pele com atenção e responsabilidade.</h3>
          <p>
            Conheça nossos atendimentos, equipe e informações para
            agendamento.
          </p>
        </div>
        <div className="clinic-site__current-image">
          <span />
          <span />
          <span />
        </div>
      </div>
      <div className="clinic-site__current-columns">
        <div>
          <strong>Especialidades</strong>
          <span>Dermatologia clínica</span>
          <span>Tratamentos estéticos</span>
          <span>Tricologia</span>
        </div>
        <div>
          <strong>Informações</strong>
          <span>Segunda a sexta</span>
          <span>Campinas, SP</span>
          <span>(00) 00000-0000</span>
        </div>
      </div>
    </div>
  );
}

export function ProposalClinicSite() {
  return (
    <div className="clinic-site clinic-site--proposal" aria-hidden="true">
      <div className="clinic-site__proposal-header">
        <strong>Aurora</strong>
        <div>
          <span>A clínica</span>
          <span>Especialidades</span>
          <span>Equipe</span>
        </div>
        <span className="clinic-site__sample-action">Falar com a clínica</span>
      </div>
      <div className="clinic-site__proposal-hero">
        <div className="clinic-site__proposal-copy">
          <small>Dermatologia clínica e estética</small>
          <h3>Informação clara para cuidar da sua pele com segurança.</h3>
          <p>
            Conheça a clínica, entenda os atendimentos e encontre o contato
            certo sem percorrer o site inteiro.
          </p>
          <span className="clinic-site__sample-action">Ver especialidades</span>
        </div>
        <div className="clinic-site__proposal-image">
          <div className="clinic-site__material clinic-site__material--one" />
          <div className="clinic-site__material clinic-site__material--two" />
          <div className="clinic-site__material clinic-site__material--three" />
          <p>Ambiente demonstrativo</p>
        </div>
      </div>
      <div className="clinic-site__proposal-footer">
        <span>Dermatologia clínica</span>
        <span>Tratamentos estéticos</span>
        <span>Tricologia</span>
        <span>Contato direto</span>
      </div>
    </div>
  );
}
