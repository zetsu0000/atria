/**
 * Structured shape of the ICP (Ideal Customer Profile) classification
 * layer — a pure, deterministic, no-network heuristic over already-
 * persisted/public evidence (candidate/clinic name, website origin,
 * optional Google Places category types) that flags prospects unlikely to
 * be a good commercial fit for the Atria MVP, even when they look like a
 * "clinic" technically. Never evaluates medical quality, never uses
 * patient data, never calls an LLM or external service. See
 * docs/technical/crawler-icp-classification.md.
 */

export type IcpOrganizationType =
  | "independent_clinic"
  | "solo_practitioner"
  | "franchise_unit"
  | "clinic_chain"
  | "hospital"
  | "directory_listing"
  | "wrong_audience"
  | "unknown";

export type IcpFit = "core" | "maybe" | "poor" | "blocked" | "future_enterprise";

export type IcpDecisionComplexity = "owner_led" | "local_manager" | "corporate" | "unknown";

/**
 * Exact, documented set of reason/blocker codes. A single code can appear
 * in either `reasons` (positive/neutral signal) or `blockers` (negative
 * signal) depending on classification outcome — never both for the same
 * classification. See `explainIcpReasonCode` for the pt-BR text shown to
 * operators.
 */
export type IcpReasonCode =
  | "hospital_or_large_institution"
  | "franchise_or_chain"
  | "directory_listing"
  | "wrong_audience"
  | "no_own_website"
  | "duplicate_existing"
  | "unclear_icp"
  | "likely_core_icp"
  | "needs_manual_review";

export type IcpClassification = {
  organizationType: IcpOrganizationType;
  icpFit: IcpFit;
  decisionComplexity: IcpDecisionComplexity;
  reasons: IcpReasonCode[];
  blockers: IcpReasonCode[];
};
