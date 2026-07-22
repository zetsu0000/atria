/**
 * Pure, deterministic Markdown rendering of a ManualOutreachPack — a
 * straight formatting pass over already-computed data, no additional
 * computation, no invented content. Given the same pack object, the output
 * is always identical (stable for tests/diffs).
 */
import type {
  ManualOutreachChannel,
  ManualOutreachCopySection,
  ManualOutreachPack,
  ManualOutreachScreenshotReference,
  RiskFlag,
} from "./types";

const CHANNEL_LABEL: Record<ManualOutreachChannel, string> = {
  whatsapp_manual: "WhatsApp",
  email: "E-mail",
};

function renderScreenshot(label: string, section: ManualOutreachScreenshotReference): string {
  const statusPt: Record<string, string> = {
    captured: "capturado",
    pending_storage: "capturado (upload pendente)",
    capture_failed: "falha na captura",
    storage_failed: "falha no upload",
    missing: "ausente/pendente",
  };
  const lines = [`- **${label}:** ${statusPt[section.status] ?? section.status}`];
  if (section.assetId) lines.push(`  - Asset ID: ${section.assetId}`);
  if (section.storagePath) lines.push(`  - Storage path (privado): ${section.storagePath}`);
  if (section.capturedAt) lines.push(`  - Capturado em: ${section.capturedAt}`);
  return lines.join("\n");
}

function renderRiskFlags(flags: RiskFlag[]): string {
  if (flags.length === 0) return "_Nenhuma flag de risco identificada._";
  return flags.map((f) => `- **[${f.severity}]** \`${f.code}\`: ${f.message}`).join("\n");
}

function renderCopySection(channel: ManualOutreachChannel, section: ManualOutreachCopySection | null): string {
  const label = CHANNEL_LABEL[channel];
  const lines = [`### ${label}`, ""];
  if (!section) {
    lines.push("_Canal não solicitado nesta geração._");
    lines.push("");
    return lines.join("\n");
  }
  if (!section.available) {
    lines.push(`_Bloqueado pelo approval gate — copy não gerada/exibida._`);
    lines.push(`- **Motivo:** ${section.blockReason}`);
    if (section.blockCode) lines.push(`- **Código:** \`${section.blockCode}\``);
    lines.push("");
    return lines.join("\n");
  }
  lines.push(`- **Outreach message ID:** ${section.outreachMessageId}`);
  lines.push(`- **Status:** ${section.outreachStatus}`);
  if (section.subject) lines.push(`- **Assunto:** ${section.subject}`);
  if (section.clickToChatUrl) lines.push(`- **Link WhatsApp (click-to-chat):** ${section.clickToChatUrl}`);
  lines.push("");
  lines.push("```");
  lines.push(section.body);
  lines.push("```");
  if (section.internalScoreNote) {
    lines.push("");
    lines.push(`> ${section.internalScoreNote}`);
  }
  lines.push("");
  return lines.join("\n");
}

