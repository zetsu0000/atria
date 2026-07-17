"use client";

import {
  type AnchorHTMLAttributes,
  type FormEvent,
  type KeyboardEvent,
  type MouseEvent,
  type ReactNode,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";

type PreviewVersion = "current" | "proposal";

const previewTabs: Array<{ id: PreviewVersion; label: string }> = [
  { id: "current", label: "Atual" },
  { id: "proposal", label: "Proposta" },
];

const navigation = [
  { id: "como-funciona", label: "Como funciona" },
  { id: "exemplo", label: "Exemplo de prévia" },
  { id: "seguranca", label: "Segurança" },
  { id: "solicitar", label: "Solicitar uma prévia" },
];

export function RequestPreviewLink({
  children,
  className,
  onClick,
  ...props
}: AnchorHTMLAttributes<HTMLAnchorElement> & { children: ReactNode }) {
  function handleClick(event: MouseEvent<HTMLAnchorElement>) {
    onClick?.(event);
    if (event.defaultPrevented) return;

    const target = document.querySelector<HTMLElement>("#solicitar");
    const heading = document.querySelector<HTMLElement>("#request-title");

    if (!target || !heading) return;

    event.preventDefault();
    window.dispatchEvent(
      new CustomEvent("atria:navigate", { detail: "solicitar" }),
    );
    const reduceMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;

    target.scrollIntoView({
      behavior: reduceMotion ? "auto" : "smooth",
      block: "start",
    });
    window.history.replaceState(null, "", "#solicitar");

    if (reduceMotion) {
      heading.focus({ preventScroll: true });
    } else {
      window.setTimeout(() => heading.focus({ preventScroll: true }), 350);
    }
  }

  return (
    <a {...props} className={className} href="#solicitar" onClick={handleClick}>
      {children}
    </a>
  );
}

export function LandingNav() {
  const [active, setActive] = useState("");
  const [menuOpen, setMenuOpen] = useState(false);
  const menuButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const sections = navigation
      .map((item) => document.getElementById(item.id))
      .filter((section): section is HTMLElement => Boolean(section));

    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((entry) => entry.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];

        if (visible) setActive(visible.target.id);
      },
      { rootMargin: "-18% 0px -62%", threshold: [0.05, 0.3, 0.6] },
    );

    function handleNavigationIntent(event: Event) {
      setActive((event as CustomEvent<string>).detail);
    }

    sections.forEach((section) => observer.observe(section));
    window.addEventListener("atria:navigate", handleNavigationIntent);
    return () => {
      observer.disconnect();
      window.removeEventListener("atria:navigate", handleNavigationIntent);
    };
  }, []);

  useEffect(() => {
    if (!menuOpen) return;

    function handleEscape(event: globalThis.KeyboardEvent) {
      if (event.key !== "Escape") return;
      setMenuOpen(false);
      menuButtonRef.current?.focus();
    }

    window.addEventListener("keydown", handleEscape);
    return () => window.removeEventListener("keydown", handleEscape);
  }, [menuOpen]);

  function closeMenu() {
    setMenuOpen(false);
  }

  return (
    <header className="site-header">
      <div className="site-header__inner">
        <a
          className="wordmark"
          href="#conteudo-principal"
          aria-label="Atria, início"
          onClick={closeMenu}
        >
          Atria
        </a>

        <button
          ref={menuButtonRef}
          className="menu-toggle"
          type="button"
          aria-expanded={menuOpen}
          aria-controls="primary-navigation"
          onClick={() => setMenuOpen((open) => !open)}
        >
          {menuOpen ? "Fechar" : "Menu"}
        </button>

        <nav
          id="primary-navigation"
          className="primary-nav"
          aria-label="Navegação principal"
          data-open={menuOpen ? "true" : "false"}
        >
          <ul>
            {navigation.map((item) => {
              const isActive = active === item.id;
              const isPrimary = item.id === "solicitar";

              return (
                <li key={item.id}>
                  {isPrimary ? (
                    <RequestPreviewLink
                      className="nav-cta"
                      aria-current={isActive ? "location" : undefined}
                      onClick={closeMenu}
                    >
                      {item.label}
                    </RequestPreviewLink>
                  ) : (
                    <a
                      className="nav-link"
                      href={`#${item.id}`}
                      aria-current={isActive ? "location" : undefined}
                      onClick={closeMenu}
                    >
                      <span>{item.label}</span>
                    </a>
                  )}
                </li>
              );
            })}
          </ul>
        </nav>
      </div>
    </header>
  );
}

