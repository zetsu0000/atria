"use client";

import { type FormEvent, useRef, useState } from "react";

type FieldName =
  | "name"
  | "clinic"
  | "role"
  | "location"
  | "siteUrl"
  | "whatsapp"
  | "email"
  | "consent";

type FormErrors = Partial<Record<FieldName, string>>;

const fieldLabels: Record<FieldName, string> = {
  name: "Nome",
  clinic: "Clínica",
  role: "Função",
  location: "Cidade / UF",
  siteUrl: "Site atual",
  whatsapp: "WhatsApp",
  email: "E-mail",
  consent: "Consentimento",
};

function hasHttpProtocol(value: string) {
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

function validate(formData: FormData): FormErrors {
  const value = (name: FieldName) => String(formData.get(name) ?? "").trim();
  const errors: FormErrors = {};

  if (!value("name")) errors.name = "Informe seu nome.";
  if (!value("clinic")) errors.clinic = "Informe o nome da clínica.";
  if (!value("role")) errors.role = "Selecione sua função.";
  if (!value("location")) errors.location = "Informe a cidade e o estado.";

  const siteUrl = value("siteUrl");
  if (!siteUrl) {
    errors.siteUrl = "Informe o endereço do site atual.";
  } else if (!hasHttpProtocol(siteUrl)) {
    errors.siteUrl = "Use um endereço completo, começando com http:// ou https://.";
  }

  const whatsappDigits = value("whatsapp").replace(/\D/g, "");
  if (!whatsappDigits) {
    errors.whatsapp = "Informe um WhatsApp para contato.";
  } else if (whatsappDigits.length < 10 || whatsappDigits.length > 13) {
    errors.whatsapp = "Informe um número com DDD válido.";
  }

  const email = value("email");
  if (!email) {
    errors.email = "Informe seu e-mail.";
  } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    errors.email = "Informe um e-mail válido.";
  }

  if (formData.get("consent") !== "on") {
    errors.consent = "Confirme que a Atria pode analisar o site informado.";
  }

  return errors;
}

function FieldError({ name, errors }: { name: FieldName; errors: FormErrors }) {
  if (!errors[name]) return null;

  return (
    <span id={`${name}-error`} className="field-error">
      {errors[name]}
    </span>
  );
}

