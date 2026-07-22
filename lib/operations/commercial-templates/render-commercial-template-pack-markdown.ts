/**
 * Pure, deterministic Markdown rendering of a CommercialTemplatePack — a
 * straight formatting pass over already-computed data, no additional
 * computation. Given the same pack object, the output is always
 * identical (stable for tests/diffs).
 */
import type { CommercialCopySection, CommercialTemplatePack, RiskFlag } from "./types";

function renderCopySection(label: string, section: CommercialCopySection): string {
  const lines = [`### ${label}`, ""];
  if (!section.available) {
    lines.push(`_Indisponível: ${section.unavailableReason}_`);
    lines.push("");
    return lines.join("\n");
  }
  if (section.subject) lines.push(`- **Assunto:** ${section.subject}`);
  if (section.clickToChatUrl) lines.push(`- **Link WhatsApp (click-to-chat):** ${section.clickToChatUrl}`);
  lines.push("");
  lines.push("```");
  lines.push(section.body);
  lines.push("```");
  lines.push("");
  return lines.join("\n");
}

function renderRiskFlags(flags: RiskFlag[]): string {
  if (flags.length === 0) return "_Nenhuma flag de risco identificada._";
  return flags.map((f) => `- **[${f.severity}]** \`${f.code}\`: ${f.message}`).join("\n");
}

export function renderCommercialTemplatePackMarkdown(pack: CommercialTemplatePack): string {
  const lines: string[] = [];

  lines.push(`# Templates comerciais por prioridade — ${pack.displayName}`);
  lines.push("");
  lines.push(`> **Prioridade: ${pack.priorityTier}** — revisão humana obrigatória; este pacote nunca envia nada.`);
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

  lines.push("## 1-2. Prioridade e resumo do motivo");
  lines.push("");
  lines.push(`- **Tipo:** ${pack.kind === "clinic" ? "Clínica (promovida)" : "Candidato (não promovido)"}`);
  lines.push(`- **ID:** ${pack.id}`);
  lines.push(`- **Prioridade:** ${pack.priorityTier}`);
  lines.push("");
  lines.push(pack.reasonSummary);
  lines.push("");

  lines.push("## 3. Próxima ação recomendada");
  lines.push("");
  lines.push(`${pack.recommendedNextActionLabel} (\`${pack.recommendedNextAction}\`)`);
  lines.push("");

  lines.push("## 4. Checklist do operador");
  lines.push("");
  for (const item of pack.operatorChecklist) lines.push(`- [ ] ${item}`);
  lines.push("");

  lines.push("## 5-6. Copy externa (não enviada)");
  lines.push("");
  lines.push(renderCopySection("WhatsApp", pack.whatsapp));
  lines.push(renderCopySection("E-mail", pack.email));

  if (pack.blockedReason) {
    lines.push("## 7. Motivo do bloqueio (interno)");
    lines.push("");
    lines.push(pack.blockedReason);
    lines.push("");
  }

  lines.push("## 8. Flags de risco");
  lines.push("");
  lines.push(renderRiskFlags(pack.riskFlags));
  lines.push("");

  lines.push("## 9. Aviso obrigatório");
  lines.push("");
  lines.push(`> ${pack.disclaimer}`);
  lines.push("");

  return lines.join("\n");
}
