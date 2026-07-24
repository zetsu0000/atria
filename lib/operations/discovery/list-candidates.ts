/**
 * Lists already-persisted `prospect_candidates` for human review before
 * promotion — read-only, never crawls, never calls an external API
 * (Google Places or otherwise), never scrapes/automates a browser, and
 * never creates, mutates, or promotes anything. Fills the "B. Review
 * candidates" gap called out in
 * docs/operations/crawler-operator-handoff-pack.md (previously "not
 * available yet"). See docs/technical/crawler-candidate-review-cli.md.
 */
import type { DiscoveryRepository } from "@/lib/operations/repositories/discovery-repository";
import type { ClinicRepository } from "@/lib/operations/repositories/clinic-repository";
import type { ClinicRecord, ProspectCandidateRecord, RepoErrorReason } from "@/lib/operations/repositories/types";
import type { DiscoverySourceType } from "@/lib/discovery/types";
import { normalizeWebsiteOrigin } from "@/lib/discovery/normalize";
import { isDirectoryListing } from "@/lib/operations/prioritization/prioritize-prospects";
import { classifyIcp, explainIcpReasonCode, extractGooglePlacesCategoryTypes } from "@/lib/operations/icp-classification/classify-icp";
import type { IcpClassification } from "@/lib/operations/icp-classification/types";
import type {
  CandidateReviewAction,
  CandidateReviewItem,
  CandidateReviewResult,
  CandidateReviewStatusFilter,
} from "./types";

export const DEFAULT_CANDIDATE_REVIEW_LIMIT = 20;

/**
 * Generous over-fetch multiplier: --discovery-job-id/--status/--source/
 * --query are all applied client-side after a single listCandidates()
 * batch. Without a wide enough batch, a specific discovery job's rows
 * could fall outside the fetch window once later, unrelated discovery
 * jobs push them down the created_at-desc ordering.
 */
const FETCH_MULTIPLIER = 25;
const MIN_FETCH_BATCH = 200;

/** How many existing clinics to fetch once for the --include-existing website-origin check. Staging scale today is a handful of clinics — generous headroom either way. */
const CLINIC_FETCH_BATCH = 500;

type ExistingClinicMatch = { clinicId: string; reason: "dedupe_key" | "normalized_website" };

/**
 * Re-normalizes an already-stored origin string through the current
 * (scheme-canonicalizing) normalizeWebsiteOrigin — safe and idempotent
 * even for rows persisted before the fix in
 * docs/technical/crawler-website-dedupe-normalization.md, since it never
 * reads or needs the original raw websiteUrl.
 */
function canonicalOriginKey(storedOrigin: string | null): string | null {
  return normalizeWebsiteOrigin(storedOrigin);
}

function buildClinicOriginIndex(clinics: ClinicRecord[]): Map<string, string> {
  const index = new Map<string, string>();
  for (const clinic of clinics) {
    const key = canonicalOriginKey(clinic.normalizedWebsiteOrigin);
    // First clinic wins on a collision — an intentionally simple,
    // deterministic tie-break; two clinics genuinely sharing one website
    // would be a data anomaly worth a human's attention regardless of
    // which one this surfaces.
    if (key && !index.has(key)) {
      index.set(key, clinic.id);
    }
  }
  return index;
}

export type ListCandidatesForReviewInput = {
  discoveryJobId?: string | null;
  status?: CandidateReviewStatusFilter;
  source?: DiscoverySourceType;
  /** Case-insensitive substring match against rawName. */
  query?: string;
  /**
   * When true, runs one extra read-only dedupe lookup per
   * not-yet-dispositioned candidate to check whether a clinic already
   * exists with the same identity — surfaces stale candidates that were
   * never marked duplicate/promoted at write time. Off by default to keep
   * the common case to a single repository call.
   */
  includeExisting?: boolean;
  /** Restrict output to candidates whose suggestedAction is "promote_candidate". */
  onlyPromotable?: boolean;
  limit?: number;
};

export type ListCandidatesForReviewDeps = {
  discoveryRepo: DiscoveryRepository;
  clinicRepo: ClinicRepository;
};

export type ListCandidatesForReviewResult =
  | { ok: true; result: CandidateReviewResult }
  | { ok: false; reason: RepoErrorReason; message: string };

