/**
 * Pure, deterministic Markdown rendering of a CandidateReviewResult — a
 * straight formatting pass over already-computed data, no additional
 * computation. Given the same result object, the output is always
 * identical (stable for tests/diffs).
 */
import type { CandidateReviewItem, CandidateReviewResult } from "./types";

const ACTION_LABEL_PT: Record<CandidateReviewItem["suggestedAction"], string> = {
  promote_candidate: "Promover candidato",
  skip_duplicate: "Pular (duplicado/já promovido)",
  manual_review: "Pesquisa manual necessária",
  blocked_directory: "Bloqueado — listagem de diretório",
  blocked_no_website: "Bloqueado — sem website",
  blocked_existing: "Bloqueado — já existe no sistema",
};

function renderItem(item: CandidateReviewItem, index: number): string {
  const lines: string[] = [];
  lines.push(`### ${index + 1}. ${item.rawName}`);
  lines.push("");
  lines.push(`- **ID:** ${item.candidateId}`);
  lines.push(`- **Discovery job:** ${item.discoveryJobId ?? "—"}`);
  lines.push(`- **Status:** ${item.status}`);
  lines.push(`- **Ação sugerida:** ${ACTION_LABEL_PT[item.suggestedAction]}`);
  lines.push(`- **Website:** ${item.websiteUrl ?? "—"}`);
  lines.push(`- **Origem:** ${item.sourceType}${item.sourcePlaceId ? ` (place_id: ${item.sourcePlaceId})` : ""}`);
  lines.push(`- **Localização:** ${[item.city, item.state].filter(Boolean).join(", ") || "—"}`);
  if (item.promotedClinicId) lines.push(`- **Clínica promovida:** ${item.promotedClinicId}`);
  if (item.existingClinicId) lines.push(`- **Clínica existente (dedupe):** ${item.existingClinicId}`);
  lines.push("");
  if (item.blockers.length > 0) {
    lines.push("**Bloqueios:**");
    for (const blocker of item.blockers) lines.push(`- ${blocker}`);
    lines.push("");
  }
  return lines.join("\n");
}

export function renderCandidateListMarkdown(result: CandidateReviewResult): string {
  const lines: string[] = [];

  lines.push("# Revisão de candidatos (prospect_candidates)");
  lines.push("");
  lines.push(`> Gerado em: ${result.generatedAt}`);
  lines.push(
    `> discovery_job_id: ${result.discoveryJobId ?? "todos"} — status: ${result.statusFilter} — origem: ${result.sourceFilter ?? "todas"} — busca: ${result.queryFilter ?? "—"}`,
  );
  lines.push(`> Apenas promovíveis: ${result.onlyPromotable ? "sim" : "não"} — verificação de duplicidade existente: ${result.includeExisting ? "sim" : "não"}`);
  lines.push(`> Limite: ${result.limit} — total retornado: ${result.count}`);
  lines.push("");
  lines.push(
    "> Listagem somente leitura sobre dados já persistidos — nunca crawleia, nunca chama API externa (Google Places ou outra), nunca promove, cria ou envia nada. Ordem determinística por created_at decrescente.",
  );
  lines.push("");

  if (result.items.length === 0) {
    lines.push("_Nenhum candidato encontrado para o filtro solicitado._");
    lines.push("");
    return lines.join("\n");
  }

  for (const [index, item] of result.items.entries()) {
    lines.push(renderItem(item, index));
  }

  return lines.join("\n");
}