function CurrentClinicFragment({ compact = false }: { compact?: boolean }) {
  return (
    <div
      className={`clinic-fragment clinic-fragment--current${compact ? " clinic-fragment--compact" : ""}`}
      aria-label="Fragmento do site atual da clínica fictícia"
    >
      <header className="clinic-header clinic-header--current">
        <p className="clinic-name">Clínica Aurora Dermatologia</p>
        <div className="clinic-nav" aria-label="Navegação da demonstração atual">
          <span>Início</span>
          <span>Especialidades</span>
          <span>Contato</span>
        </div>
      </header>

      <div className="clinic-content clinic-content--current">
        <p className="clinic-section-name">Dermatologia clínica e estética</p>
        <p className="clinic-heading">
          Cuidado de pele com atenção e responsabilidade.
        </p>
        <p>
          Conheça a clínica, os atendimentos disponíveis e as orientações para
          agendamento.
        </p>

        <div className="current-services" aria-label="Serviços da clínica fictícia">
          <span>Dermatologia clínica</span>
          <span>Tratamentos estéticos</span>
          <span>Tricologia</span>
        </div>

        <div className="current-contact">
          <strong>Contato</strong>
          <span>(11) 3456-7890</span>
          <span>Segunda a sexta, das 9h às 18h</span>
          <span className="clinic-sample-link" aria-hidden="true">
            Falar com a clínica
          </span>
          <span className="sr-only">
            Exemplo visual de chamada para ação da clínica fictícia; não é um
            controle interativo.
          </span>
        </div>
      </div>
    </div>
  );
}

function ProposalClinicFragment({ compact = false }: { compact?: boolean }) {
  return (
    <div
      className={`clinic-fragment clinic-fragment--proposal${compact ? " clinic-fragment--compact" : ""}`}
      aria-label="Fragmento da proposta para a clínica fictícia"
    >
      <header className="clinic-header clinic-header--proposal">
        <p className="clinic-name">Clínica Aurora Dermatologia</p>
        <div className="clinic-nav" aria-label="Navegação da demonstração proposta">
          <span>A clínica</span>
          <span>Especialidades</span>
          <span className="clinic-sample-link">
            Contato
          </span>
        </div>
      </header>

      <div className="clinic-content clinic-content--proposal">
        <div className="proposal-intro">
          <p className="clinic-section-name">Dermatologia clínica e estética</p>
          <p className="clinic-heading">
            Cuidado de pele com atenção e responsabilidade.
          </p>
          <p>
            Conheça a clínica, os atendimentos disponíveis e as orientações para
            agendamento.
          </p>
          <span className="clinic-cta" aria-hidden="true">
            Falar com a clínica
          </span>
          <span className="sr-only">
            Exemplo visual de chamada para ação da clínica fictícia; não é um
            controle interativo.
          </span>
        </div>

        <div className="proposal-services" aria-label="Serviços organizados da clínica fictícia">
          <p>Especialidades</p>
          <span>Dermatologia clínica</span>
          <span>Tratamentos estéticos</span>
          <span>Tricologia</span>
        </div>

        <div className="proposal-contact">
          <p>Contato direto</p>
          <strong>(11) 3456-7890</strong>
          <span>Segunda a sexta, das 9h às 18h</span>
        </div>
      </div>
    </div>
  );
}