export function RequestForm() {
  const [errors, setErrors] = useState<FormErrors>({});
  const [validated, setValidated] = useState(false);
  const summaryRef = useRef<HTMLDivElement>(null);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const nextErrors = validate(new FormData(event.currentTarget));
    setErrors(nextErrors);
    setValidated(Object.keys(nextErrors).length === 0);

    window.requestAnimationFrame(() => {
      if (Object.keys(nextErrors).length > 0) {
        summaryRef.current?.focus();
      } else {
        document.querySelector<HTMLElement>("#request-result")?.focus();
      }
    });
  }

  const invalid = (name: FieldName) => Boolean(errors[name]);
  const describedBy = (name: FieldName) =>
    invalid(name) ? `${name}-error` : undefined;

  return (
    <form className="request-form" noValidate onSubmit={handleSubmit}>
      <div className="request-form__heading">
        <p>Dados da solicitação</p>
        <p>
          Protótipo local: o preenchimento é validado neste navegador e não é
          transmitido.
        </p>
      </div>

      {Object.keys(errors).length > 0 && (
        <div
          ref={summaryRef}
          className="form-error-summary"
          role="alert"
          tabIndex={-1}
        >
          <h3>Revise os campos indicados.</h3>
          <ul>
            {(Object.keys(errors) as FieldName[]).map((name) => (
              <li key={name}>
                <a href={`#${name}`}>{fieldLabels[name]}: {errors[name]}</a>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="form-grid">
        <label className="form-field" htmlFor="name">
          <span>Nome *</span>
          <input
            id="name"
            name="name"
            type="text"
            autoComplete="name"
            aria-invalid={invalid("name")}
            aria-describedby={describedBy("name")}
          />
          <FieldError name="name" errors={errors} />
        </label>

        <label className="form-field" htmlFor="clinic">
          <span>Clínica *</span>
          <input
            id="clinic"
            name="clinic"
            type="text"
            autoComplete="organization"
            aria-invalid={invalid("clinic")}
            aria-describedby={describedBy("clinic")}
          />
          <FieldError name="clinic" errors={errors} />
        </label>

        <label className="form-field" htmlFor="role">
          <span>Sua função *</span>
          <select
            id="role"
            name="role"
            autoComplete="organization-title"
            defaultValue=""
            aria-invalid={invalid("role")}
            aria-describedby={describedBy("role")}
          >
            <option value="" disabled>Selecione</option>
            <option value="proprietario">Proprietário(a) da clínica</option>
            <option value="medico">Médico(a)</option>
            <option value="gestor">Gestor(a)</option>
            <option value="outro">Outra função</option>
          </select>
          <FieldError name="role" errors={errors} />
        </label>

        <label className="form-field" htmlFor="location">
          <span>Cidade / UF *</span>
          <input
            id="location"
            name="location"
            type="text"
            autoComplete="address-level2"
            placeholder="Ex.: Campinas / SP"
            aria-invalid={invalid("location")}
            aria-describedby={describedBy("location")}
          />
          <FieldError name="location" errors={errors} />
        </label>

        <label className="form-field form-field--wide" htmlFor="siteUrl">
          <span>URL do site atual *</span>
          <input
            id="siteUrl"
            name="siteUrl"
            type="url"
            inputMode="url"
            autoComplete="url"
            placeholder="https://www.suaclinica.com.br"
            aria-invalid={invalid("siteUrl")}
            aria-describedby={describedBy("siteUrl")}
          />
          <FieldError name="siteUrl" errors={errors} />
        </label>

        <label className="form-field" htmlFor="whatsapp">
          <span>WhatsApp *</span>
          <input
            id="whatsapp"
            name="whatsapp"
            type="tel"
            inputMode="tel"
            autoComplete="tel"
            placeholder="(00) 00000-0000"
            aria-invalid={invalid("whatsapp")}
            aria-describedby={describedBy("whatsapp")}
          />
          <FieldError name="whatsapp" errors={errors} />
        </label>

        <label className="form-field" htmlFor="email">
          <span>E-mail *</span>
          <input
            id="email"
            name="email"
            type="email"
            inputMode="email"
            autoComplete="email"
            aria-invalid={invalid("email")}
            aria-describedby={describedBy("email")}
          />
          <FieldError name="email" errors={errors} />
        </label>

        <label className="form-field form-field--wide" htmlFor="concern">
          <span>O que mais incomoda no site hoje? (opcional)</span>
          <textarea id="concern" name="concern" rows={3} />
        </label>
      </div>

      <label className="consent-field" htmlFor="consent">
        <input
          id="consent"
          name="consent"
          type="checkbox"
          aria-invalid={invalid("consent")}
          aria-describedby={describedBy("consent")}
        />
        <span>
          Autorizo a Atria a analisar o site informado para preparar uma prévia.
          Não inclua dados de pacientes. *
          <FieldError name="consent" errors={errors} />
        </span>
      </label>

      <div className="request-form__action">
        <button type="submit">Verificar solicitação <span aria-hidden="true">↗</span></button>
        <p>Nenhum dado sai deste protótipo.</p>
      </div>

      {validated && (
        <div
          id="request-result"
          className="form-result"
          role="status"
          tabIndex={-1}
        >
          <p>Preenchimento validado.</p>
          <h3>Nenhum dado foi enviado.</h3>
          <p>
            Esta landing ainda não possui backend. Em uma etapa futura, o
            envio deverá ser conectado a um canal seguro e informado ao usuário.
          </p>
        </div>
      )}
    </form>
  );
}
