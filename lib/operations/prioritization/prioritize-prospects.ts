/**
 * Ranks already-persisted candidates/clinics for human review — read-only,
 * never crawls, never calls an external API, never creates, mutates, or
 * sends anything. Every input is read via already-existing repository
 * methods (plus the two small, purely-additive `listClinics`/
 * `listCandidates` read methods this task added); nothing is invented.
 *
 * Two kinds of prospects are ranked side by side:
 *  - "clinic": a promoted clinic, scored using its crawl/screenshot/score/
 *    contact/review/outreach-log history.
 *  - "candidate": a not-yet-promoted prospect_candidates row (excluding
 *    ones already "promoted_to_clinic" or "duplicate", which are either
 *    represented via their clinic or not independently actionable). These
 *    never have crawl data, so they always map to `needs_manual_research`.
 *
 * See docs/technical/crawler-prospect-prioritization.md for the full
 * scoring model and rationale.
 */
import type { ClinicRepository } from "@/lib/operations/repositories/clinic-repository";
import type { DiscoveryRepository } from "@/lib/operations/repositories/discovery-repository";
import type { CrawlRepository } from "@/lib/operations/repositories/crawl-repository";
import type { ScoreRepository } from "@/lib/operations/repositories/score-repository";
import type { HumanReviewRepository } from "@/lib/operations/repositories/human-review-repository";
import type { ManualOutreachLogRepository } from "@/lib/operations/repositories/manual-outreach-log-repository";
import type { ClinicRecord, ProspectCandidateRecord } from "@/lib/operations/repositories/types";
import type { PriorityTier, PrioritizedProspect, PrioritizationResult, SuggestedNextAction } from "./types";

export type PrioritizeProspectsInput = {
  limit?: number;
  tier?: PriorityTier | "all";
  /** Injectable clock for deterministic "recently logged" evaluation in tests. Defaults to the real current time. */
  now?: Date;
};

export type PrioritizeProspectsDeps = {
  clinicRepo: ClinicRepository;
  discoveryRepo: DiscoveryRepository;
  crawlRepo: CrawlRepository;
  scoreRepo: ScoreRepository;
  humanReviewRepo: HumanReviewRepository;
  manualOutreachLogRepo: ManualOutreachLogRepository;
};

export const DEFAULT_PRIORITIZATION_LIMIT = 20;
/** How far back a manual_send_logged / response_logged / follow_up_logged / no_response_logged event still counts as "recently contacted". rehearsal_logged never counts — it is explicitly not a real contact. */
const RECENT_CONTACT_WINDOW_DAYS = 30;
const REAL_CONTACT_EVENT_TYPES = new Set(["manual_send_logged", "response_logged", "follow_up_logged", "no_response_logged"]);

/**
 * Small, explicit allowlist of known third-party directory/aggregator
 * domains — not an exhaustive detector, just the same manual judgment
 * call documented in docs/operations/crawler-operator-runbook.md ("is
 * website_url a directory listing, not the clinic's own domain?") made
 * mechanical for a short, known list. Anything not on this list is
 * treated as the prospect's own domain.
 */
const KNOWN_DIRECTORY_LISTING_ORIGINS = [
  "doctoralia.com.br",
  "doctoralia.com",
  "boaconsulta.com",
  "clinicorp.com",
  "guiamedico.com.br",
];

function hostnameOf(originOrUrl: string | null): string | null {
  if (!originOrUrl) return null;
  try {
    return new URL(originOrUrl).hostname.replace(/^www\./, "").toLowerCase();
  } catch {
    return null;
  }
}

/**
 * Exported so other read-only modules (e.g.
 * scripts/crawler/recalculate-score.ts, which needs this exact same
 * signal to pass `isDirectoryListing` into the score calibration —
 * lib/score/calculate.ts) can reuse the identical detector rather than
 * duplicating the domain list in a second place.
 */
export function isDirectoryListing(normalizedWebsiteOrigin: string | null): boolean {
  const host = hostnameOf(normalizedWebsiteOrigin);
  if (!host) return false;
  return KNOWN_DIRECTORY_LISTING_ORIGINS.some((known) => host === known || host.endsWith(`.${known}`));
}

function daysBetween(a: Date, b: Date): number {
  return Math.abs(a.getTime() - b.getTime()) / (1000 * 60 * 60 * 24);
}

