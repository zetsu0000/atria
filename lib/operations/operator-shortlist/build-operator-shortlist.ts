/**
 * Builds a ranked operator shortlist from one discovery job's already-
 * persisted candidates — read-only, never crawls, never calls an
 * external API, never creates, mutates, or promotes anything. Reuses
 * `listCandidatesForReview` (lib/operations/discovery/list-candidates.ts)
 * for every repository call and every classification decision; this
 * module only ranks and relabels what that function already computed —
 * it never re-derives ICP/social/directory/duplicate logic independently.
 *
 * Exists to save an operator from manually reading a raw candidate list,
 * copying IDs by hand, and re-deriving "which one should I promote next"
 * — see docs/technical/crawler-operator-shortlist-cli.md.
 */
import { hostnameOf, isDirectoryListing } from "@/lib/discovery/directory-listing";
import { isSocialProfileWebsite } from "@/lib/discovery/social-profile-website";
import { explainIcpReasonCode } from "@/lib/operations/icp-classification/classify-icp";
import type { ListCandidatesForReviewDeps } from "@/lib/operations/discovery/list-candidates";
import { listCandidatesForReview } from "@/lib/operations/discovery/list-candidates";
import type { CandidateReviewAction, CandidateReviewItem } from "@/lib/operations/discovery/types";
import type { RepoErrorReason } from "@/lib/operations/repositories/types";
import type { OperatorRecommendation, OperatorShortlistItem, OperatorShortlistResult, WebsiteClassification } from "./types";

export const DEFAULT_SHORTLIST_LIMIT = 5;
export const DEFAULT_MAX_CANDIDATES = 20;

/**
 * Known messaging/link-in-bio hostnames — a strict subset of
 * `isSocialProfileWebsite`'s allowlist, split out here purely for the
 * shortlist's more specific display categorization. Never changes
 * ICP/candidate-review behavior — those still treat every hostname in
 * either bucket identically as "not an own domain".
 */
const MESSAGING_LINK_IN_BIO_HOSTS = new Set([
  "wa.me",
  "api.whatsapp.com",
  "chat.whatsapp.com",
  "linktr.ee",
  "beacons.ai",
  "bio.link",
  "linkin.bio",
]);

function classifyWebsite(normalizedWebsiteOrigin: string | null): WebsiteClassification {
  if (!normalizedWebsiteOrigin) return "unknown";
  if (isDirectoryListing(normalizedWebsiteOrigin)) return "directory";
  if (isSocialProfileWebsite(normalizedWebsiteOrigin)) {
    const host = hostnameOf(normalizedWebsiteOrigin);
    if (host && MESSAGING_LINK_IN_BIO_HOSTS.has(host)) return "messaging_link_in_bio";
    return "social_profile";
  }
  const host = hostnameOf(normalizedWebsiteOrigin);
  return host ? "own_website" : "unknown";
}

/**
 * Relabels the already-decided `CandidateReviewAction` into the
 * shortlist's simplified operator vocabulary — never a new decision,
 * only a display mapping. `wrong_audience` is split out from the
 * generic `blocked_icp` bucket for a more specific, actionable label.
 */
function deriveOperatorRecommendation(
  suggestedAction: CandidateReviewAction,
  organizationType: CandidateReviewItem["organizationType"],
): OperatorRecommendation {
  switch (suggestedAction) {
    case "promote_candidate":
      return "promote_next";
    case "manual_review":
      return "manual_review";
    case "skip_duplicate":
    case "blocked_existing":
      return "skip_duplicate";
    case "blocked_directory":
      return "blocked_directory";
    case "blocked_no_website":
    case "blocked_no_own_website":
      return "blocked_no_own_website";
    case "blocked_icp":
      return organizationType === "wrong_audience" ? "blocked_wrong_audience" : "blocked_icp";
  }
}

/**
 * Three-tier conservative scoring, matching the task's own framing:
 * "Highest" (promotable now), "Medium" (needs manual research), and one
 * combined "Low/blocked" tier for every duplicate/blocked reason — the
 * spec explicitly does not require distinguishing severity *within* the
 * blocked tier, so all blocked/duplicate outcomes score identically and
 * ties are broken by the already-deterministic (created_at desc) input
 * order via a stable sort.
 */
function rankScoreFor(recommendation: OperatorRecommendation): number {
  switch (recommendation) {
    case "promote_next":
      return 100;
    case "manual_review":
      return 50;
    default:
      return 0;
  }
}

const ACTIONABLE_RECOMMENDATIONS = new Set<OperatorRecommendation>(["promote_next", "manual_review"]);
const DUPLICATE_RECOMMENDATIONS = new Set<OperatorRecommendation>(["skip_duplicate"]);
const SOCIAL_OR_NO_OWN_WEBSITE_RECOMMENDATIONS = new Set<OperatorRecommendation>(["blocked_no_own_website"]);

