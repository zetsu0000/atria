"use client";

import {
  type KeyboardEvent,
  useRef,
  useState,
} from "react";

type PreviewVersion = "current" | "proposal";

const versions: Array<{ id: PreviewVersion; label: string }> = [
  { id: "current", label: "Atual" },
  { id: "proposal", label: "Proposta" },
];

function CurrentClinicSite() {
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

function ProposalClinicSite() {
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

export function CurrentProposalStage() {
  const [selected, setSelected] = useState<PreviewVersion>("proposal");
  const tabRefs = useRef<Array<HTMLButtonElement | null>>([]);

  function selectVersion(version: PreviewVersion, focus = false) {
    setSelected(version);
    if (!focus) return;

    window.requestAnimationFrame(() => {
      const index = versions.findIndex((item) => item.id === version);
      tabRefs.current[index]?.focus({ preventScroll: true });
    });
  }

  function handleTabKeyDown(event: KeyboardEvent<HTMLButtonElement>) {
    const currentIndex = versions.findIndex((item) => item.id === selected);
    let nextIndex = currentIndex;

    if (event.key === "ArrowRight" || event.key === "ArrowDown") {
      nextIndex = (currentIndex + 1) % versions.length;
    } else if (event.key === "ArrowLeft" || event.key === "ArrowUp") {
      nextIndex = (currentIndex - 1 + versions.length) % versions.length;
    } else if (event.key === "Home") {
      nextIndex = 0;
    } else if (event.key === "End") {
      nextIndex = versions.length - 1;
    } else {
      return;
    }

    event.preventDefault();
    selectVersion(versions[nextIndex].id, true);
  }

  return (
    <div className="comparison-experience">
      <div className="comparison-toolbar">
        <div
          className="comparison-tabs"
          role="tablist"
          aria-label="Versão da demonstração exibida"
        >
          {versions.map((version, index) => (
            <button
              key={version.id}
              ref={(element) => {
                tabRefs.current[index] = element;
              }}
              id={`comparison-tab-${version.id}`}
              type="button"
              role="tab"
              aria-selected={selected === version.id}
              aria-controls={`comparison-panel-${version.id}`}
              tabIndex={selected === version.id ? 0 : -1}
              onClick={() => selectVersion(version.id)}
              onKeyDown={handleTabKeyDown}
            >
              <span>{version.label}</span>
              <small>{selected === version.id ? "Em exibição" : "Ver"}</small>
            </button>
          ))}
        </div>

        <p>
          Mesmo conteúdo. Outra hierarquia. Nenhuma publicação nesta etapa.
        </p>
      </div>

      <div
        className="comparison-stage"
        data-version={selected}
        aria-label={`Demonstração da versão ${
          selected === "current" ? "Atual" : "Proposta"
        }`}
      >
        <div
          id="comparison-panel-current"
          className="comparison-panel comparison-panel--current"
          role="tabpanel"
          aria-labelledby="comparison-tab-current"
          aria-hidden={selected !== "current"}
        >
          <CurrentClinicSite />
        </div>
        <div
          id="comparison-panel-proposal"
          className="comparison-panel comparison-panel--proposal"
          role="tabpanel"
          aria-labelledby="comparison-tab-proposal"
          aria-hidden={selected !== "proposal"}
        >
          <ProposalClinicSite />
        </div>
        <div className="comparison-threshold" aria-hidden="true">
          <span />
        </div>
      </div>

      <p className="comparison-announcement sr-only" aria-live="polite">
        Versão {selected === "current" ? "Atual" : "Proposta"} selecionada.
        A posição da página foi preservada.
      </p>

      <div className="comparison-footnote">
        <p>
          Demonstração fictícia — nenhuma clínica real está sendo representada.
        </p>
        <p>O site atual permanece ativo durante toda a revisão.</p>
      </div>
    </div>
  );
}

