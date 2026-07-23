/**
 * Builds a tier-aware commercial template pack for a single clinic or
 * candidate — read-only, never crawls, never calls an external API,
 * never creates, mutates, or sends anything. Reuses the exact same
 * per-item scoring the prospect prioritization layer uses
 * (`prioritizeClinic`/`prioritizeCandidate`,
 * lib/operations/prioritization/prioritize-prospects.ts) so the tier
 * shown here always agrees with `crawler:prioritize-prospects` for the
 * same id — this module never re-derives priority independently.
 *
 * Copy eligibility (whether any WhatsApp/email draft is produced at
 * all) is intentionally stricter than the tier alone:
 *  - Only "high" and "medium" tiers ever produce copy.
 *  - A candidate never produces copy — it has no crawl/score evidence
 *    yet, so there is nothing real to reference (matches
 *    `buildOutreachDraft`'s own "no evidence, no draft" rule elsewhere
 *    in this codebase).
 *  - A clinic with no score at all never produces copy, regardless of
 *    tier — an operator should never see "we reviewed your site" copy
 *    for a site that was never actually reviewed.
 *  - A clinic whose *latest* human review decision is `needs_changes`
 *    never produces copy, even if its numeric tier is otherwise
 *    high/medium — a human explicitly asked for changes, and copy must
 *    not be regenerated as if that request didn't happen. This is a
 *    stricter rule than priority tier alone provides (a needs_changes
 *    clinic isn't always hard-blocked in the tier score itself).
 *  - A directory listing (`facts.isDirectoryListing`) never produces
 *    copy either, checked explicitly rather than relying only on the
 *    tier score — see
 *    docs/technical/crawler-score-prioritization-alignment.md. The tier
 *    scorer already caps a directory listing at "low" via a heavy
 *    penalty, so this is defense-in-depth: a third-party directory page
 *    is never the clinic's real presence, so copy referencing "your
 *    site" must never be generated for one, independent of how the tier
 *    math evolves elsewhere.
 *  - `rejected` and `do_not_contact` are already hard overrides inside
 *    the tier scorer (both force `priorityTier: "blocked"`), so they're
 *    covered by the tier check without any extra logic here.
 */
import type { ClinicRepository } from "@/lib/operations/repositories/clinic-repository";
import type { DiscoveryRepository } from "@/lib/operations/repositories/discovery-repository";
import type { CrawlRepository } from "@/lib/operations/repositories/crawl-repository";
import type { ScoreRepository } from "@/lib/operations/repositories/score-repository";
import type { HumanReviewRepository } from "@/lib/operations/repositories/human-review-repository";
import type { ManualOutreachLogRepository } from "@/lib/operations/repositories/manual-outreach-log-repository";
import type { RepoErrorReason } from "@/lib/operations/repositories/types";
import { prioritizeClinic, prioritizeCandidate } from "@/lib/operations/prioritization/prioritize-prospects";
import type { PrioritizedProspect, PriorityTier, SuggestedNextAction } from "@/lib/operations/prioritization/types";
import { SCORE_DISCLAIMER } from "@/lib/score/calculate";
import type { CommercialCopySection, CommercialTemplatePack, RiskFlag } from "./types";

export type BuildCommercialTemplatePackInput = {
  clinicId?: string;
  candidateId?: string;
  /** Injectable clock, matching prioritizeProspects's own "recently logged" evaluation — for deterministic tests. */
  now?: Date;
};

export type BuildCommercialTemplatePackDeps = {
  clinicRepo: ClinicRepository;
  discoveryRepo: DiscoveryRepository;
  crawlRepo: CrawlRepository;
  scoreRepo: ScoreRepository;
  humanReviewRepo: HumanReviewRepository;
  manualOutreachLogRepo: ManualOutreachLogRepository;
};

export type BuildCommercialTemplatePackResult =
  | { ok: true; pack: CommercialTemplatePack }
  | { ok: false; reason: RepoErrorReason | "validation"; message: string };

const ACTION_LABEL_PT: Record<SuggestedNextAction, string> = {
  review_pack: "Gerar/ler pacote de revisão",
  retry_crawl: "Repetir crawl",
  approve_domain: "Aprovar domínio e rodar crawl",
  skip: "Pular",
  needs_manual_research: "Pesquisa manual necessária",
  ready_for_manual_outreach_review: "Pronta para revisão de outreach manual",
};

