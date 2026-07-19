"use client";

import Link from "next/link";
import {
  type FormEvent,
  useCallback,
  useId,
  useRef,
  useState,
  useTransition,
} from "react";
import { TurnstileField } from "@/components/landing/turnstile-field";
import {
  prepareLeadFormData,
  type RequestFormErrors,
  type RequestFormFieldName,
  validateRequestForm,
} from "@/lib/leads/request-form";
import { submitLead } from "@/lib/leads/submit-lead";
import type { LeadSubmitResult } from "@/lib/leads/types";

type FieldName = RequestFormFieldName;
type FormErrors = RequestFormErrors;

type UiStatus =
  | "idle"
  | "submitting"
  | "validation_error"
  | "duplicate"
  | "rate_limited"
  | "spam_rejected"
  | "configuration_error"
  | "service_unavailable"
  | "success"
  | "server_error";

const fieldLabels: Record<Exclude<FieldName, "form" | "concern">, string> = {
  name: "Nome",
  clinic: "Clínica",
  role: "Função",
  location: "Cidade / UF",
  siteUrl: "Site atual",
  whatsapp: "WhatsApp",
  email: "E-mail",
  consent: "Consentimento",
  turnstileToken: "Verificação de segurança",
};

const turnstileSiteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY?.trim() || "";

function FieldError({ name, errors }: { name: FieldName; errors: FormErrors }) {
  if (!errors[name]) return null;

  return (
    <span id={`${name}-error`} className="field-error">
      {errors[name]}
    </span>
  );
}

function statusFromResult(result: LeadSubmitResult): UiStatus {
  return result.status;
}

function resultTone(status: UiStatus): "success" | "error" | "info" {
  if (status === "success") return "success";
  if (status === "idle" || status === "submitting") return "info";
  return "error";
}

