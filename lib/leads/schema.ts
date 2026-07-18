import { z } from "zod";
import { CONSENT_TEXT_VERSION, type FieldErrors } from "./types";

export const LEAD_FIELD_LIMITS = {
  name: 120,
  clinic: 160,
  role: 40,
  location: 120,
  siteUrl: 2048,
  whatsapp: 32,
  email: 254,
  concern: 1000,
  source: 64,
  turnstileToken: 2048,
} as const;

export const ALLOWED_ROLES = [
  "proprietario",
  "medico",
  "gestor",
  "outro",
] as const;

export const ALLOWED_LEAD_KEYS = [
  "name",
  "clinic",
  "role",
  "location",
  "siteUrl",
  "whatsapp",
  "email",
  "concern",
  "consent",
  "turnstileToken",
  "source",
] as const;

const ROLE_LABELS: Record<(typeof ALLOWED_ROLES)[number], string> = {
  proprietario: "Proprietário(a) da clínica",
  medico: "Médico(a)",
  gestor: "Gestor(a)",
  outro: "Outra função",
};

function collapseWhitespace(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

function normalizeOptionalText(value: unknown, max: number): string | null {
  if (value == null) return null;
  const text = collapseWhitespace(String(value));
  if (!text) return null;
  return text.slice(0, max);
}

function isSafeHttpUrl(value: string): boolean {
  try {
    const url = new URL(value);
    if (url.protocol !== "http:" && url.protocol !== "https:") return false;
    if (!url.hostname.includes(".")) return false;
    if (url.username || url.password) return false;
    return true;
  } catch {
    return false;
  }
}

function normalizeWebsiteUrl(value: string): string {
  const trimmed = collapseWhitespace(value);
  const withProtocol = /^https?:\/\//i.test(trimmed)
    ? trimmed
    : `https://${trimmed}`;
  const url = new URL(withProtocol);
  url.hash = "";
  return url.toString();
}

function normalizeWhatsapp(value: string): string {
  const digits = value.replace(/\D/g, "");
  return digits;
}

function normalizeEmail(value: string): string {
  return collapseWhitespace(value).toLowerCase();
}

function isConsentGranted(value: unknown): boolean {
  if (value === true || value === "true" || value === "on" || value === "1") {
    return true;
  }
  return false;
}

const leadObjectSchema = z
  .object({
    name: z.string(),
    clinic: z.string(),
    role: z.string(),
    location: z.string(),
    siteUrl: z.string(),
    whatsapp: z.string(),
    email: z.string(),
    concern: z.string().nullable().optional(),
    consent: z.union([z.boolean(), z.string()]),
    turnstileToken: z.string().optional(),
    source: z.string().optional(),
  })
  .strict();

export type LeadInput = z.infer<typeof leadObjectSchema>;

export type ParsedLead = {
  contactName: string;
  clinicName: string;
  role: (typeof ALLOWED_ROLES)[number];
  roleLabel: string;
  location: string;
  websiteUrl: string;
  whatsapp: string;
  email: string;
  concern: string | null;
  consent: true;
  source: string;
  turnstileToken: string | null;
  consentTextVersion: string;
};

export type ParseLeadSuccess = {
  ok: true;
  data: ParsedLead;
};

export type ParseLeadFailure = {
  ok: false;
  fieldErrors: FieldErrors;
  message: string;
};

export type ParseLeadResult = ParseLeadSuccess | ParseLeadFailure;

function rejectUnexpectedKeys(
  input: Record<string, unknown>,
): FieldErrors | null {
  const allowed = new Set<string>(ALLOWED_LEAD_KEYS);
  const unexpected = Object.keys(input).filter((key) => !allowed.has(key));
  if (unexpected.length === 0) return null;
  return {
    form: "Envio inválido. Recarregue a página e tente novamente.",
  };
}

export function formDataToLeadInput(formData: FormData): Record<string, unknown> {
  const raw: Record<string, unknown> = {};
  for (const [key, value] of formData.entries()) {
    if (typeof value !== "string") {
      raw[key] = "[unsupported]";
      continue;
    }
    if (key in raw) {
      raw[key] = Array.isArray(raw[key])
        ? [...(raw[key] as string[]), value]
        : [raw[key] as string, value];
      continue;
    }
    raw[key] = value;
  }
  return raw;
}

export function parseLeadInput(input: unknown): ParseLeadResult {
  if (input == null || typeof input !== "object" || Array.isArray(input)) {
    return {
      ok: false,
      message: "Envio inválido. Recarregue a página e tente novamente.",
      fieldErrors: {
        form: "Envio inválido. Recarregue a página e tente novamente.",
      },
    };
  }

  const record = input as Record<string, unknown>;
  const unexpected = rejectUnexpectedKeys(record);
  if (unexpected) {
    return {
      ok: false,
      message: "Envio inválido. Recarregue a página e tente novamente.",
      fieldErrors: unexpected,
    };
  }

  const shaped = leadObjectSchema.safeParse({
    name: record.name ?? "",
    clinic: record.clinic ?? "",
    role: record.role ?? "",
    location: record.location ?? "",
    siteUrl: record.siteUrl ?? "",
    whatsapp: record.whatsapp ?? "",
    email: record.email ?? "",
    concern: record.concern ?? null,
    consent: record.consent ?? false,
    turnstileToken:
      typeof record.turnstileToken === "string"
        ? record.turnstileToken
        : undefined,
    source: typeof record.source === "string" ? record.source : undefined,
  });

  if (!shaped.success) {
    return {
      ok: false,
      message: "Revise os campos indicados.",
      fieldErrors: {
        form: "Revise os campos indicados.",
      },
    };
  }

  const fieldErrors: FieldErrors = {};
  const name = collapseWhitespace(shaped.data.name);
  const clinic = collapseWhitespace(shaped.data.clinic);
  const role = collapseWhitespace(shaped.data.role);
  const location = collapseWhitespace(shaped.data.location);
  const siteUrlRaw = collapseWhitespace(shaped.data.siteUrl);
  const whatsappRaw = collapseWhitespace(shaped.data.whatsapp);
  const emailRaw = collapseWhitespace(shaped.data.email);
  const concern = normalizeOptionalText(
    shaped.data.concern,
    LEAD_FIELD_LIMITS.concern,
  );
  const source = collapseWhitespace(shaped.data.source ?? "landing-solicitar");
  const turnstileToken = normalizeOptionalText(
    shaped.data.turnstileToken,
    LEAD_FIELD_LIMITS.turnstileToken,
  );

  if (!name) fieldErrors.name = "Informe seu nome.";
  else if (name.length > LEAD_FIELD_LIMITS.name) {
    fieldErrors.name = "Use um nome mais curto.";
  }

  if (!clinic) fieldErrors.clinic = "Informe o nome da clínica.";
  else if (clinic.length > LEAD_FIELD_LIMITS.clinic) {
    fieldErrors.clinic = "Use um nome de clínica mais curto.";
  }

  if (!role) fieldErrors.role = "Selecione sua função.";
  else if (!ALLOWED_ROLES.includes(role as (typeof ALLOWED_ROLES)[number])) {
    fieldErrors.role = "Selecione uma função válida.";
  }

  if (!location) fieldErrors.location = "Informe a cidade e o estado.";
  else if (location.length > LEAD_FIELD_LIMITS.location) {
    fieldErrors.location = "Use uma localização mais curta.";
  }

  let websiteUrl = "";
  if (!siteUrlRaw) {
    fieldErrors.siteUrl = "Informe o endereço do site atual.";
  } else if (siteUrlRaw.length > LEAD_FIELD_LIMITS.siteUrl) {
    fieldErrors.siteUrl = "Use um endereço mais curto.";
  } else {
    try {
      websiteUrl = normalizeWebsiteUrl(siteUrlRaw);
      if (!isSafeHttpUrl(websiteUrl)) {
        fieldErrors.siteUrl =
          "Use um endereço completo, começando com http:// ou https://.";
      }
    } catch {
      fieldErrors.siteUrl =
        "Use um endereço completo, começando com http:// ou https://.";
    }
  }

  const whatsapp = normalizeWhatsapp(whatsappRaw);
  if (!whatsapp) {
    fieldErrors.whatsapp = "Informe um WhatsApp para contato.";
  } else if (whatsapp.length < 10 || whatsapp.length > 13) {
    fieldErrors.whatsapp = "Informe um número com DDD válido.";
  } else if (whatsappRaw.length > LEAD_FIELD_LIMITS.whatsapp) {
    fieldErrors.whatsapp = "Informe um número com DDD válido.";
  }

  const email = normalizeEmail(emailRaw);
  if (!email) {
    fieldErrors.email = "Informe seu e-mail.";
  } else if (email.length > LEAD_FIELD_LIMITS.email) {
    fieldErrors.email = "Use um e-mail mais curto.";
  } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    fieldErrors.email = "Informe um e-mail válido.";
  }

  if (concern && concern.length > LEAD_FIELD_LIMITS.concern) {
    fieldErrors.concern = "Descreva o problema em menos caracteres.";
  }

  if (!isConsentGranted(shaped.data.consent)) {
    fieldErrors.consent =
      "Confirme que a Atria pode analisar o site informado e entrar em contato.";
  }

  if (source.length > LEAD_FIELD_LIMITS.source) {
    fieldErrors.source = "Origem inválida.";
  }

  if (Object.keys(fieldErrors).length > 0) {
    return {
      ok: false,
      message: "Revise os campos indicados.",
      fieldErrors,
    };
  }

  const safeRole = role as (typeof ALLOWED_ROLES)[number];

  return {
    ok: true,
    data: {
      contactName: name,
      clinicName: clinic,
      role: safeRole,
      roleLabel: ROLE_LABELS[safeRole],
      location,
      websiteUrl,
      whatsapp,
      email,
      concern,
      consent: true,
      source: source || "landing-solicitar",
      turnstileToken,
      consentTextVersion: CONSENT_TEXT_VERSION,
    },
  };
}