function whatsappDigitsFrom(contacts: Array<{ contactType: string; value: string }>): string | null {
  const contact = contacts.find((c) => c.contactType === "whatsapp");
  if (!contact) return null;
  try {
    const url = new URL(contact.value);
    const phone = url.searchParams.get("phone");
    return phone && /^\d{10,15}$/.test(phone) ? phone : null;
  } catch {
    return null;
  }
}

function unavailableCopy(channel: CommercialCopySection["channel"], reason: string): CommercialCopySection {
  return { channel, available: false, unavailableReason: reason };
}

function highTierCopy(channel: CommercialCopySection["channel"], displayName: string, whatsappDigits: string | null): CommercialCopySection {
  if (channel === "whatsapp_manual") {
    const body = [
      "Olá! Aqui é da Atria.",
      `Fizemos uma revisão rápida da presença digital de ${displayName} — é só sobre apresentação do site e facilidade de contato, não avalia qualidade médica.`,
      "Posso te mandar o resumo?",
    ].join("\n");
    let clickToChatUrl: string | null = null;
    if (whatsappDigits) {
      clickToChatUrl = `https://wa.me/${whatsappDigits}?text=${encodeURIComponent(body.slice(0, 500))}`;
    }
    return { channel, available: true, subject: null, body, clickToChatUrl };
  }
  const body = [
    `Olá, equipe da ${displayName},`,
    "",
    "Aqui é da Atria. Preparamos uma revisão rápida da apresentação digital do site de vocês — é só sobre a apresentação do site e a facilidade de encontrar informações, não avalia qualidade médica.",
    "",
    "Podemos te mandar um resumo, se fizer sentido para vocês. Sem compromisso.",
    "",
    "Atenciosamente,",
    "Atria",
  ].join("\n");
  return { channel, available: true, subject: `Prévia digital — ${displayName}`, body, clickToChatUrl: null };
}

function mediumTierCopy(channel: CommercialCopySection["channel"], displayName: string, whatsappDigits: string | null): CommercialCopySection {
  if (channel === "whatsapp_manual") {
    const body = [
      "Olá! Aqui é da Atria.",
      `Notamos alguns pontos na apresentação digital do site da ${displayName}. Você teria interesse em ver uma observação rápida sobre isso? Não avalia qualidade médica — só o site.`,
    ].join("\n");
    let clickToChatUrl: string | null = null;
    if (whatsappDigits) {
      clickToChatUrl = `https://wa.me/${whatsappDigits}?text=${encodeURIComponent(body.slice(0, 500))}`;
    }
    return { channel, available: true, subject: null, body, clickToChatUrl };
  }
  const body = [
    `Olá, equipe da ${displayName},`,
    "",
    "Aqui é da Atria. Trabalhamos com apresentação digital de clínicas e notamos alguns pontos no site de vocês que talvez valham uma olhada.",
    "",
    "Se fizer sentido, posso compartilhar uma observação rápida — sem compromisso. A análise é só sobre o site, não avalia qualidade médica.",
    "",
    "Atenciosamente,",
    "Atria",
  ].join("\n");
  return { channel, available: true, subject: `Observação rápida — ${displayName}`, body, clickToChatUrl: null };
}

function riskFlagsFrom(prioritized: PrioritizedProspect): RiskFlag[] {
  const flags: RiskFlag[] = [];
  const f = prioritized.facts;

  if (f.doNotContact) {
    flags.push({ code: "do_not_contact", severity: "high", message: "Clínica marcada como do_not_contact." });
  }
  if (prioritized.kind === "clinic" && f.latestReviewDecision === "rejected") {
    flags.push({ code: "review_rejected", severity: "high", message: "Última decisão de revisão humana: rejected." });
  }
  if (f.latestReviewDecision === "needs_changes") {
    flags.push({ code: "review_needs_changes", severity: "medium", message: "Última decisão de revisão humana: needs_changes — copy retida até nova revisão." });
  }
  if (f.isDirectoryListing) {
    flags.push({ code: "directory_listing", severity: "high", message: "Website é uma listagem de diretório de terceiros, não o domínio próprio." });
  }
  if (f.latestCrawlErrorCode === "robots_denied") {
    flags.push({ code: "robots_denied", severity: "medium", message: "robots.txt do site bloqueia o crawl (respeitado, sem bypass)." });
  } else if (f.latestCrawlStatus === "failed") {
    flags.push({ code: "crawl_failed", severity: "medium", message: "O crawl mais recente falhou." });
  } else if (f.latestCrawlStatus === "partial") {
    flags.push({ code: "crawl_partial", severity: "info", message: "O crawl mais recente ficou parcial." });
  }
  if (!f.hasScore) {
    flags.push({ code: "missing_score", severity: "info", message: "Nenhum score disponível ainda para este prospect." });
  }
  if (!f.hasPublicContact) {
    flags.push({ code: "missing_contact", severity: "info", message: "Nenhum contato público (telefone/WhatsApp/e-mail) encontrado ainda." });
  }
  if (f.recentlyLogged) {
    flags.push({ code: "recently_contacted", severity: "info", message: "Já contatada manualmente recentemente — evitar contato duplicado." });
  }
  return flags;
}