function extractSourcePlaceId(sourceAttribution: Record<string, unknown>): string | null {
  const value = sourceAttribution.providerPlaceId;
  return typeof value === "string" && value.trim() ? value : null;
}

/**
 * Chooses exactly one suggested action per candidate. Order matters: the
 * first matching rule wins, from most-specific/already-decided to
 * least-specific.
 */
function classifyCandidate(
  candidate: ProspectCandidateRecord,
  existingClinicMatch: ExistingClinicMatch | null,
): { blockers: string[]; suggestedAction: CandidateReviewAction; icp: IcpClassification } {
  const blockers: string[] = [];
  const icp = classifyIcp({
    name: candidate.rawName,
    websiteUrl: candidate.websiteUrl,
    normalizedWebsiteOrigin: candidate.normalizedWebsiteOrigin,
    sourceCategoryTypes: extractGooglePlacesCategoryTypes(candidate.sourceAttribution),
  });

  if (candidate.status === "promoted_to_clinic") {
    blockers.push(`Candidato já promovido para a clínica ${candidate.promotedClinicId ?? "desconhecida"}.`);
    return { blockers, suggestedAction: "skip_duplicate", icp };
  }

  if (candidate.status === "duplicate") {
    blockers.push(`Candidato já marcado como duplicado.${candidate.reviewNotes ? ` Nota: ${candidate.reviewNotes}` : ""}`);
    return { blockers, suggestedAction: "skip_duplicate", icp };
  }

  if (candidate.status === "rejected") {
    blockers.push(`Candidato já rejeitado anteriormente.${candidate.reviewNotes ? ` Nota: ${candidate.reviewNotes}` : ""}`);
    return { blockers, suggestedAction: "blocked_existing", icp };
  }

  if (!candidate.websiteUrl) {
    blockers.push("Nenhum website registrado para este candidato.");
    return { blockers, suggestedAction: "blocked_no_website", icp };
  }

  if (isDirectoryListing(candidate.normalizedWebsiteOrigin)) {
    blockers.push("Website é uma listagem de diretório/agregador de terceiros, não o domínio próprio do candidato.");
    return { blockers, suggestedAction: "blocked_directory", icp };
  }

  if (existingClinicMatch) {
    const blocker =
      existingClinicMatch.reason === "dedupe_key"
        ? `Já existe uma clínica com a mesma identidade (dedupe): ${existingClinicMatch.clinicId}.`
        : `Já existe uma clínica com o mesmo website (normalizado, http/https tratados como o mesmo site): ${existingClinicMatch.clinicId}.`;
    blockers.push(blocker);
    return { blockers, suggestedAction: "blocked_existing", icp };
  }

  // ICP (docs/technical/crawler-icp-classification.md), checked after
  // every duplicate/existing-clinic signal above (those always take
  // priority) but before the generic needs_review/promote fallback.
  // "blocked" here only ever means wrong_audience — a directory listing
  // was already handled above via the identical, shared detector.
  if (icp.icpFit === "blocked" || icp.icpFit === "poor" || icp.icpFit === "future_enterprise") {
    blockers.push(...icp.blockers.map(explainIcpReasonCode));
    return { blockers, suggestedAction: "blocked_icp", icp };
  }
  if (icp.icpFit === "maybe") {
    blockers.push(...icp.blockers.map(explainIcpReasonCode));
    return { blockers, suggestedAction: "manual_review", icp };
  }

  if (candidate.status === "needs_review") {
    return { blockers, suggestedAction: "manual_review", icp };
  }

  return { blockers, suggestedAction: "promote_candidate", icp };
}