export type BuildOperatorShortlistInput = {
  discoveryJobId: string;
  includeExisting?: boolean;
  onlyActionable?: boolean;
  /** How many raw candidates to fetch/consider from this discovery job before ranking. */
  maxCandidates?: number;
  /** How many top-ranked items to include in the final shortlist. */
  limit?: number;
};

export type BuildOperatorShortlistDeps = ListCandidatesForReviewDeps;

export type BuildOperatorShortlistResult =
  | { ok: true; result: OperatorShortlistResult }
  | { ok: false; reason: RepoErrorReason; message: string };

export async function buildOperatorShortlist(
  input: BuildOperatorShortlistInput,
  deps: BuildOperatorShortlistDeps,
): Promise<BuildOperatorShortlistResult> {
  const maxCandidates = input.maxCandidates ?? DEFAULT_MAX_CANDIDATES;
  const limit = input.limit ?? DEFAULT_SHORTLIST_LIMIT;
  const includeExisting = input.includeExisting ?? false;
  const onlyActionable = input.onlyActionable ?? false;

  const reviewResult = await listCandidatesForReview(
    {
      discoveryJobId: input.discoveryJobId,
      includeExisting,
      limit: maxCandidates,
    },
    deps,
  );
  if (!reviewResult.ok) {
    return { ok: false, reason: reviewResult.reason, message: reviewResult.message };
  }

  const reviewed = reviewResult.result.items;

  // Build every shortlist item first (over the full reviewed pool), then
  // rank, then decide what to actually display — so summary counts and
  // the recommended candidate always reflect the *full* pool, independent
  // of --only-actionable/--limit display filtering.
  const allItems: OperatorShortlistItem[] = reviewed.map((item) => {
    const websiteClassification = classifyWebsite(item.normalizedWebsiteOrigin);
    const operatorRecommendation = deriveOperatorRecommendation(item.suggestedAction, item.organizationType);
    return {
      rank: 0, // assigned after sorting, below
      candidateId: item.candidateId,
      rawName: item.rawName,
      websiteUrl: item.websiteUrl,
      city: item.city,
      state: item.state,
      suggestedAction: item.suggestedAction,
      organizationType: item.organizationType,
      icpFit: item.icpFit,
      decisionComplexity: item.decisionComplexity,
      blockers: item.blockers,
      reasons: item.icpReasons.map(explainIcpReasonCode),
      existingClinicId: item.existingClinicId,
      existingClinicMatchReason: item.existingClinicMatchReason,
      websiteClassification,
      operatorRecommendation,
      rankScore: rankScoreFor(operatorRecommendation),
    };
  });

  // Stable sort (guaranteed by the ECMAScript spec since ES2019): ties at
  // the same rankScore keep their original, already-deterministic
  // (created_at desc) relative order — no secondary tie-break key needed.
  const ranked = [...allItems].sort((a, b) => b.rankScore - a.rankScore);
  ranked.forEach((item, index) => {
    item.rank = index + 1;
  });

  const totalReviewed = ranked.length;
  const actionableCount = ranked.filter((i) => ACTIONABLE_RECOMMENDATIONS.has(i.operatorRecommendation)).length;
  const duplicateCount = ranked.filter((i) => DUPLICATE_RECOMMENDATIONS.has(i.operatorRecommendation)).length;
  const socialOrNoOwnWebsiteCount = ranked.filter((i) =>
    SOCIAL_OR_NO_OWN_WEBSITE_RECOMMENDATIONS.has(i.operatorRecommendation),
  ).length;
  const blockedCount = ranked.filter((i) => !ACTIONABLE_RECOMMENDATIONS.has(i.operatorRecommendation)).length;

  const topRecommended = ranked.find((i) => i.operatorRecommendation === "promote_next") ?? null;
  const recommendedCandidateId = topRecommended?.candidateId ?? null;

  let stopReason: string | null = null;
  if (!recommendedCandidateId) {
    stopReason =
      totalReviewed === 0
        ? "Nenhum candidato encontrado para este discovery_job_id."
        : `Nenhum candidato está pronto para promoção nesta leva. Revisados: ${totalReviewed}. Bloqueados/duplicados: ${blockedCount}. Precisam de pesquisa manual: ${totalReviewed - actionableCount - blockedCount + (actionableCount - (ranked.filter((i) => i.operatorRecommendation === "manual_review").length))}. Revise manualmente os candidatos com recomendação "manual_review" antes de prosseguir.`;
  }

  const displayed = onlyActionable ? ranked.filter((i) => ACTIONABLE_RECOMMENDATIONS.has(i.operatorRecommendation)) : ranked;

  return {
    ok: true,
    result: {
      generatedAt: new Date().toISOString(),
      discoveryJobId: input.discoveryJobId,
      statusFilter: reviewResult.result.statusFilter,
      includeExisting,
      onlyActionable,
      maxCandidates,
      limit,
      totalReviewed,
      actionableCount,
      blockedCount,
      duplicateCount,
      socialOrNoOwnWebsiteCount,
      recommendedCandidateId,
      stopReason,
      items: displayed.slice(0, limit),
    },
  };
}