export function PreviewComparison() {
  const [selected, setSelected] = useState<PreviewVersion>("proposal");
  const tabRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const tabsWrapRef = useRef<HTMLDivElement>(null);
  const switchAnchorRef = useRef<{
    focus: boolean;
    top: number;
    version: PreviewVersion;
  } | null>(null);

  useLayoutEffect(() => {
    const pendingSwitch = switchAnchorRef.current;
    if (!pendingSwitch || pendingSwitch.version !== selected) return;

    const nextTop = tabsWrapRef.current?.getBoundingClientRect().top;
    if (typeof nextTop === "number") {
      window.scrollBy({
        top: nextTop - pendingSwitch.top,
        left: 0,
        behavior: "auto",
      });
    }

    if (pendingSwitch.focus) {
      const index = previewTabs.findIndex((tab) => tab.id === selected);
      tabRefs.current[index]?.focus({ preventScroll: true });
    }

    switchAnchorRef.current = null;
  }, [selected]);

  function selectVersion(version: PreviewVersion, focus = false) {
    if (version === selected) {
      if (focus) {
        const index = previewTabs.findIndex((tab) => tab.id === version);
        tabRefs.current[index]?.focus({ preventScroll: true });
      }
      return;
    }

    const anchorTop = tabsWrapRef.current?.getBoundingClientRect().top;
    if (typeof anchorTop === "number") {
      switchAnchorRef.current = { focus, top: anchorTop, version };
    }

    setSelected(version);
  }

  function handleTabKeyDown(event: KeyboardEvent<HTMLButtonElement>) {
    const currentIndex = previewTabs.findIndex((tab) => tab.id === selected);
    let nextIndex = currentIndex;

    if (event.key === "ArrowRight" || event.key === "ArrowDown") {
      nextIndex = (currentIndex + 1) % previewTabs.length;
    } else if (event.key === "ArrowLeft" || event.key === "ArrowUp") {
      nextIndex =
        (currentIndex - 1 + previewTabs.length) % previewTabs.length;
    } else if (event.key === "Home") {
      nextIndex = 0;
    } else if (event.key === "End") {
      nextIndex = previewTabs.length - 1;
    } else {
      return;
    }

    event.preventDefault();
    selectVersion(previewTabs[nextIndex].id, true);
  }

  return (
    <div className="preview-comparison">
      <div className="comparison-heading">
        <div>
          <p className="comparison-heading__title">Exemplo de prévia</p>
          <p>O mesmo conteúdo, reorganizado antes da publicação.</p>
          <p className="comparison-heading__demo">
            Demonstração fictícia — nenhuma clínica real está sendo representada.
          </p>
        </div>
        <p className="comparison-heading__trust">Nenhuma alteração foi feita no site atual.</p>
      </div>

      <div className="comparison-desktop" aria-label="Comparação entre site atual e proposta">
        <section aria-labelledby="desktop-current-label">
          <p id="desktop-current-label" className="version-label">
            Atual
          </p>
          <CurrentClinicFragment />
        </section>
        <div className="threshold-boundary" aria-hidden="true" />
        <section aria-labelledby="desktop-proposal-label">
          <p id="desktop-proposal-label" className="version-label">
            Proposta
          </p>
          <ProposalClinicFragment />
        </section>
      </div>

      <div className="comparison-mobile">
        <div className="version-tabs-wrap" ref={tabsWrapRef}>
          <div className="version-tabs" role="tablist" aria-label="Versão exibida">
            {previewTabs.map((tab, index) => (
              <button
                key={tab.id}
                ref={(element) => {
                  tabRefs.current[index] = element;
                }}
                id={`tab-${tab.id}`}
                type="button"
                role="tab"
                aria-selected={selected === tab.id}
                aria-controls={`panel-${tab.id}`}
                tabIndex={selected === tab.id ? 0 : -1}
                onClick={() => selectVersion(tab.id)}
                onKeyDown={handleTabKeyDown}
              >
                <span>{tab.label}</span>
                {selected === tab.id && <small>Selecionada</small>}
              </button>
            ))}
          </div>
        </div>

        <div className="mobile-panel-frame">
          <div
            id="panel-current"
            role="tabpanel"
            aria-labelledby="tab-current"
            hidden={selected !== "current"}
          >
            <CurrentClinicFragment compact />
          </div>
          <div
            id="panel-proposal"
            role="tabpanel"
            aria-labelledby="tab-proposal"
            hidden={selected !== "proposal"}
          >
            <ProposalClinicFragment compact />
          </div>
        </div>

        <p className="comparison-live sr-only" aria-live="polite">
          Versão {selected === "current" ? "Atual" : "Proposta"} selecionada.
          A seção e a posição da leitura foram preservadas.
        </p>
        <p className="preserved-context">
          Contexto preservado: <strong>especialidades e contato</strong>
        </p>
        <p className="transition-summary">
          Maior clareza <span aria-hidden="true">·</span> Contato mais visível{" "}
          <span aria-hidden="true">·</span> Melhor organização mobile
        </p>
      </div>

      <div className="demo-notice">
        <p>O site atual permanece ativo durante a preparação da prévia.</p>
        <p>Publicação somente após sua aprovação.</p>
      </div>
    </div>
  );
}

type FieldErrors = Partial<
  Record<
    | "name"
    | "clinic"
    | "role"
    | "location"
    | "siteUrl"
    | "whatsapp"
    | "email"
    | "consent",
    string
  >
>;