function operatorChecklistFor(tier: PriorityTier, copyAvailable: boolean): string[] {
  const base = [
    "Nenhuma alegação de qualidade médica presente.",
    "Nenhum depoimento, cliente, prêmio ou credencial inventado.",
    "Nenhum número de score interno presente na copy externa.",
    "Aviso obrigatório presente em qualquer copy externa gerada.",
  ];
  if (!copyAvailable) {
    return [...base, "Nenhuma copy externa foi gerada — não enviar nada manualmente para este prospect agora."];
  }
  if (tier === "high") {
    return [
      ...base,
      "Copy revisada manualmente antes de qualquer contato.",
      "Confirmar que a clínica não está marcada como do_not_contact antes de prosseguir.",
      "Envio permanece manual — este pacote não envia nada.",
    ];
  }
  return [
    ...base,
    "Copy revisada manualmente antes de qualquer contato — tom mais brando, confirmar antes de enviar.",
    "Confirmar que a clínica não está marcada como do_not_contact antes de prosseguir.",
    "Envio permanece manual — este pacote não envia nada.",
  ];
}

function reasonSummaryFor(prioritized: PrioritizedProspect): string {
  const parts: string[] = [`${prioritized.displayName} — prioridade ${prioritized.priorityTier} (score ${prioritized.priorityScore})`];
  if (prioritized.reasons.length > 0) parts.push(`Motivos: ${prioritized.reasons.join(" ")}`);
  if (prioritized.blockers.length > 0) parts.push(`Bloqueios/riscos: ${prioritized.blockers.join(" ")}`);
  return parts.join(" ");
}

