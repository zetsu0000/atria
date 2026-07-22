/**
 * Lists review-ready clinics (i.e. clinics with at least one score, so a
 * review pack could be built for them) alongside their current review
 * status — "pending" when no human_review_decisions row exists yet for
 * that clinic, otherwise the latest recorded decision. Read-only, never
 * crawls, never calls an external API, never creates or sends anything.
 */
import type { ClinicRepository } from "@/lib/operations/repositories/clinic-repository";
import type { ScoreRepository } from "@/lib/operations/repositories/score-repository";
import type { HumanReviewRepository } from "@/lib/operations/repositories/human-review-repository";
import type { RepoErrorReason } from "@/lib/operations/repositories/types";
import type { ReviewQueueItem, ReviewQueueStatus, ReviewQueueStatusFilter } from "./types";

export const DEFAULT_REVIEW_QUEUE_LIMIT = 20;
// Scores are fetched in a wider batch before per-clinic dedupe/status
// filtering, since multiple scores can belong to the same clinic and some
// may be filtered out by --status.
const SCORE_FETCH_MULTIPLIER = 5;

export type ListReviewQueueInput = {
  status?: ReviewQueueStatusFilter;
  limit?: number;
};

export type ListReviewQueueDeps = {
  clinicRepo: ClinicRepository;
  scoreRepo: ScoreRepository;
  humanReviewRepo: HumanReviewRepository;
};

export type ListReviewQueueResult =
  | { ok: true; items: ReviewQueueItem[] }
  | { ok: false; reason: RepoErrorReason; message: string };

export async function listReviewQueue(
  input: ListReviewQueueInput,
  deps: ListReviewQueueDeps,
): Promise<ListReviewQueueResult> {
  const limit = input.limit ?? DEFAULT_REVIEW_QUEUE_LIMIT;
  const statusFilter = input.status ?? "all";

  const scoresResult = await deps.scoreRepo.listRecent(limit * SCORE_FETCH_MULTIPLIER);
  if (!scoresResult.ok) {
    return { ok: false, reason: scoresResult.reason, message: scoresResult.message };
  }

  const items: ReviewQueueItem[] = [];
  const seenClinicIds = new Set<string>();

  for (const score of scoresResult.value) {
    if (!score.clinicId || seenClinicIds.has(score.clinicId)) continue;
    seenClinicIds.add(score.clinicId);

    const clinicResult = await deps.clinicRepo.getClinic(score.clinicId);
    if (!clinicResult.ok) continue; // clinic gone/unavailable — skip, never fail the whole queue for one bad row

    const decisionResult = await deps.humanReviewRepo.getLatestDecisionForClinic(score.clinicId);
    const latestDecision = decisionResult.ok ? decisionResult.value : null;
    const status: ReviewQueueStatus = latestDecision ? latestDecision.decision : "pending";

    if (statusFilter !== "all" && status !== statusFilter) continue;

    items.push({
      clinicId: score.clinicId,
      displayName: clinicResult.value.displayName,
      scoreId: score.id,
      scoreTotal: score.total,
      crawlJobId: score.crawlJobId,
      status,
      latestDecision,
    });

    if (items.length >= limit) break;
  }

  return { ok: true, items };
}
