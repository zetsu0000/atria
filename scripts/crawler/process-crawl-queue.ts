#!/usr/bin/env npx tsx
/**
 * Standalone CLI for pipeline steps 4-11: create/resume clinic-centric
 * crawl jobs and run them (bounded pages, extraction, score, optional
 * draft). Never sends outreach.
 *
 * Usage:
 *   npx tsx scripts/crawler/process-crawl-queue.ts --dry-run --clinic-ids c1,c2
 *   npx tsx scripts/crawler/process-crawl-queue.ts --target local --crawl-job-ids j1,j2
 */
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { readLeadCaptureEnv } from "@/lib/security/env";
import { loadDotEnvLocalIfPresent } from "@/lib/operations/pipeline/load-dotenv-local";
import { selectRepositories } from "@/lib/operations/pipeline/select-repositories";
import type { PipelineTarget } from "@/lib/operations/pipeline/target-guard";
import {
  createControlledFetchHtmlPage,
  createControlledLoadRobotsPolicy,
} from "@/lib/operations/pipeline/controlled-transport";
import { processCrawlQueue } from "@/lib/operations/pipeline/process-crawl-queue";
import { getIntValue, getListValue, getValue, parseArgs } from "./cli-args";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..", "..");

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  const dryRun = args.flags.has("dry-run");
  const allowRealCrawl = args.flags.has("allow-real-crawl");
  const noOutreachDraft = args.flags.has("no-outreach-draft");
  const target = getValue(args, "target") as PipelineTarget | undefined;
  const maxPages = getIntValue(args, "max-pages", 5);
  const clinicIds = getListValue(args, "clinic-ids");
  const crawlJobIds = getListValue(args, "crawl-job-ids");

  if (clinicIds.length === 0 && crawlJobIds.length === 0) {
    console.error("[process-crawl-queue] Nothing to do: pass --clinic-ids or --crawl-job-ids (comma-separated).");
    process.exit(1);
  }

  loadDotEnvLocalIfPresent(root);
  const env = readLeadCaptureEnv();

  const repoSelection = selectRepositories({ dryRun, target, env });
  if (!repoSelection.ok) {
    console.error(`[process-crawl-queue] REFUSED: ${repoSelection.reason}`);
    process.exit(1);
  }
  const repos = repoSelection.value;

  const deps = {
    ...repos,
    fetchHtmlPage: createControlledFetchHtmlPage({ allowRealCrawl }),
    loadRobotsPolicy: createControlledLoadRobotsPolicy({ allowRealCrawl }),
  };

  const result = await processCrawlQueue(
    { clinicIds, crawlJobIds, maxPages, allowRealCrawl, createOutreachDraft: !noOutreachDraft },
    deps,
  );

  console.log(
    JSON.stringify(
      result.processed.map((p) => ({
        clinicId: p.clinicId,
        crawlJobId: p.crawlJobId,
        ok: p.result.ok,
        finalStatus: p.result.ok ? p.result.finalStatus : null,
        pagesFetched: p.result.ok ? p.result.pagesFetched : null,
        scoreTotal: p.result.ok ? (p.result.score?.total ?? null) : null,
        outreachDraftId: p.result.ok ? (p.result.outreachDraft?.id ?? null) : null,
        failureReason: p.result.ok ? null : p.result.reason,
      })),
      null,
      2,
    ),
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
