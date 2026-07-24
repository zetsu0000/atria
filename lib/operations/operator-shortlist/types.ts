/**
 * Structured shape of the operator shortlist — a read-only, ranked view
 * over a single discovery job's already-persisted candidates, built
 * entirely from `listCandidatesForReview`
 * (lib/operations/discovery/list-candidates.ts). Never crawls, never
 * calls an external API, never promotes, never sends anything. See
 * docs/technical/crawler-operator-shortlist-cli.md.
 */
import type {
  CandidateReviewAction,
  CandidateReviewStatusFilter,
} from "@/lib/operations/discovery/types";
import type { IcpDecisionComplexity, IcpFit, IcpOrganizationType } from "@/lib/operations/icp-classification/types";

/**
 * A finer-grained, purely-informational categorization of the primary
 * website_url than the underlying boolean checks — for display only.
 * `isSocialProfileWebsite` (lib/discovery/social-profile-website.ts)
 * still treats "social_profile" and "messaging_link_in_bio" identically
 * for ICP/candidate-review purposes (both are "not an own domain"); this
 * type only exists to show the operator *which kind* at a glance.
 */
export type WebsiteClassification =
  | "own_website"
  | "social_profile"
  | "messaging_link_in_bio"
  | "directory"
  | "unknown";

/**
 * A simplified, operator-facing recommendation vocabulary derived from
 * the candidate review CLI's `CandidateReviewAction` — see
 * `deriveOperatorRecommendation` in build-operator-shortlist.ts for the
 * exact mapping. This module never invents a new decision; it only
 * relabels the existing, already-tested `suggestedAction` for a
 * shortlist-specific display.
 */
export type OperatorRecommendation =
  | "promote_next"
  | "manual_review"
  | "skip_duplicate"
  | "blocked_no_own_website"
  | "blocked_directory"
  | "blocked_icp"
  | "blocked_wrong_audience";

export type OperatorShortlistItem = {
  rank: number;
  candidateId: string;
  rawName: string;
  websiteUrl: string | null;
  city: string | null;
  state: string | null;
  suggestedAction: CandidateReviewAction;
  organizationType: IcpOrganizationType;
  icpFit: IcpFit;
  decisionComplexity: IcpDecisionComplexity;
  /** Human-readable pt-BR blockers — verbatim from CandidateReviewItem.blockers. */
  blockers: string[];
  /** Human-readable pt-BR positive/neutral reasons, derived from icpReasons. */
  reasons: string[];
  existingClinicId: string | null;
  existingClinicMatchReason: "dedupe_key" | "normalized_website" | null;
  websiteClassification: WebsiteClassification;
  operatorRecommendation: OperatorRecommendation;
  /** Internal ranking score — exposed for transparency/determinism, not a public contract beyond "higher is better". */
  rankScore: number;
};

export type OperatorShortlistResult = {
  generatedAt: string;
  discoveryJobId: string;
  statusFilter: CandidateReviewStatusFilter;
  includeExisting: boolean;
  onlyActionable: boolean;
  maxCandidates: number;
  limit: number;

  totalReviewed: number;
  actionableCount: number;
  blockedCount: number;
  duplicateCount: number;
  socialOrNoOwnWebsiteCount: number;

  /** The single top-ranked candidate whose operatorRecommendation is "promote_next", if any exists in the full reviewed pool (independent of --only-actionable/--limit display filtering). */
  recommendedCandidateId: string | null;
  /** Set only when recommendedCandidateId is null — explains why, in pt-BR. */
  stopReason: string | null;

  items: OperatorShortlistItem[];
};
