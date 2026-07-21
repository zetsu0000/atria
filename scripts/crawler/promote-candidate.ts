#!/usr/bin/env npx tsx
/**
 * Standalone CLI to promote a single, already-persisted prospect_candidate
 * to a clinic by id. This is the missing piece between discovery
 * (scripts/crawler/discover-google-places.ts, which only promotes rows it
 * *just* recorded in the same run) and the crawl/score/report pipeline,
 * which all operate on clinics — there was previously no CLI path to
 * promote an existing candidate row from an earlier discovery run.
 *
 * Thin wrapper around lib/operations/promote-candidate.ts
 * (promoteCandidateToClinic), which already has full test coverage in
 * lib/operations/promote-candidate.test.ts.
 *
 * Usage:
 *   npx tsx scripts/crawler/promote-candidate.ts --dry-run --candidate-id c1
 *   npx tsx scripts/crawler/promote-candidate.ts --target staging --candidate-id c1
 */
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { readLeadCaptureEnv } from "@/lib/security/env";
import { loadDotEnvLocalIfPresent } from "@/lib/operations/pipeline/load-dotenv-local";
import { selectRepositories } from "@/lib/operations/pipeline/select-repositories";
import type { PipelineTarget } from "@/lib/operations/pipeline/target-guard";
import { promoteCandidateToClinic } from "@/lib/operations/promote-candidate";
import { getValue, parseArgs } from "./cli-args";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..", "..");

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  const dryRun = args.flags.has("dry-run");
  const target = getValue(args, "target") as PipelineTarget | undefined;
  const candidateId = getValue(args, "candidate-id");

  if (!candidateId || !candidateId.trim()) {
    console.error("[promote-candidate] REFUSED: --candidate-id is required.");
    process.exit(1);
  }

  loadDotEnvLocalIfPresent(root);
  const env = readLeadCaptureEnv();

  const repoSelection = selectRepositories({ dryRun, target, env });
  if (!repoSelection.ok) {
    console.error(`[promote-candidate] REFUSED: ${repoSelection.reason}`);
    process.exit(1);
  }
  const { discoveryRepo, clinicRepo } = repoSelection.value;

  const result = await promoteCandidateToClinic(candidateId, { discoveryRepo, clinicRepo });

  if (!result.ok) {
    console.error(`[promote-candidate] FAILED: reason=${result.reason} message=${result.message}`);
    process.exit(1);
  }

  console.log(
    JSON.stringify(
      {
        candidateId: result.candidate.id,
        candidateStatus: result.candidate.status,
        clinicId: result.clinic.id,
        clinicDisplayName: result.clinic.displayName,
        clinicWebsiteUrl: result.clinic.websiteUrl,
        clinicStatus: result.clinic.status,
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
