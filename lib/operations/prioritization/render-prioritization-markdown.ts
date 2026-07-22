/**
 * Pure, deterministic Markdown rendering of a PrioritizationResult — a
 * straight formatting pass over already-computed data, no additional
 * computation. Given the same result object, the output is always
 * identical (stable for tests/diffs).
 */
import type { PrioritizationResult, PrioritizedProspect } from "./types";

const TIER_LABEL_PT: Record<PrioritizedProspect["priorityTier"], string> = {
  high: "Alta",
  medium: "Média",
  low: "Baixa",
  blocked: "Bloqueada",
};

const ACTION_LABEL_PT: Record<PrioritizedProspect["suggestedNextAction"], string> = {
  review_pack: "Gerar/ler pacote de revisão",
  retry_crawl: "Repetir crawl",
  approve_domain: "Aprovar domínio e rodar crawl",
  skip: "Pular",
  needs_manual_research: "Pesquisa manual necessária",
  ready_for_manual_outreach_review: "Pronta para revisão de outreach manual",
};

function renderItem(item: PrioritizedProspect, index: number): string {
  const lines: string[] = [];
  lines.push(`### ${index + 1}. ${item.displayName}`);
  lines.push("");
  lines.push(`- **Tipo:** ${item.kind === "clinic" ? "Clínica (promovida)" : "Candidato (não promovido)"}`);
  lines.push(`- **ID:** ${item.id}`);
  lines.push(`- **Prioridade:** ${TIER_LABEL_PT[item.priorityTier]} (score ${item.priorityScore})`);
  lines.push(`- **Próxima ação sugerida:** ${ACTION_LABEL_PT[item.suggestedNextAction]}`);
  lines.push(`- **Website:** ${item.websiteUrl ?? "—"}`);
  lines.push("");
  if (item.reasons.length > 0) {
    lines.push("**Motivos:**");
    for (const reason of item.reasons) lines.push(`- ${reason}`);
    lines.push("");
  }
  if (item.blockers.length > 0) {
    lines.push("**Bloqueios/riscos:**");
    for (const blocker of item.blockers) lines.push(`- ${blocker}`);
    lines.push("");
  }
  return lines.join("\n");
}

export function renderPrioritizationMarkdown(result: PrioritizationResult): string {
  const lines: string[] = [];

  lines.push("# Priorização de prospects (candidatos/clínicas)");
  lines.push("");
  lines.push(`> Gerado em: ${result.generatedAt}`);
  lines.push(`> Filtro de prioridade: ${result.tierFilter} — limite: ${result.limit} — total retornado: ${result.count}`);
  lines.push("");
  lines.push(
    "> Ranking somente leitura sobre dados já persistidos — nunca crawleia, nunca chama API externa, nunca cria ou envia nada. Ordem determinística por priority_score decrescente.",
  );
  lines.push("");

  if (result.items.length === 0) {
    lines.push("_Nenhum prospect encontrado para o filtro solicitado._");
    lines.push("");
    return lines.join("\n");
  }

  for (const [index, item] of result.items.entries()) {
    lines.push(renderItem(item, index));
  }

  return lines.join("\n");
}