export async function buildCommercialTemplatePack(
  input: BuildCommercialTemplatePackInput,
  deps: BuildCommercialTemplatePackDeps,
): Promise<BuildCommercialTemplatePackResult> {
  if (Boolean(input.clinicId) === Boolean(input.candidateId)) {
    return {
      ok: false,
      reason: "validation",
      message: "Exactly one of clinicId or candidateId is required.",
    };
  }
  const now = input.now ?? new Date();
  const warnings: string[] = [];

  let prioritized: PrioritizedProspect;
  let whatsappDigits: string | null = null;

  if (input.clinicId) {
    const clinicResult = await deps.clinicRepo.getClinic(input.clinicId);
    if (!clinicResult.ok) {
      return { ok: false, reason: clinicResult.reason, message: clinicResult.message };
    }
    prioritized = await prioritizeClinic(clinicResult.value, deps, now);

    const contactsResult = await deps.clinicRepo.listContacts(input.clinicId);
    whatsappDigits = contactsResult.ok ? whatsappDigitsFrom(contactsResult.value) : null;
  } else {
    const candidateResult = await deps.discoveryRepo.getCandidate(input.candidateId!);
    if (!candidateResult.ok) {
      return { ok: false, reason: candidateResult.reason, message: candidateResult.message };
    }
    prioritized = prioritizeCandidate(candidateResult.value);
  }

  const isNeedsChanges = prioritized.facts.latestReviewDecision === "needs_changes";
  // Defense-in-depth, on top of the fact that a directory listing is
  // already numerically capped at "low" by prioritizeClinic/
  // prioritizeCandidate's own -60 penalty (see
  // docs/technical/crawler-score-prioritization-alignment.md): a
  // third-party directory page is never the clinic's own presence, so
  // copy must never be generated for one regardless of how the tier math
  // evolves elsewhere.
  const isDirectoryListing = prioritized.facts.isDirectoryListing;

  let whatsapp: CommercialCopySection;
  let email: CommercialCopySection;
  let blockedReason: string | null = null;

  if (prioritized.kind === "candidate") {
    const reason = "Candidato ainda não promovido/crawleado — sem evidências reais para gerar copy.";
    whatsapp = unavailableCopy("whatsapp_manual", reason);
    email = unavailableCopy("email", reason);
    blockedReason = prioritized.priorityTier === "blocked" ? prioritized.blockers.join(" ") || reason : reason;
  } else if (isDirectoryListing) {
    const reason = "Website é uma listagem de diretório de terceiros, não o domínio próprio da clínica — sem evidência real da presença digital dela para gerar copy.";
    whatsapp = unavailableCopy("whatsapp_manual", reason);
    email = unavailableCopy("email", reason);
    blockedReason = reason;
  } else if (prioritized.priorityTier === "blocked") {
    const reason = prioritized.blockers.length > 0 ? prioritized.blockers.join(" ") : "Prioridade bloqueada.";
    whatsapp = unavailableCopy("whatsapp_manual", "Prospect bloqueado — nenhuma copy externa é gerada. Ver blockedReason.");
    email = unavailableCopy("email", "Prospect bloqueado — nenhuma copy externa é gerada. Ver blockedReason.");
    blockedReason = reason;
  } else if (isNeedsChanges) {
    const reason = "Última decisão de revisão humana é needs_changes — revisar antes de qualquer nova copy.";
    whatsapp = unavailableCopy("whatsapp_manual", reason);
    email = unavailableCopy("email", reason);
    blockedReason = reason;
  } else if (prioritized.priorityTier === "low") {
    // Checked before the generic "missing score" guard below: a clinic
    // with no score at all almost always lands in "low" tier, and per
    // the task's own spec this is a soft recommendation ("prioritize
    // manual research"), not a hard block — it must not be reported as
    // blockedReason just because the two conditions usually coincide.
    const reason = "Prioridade baixa — outreach direto não é recomendado por padrão. Priorizar pesquisa manual ou revisita futura.";
    whatsapp = unavailableCopy("whatsapp_manual", reason);
    email = unavailableCopy("email", reason);
    blockedReason = null;
    warnings.push(reason);
  } else if (!prioritized.facts.hasScore) {
    // Only reachable here for "medium" tier without a score — high tier
    // is numerically unreachable without one (see module docstring), and
    // "low"/"blocked" were already handled above.
    const reason = "Nenhum score disponível ainda — sem evidências reais para gerar copy.";
    whatsapp = unavailableCopy("whatsapp_manual", reason);
    email = unavailableCopy("email", reason);
    blockedReason = reason;
  } else if (prioritized.priorityTier === "high") {
    whatsapp = highTierCopy("whatsapp_manual", prioritized.displayName, whatsappDigits);
    email = highTierCopy("email", prioritized.displayName, whatsappDigits);
    if (!whatsappDigits) warnings.push("Nenhum número de WhatsApp público encontrado — link click-to-chat não pôde ser gerado.");
  } else {
    whatsapp = mediumTierCopy("whatsapp_manual", prioritized.displayName, whatsappDigits);
    email = mediumTierCopy("email", prioritized.displayName, whatsappDigits);
    if (!whatsappDigits) warnings.push("Nenhum número de WhatsApp público encontrado — link click-to-chat não pôde ser gerado.");
  }

  const pack: CommercialTemplatePack = {
    reviewRequired: true,
    generatedAt: now.toISOString(),
    disclaimer: SCORE_DISCLAIMER,

    priorityTier: prioritized.priorityTier,
    kind: prioritized.kind,
    id: prioritized.id,
    displayName: prioritized.displayName,

    reasonSummary: reasonSummaryFor(prioritized),

    recommendedNextAction: prioritized.suggestedNextAction,
    recommendedNextActionLabel: ACTION_LABEL_PT[prioritized.suggestedNextAction],

    operatorChecklist: operatorChecklistFor(prioritized.priorityTier, whatsapp.available || email.available),

    whatsapp,
    email,

    blockedReason,
    riskFlags: riskFlagsFrom(prioritized),

    warnings,
  };

  return { ok: true, pack };
}
