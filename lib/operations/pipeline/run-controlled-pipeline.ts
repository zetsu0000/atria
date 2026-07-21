/**
 * Top-level controlled automation pipeline:
 *
 *   import CSV candidates (bounded, deduplicated)
 *   → promote eligible candidates to clinics
 *   → create clinic-centric crawl jobs and run them (bounded pages)
 *       → persist pages/findings, extraction, assets, score
 *       → optionally build an outreach draft (never sent)
 *       → mark each job completed/partial/failed
 *
 * Fully dependency-injected — the CLI wires real Supabase repositories
 * (gated by lib/operations/pipeline/target-guard.ts) or in-memory fakes for
 * --dry-run. Network access goes through
 * lib/operations/pipeline/controlled-transport.ts, which defaults to
 * fixture-only and only ever allows real requests to an explicit hostname
 * allowlist.
 */
import type { DiscoveryRepository } from "@/lib/operations/repositories/discovery-repository";
import type { PromoteCandidateResult } from "@/lib/operations/promote-candidate";
import { promoteCandidateToClinic } from "@/lib/operations/promote-candidate";
import {
  importCandidatesFromCsv,
  DEFAULT_MAX_CANDIDATES,
  type ImportCandidatesResult,
} from "./import-candidates";
import {
  processCrawlQueue,
  DEFAULT_MAX_PAGES,
  type ProcessCrawlQueueDeps,
  type ProcessCrawlQueueResult,
} from "./process-crawl-queue";
import type { ScreenshotStorageConfig } from "./screenshot-assets";

export type RunControlledPipelineInput = {
  csvText: string;
  maxCandidates?: number;
  maxPages?: number;
  allowRealCrawl: boolean;
  createOutreachDraft?: boolean;
  /** Requires allowRealCrawl=true; otherwise silently skipped — see process-crawl-queue.ts. */
  captureScreenshots?: boolean;
  screenshotTimeoutMs?: number;
  screenshotStorage?: ScreenshotStorageConfig;
};

export type RunControlledPipelineDeps = ProcessCrawlQueueDeps & { discoveryRepo: DiscoveryRepository };

export type RunControlledPipelineResult = {
  import: ImportCandidatesResult;
  promotions: Array<{ candidateId: string; rawName: string; result: PromoteCandidateResult }>;
  crawl: ProcessCrawlQueueResult;
};

export async function runControlledPipeline(
  input: RunControlledPipelineInput,
  deps: RunControlledPipelineDeps,
): Promise<RunControlledPipelineResult> {
  const importResult = await importCandidatesFromCsv(
    { csvText: input.csvText, maxCandidates: input.maxCandidates ?? DEFAULT_MAX_CANDIDATES },
    { discoveryRepo: deps.discoveryRepo },
  );

  const promotions: RunControlledPipelineResult["promotions"] = [];
  for (const candidate of importResult.imported) {
    const result = await promoteCandidateToClinic(candidate.id, {
      discoveryRepo: deps.discoveryRepo,
      clinicRepo: deps.clinicRepo,
    });
    promotions.push({ candidateId: candidate.id, rawName: candidate.rawName, result });
  }

  const clinicIds = promotions
    .map((p) => (p.result.ok ? p.result.clinic.id : null))
    .filter((id): id is string => id !== null);

  const crawl = await processCrawlQueue(
    {
      clinicIds,
      maxPages: input.maxPages ?? DEFAULT_MAX_PAGES,
      allowRealCrawl: input.allowRealCrawl,
      createOutreachDraft: input.createOutreachDraft ?? true,
      captureScreenshots: input.captureScreenshots,
      screenshotTimeoutMs: input.screenshotTimeoutMs,
      screenshotStorage: input.screenshotStorage,
    },
    deps,
  );

  return { import: importResult, promotions, crawl };
}
