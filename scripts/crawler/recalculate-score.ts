#!/usr/bin/env npx tsx
/**
 * Recalculates and persists a fresh score for an existing clinic/crawl job
 * using already-persisted data only — never crawls, never calls an
 * external API, never sends anything. This is the missing piece needed to
 * re-score an existing crawl (e.g. after a scoring-model upgrade like
 * score-v1) without re-crawling the site: `process-crawl-queue.ts
 * --crawl-job-ids` *resumes* a job by re-running the actual crawl loop,
 * which is not what's wanted here.
 *
 * Usage:
 *   npx tsx scripts/crawler/recalculate-score.ts --target staging --clinic-id <id>
 *   npx tsx scripts/crawler/recalculate-score.ts --target staging --clinic-id <id> --crawl-job-id <id>
 *
 * Flags:
 *   --target local|staging  Required. Refused if it (or the resolved
 *                           SUPABASE_URL) would touch production — see
 *                           lib/operations/pipeline/target-guard.ts.
 *   --clinic-id <id>        Required.
 *   --crawl-job-id <id>     Optional — defaults to the clinic's most recent crawl job.
 */
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { readLeadCaptureEnv } from "@/lib/security/env";
import { loadDotEnvLocalIfPresent } from "@/lib/operations/pipeline/load-dotenv-local";
import { selectRepositories } from "@/lib/operations/pipeline/select-repositories";
import type { PipelineTarget } from "@/lib/operations/pipeline/target-guard";
import { calculatePlaceholderScore } from "@/lib/score/calculate";
import { getValue, parseArgs } from "./cli-args";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..", "..");

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  const target = getValue(args, "target") as PipelineTarget | undefined;
  const clinicId = getValue(args, "clinic-id");
  const crawlJobIdArg = getValue(args, "crawl-job-id");

  if (!clinicId || !clinicId.trim()) {
    console.error("[recalculate-score] REFUSED: --clinic-id is required.");
    process.exit(1);
  }

  loadDotEnvLocalIfPresent(root);
  const env = readLeadCaptureEnv();

  const repoSelection = selectRepositories({ dryRun: false, target, env });
  if (!repoSelection.ok) {
    console.error(`[recalculate-score] REFUSED: ${repoSelection.reason}`);
    process.exit(1);
  }
  const { clinicRepo, crawlRepo, extractionRepo, scoreRepo } = repoSelection.value;

  const clinicResult = await clinicRepo.getClinic(clinicId);
  if (!clinicResult.ok) {
    console.error(`[recalculate-score] FAILED (${clinicResult.reason}): ${clinicResult.message}`);
    process.exit(1);
  }

  const crawlJobResult = crawlJobIdArg
    ? await crawlRepo.getCrawlJob(crawlJobIdArg)
    : await crawlRepo.getLatestCrawlJobForClinic(clinicId);
  if (!crawlJobResult.ok) {
    console.error(`[recalculate-score] FAILED (${crawlJobResult.reason}): ${crawlJobResult.message}`);
    process.exit(1);
  }
  const crawlJob = crawlJobResult.value;
  if (!crawlJob) {
    console.error("[recalculate-score] FAILED: no crawl job found for this clinic.");
    process.exit(1);
  }

  const extractionResult = await extractionRepo.getLatestForCrawlJob(crawlJob.id);
  const candidates = extractionResult.ok && extractionResult.value ? extractionResult.value.candidates : [];

  const assetsResult = await crawlRepo.listAssetsForCrawlJob(crawlJob.id);
  const assets = assetsResult.ok ? assetsResult.value : [];
  const desktopAsset = assets.find((a) => a.assetType === "screenshot_desktop");
  const mobileAsset = assets.find((a) => a.assetType === "screenshot_mobile");
  const isUsableCapture = (asset: typeof desktopAsset): boolean => {
    if (!asset) return false;
    const status = typeof asset.metadata.captureStatus === "string" ? asset.metadata.captureStatus : null;
    return status !== "capture_failed";
  };

  const score = calculatePlaceholderScore({
    candidates,
    pageCount: crawlJob.pagesFetched,
    hasDesktopScreenshotMeta: isUsableCapture(desktopAsset),
    hasMobileScreenshotMeta: isUsableCapture(mobileAsset),
    desktopScreenshotAssetId: desktopAsset?.id ?? null,
    mobileScreenshotAssetId: mobileAsset?.id ?? null,
    requestedUrl: crawlJob.requestedUrl,
  });

  const saved = await scoreRepo.saveScore({ crawlJobId: crawlJob.id, clinicId, score });
  if (!saved.ok) {
    console.error(`[recalculate-score] FAILED (${saved.reason}): ${saved.message}`);
    process.exit(1);
  }

  console.log(
    JSON.stringify(
      {
        clinicId,
        crawlJobId: crawlJob.id,
        scoreId: saved.value.id,
        scoringVersion: saved.value.scoringVersion,
        total: saved.value.total,
        dimensions: {
          credibility: saved.value.credibility,
          clarity: saved.value.clarity,
          mobile: saved.value.mobile,
          actionability: saved.value.actionability,
          freshness: saved.value.freshness,
        },
        candidateCount: candidates.length,
        pagesFetched: crawlJob.pagesFetched,
        hasDesktopScreenshot: isUsableCapture(desktopAsset),
        hasMobileScreenshot: isUsableCapture(mobileAsset),
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
