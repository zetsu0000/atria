export type RequestFormFieldName =
  | "name"
  | "clinic"
  | "role"
  | "location"
  | "siteUrl"
  | "whatsapp"
  | "email"
  | "concern"
  | "consent"
  | "turnstileToken"
  | "form";

export type RequestFormErrors = Partial<
  Record<RequestFormFieldName, string>
>;

export const TURNSTILE_REQUIRED_MESSAGE =
  "Complete a verificação de segurança antes de enviar.";

const CLOUDFLARE_TURNSTILE_FIELD = "cf-turnstile-response";

function hasHttpProtocol(value: string) {
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

export function validateRequestForm(
  formData: FormData,
  options: {
    turnstileConfigured: boolean;
    turnstileToken: string | null;
  },
): RequestFormErrors {
  const value = (name: RequestFormFieldName) =>
    String(formData.get(name) ?? "").trim();
  const errors: RequestFormErrors = {};

  if (!value("name")) errors.name = "Informe seu nome.";
  if (!value("clinic")) errors.clinic = "Informe o nome da clínica.";
  if (!value("role")) errors.role = "Selecione sua função.";
  if (!value("location")) errors.location = "Informe a cidade e o estado.";

  const siteUrl = value("siteUrl");
  if (!siteUrl) {
    errors.siteUrl = "Informe o endereço do site atual.";
  } else if (!hasHttpProtocol(siteUrl)) {
    errors.siteUrl =
      "Use um endereço completo, começando com http:// ou https://.";
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
    errors.consent =
      "Confirme que a Atria pode analisar o site informado e entrar em contato.";
  }

  if (options.turnstileConfigured && !options.turnstileToken) {
    errors.turnstileToken = TURNSTILE_REQUIRED_MESSAGE;
  }

  return errors;
}

export function prepareLeadFormData(
  formData: FormData,
  options: {
    turnstileConfigured: boolean;
    turnstileToken: string | null;
  },
): FormData {
  formData.delete(CLOUDFLARE_TURNSTILE_FIELD);

  if (options.turnstileConfigured && options.turnstileToken) {
    formData.set("turnstileToken", options.turnstileToken);
  }

  formData.set("source", "landing-solicitar");
  return formData;
}
