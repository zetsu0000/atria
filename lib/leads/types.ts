export type LeadSubmitStatus =
  | "success"
  | "validation_error"
  | "duplicate"
  | "rate_limited"
  | "spam_rejected"
  | "configuration_error"
  | "service_unavailable"
  | "server_error";

export type LeadFieldName =
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
  | "source"
  | "form";

export type FieldErrors = Partial<Record<LeadFieldName, string>>;

export type LeadSubmitResult =
  | {
      status: "success";
      message: string;
      leadId: string;
    }
  | {
      status: "validation_error";
      message: string;
      fieldErrors: FieldErrors;
    }
  | {
      status: Exclude<LeadSubmitStatus, "success" | "validation_error">;
      message: string;
    };

export type NormalizedLead = {
  contactName: string;
  clinicName: string;
  role: string;
  location: string;
  websiteUrl: string;
  whatsapp: string;
  email: string;
  concern: string | null;
  consent: true;
  source: string;
  consentTextVersion: string;
  submittedAt: string;
};

export const CONSENT_TEXT_VERSION = "2026-07-18-v1";

export const USER_MESSAGES = {
  success:
    "Solicitação recebida. A Atria analisará o site informado e retornará pelo contato fornecido.",
  validation: "Revise os campos indicados.",
  duplicate:
    "Esta solicitação já foi recebida recentemente. Aguarde nosso retorno pelo contato informado.",
  rateLimited:
    "Muitas tentativas em pouco tempo. Aguarde alguns minutos e tente novamente.",
  spamRejected:
    "Não foi possível confirmar o envio. Atualize a página e tente novamente.",
  configuration:
    "O envio ainda não está disponível. Tente novamente mais tarde ou use o WhatsApp informado no site.",
  serviceUnavailable:
    "O serviço de envio está temporariamente indisponível. Tente novamente em instantes.",
  serverError:
    "Não foi possível concluir o envio. Tente novamente em instantes.",
} as const;
