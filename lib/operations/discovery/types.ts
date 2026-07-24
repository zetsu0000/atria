import type { CandidateStatus, DiscoverySourceType } from "@/lib/discovery/types";
import type { IcpDecisionComplexity, IcpFit, IcpOrganizationType, IcpReasonCode } from "@/lib/operations/icp-classification/types";

export type CandidateReviewStatusFilter = CandidateStatus | "all";

/**
 * The single suggested next step for a human operator deciding whether to
 * promote a candidate. Exactly one action is chosen per candidate — the
 * first matching rule wins. See lib/operations/discovery/list-candidates.ts
 * (classifyCandidate) for the decision order, and
 * docs/technical/crawler-candidate-review-cli.md for the operator-facing
 * explanation of each value.
 */
export type CandidateReviewAction =
  | "promote_candidate"
  | "skip_duplicate"
  | "manual_review"
  | "blocked_directory"
  | "blocked_no_website"
  | "blocked_existing"
  /** ICP-driven block — hospital/franchise/chain/wrong-audience, or (non-directory) blocked ICP fit. See docs/technical/crawler-icp-classification.md. */
  | "blocked_icp";

export type CandidateReviewItem = {
  candidateId: string;
  discoveryJobId: string | null;
  rawName: string;
  websiteUrl: string | null;
  normalizedWebsiteOrigin: string | null;
  sourceType: DiscoverySourceType;
  /** Only populated for sourceType "google_places", read from sourceAttribution.providerPlaceId. */
  sourcePlaceId: string | null;
  city: string | null;
  state: string | null;
  status: CandidateStatus;
  /** Set when status is "promoted_to_clinic". */
  promotedClinicId: string | null;
  /**
   * Set only when --include-existing was requested and a live check
   * against the clinics table found a different, already-existing clinic
   * that is likely the same real-world business. Never populated for
   * candidates already dispositioned (promoted_to_clinic/duplicate/
   * rejected) — their own status already explains why they're not
   * promotable.
   */
  existingClinicId: string | null;
  /**
   * Explains *why* existingClinicId matched — "dedupe_key" for an exact
   * match (identical name/phone/email/city/website, the same signal
   * promote-candidate.ts uses to link idempotently instead of creating a
   * duplicate clinic), or "normalized_website" when only the website
   * matches (scheme-insensitive: http:// and https:// are the same
   * identity — see docs/technical/crawler-website-dedupe-normalization.md)
   * but the listing name/details differ, e.g. the same clinic discovered
   * under two different Google Places listings. Null when existingClinicId
   * is null.
   */
  existingClinicMatchReason: "dedupe_key" | "normalized_website" | null;
  blockers: string[];
  suggestedAction: CandidateReviewAction;
  createdAt: string;

  /** ICP (Ideal Customer Profile) classification — see docs/technical/crawler-icp-classification.md. Always computed, even for candidates already blocked for another reason (duplicate/no-website/directory), for full operator visibility. */
  organizationType: IcpOrganizationType;
  icpFit: IcpFit;
  decisionComplexity: IcpDecisionComplexity;
  icpReasons: IcpReasonCode[];
  icpBlockers: IcpReasonCode[];
};

export type CandidateReviewResult = {
  generatedAt: string;
  discoveryJobId: string | null;
  statusFilter: CandidateReviewStatusFilter;
  sourceFilter: DiscoverySourceType | null;
  queryFilter: string | null;
  onlyPromotable: boolean;
  includeExisting: boolean;
  limit: number;
  count: number;
  items: CandidateReviewItem[];
};
