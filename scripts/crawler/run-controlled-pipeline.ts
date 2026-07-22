#!/usr/bin/env npx tsx
/**
 * Controlled automation pipeline CLI — import → dedupe → promote → crawl →
 * extract → score → draft, never send.
 *
 * Usage:
 *   npx tsx scripts/crawler/run-controlled-pipeline.ts --dry-run
 *   npx tsx scripts/crawler/run-controlled-pipeline.ts --target local
 *   npx tsx scripts/crawler/run-controlled-pipeline.ts --target staging --allow-real-crawl
 *   npx tsx scripts/crawler/run-controlled-pipeline.ts --dry-run --allow-real-crawl --capture-screenshots
 *
 * Flags:
 *   --dry-run              Use in-memory fakes only. No Supabase, no --target needed.
 *   --target local|staging Required unless --dry-run. Refused if it (or the
 *                          resolved SUPABASE_URL) would touch production —
 *                          see lib/operations/pipeline/target-guard.ts.
 *   --csv <path>           Defaults to data/examples/prospect-candidates.example.csv
 *   --max-candidates <n>   Default 5.
 *   --max-pages <n>        Default 5.
 *   --allow-real-crawl     Without this, every fetch is served from an
 *                          in-memory fixture — no network call is made.
 *                          With it, only example.com (+ subdomains) may
 *                          actually be requested (lib/operations/pipeline/controlled-transport.ts).
 *   --no-outreach-draft    Skip building an outreach draft (default: build one).
 *   --capture-screenshots  Capture homepage desktop+mobile screenshots.
 *                          REQUIRES --allow-real-crawl — refused otherwise.
 *   --screenshot-timeout-ms <n>   Default 15000.
 *   --screenshot-storage-bucket <name>  Upload to this private Supabase
 *                          Storage bucket (must already exist — never
 *                          created or made public by this pipeline).
 *                          Defaults to the SCREENSHOT_STORAGE_BUCKET env
 *                          var when this flag is omitted. Without either,
 *                          screenshot metadata is persisted with status
 *                          "pending_storage" and no storage upload is
 *                          attempted — never fails the pipeline.
 *   --approved-domains <d1,d2>  Default none. Explicitly, per-invocation
 *                          extends the real-crawl hostname allowlist beyond
 *                          example.com for exactly the listed domains — see
 *                          lib/operations/pipeline/controlled-transport.ts.
 *                          Never persisted; no wildcards; independent of
 *                          the SSRF/private-IP guard and production refusal.
 *
 * This pipeline never sends outreach — it only ever creates a
 * `draft`-status row. Sending requires a separate, explicitly
 * human-approved channel that does not exist in this codebase.
 */
import { readFileSync } from "node:fs";
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
import { runControlledPipeline } from "@/lib/operations/pipeline/run-controlled-pipeline";
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
  const csvPath = getValue(args, "csv", join(root, "data/examples/prospect-candidates.example.csv"))!;
  const maxCandidates = getIntValue(args, "max-candidates", 5);
  const maxPages = getIntValue(args, "max-pages", 5);
  const screenshotTimeoutMs = getIntValue(args, "screenshot-timeout-ms", 15000);
  const screenshotStorageBucket = getValue(args, "screenshot-storage-bucket") ?? readScreenshotStorageEnv().screenshotStorageBucket;
  const approvedDomains = getListValue(args, "approved-domains");

  if (captureScreenshots && !allowRealCrawl) {
    console.error(
      "[controlled-pipeline] REFUSED: --capture-screenshots requires --allow-real-crawl (screenshots need a real browser navigation to a real, allowlisted page).",
    );
    process.exit(1);
  }

  const invalidApprovedDomain = approvedDomains.find((d) => !isValidApprovedDomainEntry(d));
  if (invalidApprovedDomain) {
    console.error(
      `[controlled-pipeline] REFUSED: --approved-domains contains an invalid entry "${invalidApprovedDomain}" (plain hostnames only — no wildcards, protocols, paths, ports, or IP literals).`,
    );
    process.exit(1);
  }

  loadDotEnvLocalIfPresent(root);
  const env = readLeadCaptureEnv();

  const repoSelection = selectRepositories({ dryRun, target, env });
  if (!repoSelection.ok) {
    console.error(`[controlled-pipeline] REFUSED: ${repoSelection.reason}`);
    process.exit(1);
  }
  const repos = repoSelection.value;

  console.log(
    `[controlled-pipeline] mode=${dryRun ? "dry-run" : `target=${target}`} allowRealCrawl=${allowRealCrawl} captureScreenshots=${captureScreenshots} maxCandidates=${maxCandidates} maxPages=${maxPages} csv=${csvPath}`,
  );

  const csvText = readFileSync(csvPath, "utf8");

  const screenshotStorage: ScreenshotStorageConfig =
    !dryRun && screenshotStorageBucket
      ? { configured: true, bucketName: screenshotStorageBucket, upload: createSupabaseStorageUploader(env, screenshotStorageBucket) }
      : { configured: false };

  if (approvedDomains.length > 0) {
    console.log(`[controlled-pipeline] approvedDomains=${approvedDomains.join(",")} (extends the default example.com-only allowlist for this run only)`);
  }

  const transportOptions = { allowRealCrawl, approvedRealCrawlHostnames: approvedDomains };
  const deps = {
    ...repos,
    fetchHtmlPage: createControlledFetchHtmlPage(transportOptions),
    loadRobotsPolicy: createControlledLoadRobotsPolicy(transportOptions),
    lookupImpl: createControlledLookup(transportOptions),
    captureScreenshot: captureScreenshots ? captureScreenshotWithPlaywright : undefined,
  };

  const result = await runControlledPipeline(
    {
      csvText,
      maxCandidates,
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
      {
        discoveryJobId: result.import.discoveryJobId,
        totalRowsInCsv: result.import.totalRowsInCsv,
        importedCount: result.import.imported.length,
        duplicateCount: result.import.duplicates.length,
        rejectedCount: result.import.rejectedRows.length,
        truncatedByMaxCandidates: result.import.truncatedByMaxCandidates,
        promotions: result.promotions.map((p) => ({
          candidateId: p.candidateId,
          rawName: p.rawName,
          ok: p.result.ok,
          clinicId: p.result.ok ? p.result.clinic.id : null,
        })),
        crawlJobs: result.crawl.processed.map((p) => ({
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
        note: "No real crawl unless --allow-real-crawl (and only to example.com + subdomains). No screenshots unless --capture-screenshots (and only with --allow-real-crawl). No outreach ever sent — draft only. Human review required before any commercial use.",
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
