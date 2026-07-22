/**
 * Validates and records a single human review decision. This is the only
 * place in the codebase that writes to `human_review_decisions` — it is
 * purely an additive, append-only audit-log insert:
 *
 *  - Never sends anything.
 *  - Never auto-approves — a decision only exists because a human passed
 *    --decision explicitly; there is no code path that infers or defaults
 *    to "approved".
 *  - Never mutates `outreach_messages` in any way (not even on
 *    "approved") — the outreach draft's own status column is a fully
 *    separate concern that this function never touches. All outreach
 *    stays `status: "draft"` regardless of the decision recorded here.
 *
 * score_id / outreach_message_id are auto-linked to whatever currently
 * exists for the clinic (its latest score / latest outreach draft), purely
 * for traceability — the caller never has to look them up manually.
 */
import type { ClinicRepository } from "@/lib/operations/repositories/clinic-repository";
import type { CrawlRepository } from "@/lib/operations/repositories/crawl-repository";
import type { ScoreRepository } from "@/lib/operations/repositories/score-repository";
import type { OutreachRepository } from "@/lib/operations/repositories/outreach-repository";
import type { HumanReviewRepository } from "@/lib/operations/repositories/human-review-repository";
import type { HumanReviewDecision, HumanReviewDecisionRecord, RepoErrorReason } from "@/lib/operations/repositories/types";

export const VALID_HUMAN_REVIEW_DECISIONS: readonly HumanReviewDecision[] = ["approved", "rejected", "needs_changes"];

export function isValidHumanReviewDecision(value: string): value is HumanReviewDecision {
  return (VALID_HUMAN_REVIEW_DECISIONS as readonly string[]).includes(value);
}

export type RecordReviewDecisionInput = {
  clinicId: string;
  crawlJobId?: string;
  /** Deliberately a raw string, not HumanReviewDecision — validated inside, so an invalid CLI value is rejected with a clear reason rather than a type-level crash. */
  decision: string;
  reviewerNotes?: string | null;
  reviewer?: string | null;
};

export type RecordReviewDecisionDeps = {
  clinicRepo: ClinicRepository;
  crawlRepo: CrawlRepository;
  scoreRepo: ScoreRepository;
  outreachRepo: OutreachRepository;
  humanReviewRepo: HumanReviewRepository;
};

export type RecordReviewDecisionResult =
  | { ok: true; decision: HumanReviewDecisionRecord }
  | { ok: false; reason: RepoErrorReason | "invalid_decision"; message: string };

export async function recordReviewDecision(
  input: RecordReviewDecisionInput,
  deps: RecordReviewDecisionDeps,
): Promise<RecordReviewDecisionResult> {
  if (!isValidHumanReviewDecision(input.decision)) {
    return {
      ok: false,
      reason: "invalid_decision",
      message: `Invalid decision "${input.decision}" — must be one of: ${VALID_HUMAN_REVIEW_DECISIONS.join(", ")}.`,
    };
  }

  const clinicResult = await deps.clinicRepo.getClinic(input.clinicId);
  if (!clinicResult.ok) {
    return { ok: false, reason: clinicResult.reason, message: clinicResult.message };
  }

  let crawlJobId: string | null = input.crawlJobId ?? null;
  if (!crawlJobId) {
    const latestCrawl = await deps.crawlRepo.getLatestCrawlJobForClinic(input.clinicId);
    if (latestCrawl.ok && latestCrawl.value) crawlJobId = latestCrawl.value.id;
  }

  const scoreResult = await deps.scoreRepo.getLatestForClinic(input.clinicId);
  const scoreId = scoreResult.ok && scoreResult.value ? scoreResult.value.id : null;

  const outreachResult = await deps.outreachRepo.listForClinic(input.clinicId);
  const outreachMessageId =
    outreachResult.ok && outreachResult.value.length > 0
      ? outreachResult.value.reduce((a, b) => (a.createdAt >= b.createdAt ? a : b)).id
      : null;

  const recorded = await deps.humanReviewRepo.recordDecision({
    clinicId: input.clinicId,
    crawlJobId,
    scoreId,
    outreachMessageId,
    decision: input.decision,
    reviewerNotes: input.reviewerNotes ?? null,
    reviewer: input.reviewer ?? null,
    metadata: {
      scoreTotalAtReview: scoreResult.ok ? (scoreResult.value?.total ?? null) : null,
      clinicStatusAtReview: clinicResult.value.status,
    },
  });
  if (!recorded.ok) {
    return { ok: false, reason: recorded.reason, message: recorded.message };
  }

  return { ok: true, decision: recorded.value };
}
