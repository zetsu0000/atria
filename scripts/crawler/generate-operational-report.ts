#!/usr/bin/env npx tsx
/**
 * Generates the "Raio-X da Primeira Impressão Digital" operational report
 * for an existing clinic — read-only, never crawls, never calls an
 * external API, never sends anything. Always human-review material.
 *
 * Usage:
 *   npx tsx scripts/crawler/generate-operational-report.ts --target local --clinic-id <id>
 *   npx tsx scripts/crawler/generate-operational-report.ts --target staging --clinic-id <id> --crawl-job-id <id> --output json
 *   npx tsx scripts/crawler/generate-operational-report.ts --target local --clinic-id <id> --allow-incomplete --write-artifact
 *
 * Flags:
 *   --target local|staging  Required. Refused if it (or the resolved
 *                           SUPABASE_URL) would touch production — see
 *                           lib/operations/pipeline/target-guard.ts.
 *   --clinic-id <id>        Required.
 *   --crawl-job-id <id>     Optional — defaults to the clinic's most recent crawl job.
 *   --output markdown|json  Default markdown.
 *   --write-artifact        Also write the report to artifacts/reports/ (gitignored, local only).
 *   --allow-incomplete      Generate an incomplete_report when score is missing, instead of failing.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { readLeadCaptureEnv } from "@/lib/security/env";
import { loadDotEnvLocalIfPresent } from "@/lib/operations/pipeline/load-dotenv-local";
import { selectRepositories } from "@/lib/operations/pipeline/select-repositories";
import type { PipelineTarget } from "@/lib/operations/pipeline/target-guard";
import { buildOperationalReport } from "@/lib/operations/report/build-operational-report";
import { renderOperationalReportMarkdown } from "@/lib/operations/report/render-operational-report-markdown";
import { getValue, parseArgs } from "./cli-args";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..", "..");

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  const target = getValue(args, "target") as PipelineTarget | undefined;
  const clinicId = getValue(args, "clinic-id");
  const crawlJobId = getValue(args, "crawl-job-id");
  const output = (getValue(args, "output", "markdown") as "markdown" | "json")!;
  const writeArtifact = args.flags.has("write-artifact");
  const allowIncomplete = args.flags.has("allow-incomplete");

  if (!clinicId) {
    console.error("[generate-operational-report] --clinic-id is required.");
    process.exit(1);
  }

  loadDotEnvLocalIfPresent(root);
  const env = readLeadCaptureEnv();

  // dryRun is always false here — the report reads existing persisted
  // data, so it needs a real (non-production) target. Production is still
  // refused by selectRepositories/assertSafeTarget regardless.
  const repoSelection = selectRepositories({ dryRun: false, target, env });
  if (!repoSelection.ok) {
    console.error(`[generate-operational-report] REFUSED: ${repoSelection.reason}`);
    process.exit(1);
  }
  const repos = repoSelection.value;

  const result = await buildOperationalReport(
    { clinicId, crawlJobId, allowIncomplete },
    {
      clinicRepo: repos.clinicRepo,
      crawlRepo: repos.crawlRepo,
      extractionRepo: repos.extractionRepo,
      scoreRepo: repos.scoreRepo,
      outreachRepo: repos.outreachRepo,
    },
  );

  if (!result.ok) {
    console.error(`[generate-operational-report] FAILED (${result.reason}): ${result.message}`);
    process.exit(1);
  }

  const rendered = output === "json" ? JSON.stringify(result.report, null, 2) : renderOperationalReportMarkdown(result.report);
  console.log(rendered);

  if (writeArtifact) {
    const outDir = join(root, "artifacts/reports");
    mkdirSync(outDir, { recursive: true });
    const ext = output === "json" ? "json" : "md";
    const outPath = join(outDir, `${clinicId}.${ext}`);
    writeFileSync(outPath, rendered, "utf8");
    console.error(`[generate-operational-report] wrote artifact: ${outPath}`);
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
