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
import type { ProspectCandidateRecord, RepoErrorReason } from "@/lib/operations/repositories/types";
import type { DiscoverySourceType } from "@/lib/discovery/types";
import { isDirectoryListing } from "@/lib/operations/prioritization/prioritize-prospects";
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
  existingClinicId: string | null,
): { blockers: string[]; suggestedAction: CandidateReviewAction } {
  const blockers: string[] = [];

  if (candidate.status === "promoted_to_clinic") {
    blockers.push(`Candidato já promovido para a clínica ${candidate.promotedClinicId ?? "desconhecida"}.`);
    return { blockers, suggestedAction: "skip_duplicate" };
  }

  if (candidate.status === "duplicate") {
    blockers.push(`Candidato já marcado como duplicado.${candidate.reviewNotes ? ` Nota: ${candidate.reviewNotes}` : ""}`);
    return { blockers, suggestedAction: "skip_duplicate" };
  }

  if (candidate.status === "rejected") {
    blockers.push(`Candidato já rejeitado anteriormente.${candidate.reviewNotes ? ` Nota: ${candidate.reviewNotes}` : ""}`);
    return { blockers, suggestedAction: "blocked_existing" };
  }

  if (!candidate.websiteUrl) {
    blockers.push("Nenhum website registrado para este candidato.");
    return { blockers, suggestedAction: "blocked_no_website" };
  }

  if (isDirectoryListing(candidate.normalizedWebsiteOrigin)) {
    blockers.push("Website é uma listagem de diretório/agregador de terceiros, não o domínio próprio do candidato.");
    return { blockers, suggestedAction: "blocked_directory" };
  }

  if (existingClinicId) {
    blockers.push(`Já existe uma clínica com a mesma identidade (dedupe): ${existingClinicId}.`);
    return { blockers, suggestedAction: "blocked_existing" };
  }

  if (candidate.status === "needs_review") {
    return { blockers, suggestedAction: "manual_review" };
  }

  return { blockers, suggestedAction: "promote_candidate" };
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

  const items: CandidateReviewItem[] = [];
  for (const candidate of candidates) {
    let existingClinicId: string | null = null;
    // Only worth the extra lookup for candidates that aren't already
    // definitively dispositioned — a promoted/duplicate/rejected candidate
    // already carries its own explanation.
    if (
      includeExisting &&
      candidate.status !== "promoted_to_clinic" &&
      candidate.status !== "duplicate" &&
      candidate.status !== "rejected"
    ) {
      const clinicMatch = await deps.clinicRepo.findClinicByDedupeKey(candidate.dedupeKey);
      if (clinicMatch.ok && clinicMatch.value) {
        existingClinicId = clinicMatch.value.id;
      }
    }

    const { blockers, suggestedAction } = classifyCandidate(candidate, existingClinicId);

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
      existingClinicId,
      blockers,
      suggestedAction,
      createdAt: candidate.createdAt,
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
