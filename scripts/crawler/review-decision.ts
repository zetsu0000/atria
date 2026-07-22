#!/usr/bin/env npx tsx
/**
 * Records a single human review decision for a clinic — approved,
 * rejected, or needs_changes. Append-only: always inserts a new row into
 * human_review_decisions, never updates or deletes a prior one. Never
 * sends anything, never auto-approves, never mutates outreach_messages —
 * all outreach stays status "draft" regardless of the decision recorded.
 *
 * Usage:
 *   npx tsx scripts/crawler/review-decision.ts --target local --clinic-id <id> --decision approved --reviewer "AB" --notes "Looks good."
 *   npx tsx scripts/crawler/review-decision.ts --target staging --clinic-id <id> --crawl-job-id <id> --decision needs_changes --reviewer "AB" --notes "Fix mobile screenshot before resubmitting."
 *
 * Flags:
 *   --target local|staging  Required. Refused if it (or the resolved
 *                           SUPABASE_URL) would touch production — see
 *                           lib/operations/pipeline/target-guard.ts.
 *   --clinic-id <id>        Required.
 *   --crawl-job-id <id>     Optional — defaults to the clinic's most recent crawl job.
 *   --decision approved|rejected|needs_changes  Required.
 *   --notes "<text>"        Optional reviewer notes (max 4000 chars).
 *   --reviewer "<name>"     Optional reviewer name/initials (max 160 chars).
 */
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { readLeadCaptureEnv } from "@/lib/security/env";
import { loadDotEnvLocalIfPresent } from "@/lib/operations/pipeline/load-dotenv-local";
import { selectRepositories } from "@/lib/operations/pipeline/select-repositories";
import type { PipelineTarget } from "@/lib/operations/pipeline/target-guard";
import { recordReviewDecision } from "@/lib/operations/review-queue/record-review-decision";
import { getValue, parseArgs } from "./cli-args";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..", "..");

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  const target = getValue(args, "target") as PipelineTarget | undefined;
  const clinicId = getValue(args, "clinic-id");
  const crawlJobId = getValue(args, "crawl-job-id");
  const decision = getValue(args, "decision");
  const notes = getValue(args, "notes");
  const reviewer = getValue(args, "reviewer");

  if (!clinicId || !clinicId.trim()) {
    console.error("[review-decision] REFUSED: --clinic-id is required.");
    process.exit(1);
  }
  if (!decision || !decision.trim()) {
    console.error("[review-decision] REFUSED: --decision is required (approved|rejected|needs_changes).");
    process.exit(1);
  }

  loadDotEnvLocalIfPresent(root);
  const env = readLeadCaptureEnv();

  const repoSelection = selectRepositories({ dryRun: false, target, env });
  if (!repoSelection.ok) {
    console.error(`[review-decision] REFUSED: ${repoSelection.reason}`);
    process.exit(1);
  }
  const repos = repoSelection.value;

  const result = await recordReviewDecision(
    { clinicId, crawlJobId, decision, reviewerNotes: notes ?? null, reviewer: reviewer ?? null },
    {
      clinicRepo: repos.clinicRepo,
      crawlRepo: repos.crawlRepo,
      scoreRepo: repos.scoreRepo,
      outreachRepo: repos.outreachRepo,
      humanReviewRepo: repos.humanReviewRepo,
    },
  );

  if (!result.ok) {
    console.error(`[review-decision] FAILED (${result.reason}): ${result.message}`);
    process.exit(1);
  }

  console.log(
    JSON.stringify(
      {
        id: result.decision.id,
        clinicId: result.decision.clinicId,
        crawlJobId: result.decision.crawlJobId,
        scoreId: result.decision.scoreId,
        outreachMessageId: result.decision.outreachMessageId,
        decision: result.decision.decision,
        reviewer: result.decision.reviewer,
        reviewedAt: result.decision.reviewedAt,
        note: "Outreach status unchanged — this command never sends anything and never auto-approves outreach.",
      },
      null,
      2,
    ),
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
