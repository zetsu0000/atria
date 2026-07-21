#!/usr/bin/env npx tsx
/**
 * Standalone CLI for pipeline steps 1-2: import candidates from a CSV
 * fixture and deduplicate them. Never calls an external API.
 *
 * Usage:
 *   npx tsx scripts/crawler/import-candidates.ts --dry-run
 *   npx tsx scripts/crawler/import-candidates.ts --target local --csv data/examples/prospect-candidates.example.csv
 */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { readLeadCaptureEnv } from "@/lib/security/env";
import { loadDotEnvLocalIfPresent } from "@/lib/operations/pipeline/load-dotenv-local";
import { selectRepositories } from "@/lib/operations/pipeline/select-repositories";
import type { PipelineTarget } from "@/lib/operations/pipeline/target-guard";
import { importCandidatesFromCsv } from "@/lib/operations/pipeline/import-candidates";
import { getIntValue, getValue, parseArgs } from "./cli-args";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..", "..");

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  const dryRun = args.flags.has("dry-run");
  const target = getValue(args, "target") as PipelineTarget | undefined;
  const csvPath = getValue(args, "csv", join(root, "data/examples/prospect-candidates.example.csv"))!;
  const maxCandidates = getIntValue(args, "max-candidates", 5);

  loadDotEnvLocalIfPresent(root);
  const env = readLeadCaptureEnv();

  const repoSelection = selectRepositories({ dryRun, target, env });
  if (!repoSelection.ok) {
    console.error(`[import-candidates] REFUSED: ${repoSelection.reason}`);
    process.exit(1);
  }

  const csvText = readFileSync(csvPath, "utf8");
  const result = await importCandidatesFromCsv(
    { csvText, maxCandidates },
    { discoveryRepo: repoSelection.value.discoveryRepo },
  );

  console.log(
    JSON.stringify(
      {
        discoveryJobId: result.discoveryJobId,
        totalRowsInCsv: result.totalRowsInCsv,
        imported: result.imported.map((c) => ({ id: c.id, rawName: c.rawName, dedupeKey: c.dedupeKey })),
        duplicates: result.duplicates,
        rejectedRows: result.rejectedRows,
        truncatedByMaxCandidates: result.truncatedByMaxCandidates,
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