export function RequestForm() {
  const [errors, setErrors] = useState<FormErrors>({});
  const [status, setStatus] = useState<UiStatus>("idle");
  const [statusMessage, setStatusMessage] = useState<string>("");
  const [turnstileToken, setTurnstileToken] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const summaryRef = useRef<HTMLDivElement>(null);
  const resultRef = useRef<HTMLDivElement>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const statusId = useId();

  const handleTokenChange = useCallback((token: string | null) => {
    setTurnstileToken(token);

    if (token) {
      setErrors((currentErrors) => {
        if (!currentErrors.turnstileToken) return currentErrors;

        const nextErrors = { ...currentErrors };
        delete nextErrors.turnstileToken;
        return nextErrors;
      });
      setStatus((currentStatus) =>
        currentStatus === "validation_error" ? "idle" : currentStatus,
      );
    }
  }, []);

  function focusStatus(hasFieldErrors: boolean) {
    window.requestAnimationFrame(() => {
      if (hasFieldErrors) {
        summaryRef.current?.focus();
      } else {
        resultRef.current?.focus();
      }
    });
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (isPending || status === "submitting" || status === "success") return;

    const form = event.currentTarget;
    const formData = new FormData(form);
    const turnstileConfigured = Boolean(turnstileSiteKey);
    const clientErrors = validateRequestForm(formData, {
      turnstileConfigured,
      turnstileToken,
    });

    if (Object.keys(clientErrors).length > 0) {
      setErrors(clientErrors);
      setStatus("validation_error");
      setStatusMessage("Revise os campos indicados.");
      focusStatus(true);
      return;
    }

    prepareLeadFormData(formData, {
      turnstileConfigured,
      turnstileToken,
    });

    setErrors({});
    setStatus("submitting");
    setStatusMessage("Enviando solicitação…");

    startTransition(async () => {
      const result = await submitLead(formData);
      const nextStatus = statusFromResult(result);
      setStatus(nextStatus);
      setStatusMessage(result.message);

      if (result.status === "validation_error") {
        setErrors(result.fieldErrors as FormErrors);
        focusStatus(Object.keys(result.fieldErrors).length > 0);
        return;
      }

      setErrors({});
      if (result.status === "success") {
        formRef.current?.reset();
        setTurnstileToken(null);
      }
      focusStatus(false);
    });
  }

  const submitting = isPending || status === "submitting";
  const invalid = (name: FieldName) => Boolean(errors[name]);
  const describedBy = (name: FieldName) =>
    invalid(name) ? `${name}-error` : undefined;

  const showResult =
    status !== "idle" &&
    status !== "submitting" &&
    status !== "validation_error";

  const summaryEntries = (
    Object.keys(errors) as FieldName[]
  ).filter((name) => name !== "form" && name !== "concern");

  return (
    <form
      ref={formRef}
      className="request-form"
      noValidate
      onSubmit={handleSubmit}
      aria-busy={submitting}
    >
      <div className="request-form__heading">
        <p>Dados da solicitação</p>
        <p>
          Envio seguro para análise da Atria. Não inclua dados de pacientes.
        </p>
      </div>

      <div
        id={statusId}
        className="request-form__live"
        role="status"
        aria-live="polite"
        aria-atomic="true"
      >
        {submitting ? "Enviando solicitação…" : ""}
      </div>

      {(status === "validation_error" || Object.keys(errors).length > 0) && (
        <div
          ref={summaryRef}
          className="form-error-summary"
          role="alert"
          tabIndex={-1}
        >
          <h3>Revise os campos indicados.</h3>
          <ul>
            {summaryEntries.map((name) => (
              <li key={name}>
                <a href={`#${name}`}>
                  {(fieldLabels as Record<string, string>)[name] ?? name}:{" "}
                  {errors[name]}
                </a>
              </li>
            ))}
            {errors.form ? <li>{errors.form}</li> : null}
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
            maxLength={120}
            disabled={submitting || status === "success"}
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
            maxLength={160}
            disabled={submitting || status === "success"}
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
            disabled={submitting || status === "success"}
            aria-invalid={invalid("role")}
            aria-describedby={describedBy("role")}
          >
            <option value="" disabled>
              Selecione
            </option>
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
            maxLength={120}
            disabled={submitting || status === "success"}
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
            maxLength={2048}
            disabled={submitting || status === "success"}
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
            maxLength={32}
            disabled={submitting || status === "success"}
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
            maxLength={254}
            disabled={submitting || status === "success"}
            aria-invalid={invalid("email")}
            aria-describedby={describedBy("email")}
          />
          <FieldError name="email" errors={errors} />
        </label>

        <label className="form-field form-field--wide" htmlFor="concern">
          <span>O que mais incomoda no site hoje? (opcional)</span>
          <textarea
            id="concern"
            name="concern"
            rows={3}
            maxLength={1000}
            disabled={submitting || status === "success"}
          />
        </label>
      </div>

      <label className="consent-field" htmlFor="consent">
        <input
          id="consent"
          name="consent"
          type="checkbox"
          disabled={submitting || status === "success"}
          aria-invalid={invalid("consent")}
          aria-describedby={describedBy("consent")}
        />
        <span>
          Autorizo a Atria a analisar o site informado para preparar uma prévia
          e entrar em contato sobre esta solicitação. Li o{" "}
          <Link href="/privacidade">aviso de privacidade</Link> e os{" "}
          <Link href="/termos">termos de uso</Link>. Não inclua dados de
          pacientes. *
          <FieldError name="consent" errors={errors} />
        </span>
      </label>

      {turnstileSiteKey ? (
        <TurnstileField
          siteKey={turnstileSiteKey}
          onTokenChange={handleTokenChange}
          error={errors.turnstileToken}
        />
      ) : null}

      <div className="request-form__action">
        <button type="submit" disabled={submitting || status === "success"}>
          {submitting ? (
            <>Enviando…</>
          ) : status === "success" ? (
            <>Solicitação enviada</>
          ) : (
            <>
              Verificar solicitação <span aria-hidden="true">↗</span>
            </>
          )}
        </button>
        <p>Usamos os dados apenas para avaliar o site e retornar o contato.</p>
      </div>

      {showResult && (
        <div
          ref={resultRef}
          id="request-result"
          className={`form-result form-result--${resultTone(status)}`}
          role={resultTone(status) === "success" ? "status" : "alert"}
          tabIndex={-1}
        >
          <p>
            {status === "success"
              ? "Solicitação registrada"
              : "Não foi possível concluir"}
          </p>
          <h3>
            {status === "success"
              ? "Recebemos seu pedido de prévia."
              : "Envio não concluído."}
          </h3>
          <p>{statusMessage}</p>
        </div>
      )}
    </form>
  );
}
