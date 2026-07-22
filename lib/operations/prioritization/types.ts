/**
 * Structured shape of the prospect prioritization layer — a read-only
 * ranking over already-persisted data (clinics, prospect_candidates,
 * crawl_jobs, scan_assets, scores, clinic_contacts,
 * human_review_decisions, manual_outreach_logs) so a human operator
 * spends review time on the best targets first. Never crawls, never
 * calls an external API, never creates or sends anything, never mutates
 * a single row anywhere.
 */

export type PriorityTier = "high" | "medium" | "low" | "blocked";

export type SuggestedNextAction =
  | "review_pack"
  | "retry_crawl"
  | "approve_domain"
  | "skip"
  | "needs_manual_research"
  | "ready_for_manual_outreach_review";

export type PrioritizedProspectKind = "candidate" | "clinic";

export type PrioritizedProspect = {
  kind: PrioritizedProspectKind;
  /** clinicId for kind "clinic", candidateId for kind "candidate". */
  id: string;
  displayName: string;
  websiteUrl: string | null;
  normalizedWebsiteOrigin: string | null;

  priorityScore: number;
  priorityTier: PriorityTier;
  reasons: string[];
  blockers: string[];
  suggestedNextAction: SuggestedNextAction;

  /** Supporting facts surfaced for operator visibility — every reason/blocker traces back to one of these. */
  facts: {
    hasOwnWebsite: boolean;
    isDirectoryListing: boolean;
    hasScore: boolean;
    scoreTotal: number | null;
    scoringVersion: string | null;
    latestCrawlStatus: string | null;
    latestCrawlErrorCode: string | null;
    hasScreenshotEvidence: boolean;
    hasPublicContact: boolean;
    latestReviewDecision: string | null;
    doNotContact: boolean;
    recentlyLogged: boolean;
  };
};

export type PrioritizationResult = {
  generatedAt: string;
  tierFilter: PriorityTier | "all";
  limit: number;
  count: number;
  items: PrioritizedProspect[];
};
