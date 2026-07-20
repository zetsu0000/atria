import { z } from "zod";

export const OUTREACH_CHANNELS = ["email", "whatsapp_manual", "other"] as const;
export const OUTREACH_STATUSES = [
  "draft",
  "approved",
  "sent",
  "replied",
  "ignored",
  "rejected",
] as const;

export const outreachEvidenceSchema = z.object({
  observation: z.string().min(1).max(500),
  sourceUrl: z.string().max(2048).optional().nullable(),
});

export const outreachDraftSchema = z.object({
  clinicId: z.string().uuid().optional(),
  channel: z.enum(OUTREACH_CHANNELS),
  status: z.enum(OUTREACH_STATUSES).default("draft"),
  subject: z.string().max(200).nullable().optional(),
  body: z.string().min(1).max(10000),
  evidence: z.array(outreachEvidenceSchema).default([]),
  clickToChatUrl: z.string().max(2048).nullable().optional(),
  humanReviewed: z.boolean().default(false),
  doNotContactBlocked: z.boolean().default(false),
});

export type OutreachDraft = z.infer<typeof outreachDraftSchema>;

export type BuildOutreachDraftInput = {
  clinicDisplayName: string;
  channel: (typeof OUTREACH_CHANNELS)[number];
  observations: Array<{ observation: string; sourceUrl?: string | null }>;
  whatsappDigits?: string | null;
  doNotContact?: boolean;
};

/**
 * Build a local outreach draft. Never sends messages.
 */
export function buildOutreachDraft(
  input: BuildOutreachDraftInput,
):
  | { ok: true; draft: OutreachDraft }
  | { ok: false; message: string } {
  if (input.doNotContact) {
    return {
      ok: false,
      message: "Clinic is marked do_not_contact; draft blocked.",
    };
  }

  if (!input.observations.length) {
    return {
      ok: false,
      message: "Outreach draft requires at least one evidence-backed observation.",
    };
  }

  const bullets = input.observations
    .map((o) => `- ${o.observation}`)
    .join("\n");

  const body =
    input.channel === "email"
      ? [
          `Olá, equipe da ${input.clinicDisplayName},`,
          "",
          "Analisamos apenas a apresentação digital pública do site e a facilidade de encontrar informações (não avaliamos qualidade médica).",
          "",
          "Observações preliminares (sujeitas a revisão humana):",
          bullets,
          "",
          "Se fizer sentido, podemos mostrar uma prévia privada do primeiro bloco antes de qualquer publicação.",
          "",
          "Atenciosamente,",
          "Atria",
        ].join("\n")
      : [
          `Olá! Aqui é da Atria.`,
          `Vimos o site da ${input.clinicDisplayName} e preparamos observações só sobre a apresentação digital (não é avaliação médica):`,
          bullets,
          `Posso te enviar um link privado de prévia quando fizer sentido.`,
        ].join("\n");

  let clickToChatUrl: string | null = null;
  if (input.channel === "whatsapp_manual" && input.whatsappDigits) {
    const digits = input.whatsappDigits.replace(/\D+/g, "");
    if (digits.length >= 10 && digits.length <= 15) {
      clickToChatUrl = `https://wa.me/${digits}?text=${encodeURIComponent(body.slice(0, 500))}`;
    }
  }

  const draft = outreachDraftSchema.parse({
    channel: input.channel,
    status: "draft",
    subject:
      input.channel === "email"
        ? `Prévia digital — ${input.clinicDisplayName}`
        : null,
    body,
    evidence: input.observations,
    clickToChatUrl,
    humanReviewed: false,
    doNotContactBlocked: false,
  });

  return { ok: true, draft };
}

/**
 * Transition helpers — sending is never automatic.
 */
export function markOutreachApproved(
  draft: OutreachDraft,
):
  | { ok: true; draft: OutreachDraft }
  | { ok: false; message: string } {
  if (draft.doNotContactBlocked) {
    return { ok: false, message: "Cannot approve: do_not_contact blocked." };
  }
  return {
    ok: true,
    draft: { ...draft, status: "approved", humanReviewed: true },
  };
}

export function assertOutreachNotAutoSent(draft: OutreachDraft): void {
  if (draft.status === "sent" && !draft.humanReviewed) {
    throw new Error("Outreach cannot be marked sent without human review.");
  }
}
