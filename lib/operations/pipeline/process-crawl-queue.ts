/**
 * Steps 4-11 of the controlled automation pipeline: create/resume
 * clinic-centric crawl jobs and run them through the bounded crawler
 * (lib/operations/run-crawl-job.ts), which already handles page/finding
 * persistence, extraction, scoring, optional draft creation, and marking
 * the job completed/partial/failed. Never sends outreach — the underlying
 * orchestrator only ever creates a `draft`-status row.
 */
import { runCrawlJob, type RunCrawlJobDeps, type RunCrawlJobResult } from "@/lib/operations/run-crawl-job";
import { createControlledLookup } from "./controlled-transport";

export const DEFAULT_MAX_PAGES = 5;

export type ProcessCrawlQueueInput = {
  /** Clinics to create a new crawl job for and run. */
  clinicIds?: string[];
  /** Already-created (e.g. previously queued) crawl jobs to resume/run. */
  crawlJobIds?: string[];
  maxPages?: number;
  allowRealCrawl: boolean;
  createOutreachDraft?: boolean;
};

export type ProcessedJobOutcome = {
  clinicId: string | null;
  crawlJobId: string | null;
  result: RunCrawlJobResult;
};

export type ProcessCrawlQueueResult = {
  processed: ProcessedJobOutcome[];
};

export async function processCrawlQueue(
  input: ProcessCrawlQueueInput,
  deps: RunCrawlJobDeps,
): Promise<ProcessCrawlQueueResult> {
  const maxPages = input.maxPages ?? DEFAULT_MAX_PAGES;
  const delayMs = input.allowRealCrawl ? undefined : 0;
  const outreachDraft = input.createOutreachDraft ? ({ channel: "email" } as const) : null;
  const lookupImpl = createControlledLookup({ allowRealCrawl: input.allowRealCrawl });
  const processed: ProcessedJobOutcome[] = [];

  for (const clinicId of input.clinicIds ?? []) {
    const clinicResult = await deps.clinicRepo.getClinic(clinicId);
    if (!clinicResult.ok || !clinicResult.value.websiteUrl) {
      processed.push({
        clinicId,
        crawlJobId: null,
        result: {
          ok: false,
          reason: "validation",
          message: clinicResult.ok ? "Clinic has no website URL to crawl." : clinicResult.message,
        },
      });
      continue;
    }

    const result = await runCrawlJob(
      {
        clinicId,
        requestedUrl: clinicResult.value.websiteUrl,
        maxPages,
        delayMs,
        lookupImpl,
        outreachDraft,
      },
      deps,
    );
    processed.push({ clinicId, crawlJobId: result.ok ? result.job.id : (result.job?.id ?? null), result });
  }

  for (const crawlJobId of input.crawlJobIds ?? []) {
    const jobResult = await deps.crawlRepo.getCrawlJob(crawlJobId);
    if (!jobResult.ok) {
      processed.push({ clinicId: null, crawlJobId, result: { ok: false, reason: jobResult.reason, message: jobResult.message } });
      continue;
    }

    const result = await runCrawlJob(
      {
        crawlJobId,
        requestedUrl: jobResult.value.requestedUrl,
        maxPages,
        delayMs,
        lookupImpl,
        outreachDraft,
      },
      deps,
    );
    processed.push({ clinicId: jobResult.value.clinicId, crawlJobId, result });
  }

  return { processed };
}
