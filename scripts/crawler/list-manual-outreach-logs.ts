#!/usr/bin/env npx tsx
/**
 * Lists manual outreach log rows for a clinic or a specific outreach
 * message. Read-only, never sends anything, never mutates anything.
 *
 * Usage:
 *   npx tsx scripts/crawler/list-manual-outreach-logs.ts --target staging --clinic-id <id>
 *   npx tsx scripts/crawler/list-manual-outreach-logs.ts --target staging --outreach-message-id <id>
 *
 * Flags:
 *   --target local|staging       Required. Refused if it (or the resolved
 *                                 SUPABASE_URL) would touch production — see
 *                                 lib/operations/pipeline/target-guard.ts.
 *   --clinic-id <id>              Required unless --outreach-message-id is given.
 *   --outreach-message-id <id>   Required unless --clinic-id is given.
 */
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { readLeadCaptureEnv } from "@/lib/security/env";
import { loadDotEnvLocalIfPresent } from "@/lib/operations/pipeline/load-dotenv-local";
import { selectRepositories } from "@/lib/operations/pipeline/select-repositories";
import type { PipelineTarget } from "@/lib/operations/pipeline/target-guard";
import { listManualOutreachLogs } from "@/lib/operations/manual-outreach-logging/list-manual-outreach-logs";
import { getValue, parseArgs } from "./cli-args";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..", "..");

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  const target = getValue(args, "target") as PipelineTarget | undefined;
  const clinicId = getValue(args, "clinic-id");
  const outreachMessageId = getValue(args, "outreach-message-id");

  loadDotEnvLocalIfPresent(root);
  const env = readLeadCaptureEnv();

  const repoSelection = selectRepositories({ dryRun: false, target, env });
  if (!repoSelection.ok) {
    console.error(`[list-manual-outreach-logs] REFUSED: ${repoSelection.reason}`);
    process.exit(1);
  }
  const repos = repoSelection.value;

  const result = await listManualOutreachLogs(
    { clinicId, outreachMessageId },
    { manualOutreachLogRepo: repos.manualOutreachLogRepo },
  );

  if (!result.ok) {
    console.error(`[list-manual-outreach-logs] FAILED (${result.reason}): ${result.message}`);
    process.exit(1);
  }

  console.log(JSON.stringify({ count: result.logs.length, logs: result.logs }, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
