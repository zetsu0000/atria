#!/usr/bin/env npx tsx
/**
 * Lists the human review queue: review-ready clinics (those with at least
 * one score) alongside their current review status. Read-only, never
 * crawls, never calls an external API, never sends anything.
 *
 * Usage:
 *   npx tsx scripts/crawler/review-queue.ts --target local
 *   npx tsx scripts/crawler/review-queue.ts --target staging --status pending --limit 20
 *
 * Flags:
 *   --target local|staging  Required. Refused if it (or the resolved
 *                           SUPABASE_URL) would touch production — see
 *                           lib/operations/pipeline/target-guard.ts.
 *   --status pending|approved|rejected|needs_changes|all  Default "all".
 *                           "pending" means no decision has been recorded
 *                           yet for that clinic.
 *   --limit <n>             Default 20.
 */
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { readLeadCaptureEnv } from "@/lib/security/env";
import { loadDotEnvLocalIfPresent } from "@/lib/operations/pipeline/load-dotenv-local";
import { selectRepositories } from "@/lib/operations/pipeline/select-repositories";
import type { PipelineTarget } from "@/lib/operations/pipeline/target-guard";
import { listReviewQueue, DEFAULT_REVIEW_QUEUE_LIMIT } from "@/lib/operations/review-queue/list-review-queue";
import type { ReviewQueueStatusFilter } from "@/lib/operations/review-queue/types";
import { getIntValue, getValue, parseArgs } from "./cli-args";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..", "..");

const VALID_STATUS_FILTERS = ["pending", "approved", "rejected", "needs_changes", "all"];

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  const target = getValue(args, "target") as PipelineTarget | undefined;
  const status = getValue(args, "status", "all") as ReviewQueueStatusFilter;
  const limit = getIntValue(args, "limit", DEFAULT_REVIEW_QUEUE_LIMIT);

  if (!VALID_STATUS_FILTERS.includes(status)) {
    console.error(`[review-queue] REFUSED: --status must be one of: ${VALID_STATUS_FILTERS.join(", ")}.`);
    process.exit(1);
  }

  loadDotEnvLocalIfPresent(root);
  const env = readLeadCaptureEnv();

  // dryRun is always false — the queue reads existing persisted data, so
  // it needs a real (non-production) target. Production is still refused
  // by selectRepositories/assertSafeTarget regardless.
  const repoSelection = selectRepositories({ dryRun: false, target, env });
  if (!repoSelection.ok) {
    console.error(`[review-queue] REFUSED: ${repoSelection.reason}`);
    process.exit(1);
  }
  const repos = repoSelection.value;

  const result = await listReviewQueue(
    { status, limit },
    { clinicRepo: repos.clinicRepo, scoreRepo: repos.scoreRepo, humanReviewRepo: repos.humanReviewRepo },
  );

  if (!result.ok) {
    console.error(`[review-queue] FAILED (${result.reason}): ${result.message}`);
    process.exit(1);
  }

  console.log(
    JSON.stringify(
      {
        statusFilter: status,
        limit,
        count: result.items.length,
        items: result.items.map((item) => ({
          clinicId: item.clinicId,
          displayName: item.displayName,
          status: item.status,
          scoreId: item.scoreId,
          scoreTotal: item.scoreTotal,
          crawlJobId: item.crawlJobId,
          latestDecision: item.latestDecision
            ? {
                id: item.latestDecision.id,
                decision: item.latestDecision.decision,
                reviewer: item.latestDecision.reviewer,
                reviewedAt: item.latestDecision.reviewedAt,
              }
            : null,
        })),
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
