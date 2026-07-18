import {
  hasNotificationConfig,
  logConfigWarning,
  readLeadCaptureEnv,
  type LeadCaptureEnv,
} from "@/lib/security/env";
import type { ParsedLead } from "./schema";

export type NotifyLeadResult =
  | { ok: true; mode: "sent" | "skipped" }
  | { ok: false; reason: "failed" };

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function buildTextBody(lead: ParsedLead, leadId: string, submittedAt: string): string {
  return [
    "Nova solicitação de prévia — Atria",
    "",
    `ID: ${leadId}`,
    `Recebido em: ${submittedAt}`,
    `Origem: ${lead.source}`,
    "",
    `Nome: ${lead.contactName}`,
    `Clínica: ${lead.clinicName}`,
    `Função: ${lead.roleLabel}`,
    `Cidade/UF: ${lead.location}`,
    `Site: ${lead.websiteUrl}`,
    `E-mail: ${lead.email}`,
    `WhatsApp: ${lead.whatsapp}`,
    `Problema relatado: ${lead.concern ?? "(não informado)"}`,
    `Consentimento: sim (${lead.consentTextVersion})`,
  ].join("\n");
}

function buildHtmlBody(lead: ParsedLead, leadId: string, submittedAt: string): string {
  const rows: Array<[string, string]> = [
    ["ID", leadId],
    ["Recebido em", submittedAt],
    ["Origem", lead.source],
    ["Nome", lead.contactName],
    ["Clínica", lead.clinicName],
    ["Função", lead.roleLabel],
    ["Cidade/UF", lead.location],
    ["Site", lead.websiteUrl],
    ["E-mail", lead.email],
    ["WhatsApp", lead.whatsapp],
    ["Problema relatado", lead.concern ?? "(não informado)"],
    ["Consentimento", `sim (${lead.consentTextVersion})`],
  ];

  const list = rows
    .map(
      ([label, value]) =>
        `<li><strong>${escapeHtml(label)}:</strong> ${escapeHtml(value)}</li>`,
    )
    .join("");

  return `<p>Nova solicitação de prévia — Atria</p><ul>${list}</ul>`;
}

export async function notifyLeadReceived(input: {
  lead: ParsedLead;
  leadId: string;
  submittedAt: string;
  env?: LeadCaptureEnv;
}): Promise<NotifyLeadResult> {
  const env = input.env ?? readLeadCaptureEnv();

  if (!hasNotificationConfig(env)) {
    logConfigWarning("notification_missing");
    return { ok: true, mode: "skipped" };
  }

  try {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${env.resendApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: env.leadFromEmail,
        to: [env.leadNotificationEmail],
        subject: `Atria — nova solicitação de prévia (${input.lead.clinicName})`,
        text: buildTextBody(input.lead, input.leadId, input.submittedAt),
        html: buildHtmlBody(input.lead, input.leadId, input.submittedAt),
      }),
      cache: "no-store",
    });

    if (!response.ok) {
      console.warn(
        `[atria:leads] notification_failed status=${response.status}`,
      );
      return { ok: false, reason: "failed" };
    }

    return { ok: true, mode: "sent" };
  } catch {
    console.warn("[atria:leads] notification_exception");
    return { ok: false, reason: "failed" };
  }
}