function clampTier(score: number): PriorityTier {
  if (score >= 70) return "high";
  if (score >= 40) return "medium";
  if (score >= 15) return "low";
  return "blocked";
}

/**
 * Exported so other read-only modules (e.g. the commercial template
 * builder, lib/operations/commercial-templates/) can score a single,
 * already-fetched clinic/candidate the exact same way this ranking does
 * — without refetching the full list — guaranteeing the tier shown
 * elsewhere always agrees with the tier `prioritizeProspects` itself
 * would produce for that same record.
 */
export async function prioritizeClinic(
  clinic: ClinicRecord,
  deps: PrioritizeProspectsDeps,
  now: Date,
): Promise<PrioritizedProspect> {
  const reasons: string[] = [];
  const blockers: string[] = [];
  // Lower base than the candidate scorer (50) — a clinic earns its way up
  // through real evidence (website, crawl, screenshot, score, contact),
  // rather than starting from a position that a single missing signal
  // (e.g. no screenshot) can't meaningfully move.
  let score = 20;

  const hasOwnWebsite = Boolean(clinic.websiteUrl);
  const directoryListing = isDirectoryListing(clinic.normalizedWebsiteOrigin);
  if (hasOwnWebsite && !directoryListing) {
    score += 10;
    reasons.push("Possui site próprio (não é listagem de diretório de terceiros).");
  } else if (directoryListing) {
    score -= 60;
    blockers.push(`Website é uma listagem de diretório de terceiros (${hostnameOf(clinic.normalizedWebsiteOrigin)}), não o domínio próprio da clínica.`);
  } else {
    score -= 20;
    blockers.push("Nenhum website registrado para esta clínica.");
  }

  const crawlJobResult = await deps.crawlRepo.getLatestCrawlJobForClinic(clinic.id);
  const crawlJob = crawlJobResult.ok ? crawlJobResult.value : null;

  let hasScreenshotEvidence = false;
  if (crawlJob) {
    const assetsResult = await deps.crawlRepo.listAssetsForCrawlJob(crawlJob.id);
    const assets = assetsResult.ok ? assetsResult.value : [];
    hasScreenshotEvidence = assets.some((a) => {
      const status = typeof a.metadata.captureStatus === "string" ? a.metadata.captureStatus : null;
      return status === "captured" || status === "pending_storage";
    });
  }
  if (hasScreenshotEvidence) {
    score += 15;
    reasons.push("Evidência visual (screenshot) já capturada.");
  }

  if (crawlJob && (crawlJob.status === "failed" || crawlJob.status === "partial")) {
    if (crawlJob.errorCode === "robots_denied") {
      if (hasScreenshotEvidence) {
        score -= 15;
        blockers.push("robots.txt bloqueou o crawl (respeitado, sem bypass), mas evidência visual já existe.");
      } else {
        score -= 40;
        blockers.push("robots.txt bloqueou o crawl (respeitado, sem bypass) e não há nenhuma evidência visual alternativa.");
      }
    } else if (crawlJob.status === "failed") {
      if (hasScreenshotEvidence) {
        score -= 10;
        reasons.push("Crawl de conteúdo falhou, mas o site é comprovadamente alcançável — screenshot capturado com sucesso.");
      } else {
        score -= 30;
        blockers.push(`Crawl falhou (${crawlJob.errorCode ?? "erro desconhecido"}) e não há evidência alternativa (sem screenshot).`);
      }
    } else {
      score -= 10;
      blockers.push("Crawl mais recente ficou parcial (limite de páginas ou falhas de busca).");
    }
  }

  const scoreResult = await deps.scoreRepo.getLatestForClinic(clinic.id);
  const clinicScore = scoreResult.ok ? scoreResult.value : null;
  const hasScore = Boolean(clinicScore);
  if (hasScore && clinicScore && clinicScore.total > 0) {
    score += 10;
    reasons.push(`Score digital disponível: ${clinicScore.total}/100 (${clinicScore.scoringVersion}).`);
    if (clinicScore.total >= 30 && clinicScore.total <= 85) {
      score += 10;
      reasons.push("Score na faixa que sugere oportunidade clara de melhoria (site funcional, com espaço real de evolução).");
    } else if (clinicScore.total > 85) {
      score -= 5;
      blockers.push("Score já muito alto — pouco espaço de melhoria para posicionar a oferta.");
    }
  } else if (hasScore && clinicScore) {
    // Calibration v1 (lib/score/calculate.ts) zeroes every dimension for
    // an unreachable site, a robots.txt refusal, or a directory listing —
    // a real, computed 0/100 is not "some evidence available"; it is the
    // same "nothing usable to show" signal as never having scored the
    // clinic at all, so it must not earn the flat score-availability
    // bonus above (previously it did, which could let a robots-denied or
    // directory-listing clinic rank as "medium" priority on a hard zero).
    score -= 15;
    blockers.push(`Score calculado é ${clinicScore.total}/100 (${clinicScore.scoringVersion}) — sem evidência de presença digital utilizável.`);
  } else {
    score -= 15;
    blockers.push("Nenhum score disponível ainda para esta clínica.");
  }

  const contactsResult = await deps.clinicRepo.listContacts(clinic.id);
  const contacts = contactsResult.ok ? contactsResult.value : [];
  const hasPublicContact = contacts.some((c) => c.contactType === "phone" || c.contactType === "whatsapp" || c.contactType === "email");
  if (hasPublicContact) {
    score += 10;
    reasons.push("Contato público (telefone/WhatsApp/e-mail) encontrado.");
  } else {
    blockers.push("Nenhum contato público (telefone/WhatsApp/e-mail) encontrado ainda.");
  }

  const decisionResult = await deps.humanReviewRepo.getLatestDecisionForClinic(clinic.id);
  const latestDecision = decisionResult.ok ? decisionResult.value : null;
  if (latestDecision?.decision === "rejected") {
    score -= 100;
    blockers.push("Última decisão de revisão humana: rejected.");
  } else if (latestDecision?.decision === "needs_changes") {
    score -= 10;
    blockers.push("Última decisão de revisão humana: needs_changes.");
  } else if (latestDecision?.decision === "approved") {
    score += 10;
    reasons.push("Última decisão de revisão humana: approved.");
  }

  if (clinic.doNotContact) {
    score -= 100;
    blockers.push(clinic.doNotContactReason ? `Marcada como do_not_contact: ${clinic.doNotContactReason}` : "Marcada como do_not_contact.");
  }

  const logsResult = await deps.manualOutreachLogRepo.listForClinic(clinic.id);
  const logs = logsResult.ok ? logsResult.value : [];
  const recentlyLogged = logs.some(
    (log) => REAL_CONTACT_EVENT_TYPES.has(log.eventType) && daysBetween(now, new Date(log.occurredAt)) <= RECENT_CONTACT_WINDOW_DAYS,
  );
  if (recentlyLogged) {
    score -= 20;
    blockers.push(`Já contatada manualmente nos últimos ${RECENT_CONTACT_WINDOW_DAYS} dias — evitar contato duplicado.`);
  }

  const hardBlocked = clinic.doNotContact || latestDecision?.decision === "rejected";
  const tier: PriorityTier = hardBlocked ? "blocked" : clampTier(score);

  let suggestedNextAction: SuggestedNextAction;
  if (hardBlocked || directoryListing) {
    suggestedNextAction = "skip";
  } else if (!crawlJob) {
    suggestedNextAction = "approve_domain";
  } else if ((crawlJob.status === "failed" || crawlJob.status === "partial") && !hasScore) {
    suggestedNextAction = "retry_crawl";
  } else if (latestDecision?.decision === "approved") {
    suggestedNextAction = "ready_for_manual_outreach_review";
  } else {
    suggestedNextAction = "review_pack";
  }

  return {
    kind: "clinic",
    id: clinic.id,
    displayName: clinic.displayName,
    websiteUrl: clinic.websiteUrl,
    normalizedWebsiteOrigin: clinic.normalizedWebsiteOrigin,
    priorityScore: score,
    priorityTier: tier,
    reasons,
    blockers,
    suggestedNextAction,
    facts: {
      hasOwnWebsite,
      isDirectoryListing: directoryListing,
      hasScore,
      scoreTotal: clinicScore?.total ?? null,
      scoringVersion: clinicScore?.scoringVersion ?? null,
      latestCrawlStatus: crawlJob?.status ?? null,
      latestCrawlErrorCode: crawlJob?.errorCode ?? null,
      hasScreenshotEvidence,
      hasPublicContact,
      latestReviewDecision: latestDecision?.decision ?? null,
      doNotContact: clinic.doNotContact,
      recentlyLogged,
    },
  };
}