const fieldOrder: Array<keyof FieldErrors> = [
  "name",
  "role",
  "whatsapp",
  "email",
  "clinic",
  "location",
  "siteUrl",
  "consent",
];

function getText(formData: FormData, name: string) {
  return String(formData.get(name) ?? "").trim();
}

function validateRequest(formData: FormData) {
  const errors: FieldErrors = {};
  const email = getText(formData, "email");
  const siteUrl = getText(formData, "siteUrl");
  const whatsapp = getText(formData, "whatsapp");

  if (!getText(formData, "name")) errors.name = "Informe o seu nome.";
  if (!getText(formData, "clinic")) errors.clinic = "Informe o nome da clínica.";
  if (!getText(formData, "role")) errors.role = "Selecione o seu cargo ou função.";
  if (!getText(formData, "location")) errors.location = "Informe a cidade e o estado.";

  if (!siteUrl) {
    errors.siteUrl = "Informe o endereço do site atual.";
  } else {
    try {
      const parsedUrl = new URL(siteUrl);
      if (!['http:', 'https:'].includes(parsedUrl.protocol)) throw new Error();
    } catch {
      errors.siteUrl = "Use um endereço completo, como https://clinicexemplo.com.br.";
    }
  }

  if (!whatsapp) {
    errors.whatsapp = "Informe um número de WhatsApp.";
  } else if (whatsapp.replace(/\D/g, "").length < 10) {
    errors.whatsapp = "Inclua o DDD e o número completo.";
  }

  if (!email) {
    errors.email = "Informe o seu e-mail.";
  } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    errors.email = "Informe um e-mail completo, como nome@clinica.com.br.";
  }

  if (formData.get("consent") !== "on") {
    errors.consent = "Autorize o contato para continuar com a solicitação.";
  }

  return errors;
}

function FieldError({ id, message }: { id: string; message?: string }) {
  if (!message) return null;
  return (
    <p id={id} className="field-error">
      {message}
    </p>
  );
}

