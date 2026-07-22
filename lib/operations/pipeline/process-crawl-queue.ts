/**
 * Steps 4-11 of the controlled automation pipeline: create/resume
 * clinic-centric crawl jobs and run them through the bounded crawler
 * (lib/operations/run-crawl-job.ts), which already handles page/finding
 * persistence, extraction, scoring, optional draft creation, and marking
 * the job completed/partial/failed. Never sends outreach — the underlying
 * orchestrator only ever creates a `draft`-status row.
 *
 * Screenshot capture (steps 3/8 of docs/technical/crawler-screenshot-score-assets.md)
 * is opt-in and gated: it only ever runs when both `captureScreenshots` and
 * `allowRealCrawl` are true; otherwise it is silently (and safely) skipped,
 * never refused with a crash — the CLI layer is where a hard refusal with a
 * clear message belongs (see scripts/crawler/run-controlled-pipeline.ts).
 * When it does run, the score is recalculated to reference the captured
 * assets and the outreach draft (if any) is built *after* screenshots so
 * its evidence can mention them — a screenshot failure never fails the
 * whole job, only that asset's own outcome.
 *
 * Before creating a fresh crawl job for a clinic (the `clinicIds` path
 * only — a resumed `crawlJobIds` job keeps whatever `requestedUrl` it was
 * already created with), a plain `http://` starting URL is safely
 * canonicalized to `https://` when doing so is verifiably safe — see
 * `canonicalizeHttpToHttpsIfSafe` (lib/crawler/url-policy.ts) and
 * docs/technical/crawler-http-origin-fetch-fix.md for why: many real
 * sites unconditionally redirect http:// to https:// on the same host,
 * which the bounded crawl loop's own (correct, unweakened) same-origin
 * guard refuses to follow — so starting the crawl on https:// directly
 * avoids that entirely. This only ever runs when `allowRealCrawl` is
 * true, reuses the same host-allowlist-gated `lookupImpl` as everything
 * else in this module, and never changes host — see the function's own
 * docstring for the full safety contract.
 */
import { runCrawlJob, type RunCrawlJobDeps, type RunCrawlJobResult } from "@/lib/operations/run-crawl-job";
import { calculatePlaceholderScore } from "@/lib/score/calculate";
import { buildOutreachDraft } from "@/lib/outreach/draft";
import type { ScoreRecord } from "@/lib/operations/repositories/types";
import { canonicalizeHttpToHttpsIfSafe, type LookupFn } from "@/lib/crawler/url-policy";
import { createControlledLookup, resolveAllowedRealCrawlHostnames } from "./controlled-transport";
import {
  captureAndPersistScreenshots,
  type CaptureAndPersistScreenshotsDeps,
  type ScreenshotAssetOutcome,
  type ScreenshotStorageConfig,
} from "./screenshot-assets";

export const DEFAULT_MAX_PAGES = 5;

export type ProcessCrawlQueueInput = {
  /** Clinics to create a new crawl job for and run. */
  clinicIds?: string[];
  /** Already-created (e.g. previously queued) crawl jobs to resume/run. */
  crawlJobIds?: string[];
  maxPages?: number;
  allowRealCrawl: boolean;
  createOutreachDraft?: boolean;
  /** Requires allowRealCrawl=true; otherwise silently skipped (see module docs above). */
  captureScreenshots?: boolean;
  screenshotTimeoutMs?: number;
  screenshotStorage?: ScreenshotStorageConfig;
  /**
   * Same list passed to `createControlledLookup`/`createControlledFetchHtmlPage`
   * for this invocation (the CLI's `--approved-domains`). Used only to let
   * the http-to-https starting-URL canonicalization accept an explicitly
   * approved cross-host redirect (e.g. `www.` -> apex) — see
   * `canonicalizeHttpToHttpsIfSafe`'s docstring. Never widens any other
   * guard; the SSRF check is still independently re-run against any
   * cross-host target before it's ever accepted.
   */
  approvedRealCrawlHostnames?: readonly string[];
};