export async function listCandidatesForReview(
  input: ListCandidatesForReviewInput,
  deps: ListCandidatesForReviewDeps,
): Promise<ListCandidatesForReviewResult> {
  const limit = input.limit ?? DEFAULT_CANDIDATE_REVIEW_LIMIT;
  const statusFilter = input.status ?? "all";
  const includeExisting = input.includeExisting ?? false;
  const onlyPromotable = input.onlyPromotable ?? false;
  const queryText = input.query?.trim().toLowerCase() || null;

  const fetchLimit = Math.max(limit * FETCH_MULTIPLIER, MIN_FETCH_BATCH);
  const candidatesResult = await deps.discoveryRepo.listCandidates(fetchLimit);
  if (!candidatesResult.ok) {
    return { ok: false, reason: candidatesResult.reason, message: candidatesResult.message };
  }

  // listCandidates() already returns created_at desc — deterministic,
  // newest-first ordering, preserved through every filter below.
  let candidates = candidatesResult.value;

  if (input.discoveryJobId) {
    candidates = candidates.filter((c) => c.discoveryJobId === input.discoveryJobId);
  }
  if (input.source) {
    candidates = candidates.filter((c) => c.sourceType === input.source);
  }
  if (queryText) {
    candidates = candidates.filter((c) => c.rawName.toLowerCase().includes(queryText));
  }
  if (statusFilter !== "all") {
    candidates = candidates.filter((c) => c.status === statusFilter);
  }

  // Fetched once (not per-candidate) so the website-origin check below is a
  // single extra read regardless of how many candidates are being reviewed.
  let clinicOriginIndex: Map<string, string> | null = null;
  if (includeExisting) {
    const clinicsResult = await deps.clinicRepo.listClinics(CLINIC_FETCH_BATCH);
    if (clinicsResult.ok) {
      clinicOriginIndex = buildClinicOriginIndex(clinicsResult.value);
    }
  }

  const items: CandidateReviewItem[] = [];
  for (const candidate of candidates) {
    let existingClinicMatch: ExistingClinicMatch | null = null;
    // Only worth the extra lookup for candidates that aren't already
    // definitively dispositioned — a promoted/duplicate/rejected candidate
    // already carries its own explanation.
    if (
      includeExisting &&
      candidate.status !== "promoted_to_clinic" &&
      candidate.status !== "duplicate" &&
      candidate.status !== "rejected"
    ) {
      // 1. Exact identity match first (same signal promote-candidate.ts
      // uses to link idempotently instead of creating a duplicate clinic —
      // name/phone/email/city/website all agree).
      const clinicMatch = await deps.clinicRepo.findClinicByDedupeKey(candidate.dedupeKey);
      if (clinicMatch.ok && clinicMatch.value) {
        existingClinicMatch = { clinicId: clinicMatch.value.id, reason: "dedupe_key" };
      } else if (clinicOriginIndex) {
        // 2. Fall back to a website-only match (scheme-insensitive) —
        // catches the same real business discovered under a different
        // listing name, e.g. a second Google Places entry for the same
        // clinic. See docs/technical/crawler-website-dedupe-normalization.md.
        const candidateOriginKey = canonicalOriginKey(candidate.normalizedWebsiteOrigin);
        const matchedClinicId = candidateOriginKey ? clinicOriginIndex.get(candidateOriginKey) : undefined;
        if (matchedClinicId) {
          existingClinicMatch = { clinicId: matchedClinicId, reason: "normalized_website" };
        }
      }
    }

    const { blockers, suggestedAction, icp } = classifyCandidate(candidate, existingClinicMatch);

    if (onlyPromotable && suggestedAction !== "promote_candidate") {
      continue;
    }

    items.push({
      candidateId: candidate.id,
      discoveryJobId: candidate.discoveryJobId,
      rawName: candidate.rawName,
      websiteUrl: candidate.websiteUrl,
      normalizedWebsiteOrigin: candidate.normalizedWebsiteOrigin,
      sourceType: candidate.sourceType,
      sourcePlaceId: extractSourcePlaceId(candidate.sourceAttribution),
      city: candidate.city,
      state: candidate.state,
      status: candidate.status,
      promotedClinicId: candidate.promotedClinicId,
      existingClinicId: existingClinicMatch?.clinicId ?? null,
      existingClinicMatchReason: existingClinicMatch?.reason ?? null,
      blockers,
      suggestedAction,
      createdAt: candidate.createdAt,
      organizationType: icp.organizationType,
      icpFit: icp.icpFit,
      decisionComplexity: icp.decisionComplexity,
      icpReasons: icp.reasons,
      icpBlockers: icp.blockers,
    });

    if (items.length >= limit) break;
  }

  return {
    ok: true,
    result: {
      generatedAt: new Date().toISOString(),
      discoveryJobId: input.discoveryJobId ?? null,
      statusFilter,
      sourceFilter: input.source ?? null,
      queryFilter: queryText,
      onlyPromotable,
      includeExisting,
      limit,
      count: items.length,
      items,
    },
  };
}