export function RequestForm() {
  const [errors, setErrors] = useState<FieldErrors>({});
  const [status, setStatus] = useState<"idle" | "invalid" | "validated">(
    "idle",
  );
  const statusRef = useRef<HTMLDivElement>(null);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const nextErrors = validateRequest(new FormData(event.currentTarget));
    setErrors(nextErrors);

    const firstInvalid = fieldOrder.find((field) => nextErrors[field]);
    if (firstInvalid) {
      setStatus("invalid");
      window.requestAnimationFrame(() => {
        document.getElementById(firstInvalid)?.focus();
      });
      return;
    }

    setStatus("validated");
    window.requestAnimationFrame(() => statusRef.current?.focus());
  }

  function handleInput() {
    if (status === "validated") setStatus("idle");
  }

  function describedBy(field: keyof FieldErrors, hint?: string) {
    const values = [hint, errors[field] ? `${field}-error` : null].filter(Boolean);
    return values.length ? values.join(" ") : undefined;
  }

  return (
    <form
      className="request-form"
      noValidate
      onInput={handleInput}
      onSubmit={handleSubmit}
    >
      {status === "invalid" && (
        <div className="error-summary" role="alert" aria-labelledby="error-summary-title">
          <h3 id="error-summary-title">Revise os campos indicados.</h3>
          <ul>
            {fieldOrder.map((field) =>
              errors[field] ? (
                <li key={field}>
                  <a href={`#${field}`}>{errors[field]}</a>
                </li>
              ) : null,
            )}
          </ul>
        </div>
      )}

      {status === "validated" && (
        <div
          className="form-status"
          role="status"
          tabIndex={-1}
          ref={statusRef}
        >
          <h3>Preenchimento validado. Nenhum dado foi enviado.</h3>
          <p>
            Esta demonstração confirmou apenas os campos desta página. Os
            dados continuam disponíveis abaixo para você revisar e não foram
            enviados a nenhum serviço.
          </p>
        </div>
      )}

      <div className="local-mode-note" aria-label="Comportamento deste MVP">
        <strong>Demonstração local do formulário</strong>
        <p>
          Nesta versão, os campos são verificados somente nesta página. Nenhum
          dado é enviado a um serviço de produção.
        </p>
      </div>

      <fieldset className="form-section">
        <legend>Sobre você e o contato</legend>
        <div className="form-grid">
          <div className="field-group">
            <label htmlFor="name">Nome <span>(obrigatório)</span></label>
            <input
              id="name"
              name="name"
              type="text"
              autoComplete="name"
              maxLength={100}
              required
              aria-invalid={Boolean(errors.name)}
              aria-describedby={describedBy("name")}
            />
            <FieldError id="name-error" message={errors.name} />
          </div>

          <div className="field-group">
            <label htmlFor="role">Cargo ou função <span>(obrigatório)</span></label>
            <select
              id="role"
              name="role"
              defaultValue=""
              autoComplete="organization-title"
              required
              aria-invalid={Boolean(errors.role)}
              aria-describedby={describedBy("role")}
            >
              <option value="" disabled>Selecione uma opção</option>
              <option>Médico proprietário</option>
              <option>Sócio</option>
              <option>Gestor</option>
              <option>Marketing</option>
              <option>Outro</option>
            </select>
            <FieldError id="role-error" message={errors.role} />
          </div>

          <div className="field-group">
            <label htmlFor="whatsapp">WhatsApp <span>(obrigatório)</span></label>
            <input
              id="whatsapp"
              name="whatsapp"
              type="tel"
              inputMode="tel"
              autoComplete="tel"
              maxLength={24}
              required
              placeholder="(11) 99999-9999"
              aria-invalid={Boolean(errors.whatsapp)}
              aria-describedby={describedBy("whatsapp")}
            />
            <FieldError id="whatsapp-error" message={errors.whatsapp} />
          </div>

          <div className="field-group">
            <label htmlFor="email">E-mail <span>(obrigatório)</span></label>
            <input
              id="email"
              name="email"
              type="email"
              inputMode="email"
              autoComplete="email"
              maxLength={160}
              required
              aria-invalid={Boolean(errors.email)}
              aria-describedby={describedBy("email")}
            />
            <FieldError id="email-error" message={errors.email} />
          </div>
        </div>
      </fieldset>

      <fieldset className="form-section">
        <legend>Sobre a clínica e o site atual</legend>
        <div className="form-grid">
          <div className="field-group">
            <label htmlFor="clinic">Nome da clínica <span>(obrigatório)</span></label>
            <input
              id="clinic"
              name="clinic"
              type="text"
              autoComplete="organization"
              maxLength={140}
              required
              aria-invalid={Boolean(errors.clinic)}
              aria-describedby={describedBy("clinic")}
            />
            <FieldError id="clinic-error" message={errors.clinic} />
          </div>

          <div className="field-group">
            <label htmlFor="location">Cidade e estado <span>(obrigatório)</span></label>
            <input
              id="location"
              name="location"
              type="text"
              autoComplete="address-level2"
              maxLength={100}
              required
              placeholder="Ex.: Campinas, SP"
              aria-invalid={Boolean(errors.location)}
              aria-describedby={describedBy("location")}
            />
            <FieldError id="location-error" message={errors.location} />
          </div>

          <div className="field-group field-group--wide">
            <label htmlFor="siteUrl">URL atual do site <span>(obrigatório)</span></label>
            <input
              id="siteUrl"
              name="siteUrl"
              type="url"
              inputMode="url"
              autoComplete="url"
              maxLength={500}
              required
              placeholder="https://"
              aria-invalid={Boolean(errors.siteUrl)}
              aria-describedby={describedBy("siteUrl", "siteUrl-hint")}
            />
            <p id="siteUrl-hint" className="field-hint">
              Usamos este endereço apenas para entender a versão atual.
            </p>
            <FieldError id="siteUrl-error" message={errors.siteUrl} />
          </div>

          <div className="field-group field-group--wide">
            <label htmlFor="concern">O que mais incomoda no site atual? <span>(opcional)</span></label>
            <textarea id="concern" name="concern" rows={4} maxLength={1000} />
          </div>
        </div>
      </fieldset>

      <fieldset className="form-section form-section--consent">
        <legend>Autorização de contato</legend>
        <div className="consent-field">
          <input
            id="consent"
            name="consent"
            type="checkbox"
            required
            aria-invalid={Boolean(errors.consent)}
            aria-describedby={describedBy("consent")}
          />
          <label htmlFor="consent">
            Autorizo a Atria a entrar em contato sobre esta solicitação de prévia.
          </label>
          <FieldError id="consent-error" message={errors.consent} />
        </div>
      </fieldset>

      <div className="form-actions">
        <button className="button button--primary" type="submit">
          Verificar preenchimento
        </button>
        <p>
          Nenhuma publicação, acesso ao domínio ou alteração técnica acontece
          a partir deste pedido.
        </p>
      </div>
    </form>
  );
}
