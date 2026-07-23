/**
 * Pure, deterministic Markdown rendering of a HumanReviewPack — a straight
 * formatting pass over already-computed data, no additional computation,
 * no invented content. Given the same pack object, the output is always
 * identical (stable for tests/diffs).
 */
import type { HumanReviewPack, RiskFlag, ScreenshotSection, SuggestedMessageDraft } from "./types";

function renderScreenshot(label: string, section: ScreenshotSection): string {
  const statusPt: Record<string, string> = {
    captured: "capturado",
    pending_storage: "capturado (upload pendente)",
    capture_failed: "falha na captura",
    storage_failed: "falha no upload",
    missing: "ausente/pendente",
  };
  const lines = [`- **${label}:** ${statusPt[section.status] ?? section.status}`];
  if (section.assetId) lines.push(`  - Asset ID: ${section.assetId}`);
  if (section.storagePath) lines.push(`  - Storage path: ${section.storagePath}`);
  if (section.capturedAt) lines.push(`  - Capturado em: ${section.capturedAt}`);
  return lines.join("\n");
}

function renderRiskFlags(flags: RiskFlag[]): string {
  if (flags.length === 0) return "_Nenhuma flag de risco identificada._";
  return flags.map((f) => `- **[${f.severity}]** \`${f.code}\`: ${f.message}`).join("\n");
}

function renderDraft(label: string, draft: SuggestedMessageDraft): string {
  const lines = [`### ${label}`, ""];
  if (!draft.available) {
    lines.push(`_Indisponível: ${draft.unavailableReason}_`);
    lines.push("");
    return lines.join("\n");
  }
  lines.push(`- **Canal:** ${draft.channel}`);
  lines.push(`- **Status:** ${draft.status} (review_required)`);
  lines.push(`- **Origem:** ${draft.persisted ? `rascunho já persistido (id ${draft.persistedMessageId})` : "gerado nesta execução, não persistido"}`);
  if (draft.subject) lines.push(`- **Assunto:** ${draft.subject}`);
  if (draft.clickToChatUrl) lines.push(`- **Link WhatsApp (click-to-chat):** ${draft.clickToChatUrl}`);
  lines.push("");
  lines.push("```");
  lines.push(draft.body ?? "");
  lines.push("```");
  lines.push("");
  return lines.join("\n");
}

export function renderHumanReviewPackMarkdown(pack: HumanReviewPack): string {
  const lines: string[] = [];

  lines.push(`# Pacote de revisão humana — ${pack.clinicIdentity.displayName}`);
  lines.push("");
  lines.push(`> **Status: ${pack.status}** — aprovação humana obrigatória antes de qualquer contato com a clínica.`);
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

  lines.push("## 1. Resumo interno");
  lines.push("");
  lines.push(pack.internalSummary);
  lines.push("");

  lines.push("## 2. Identidade da clínica e origem");
  lines.push("");
  lines.push(`- **Nome:** ${pack.clinicIdentity.displayName}`);
  lines.push(`- **Clinic ID:** ${pack.clinicIdentity.clinicId}`);
  lines.push(`- **Status:** ${pack.clinicIdentity.status}`);
  lines.push(`- **Cidade/Estado:** ${pack.clinicIdentity.city ?? "—"} / ${pack.clinicIdentity.state ?? "—"}`);
  lines.push(`- **Especialidade:** ${pack.clinicIdentity.specialty ?? "—"}`);
  lines.push(`- **Origem normalizada do site:** ${pack.clinicIdentity.normalizedWebsiteOrigin ?? "—"}`);
  lines.push(`- **Tipo de origem:** ${pack.provenance.sourceType}`);
  lines.push(`- **Dedupe key:** ${pack.provenance.dedupeKey}`);
  lines.push("");

  lines.push("## 3. Website analisado");
  lines.push("");
  if (pack.websiteAnalyzed.crawlJobId) {
    lines.push(`- **Crawl job ID:** ${pack.websiteAnalyzed.crawlJobId}`);
    lines.push(`- **URL solicitada:** ${pack.websiteAnalyzed.requestedUrl}`);
    lines.push(`- **Status do crawl:** ${pack.websiteAnalyzed.crawlStatus}`);
    lines.push(
      `- **Páginas:** ${pack.websiteAnalyzed.pagesFetched ?? 0} obtidas / ${pack.websiteAnalyzed.pagesDiscovered ?? 0} descobertas / ${pack.websiteAnalyzed.pagesFailed ?? 0} com falha`,
    );
    if (pack.websiteAnalyzed.errorCode) {
      lines.push(`- **Código de erro:** \`${pack.websiteAnalyzed.errorCode}\``);
      lines.push(`- **Explicação para o operador:** ${pack.websiteAnalyzed.failureExplanation ?? "—"}`);
      lines.push(`- **Próxima ação sugerida:** ${pack.websiteAnalyzed.suggestedNextAction ?? "—"}`);
    }
  } else {
    lines.push("_Nenhum crawl job encontrado para esta clínica._");
  }
  lines.push("");

  lines.push("## 4. Resumo do score");
  lines.push("");
  if (pack.scoreSummary.available) {
    lines.push(`- **Total:** ${pack.scoreSummary.total}/100`);
    lines.push(`- **Versão de scoring:** ${pack.scoreSummary.scoringVersion}`);
    lines.push("");
    lines.push("| Dimensão | Pontos | Máximo |");
    lines.push("| --- | ---: | ---: |");
    for (const dim of pack.scoreDimensions) {
      lines.push(`| ${dim.labelPt} | ${dim.points ?? "—"} | ${dim.max} |`);
    }
  } else {
    lines.push("_Score indisponível — pacote gerado como `incomplete_review_pack`._");
  }
  lines.push("");

  lines.push("## 5. Screenshots (homepage)");
  lines.push("");
  lines.push(renderScreenshot("Desktop", pack.screenshots.desktop));
  lines.push(renderScreenshot("Mobile", pack.screenshots.mobile));
  lines.push("");

  lines.push("## 6. Principais problemas identificados");
  lines.push("");
  if (pack.keyIssues.length > 0) {
    for (const issue of pack.keyIssues) lines.push(`- ${issue}`);
  } else {
    lines.push("_Nenhum problema abaixo do limite identificado nas dimensões avaliadas._");
  }
  lines.push("");

  lines.push("## 7. Ângulo sugerido para outreach");
  lines.push("");
  lines.push(pack.suggestedOutreachAngle);
  lines.push("");

  lines.push("## 8-9. Rascunhos sugeridos de contato (não enviados)");
  lines.push("");
  lines.push(renderDraft("WhatsApp", pack.suggestedWhatsappDraft));
  lines.push(renderDraft("E-mail", pack.suggestedEmailDraft));

  lines.push("## 10. Checklist de aprovação humana");
  lines.push("");
  for (const item of pack.humanApprovalChecklist) lines.push(`- [ ] ${item}`);
  lines.push("");

  lines.push("## 11. Flags de risco");
  lines.push("");
  lines.push(renderRiskFlags(pack.riskFlags));
  lines.push("");

  lines.push("## 12. Aviso obrigatório");
  lines.push("");
  lines.push(`> ${pack.disclaimer}`);
  lines.push("");

  return lines.join("\n");
}