/** Exported for the same reason as prioritizeClinic above. */
export function prioritizeCandidate(candidate: ProspectCandidateRecord): PrioritizedProspect {
  const reasons: string[] = [];
  const blockers: string[] = [];
  let score = 50;

  const hasOwnWebsite = Boolean(candidate.websiteUrl);
  const directoryListing = isDirectoryListing(candidate.normalizedWebsiteOrigin);
  if (hasOwnWebsite && !directoryListing) {
    score += 10;
    reasons.push("Possui website próprio candidato (ainda não crawleado).");
  } else if (directoryListing) {
    score -= 60;
    blockers.push(`Website é uma listagem de diretório de terceiros (${hostnameOf(candidate.normalizedWebsiteOrigin)}), não o domínio próprio.`);
  } else {
    score -= 20;
    blockers.push("Nenhum website encontrado para este candidato.");
  }

  if (candidate.status === "rejected") {
    score -= 100;
    blockers.push("Candidato já marcado como rejected.");
  } else if (candidate.status === "needs_review") {
    score -= 10;
    blockers.push("Candidato sinalizado como needs_review pela fonte de descoberta.");
  }

  const hardBlocked = candidate.status === "rejected";
  const tier: PriorityTier = hardBlocked ? "blocked" : clampTier(score);
  const suggestedNextAction: SuggestedNextAction = hardBlocked || directoryListing ? "skip" : "needs_manual_research";

  return {
    kind: "candidate",
    id: candidate.id,
    displayName: candidate.rawName,
    websiteUrl: candidate.websiteUrl,
    normalizedWebsiteOrigin: candidate.normalizedWebsiteOrigin,
    priorityScore: score,
    priorityTier: tier,
    reasons,
    blockers,
    suggestedNextAction,
    facts: {
      hasOwnWebsite,
      isDirectoryListing: directoryListing,
      hasScore: false,
      scoreTotal: null,
      scoringVersion: null,
      latestCrawlStatus: null,
      latestCrawlErrorCode: null,
      hasScreenshotEvidence: false,
      hasPublicContact: Boolean(candidate.phone || candidate.email),
      latestReviewDecision: null,
      doNotContact: false,
      recentlyLogged: false,
    },
  };
}

