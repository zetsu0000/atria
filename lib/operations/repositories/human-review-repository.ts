import type {
  CreateHumanReviewDecisionInput,
  HumanReviewDecisionRecord,
  RepoResult,
} from "./types";

/**
 * Persistence for `human_review_decisions` — an append-only audit log.
 * `recordDecision` always inserts a new row; there is no update/delete
 * method, so a clinic's review history is preserved rather than
 * overwritten. Never sends anything and never touches `outreach_messages`.
 */
export interface HumanReviewRepository {
  recordDecision(
    input: CreateHumanReviewDecisionInput,
  ): Promise<RepoResult<HumanReviewDecisionRecord>>;

  getLatestDecisionForClinic(
    clinicId: string,
  ): Promise<RepoResult<HumanReviewDecisionRecord | null>>;

  listDecisionsForClinic(
    clinicId: string,
  ): Promise<RepoResult<HumanReviewDecisionRecord[]>>;
}