export function renderManualOutreachPackMarkdown(pack: ManualOutreachPack): string {
  const lines: string[] = [];

  lines.push(`# Pacote de outreach manual — ${pack.clinicIdentity.displayName}`);
  lines.push("");
  lines.push(`> **Status: ${pack.status}** — envio permanece manual; este pacote nunca envia nada.`);
  lines.push(`> Gerado em: ${pack.generatedAt}`);
  lines.push("");
  lines.push(`> ${pack.disclaimer}`);
  lines.push("");

  if (pack.warnings.length > 0) {
    lines.push("## ⚠ Avisos");
    lines.push("");
    for (const warning of pack.warnings) lines.push(`- ${warning}`);
    lines.push("");
  }

  lines.push("## 1. Resumo do operador");
  lines.push("");
  lines.push(pack.operatorSummary);
  lines.push("");

  lines.push("## 2. Identidade da clínica");
  lines.push("");
  lines.push(`- **Nome:** ${pack.clinicIdentity.displayName}`);
  lines.push(`- **Clinic ID:** ${pack.clinicIdentity.clinicId}`);
  lines.push(`- **Status:** ${pack.clinicIdentity.status}`);
  lines.push(`- **Cidade/Estado:** ${pack.clinicIdentity.city ?? "—"} / ${pack.clinicIdentity.state ?? "—"}`);
  lines.push(`- **Especialidade:** ${pack.clinicIdentity.specialty ?? "—"}`);
  lines.push("");

  lines.push("## 3. Website analisado");
  lines.push("");
  if (pack.websiteAnalyzed.crawlJobId) {
    lines.push(`- **Crawl job ID:** ${pack.websiteAnalyzed.crawlJobId}`);
    lines.push(`- **URL solicitada:** ${pack.websiteAnalyzed.requestedUrl}`);
    lines.push(`- **Origem normalizada:** ${pack.websiteAnalyzed.normalizedOrigin ?? "—"}`);
    lines.push(`- **Status do crawl:** ${pack.websiteAnalyzed.crawlStatus}`);
    lines.push(`- **Páginas obtidas:** ${pack.websiteAnalyzed.pagesFetched ?? 0}`);
  } else {
    lines.push("_Nenhum crawl job encontrado para esta clínica._");
  }
  lines.push("");

  lines.push("## 4. Status de aprovação");
  lines.push("");
  lines.push(`- **Decisão mais recente é approved:** ${pack.approvalStatus.hasApprovedDecision ? "sim" : "não"}`);
  lines.push(`- **Decision ID:** ${pack.approvalStatus.latestDecisionId ?? "—"}`);
  lines.push(`- **Decisão:** ${pack.approvalStatus.decision ?? "—"}`);
  lines.push(`- **Revisor:** ${pack.approvalStatus.reviewer ?? "—"}`);
  lines.push(`- **Revisado em:** ${pack.approvalStatus.reviewedAt ?? "—"}`);
  lines.push("");

  lines.push("## 5. Resultado do approval gate");
  lines.push("");
  lines.push("| Canal | Status | Outreach message ID | Código | Motivo |");
  lines.push("| --- | --- | --- | --- | --- |");
  for (const result of pack.approvalGateResults) {
    lines.push(
      `| ${CHANNEL_LABEL[result.channel]} | ${result.status} | ${result.outreachMessageId ?? "—"} | ${result.code ?? "—"} | ${result.reason} |`,
    );
  }
  lines.push("");

  lines.push("## 6. Resumo do score");
  lines.push("");
  if (pack.scoreSummary.available) {
    lines.push(`- **Total:** ${pack.scoreSummary.total}/100`);
    lines.push(`- **Versão de scoring:** ${pack.scoreSummary.scoringVersion}`);
  } else {
    lines.push("_Score indisponível para esta clínica/crawl job._");
  }
  lines.push("");

  lines.push("## 7. Resumo de evidências-chave");
  lines.push("");
  for (const item of pack.keyEvidenceSummary) lines.push(`- ${item}`);
  lines.push("");

  lines.push("## 8. Referências de screenshot");
  lines.push("");
  lines.push(renderScreenshot("Desktop", pack.screenshots.desktop));
  lines.push(renderScreenshot("Mobile", pack.screenshots.mobile));
  lines.push("");

  lines.push("## 9. Flags de risco");
  lines.push("");
  lines.push(renderRiskFlags(pack.riskFlags));
  lines.push("");

  lines.push("## 10-11. Copy final (não enviada)");
  lines.push("");
  lines.push(renderCopySection("whatsapp_manual", pack.whatsapp));
  lines.push(renderCopySection("email", pack.email));

  lines.push("## 13. Checklist de envio manual");
  lines.push("");
  for (const item of pack.operatorChecklist) lines.push(`- [ ] ${item}`);
  lines.push("");

  lines.push("## 14. Checklist de registro pós-envio");
  lines.push("");
  for (const item of pack.postSendLoggingChecklist) lines.push(`- [ ] ${item}`);
  lines.push("");

  lines.push("## 15. Aviso obrigatório");
  lines.push("");
  lines.push(`> ${pack.disclaimer}`);
  lines.push("");

  return lines.join("\n");
}