/** Candidates already represented elsewhere — a clinic exists for promoted ones, and duplicates aren't independently actionable. */
const NON_ACTIONABLE_CANDIDATE_STATUSES = new Set(["promoted_to_clinic", "duplicate"]);

export async function prioritizeProspects(
  input: PrioritizeProspectsInput,
  deps: PrioritizeProspectsDeps,
): Promise<PrioritizationResult> {
  const limit = input.limit ?? DEFAULT_PRIORITIZATION_LIMIT;
  const tierFilter = input.tier ?? "all";
  const now = input.now ?? new Date();

  const fetchMultiplier = 5;

  const clinicsResult = await deps.clinicRepo.listClinics(limit * fetchMultiplier);
  const clinics = clinicsResult.ok ? clinicsResult.value : [];

  const candidatesResult = await deps.discoveryRepo.listCandidates(limit * fetchMultiplier);
  const candidates = (candidatesResult.ok ? candidatesResult.value : []).filter(
    (c) => !NON_ACTIONABLE_CANDIDATE_STATUSES.has(c.status),
  );

  const clinicItems = await Promise.all(clinics.map((clinic) => prioritizeClinic(clinic, deps, now)));
  const candidateItems = candidates.map(prioritizeCandidate);

  const all = [...clinicItems, ...candidateItems];

  const filtered = tierFilter === "all" ? all : all.filter((item) => item.priorityTier === tierFilter);

  // Deterministic ordering: highest priorityScore first; ties broken by
  // kind (clinic before candidate — clinics have real crawl/score data,
  // so they're the more actionable of an equal-score tie), then by id
  // for full determinism regardless of input iteration order.
  filtered.sort((a, b) => {
    if (b.priorityScore !== a.priorityScore) return b.priorityScore - a.priorityScore;
    if (a.kind !== b.kind) return a.kind === "clinic" ? -1 : 1;
    return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
  });

  const items = filtered.slice(0, limit);

  return {
    generatedAt: now.toISOString(),
    tierFilter,
    limit,
    count: items.length,
    items,
  };
}