export type ProcessCrawlQueueDeps = RunCrawlJobDeps &
  Partial<CaptureAndPersistScreenshotsDeps> & {
    /** Overridable for tests — defaults to lib/operations/pipeline/controlled-transport.ts's createControlledLookup. */
    lookupImpl?: LookupFn;
    /** Overridable for tests — defaults to the real global fetch. Used only for the single, bounded https:// preflight request in canonicalizeHttpToHttpsIfSafe; never used for the crawl itself. */
    httpsPreflightFetchImpl?: typeof fetch;
  };

export type ProcessedJobOutcome = {
  clinicId: string | null;
  crawlJobId: string | null;
  result: RunCrawlJobResult;
  screenshots: ScreenshotAssetOutcome[];
  screenshotsSkippedReason: string | null;
  /** Score recomputed after screenshots landed, superseding result.score. Null unless screenshots were actually captured. */
  updatedScore: ScoreRecord | null;
  /** Outreach draft built *after* screenshots so its evidence can reference them. Null unless screenshots were actually captured and a draft was requested. */
  deferredOutreachDraftId: string | null;
};

export type ProcessCrawlQueueResult = {
  processed: ProcessedJobOutcome[];
};

export async function processCrawlQueue(
  input: ProcessCrawlQueueInput,
  deps: ProcessCrawlQueueDeps,
): Promise<ProcessCrawlQueueResult> {
  const maxPages = input.maxPages ?? DEFAULT_MAX_PAGES;
  const delayMs = input.allowRealCrawl ? undefined : 0;
  const lookupImpl = deps.lookupImpl ?? createControlledLookup({ allowRealCrawl: input.allowRealCrawl });

  const willCaptureScreenshots = Boolean(input.captureScreenshots) && input.allowRealCrawl && Boolean(deps.captureScreenshot);
  const screenshotsSkippedReason = Boolean(input.captureScreenshots) && !willCaptureScreenshots
    ? (!input.allowRealCrawl
        ? "Screenshots skipped: --capture-screenshots requires --allow-real-crawl."
        : "Screenshots skipped: no captureScreenshot implementation was provided.")
    : null;

  const wantsOutreachDraft = Boolean(input.createOutreachDraft);
  // When screenshots will be captured, defer draft creation until after they
  // land so its evidence can reference them; otherwise let runCrawlJob build
  // it inline, same as before.
  const outreachDraftForCrawl = wantsOutreachDraft && !willCaptureScreenshots ? ({ channel: "email" } as const) : null;

  const processed: ProcessedJobOutcome[] = [];

  async function afterCrawl(
    result: RunCrawlJobResult,
    clinicIdHint: string | null,
  ): Promise<{
    screenshots: ScreenshotAssetOutcome[];
    updatedScore: ScoreRecord | null;
    deferredOutreachDraftId: string | null;
  }> {
    if (!result.ok || !willCaptureScreenshots) {
      return { screenshots: [], updatedScore: null, deferredOutreachDraftId: null };
    }

    const clinicId = result.job.clinicId ?? clinicIdHint;
    const screenshots = await captureAndPersistScreenshots(
      {
        clinicId,
        crawlJobId: result.job.id,
        sourceUrl: result.job.requestedUrl,
        timeoutMs: input.screenshotTimeoutMs,
        storage: input.screenshotStorage ?? { configured: false },
      },
      { crawlRepo: deps.crawlRepo, captureScreenshot: deps.captureScreenshot! },
    );

    let updatedScore: ScoreRecord | null = null;
    let deferredOutreachDraftId: string | null = null;

    if (result.extraction) {
      const desktopOutcome = screenshots.find((s) => s.assetType === "screenshot_desktop" && s.captureStatus !== "capture_failed");
      const mobileOutcome = screenshots.find((s) => s.assetType === "screenshot_mobile" && s.captureStatus !== "capture_failed");

      const recomputed = calculatePlaceholderScore({
        candidates: result.extraction.candidates,
        pageCount: result.pagesFetched,
        hasDesktopScreenshotMeta: Boolean(desktopOutcome),
        hasMobileScreenshotMeta: Boolean(mobileOutcome),
        desktopScreenshotAssetId: desktopOutcome?.asset?.id ?? null,
        mobileScreenshotAssetId: mobileOutcome?.asset?.id ?? null,
        requestedUrl: result.job.requestedUrl,
      });
      const savedScore = await deps.scoreRepo.saveScore({
        crawlJobId: result.job.id,
        clinicId,
        score: recomputed,
      });
      if (savedScore.ok) updatedScore = savedScore.value;

      if (wantsOutreachDraft && clinicId) {
        const clinicResult = await deps.clinicRepo.getClinic(clinicId);
        if (clinicResult.ok) {
          const observations = (savedScore.ok ? savedScore.value.evidence : recomputed.evidence).map((e) => ({
            observation: e.reason,
            sourceUrl: e.sourceUrl ?? null,
          }));
          const built = buildOutreachDraft({
            clinicDisplayName: clinicResult.value.displayName,
            channel: "email",
            observations,
            doNotContact: clinicResult.value.doNotContact,
          });
          if (built.ok) {
            const draft = await deps.outreachRepo.createDraft({
              clinicId,
              leadId: result.job.leadId,
              draft: built.draft,
              doNotContact: clinicResult.value.doNotContact,
            });
            if (draft.ok) deferredOutreachDraftId = draft.value.id;
          }
        }
      }
    }

    return { screenshots, updatedScore, deferredOutreachDraftId };
  }

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
        screenshots: [],
        screenshotsSkippedReason,
        updatedScore: null,
        deferredOutreachDraftId: null,
      });
      continue;
    }

    let requestedUrl = clinicResult.value.websiteUrl;
    let httpsCanonicalization: { originalUrl: string; canonicalUrl: string; reason: string } | null = null;
    if (input.allowRealCrawl && requestedUrl.startsWith("http://")) {
      const canonicalized = await canonicalizeHttpToHttpsIfSafe(requestedUrl, {
        lookupImpl,
        fetchImpl: deps.httpsPreflightFetchImpl,
        additionalApprovedHostnames: resolveAllowedRealCrawlHostnames({
          allowRealCrawl: input.allowRealCrawl,
          approvedRealCrawlHostnames: input.approvedRealCrawlHostnames,
        }),
      });
      if (canonicalized.upgraded) {
        httpsCanonicalization = { originalUrl: requestedUrl, canonicalUrl: canonicalized.url, reason: canonicalized.reason };
        requestedUrl = canonicalized.url;
      }
    }

    const result = await runCrawlJob(
      {
        clinicId,
        requestedUrl,
        maxPages,
        delayMs,
        lookupImpl,
        outreachDraft: outreachDraftForCrawl,
      },
      deps,
    );
    if (httpsCanonicalization && result.ok) {
      await deps.crawlRepo.recordFinding(result.job.id, {
        category: "ops",
        severity: "info",
        code: "http_to_https_canonicalized",
        summary: `Starting URL upgraded from ${httpsCanonicalization.originalUrl} to ${httpsCanonicalization.canonicalUrl} before crawling (${httpsCanonicalization.reason}).`,
        details: httpsCanonicalization,
      });
    }
    const { screenshots, updatedScore, deferredOutreachDraftId } = await afterCrawl(result, clinicId);
    processed.push({
      clinicId,
      crawlJobId: result.ok ? result.job.id : (result.job?.id ?? null),
      result,
      screenshots,
      screenshotsSkippedReason,
      updatedScore,
      deferredOutreachDraftId,
    });
  }

  for (const crawlJobId of input.crawlJobIds ?? []) {
    const jobResult = await deps.crawlRepo.getCrawlJob(crawlJobId);
    if (!jobResult.ok) {
      processed.push({
        clinicId: null,
        crawlJobId,
        result: { ok: false, reason: jobResult.reason, message: jobResult.message },
        screenshots: [],
        screenshotsSkippedReason,
        updatedScore: null,
        deferredOutreachDraftId: null,
      });
      continue;
    }

    const result = await runCrawlJob(
      {
        crawlJobId,
        requestedUrl: jobResult.value.requestedUrl,
        maxPages,
        delayMs,
        lookupImpl,
        outreachDraft: outreachDraftForCrawl,
      },
      deps,
    );
    const { screenshots, updatedScore, deferredOutreachDraftId } = await afterCrawl(result, jobResult.value.clinicId);
    processed.push({
      clinicId: jobResult.value.clinicId,
      crawlJobId,
      result,
      screenshots,
      screenshotsSkippedReason,
      updatedScore,
      deferredOutreachDraftId,
    });
  }

  return { processed };
}
