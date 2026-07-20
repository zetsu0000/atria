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

/** Accepts full URLs or bare domains (www.clinica.com.br). */
export function isPlausibleWebsiteInput(value: string): boolean {
  const trimmed = value.trim();
  if (!trimmed) return false;
  try {
    const withProtocol = /^https?:\/\//i.test(trimmed)
      ? trimmed
      : `https://${trimmed}`;
    const url = new URL(withProtocol);
    if (url.protocol !== "http:" && url.protocol !== "https:") return false;
    if (!url.hostname.includes(".")) return false;
    if (url.username || url.password) return false;
    return true;
  } catch {
    return false;
  }
}

export function normalizeWebsiteInput(value: string): string {
  const trimmed = value.trim().replace(/\s+/g, " ");
  const withProtocol = /^https?:\/\//i.test(trimmed)
    ? trimmed
    : `https://${trimmed}`;
  const url = new URL(withProtocol);
  url.hash = "";
  return url.toString();
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
  } else if (!isPlausibleWebsiteInput(siteUrl)) {
    errors.siteUrl =
      "Informe um site válido, como www.suaclinica.com.br.";
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

  const siteUrl = String(formData.get("siteUrl") ?? "").trim();
  if (siteUrl && isPlausibleWebsiteInput(siteUrl)) {
    formData.set("siteUrl", normalizeWebsiteInput(siteUrl));
  }

  formData.set("source", "landing-solicitar");
  return formData;
}
