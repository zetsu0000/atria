/**
 * Pure, deterministic Markdown rendering of an OperationalReport — a
 * straight formatting pass over already-computed data, no additional
 * computation, no invented content. Given the same report object, the
 * output is always identical (stable for tests/diffs).
 */
import type { EvidenceEntry, OperationalReport, ScreenshotSection } from "./types";

function renderEvidence(entries: EvidenceEntry[]): string {
  if (entries.length === 0) return "_Sem evidências registradas._";
  return entries
    .map((e) => `- ${e.reason}${e.sourceUrl ? ` ([fonte](${e.sourceUrl}))` : ""} (${e.points} pts)`)
    .join("\n");
}

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

export function renderOperationalReportMarkdown(report: OperationalReport): string {
  const lines: string[] = [];

  lines.push(`# Raio-X da Primeira Impressão Digital — ${report.clinicIdentity.displayName}`);
  lines.push("");
  lines.push(`> **Status: ${report.status}** — revisão humana obrigatória antes de qualquer uso comercial.`);
  lines.push(`> Gerado em: ${report.generatedAt}`);
  lines.push("");
  lines.push(`> ${report.disclaimer}`);
  lines.push("");

  if (report.warnings.length > 0) {
    lines.push("## ⚠ Avisos");
    lines.push("");
    for (const warning of report.warnings) lines.push(`- ${warning}`);
    lines.push("");
  }

  lines.push("## 1. Identidade da clínica");
  lines.push("");
  lines.push(`- **Nome:** ${report.clinicIdentity.displayName}`);
  lines.push(`- **Clinic ID:** ${report.clinicIdentity.clinicId}`);
  lines.push(`- **Status:** ${report.clinicIdentity.status}`);
  lines.push(`- **Cidade/Estado:** ${report.clinicIdentity.city ?? "—"} / ${report.clinicIdentity.state ?? "—"}`);
  lines.push(`- **Especialidade:** ${report.clinicIdentity.specialty ?? "—"}`);
  lines.push(`- **Origem normalizada do site:** ${report.clinicIdentity.normalizedWebsiteOrigin ?? "—"}`);
  lines.push("");

  lines.push("## 2. Origem/proveniência");
  lines.push("");
  lines.push(`- **Tipo de origem:** ${report.provenance.sourceType}`);
  lines.push(`- **Dedupe key:** ${report.provenance.dedupeKey}`);
  lines.push(`- **Lead vinculado:** ${report.provenance.leadId ?? "—"}`);
  lines.push(`- **Atribuição de origem:** \`${JSON.stringify(report.provenance.sourceAttribution)}\``);
  lines.push("");

  lines.push("## 3. Website analisado");
  lines.push("");
  if (report.websiteAnalyzed.crawlJobId) {
    lines.push(`- **Crawl job ID:** ${report.websiteAnalyzed.crawlJobId}`);
    lines.push(`- **URL solicitada:** ${report.websiteAnalyzed.requestedUrl}`);
    lines.push(`- **Origem normalizada:** ${report.websiteAnalyzed.normalizedOrigin}`);
    lines.push(`- **Status do crawl:** ${report.websiteAnalyzed.crawlStatus}`);
    lines.push(
      `- **Páginas:** ${report.websiteAnalyzed.pagesFetched ?? 0} obtidas / ${report.websiteAnalyzed.pagesDiscovered ?? 0} descobertas / ${report.websiteAnalyzed.pagesFailed ?? 0} com falha`,
    );
    lines.push(`- **Início:** ${report.websiteAnalyzed.startedAt ?? "—"} · **Conclusão:** ${report.websiteAnalyzed.completedAt ?? "—"}`);
  } else {
    lines.push("_Nenhum crawl job encontrado para esta clínica._");
  }
  lines.push("");

  lines.push("## 4. Resumo do score");
  lines.push("");
  if (report.scoreSummary.available) {
    lines.push(`- **Total:** ${report.scoreSummary.total}/100`);
    lines.push(`- **Versão de scoring:** ${report.scoreSummary.scoringVersion}`);
    lines.push(`- **Status de revisão:** ${report.scoreSummary.reviewStatus}`);
  } else {
    lines.push("_Score indisponível — relatório gerado como `incomplete_report`._");
  }
  lines.push("");

  lines.push("## 5. Dimensões do score");
  lines.push("");
  lines.push("| Dimensão | Pontos | Máximo |");
  lines.push("| --- | ---: | ---: |");
  for (const dim of report.scoreDimensions) {
    lines.push(`| ${dim.labelPt} | ${dim.points ?? "—"} | ${dim.max} |`);
  }
  lines.push("");

  lines.push("## 6. Evidências por dimensão");
  lines.push("");
  for (const dim of report.scoreDimensions) {
    lines.push(`### ${dim.labelPt}`);
    lines.push("");
    lines.push(renderEvidence(report.evidenceByDimension[dim.key]));
    lines.push("");
  }

  lines.push("## 7. Screenshots (homepage)");
  lines.push("");
  lines.push(renderScreenshot("Desktop", report.screenshots.desktop));
  lines.push(renderScreenshot("Mobile", report.screenshots.mobile));
  lines.push("");

  lines.push("## 8. Resumo de conteúdo/contatos extraídos");
  lines.push("");
  if (report.extractedContentSummary.available) {
    lines.push(`- **Schema version:** ${report.extractedContentSummary.schemaVersion}`);
    lines.push(`- **Requer revisão humana:** ${report.extractedContentSummary.requiresHumanReview ? "sim" : "não"}`);
    lines.push(
      `- **Candidatos por tipo:** ${Object.entries(report.extractedContentSummary.candidateCountsByKind)
        .map(([kind, count]) => `${kind}=${count}`)
        .join(", ") || "—"}`,
    );
    if (report.extractedContentSummary.contacts.length > 0) {
      lines.push("");
      lines.push("| Tipo | Valor | Confiança | Fonte |");
      lines.push("| --- | --- | --- | --- |");
      for (const contact of report.extractedContentSummary.contacts) {
        lines.push(`| ${contact.kind} | ${contact.value} | ${contact.confidence} | ${contact.sourceUrl} |`);
      }
    } else {
      lines.push("- _Nenhum contato candidato extraído._");
    }
  } else {
    lines.push("_Conteúdo extraído indisponível para este crawl job._");
  }
  lines.push("");

  lines.push("## 9. Principais problemas de apresentação digital");
  lines.push("");
  if (report.mainIssues.length > 0) {
    for (const issue of report.mainIssues) lines.push(`- ${issue}`);
  } else {
    lines.push("_Nenhum problema abaixo do limite identificado nas dimensões avaliadas._");
  }
  lines.push("");

  lines.push("## 10. Ângulo de melhoria sugerido");
  lines.push("");
  lines.push(report.suggestedImprovementAngle);
  lines.push("");

  lines.push("## 11. Rascunho de outreach");
  lines.push("");
  if (report.outreachDraft.available) {
    lines.push(`- **Canal:** ${report.outreachDraft.channel}`);
    lines.push(`- **Status:** ${report.outreachDraft.status}`);
    if (report.outreachDraft.subject) lines.push(`- **Assunto:** ${report.outreachDraft.subject}`);
    if (report.outreachDraft.clickToChatUrl) lines.push(`- **Link WhatsApp (click-to-chat):** ${report.outreachDraft.clickToChatUrl}`);
    lines.push("");
    lines.push("```");
    lines.push(report.outreachDraft.body ?? "");
    lines.push("```");
  } else {
    lines.push("_Nenhum rascunho de outreach encontrado para esta clínica._");
  }
  lines.push("");

  lines.push("## 12. Checklist de revisão humana");
  lines.push("");
  for (const item of report.humanReviewChecklist) lines.push(`- [ ] ${item}`);
  lines.push("");

  lines.push("## 13. Aviso obrigatório");
  lines.push("");
  lines.push(`> ${report.disclaimer}`);
  lines.push("");

  return lines.join("\n");
}
