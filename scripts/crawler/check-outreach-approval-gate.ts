#!/usr/bin/env npx tsx
/**
 * Runs the read-only outreach approval gate (lib/operations/outreach/approval-gate.ts)
 * against a specific outreach message and prints the structured result.
 * Never sends anything, never mutates outreach_messages or
 * human_review_decisions — purely a precondition check for a future
 * sender that doesn't exist yet.
 *
 * Usage:
 *   npx tsx scripts/crawler/check-outreach-approval-gate.ts --target staging --clinic-id <id> --outreach-message-id <id>
 *
 * Flags:
 *   --target local|staging       Required. Refused if it (or the resolved
 *                                 SUPABASE_URL) would touch production — see
 *                                 lib/operations/pipeline/target-guard.ts.
 *   --clinic-id <id>             Required.
 *   --outreach-message-id <id>   Required.
 */
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { readLeadCaptureEnv } from "@/lib/security/env";
import { loadDotEnvLocalIfPresent } from "@/lib/operations/pipeline/load-dotenv-local";
import { selectRepositories } from "@/lib/operations/pipeline/select-repositories";
import type { PipelineTarget } from "@/lib/operations/pipeline/target-guard";
import { canPrepareOutreachForSend } from "@/lib/operations/outreach/approval-gate";
import { getValue, parseArgs } from "./cli-args";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..", "..");

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  const target = getValue(args, "target") as PipelineTarget | undefined;
  const clinicId = getValue(args, "clinic-id");
  const outreachMessageId = getValue(args, "outreach-message-id");

  if (!clinicId || !clinicId.trim()) {
    console.error("[check-outreach-approval-gate] REFUSED: --clinic-id is required.");
    process.exit(1);
  }
  if (!outreachMessageId || !outreachMessageId.trim()) {
    console.error("[check-outreach-approval-gate] REFUSED: --outreach-message-id is required.");
    process.exit(1);
  }

  loadDotEnvLocalIfPresent(root);
  const env = readLeadCaptureEnv();

  const repoSelection = selectRepositories({ dryRun: false, target, env });
  if (!repoSelection.ok) {
    console.error(`[check-outreach-approval-gate] REFUSED: ${repoSelection.reason}`);
    process.exit(1);
  }
  const { clinicRepo, outreachRepo, humanReviewRepo } = repoSelection.value;

  const result = await canPrepareOutreachForSend(
    { clinicId, outreachMessageId },
    { clinicRepo, outreachRepo, humanReviewRepo },
  );

  console.log(
    JSON.stringify(
      {
        clinicId,
        outreachMessageId,
        allowed: result.allowed,
        code: result.allowed ? null : result.code,
        reason: result.reason,
        latestDecision: result.decision
          ? {
              id: result.decision.id,
              decision: result.decision.decision,
              reviewer: result.decision.reviewer,
              reviewedAt: result.decision.reviewedAt,
            }
          : null,
        note: "Read-only precondition check. Nothing was sent, approved, or otherwise mutated.",
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
