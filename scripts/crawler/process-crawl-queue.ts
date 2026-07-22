#!/usr/bin/env npx tsx
/**
 * Standalone CLI for pipeline steps 4-11: create/resume clinic-centric
 * crawl jobs and run them (bounded pages, extraction, score, optional
 * draft, optional screenshots). Never sends outreach.
 *
 * Usage:
 *   npx tsx scripts/crawler/process-crawl-queue.ts --dry-run --clinic-ids c1,c2
 *   npx tsx scripts/crawler/process-crawl-queue.ts --target local --crawl-job-ids j1,j2
 *   npx tsx scripts/crawler/process-crawl-queue.ts --dry-run --allow-real-crawl --capture-screenshots --clinic-ids c1
 *   npx tsx scripts/crawler/process-crawl-queue.ts --target staging --allow-real-crawl --capture-screenshots \
 *     --approved-domains grupocpd.com.br,www.grupocpd.com.br --clinic-ids c1
 *
 * --approved-domains <d1,d2>  Default none. Explicitly, per-invocation
 *                      extends the real-crawl hostname allowlist (default:
 *                      example.com only) for exactly the listed domains —
 *                      the manual-approval mechanism for a single-clinic
 *                      real-domain rehearsal. Never persisted; no wildcards
 *                      accepted; has no effect on the independent SSRF/
 *                      private-IP guard or the production target-guard —
 *                      see lib/operations/pipeline/controlled-transport.ts.
 *
 * See scripts/crawler/run-controlled-pipeline.ts for the full flag
 * reference — this CLI accepts the same screenshot/target/real-crawl flags.
 */
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { readLeadCaptureEnv, readScreenshotStorageEnv } from "@/lib/security/env";
import { loadDotEnvLocalIfPresent } from "@/lib/operations/pipeline/load-dotenv-local";
import { selectRepositories } from "@/lib/operations/pipeline/select-repositories";
import type { PipelineTarget } from "@/lib/operations/pipeline/target-guard";
import {
  createControlledFetchHtmlPage,
  createControlledLoadRobotsPolicy,
  createControlledLookup,
  isValidApprovedDomainEntry,
} from "@/lib/operations/pipeline/controlled-transport";
import { createSupabaseStorageUploader, type ScreenshotStorageConfig } from "@/lib/operations/pipeline/screenshot-assets";
import { captureScreenshotWithPlaywright } from "@/lib/crawler/screenshot-capture";
import { processCrawlQueue } from "@/lib/operations/pipeline/process-crawl-queue";
import { getIntValue, getListValue, getValue, parseArgs } from "./cli-args";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..", "..");

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  const dryRun = args.flags.has("dry-run");
  const allowRealCrawl = args.flags.has("allow-real-crawl");
  const noOutreachDraft = args.flags.has("no-outreach-draft");
  const captureScreenshots = args.flags.has("capture-screenshots");
  const target = getValue(args, "target") as PipelineTarget | undefined;
  const maxPages = getIntValue(args, "max-pages", 5);
  const clinicIds = getListValue(args, "clinic-ids");
  const crawlJobIds = getListValue(args, "crawl-job-ids");
  const screenshotTimeoutMs = getIntValue(args, "screenshot-timeout-ms", 15000);
  const screenshotStorageBucket = getValue(args, "screenshot-storage-bucket") ?? readScreenshotStorageEnv().screenshotStorageBucket;
  const approvedDomains = getListValue(args, "approved-domains");

  if (clinicIds.length === 0 && crawlJobIds.length === 0) {
    console.error("[process-crawl-queue] Nothing to do: pass --clinic-ids or --crawl-job-ids (comma-separated).");
    process.exit(1);
  }

  if (captureScreenshots && !allowRealCrawl) {
    console.error(
      "[process-crawl-queue] REFUSED: --capture-screenshots requires --allow-real-crawl (screenshots need a real browser navigation to a real, allowlisted page).",
    );
    process.exit(1);
  }

  const invalidApprovedDomain = approvedDomains.find((d) => !isValidApprovedDomainEntry(d));
  if (invalidApprovedDomain) {
    console.error(
      `[process-crawl-queue] REFUSED: --approved-domains contains an invalid entry "${invalidApprovedDomain}" (plain hostnames only — no wildcards, protocols, paths, ports, or IP literals).`,
    );
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

  const screenshotStorage: ScreenshotStorageConfig =
    !dryRun && screenshotStorageBucket
      ? { configured: true, bucketName: screenshotStorageBucket, upload: createSupabaseStorageUploader(env, screenshotStorageBucket) }
      : { configured: false };

  if (approvedDomains.length > 0) {
    console.log(`[process-crawl-queue] approvedDomains=${approvedDomains.join(",")} (extends the default example.com-only allowlist for this run only)`);
  }

  const transportOptions = { allowRealCrawl, approvedRealCrawlHostnames: approvedDomains };
  const deps = {
    ...repos,
    fetchHtmlPage: createControlledFetchHtmlPage(transportOptions),
    loadRobotsPolicy: createControlledLoadRobotsPolicy(transportOptions),
    lookupImpl: createControlledLookup(transportOptions),
    captureScreenshot: captureScreenshots ? captureScreenshotWithPlaywright : undefined,
  };

  const result = await processCrawlQueue(
    {
      clinicIds,
      crawlJobIds,
      maxPages,
      allowRealCrawl,
      createOutreachDraft: !noOutreachDraft,
      captureScreenshots,
      screenshotTimeoutMs,
      screenshotStorage,
      approvedRealCrawlHostnames: approvedDomains,
    },
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
        scoreTotal: p.updatedScore?.total ?? (p.result.ok ? (p.result.score?.total ?? null) : null),
        outreachDraftId: p.deferredOutreachDraftId ?? (p.result.ok ? (p.result.outreachDraft?.id ?? null) : null),
        failureReason: p.result.ok ? null : p.result.reason,
        screenshots: p.screenshots.map((s) => ({
          viewport: s.viewport,
          assetType: s.assetType,
          captureStatus: s.captureStatus,
          storagePath: s.storagePath,
          assetId: s.asset?.id ?? null,
        })),
        screenshotsSkippedReason: p.screenshotsSkippedReason,
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
