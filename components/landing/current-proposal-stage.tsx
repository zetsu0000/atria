"use client";

import {
  type KeyboardEvent,
  useRef,
  useState,
} from "react";
import {
  CurrentClinicSite,
  ProposalClinicSite,
} from "@/components/clinic/aurora-sites";

type PreviewVersion = "current" | "proposal";

const versions: Array<{ id: PreviewVersion; label: string }> = [
  { id: "current", label: "Atual" },
  { id: "proposal", label: "Proposta" },
];

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

