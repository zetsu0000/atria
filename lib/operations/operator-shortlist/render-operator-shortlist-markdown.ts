/**
 * Pure, deterministic Markdown rendering of an OperatorShortlistResult — a
 * straight formatting pass over already-computed data, no additional
 * computation, no repository access. Given the same result object, the
 * output is always identical (stable for tests/diffs).
 */
import type { OperatorShortlistItem, OperatorShortlistResult, OperatorRecommendation, WebsiteClassification } from "./types";

const RECOMMENDATION_LABEL_PT: Record<OperatorRecommendation, string> = {
  promote_next: "Promover a seguir",
  manual_review: "Pesquisa manual necessária",
  skip_duplicate: "Pular (duplicado/já existente)",
  blocked_no_own_website: "Bloqueado — sem website próprio (perfil social/mensageria)",
  blocked_directory: "Bloqueado — listagem de diretório",
  blocked_icp: "Bloqueado — perfil (ICP) não é foco do MVP",
  blocked_wrong_audience: "Bloqueado — público-alvo incorreto",
};

const WEBSITE_CLASSIFICATION_LABEL_PT: Record<WebsiteClassification, string> = {
  own_website: "Website próprio",
  social_profile: "Perfil social (Instagram/Facebook)",
  messaging_link_in_bio: "Link de mensageria/link-in-bio",
  directory: "Listagem de diretório",
  unknown: "Desconhecido/sem website",
};

/**
 * Real, existing script names/flags only — never invented. See
 * scripts/crawler/promote-candidate.ts and
 * scripts/crawler/process-crawl-queue.ts for the source of truth. The
 * clinic ID isn't known until after promotion, so the crawl command
 * always uses a placeholder, never a real value.
 */
function renderCommandSuggestions(recommendedCandidateId: string | null): string[] {
  const lines: string[] = [];
  lines.push("## Próximos comandos sugeridos");
  lines.push("");
  if (!recommendedCandidateId) {
    lines.push("_Nenhum candidato recomendado nesta leva — nenhum comando sugerido. Veja o motivo de parada acima._");
    return lines;
  }
  lines.push("1. Promover o candidato recomendado:");
  lines.push("");
  lines.push("```bash");
  lines.push("npm run crawler:promote -- \\");
  lines.push("  --target staging \\");
  lines.push(`  --candidate-id ${recommendedCandidateId}`);
  lines.push("```");
  lines.push("");
  lines.push("2. Depois da promoção, rodar o crawl controlado (substitua `<CLINIC_ID>` e `<APPROVED_DOMAIN>` pelos valores reais retornados pela promoção):");
  lines.push("");
  lines.push("```bash");
  lines.push("npm run crawler:queue:process -- \\");
  lines.push("  --target staging \\");
  lines.push("  --clinic-ids <CLINIC_ID> \\");
  lines.push("  --max-pages 3 \\");
  lines.push("  --allow-real-crawl \\");
  lines.push("  --approved-domains <APPROVED_DOMAIN>");
  lines.push("```");
  return lines;
}

function renderItem(item: OperatorShortlistItem): string[] {
  const lines: string[] = [];
  lines.push(`### ${item.rank}. ${item.rawName}`);
  lines.push("");
  lines.push(`- **candidate_id:** ${item.candidateId}`);
  lines.push(`- **website_url:** ${item.websiteUrl ?? "—"}`);
  lines.push(`- **Localização:** ${[item.city, item.state].filter(Boolean).join(", ") || "—"}`);
  lines.push(`- **suggested_action:** ${item.suggestedAction}`);
  lines.push(`- **organization_type:** ${item.organizationType}`);
  lines.push(`- **icp_fit:** ${item.icpFit}`);
  lines.push(`- **decision_complexity:** ${item.decisionComplexity}`);
  lines.push(`- **Classificação do website:** ${WEBSITE_CLASSIFICATION_LABEL_PT[item.websiteClassification]}`);
  lines.push(`- **Recomendação do operador:** ${RECOMMENDATION_LABEL_PT[item.operatorRecommendation]}`);
  if (item.existingClinicId) {
    const matchLabel = item.existingClinicMatchReason === "normalized_website" ? "mesmo website" : "dedupe";
    lines.push(`- **Clínica existente (${matchLabel}):** ${item.existingClinicId}`);
  }
  if (item.blockers.length > 0) {
    lines.push("- **Bloqueios:**");
    for (const blocker of item.blockers) lines.push(`  - ${blocker}`);
  }
  if (item.reasons.length > 0) {
    lines.push("- **Motivos (ICP):**");
    for (const reason of item.reasons) lines.push(`  - ${reason}`);
  }
  lines.push("");
  return lines;
}

export function renderOperatorShortlistMarkdown(result: OperatorShortlistResult): string {
  const lines: string[] = [];

  lines.push("# Shortlist do operador (discovery job)");
  lines.push("");
  lines.push(`> Gerado em: ${result.generatedAt}`);
  lines.push(`> discovery_job_id: ${result.discoveryJobId}`);
  lines.push(
    `> Verificação de duplicidade existente: ${result.includeExisting ? "sim" : "não"} — apenas acionáveis: ${result.onlyActionable ? "sim" : "não"} — max_candidates: ${result.maxCandidates} — limite exibido: ${result.limit}`,
  );
  lines.push("");
  lines.push("## Resumo");
  lines.push("");
  lines.push(`- **Total revisado:** ${result.totalReviewed}`);
  lines.push(`- **Acionáveis (promover ou revisar manualmente):** ${result.actionableCount}`);
  lines.push(`- **Bloqueados:** ${result.blockedCount}`);
  lines.push(`- **Duplicados/já existentes:** ${result.duplicateCount}`);
  lines.push(`- **Sem website próprio (social/mensageria):** ${result.socialOrNoOwnWebsiteCount}`);
  lines.push(`- **Candidato recomendado:** ${result.recommendedCandidateId ?? "nenhum"}`);
  if (result.stopReason) {
    lines.push(`- **Motivo de parada:** ${result.stopReason}`);
  }
  lines.push("");
  lines.push(
    "> Shortlist somente leitura sobre candidatos já persistidos — nunca crawleia, nunca chama API externa (Google Places/SERP ou outra), nunca promove, cria ou envia nada. Ordem determinística (maior pontuação de ranqueamento primeiro).",
  );
  lines.push("");

  if (result.items.length === 0) {
    lines.push("_Nenhum candidato exibido para os filtros solicitados._");
    lines.push("");
  } else {
    lines.push("## Candidatos");
    lines.push("");
    for (const item of result.items) {
      lines.push(...renderItem(item));
    }
  }

  lines.push(...renderCommandSuggestions(result.recommendedCandidateId));
  lines.push("");

  return lines.join("\n");
}
