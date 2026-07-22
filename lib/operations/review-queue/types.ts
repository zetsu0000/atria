import type { HumanReviewDecisionRecord } from "@/lib/operations/repositories/types";

/**
 * "pending" is never stored — it means no `human_review_decisions` row
 * exists yet for that clinic. The other three are the exact values the
 * `decision` column accepts.
 */
export type ReviewQueueStatus = "pending" | "approved" | "rejected" | "needs_changes";
export type ReviewQueueStatusFilter = ReviewQueueStatus | "all";

export type ReviewQueueItem = {
  clinicId: string;
  displayName: string;
  scoreId: string;
  scoreTotal: number;
  crawlJobId: string | null;
  status: ReviewQueueStatus;
  latestDecision: HumanReviewDecisionRecord | null;
};
