/**
 * Clinic-centric crawl orchestrator wired to the repository/adapter layer.
 *
 * Flow: clinic/source URL → create or claim crawl job → crawl bounded pages
 * → persist page statuses → persist extraction result → persist asset
 * metadata if screenshots exist → calculate score → persist score →
 * optionally create outreach draft only when explicitly requested → mark
 * job completed or failed.
 *
 * This is separate from lib/crawler/run-crawl.ts, which is the existing
 * lead-centric runner (drives lib/leads status transitions, persists
 * straight to Supabase). This orchestrator persists exclusively through
 * injected repositories so it can run against fakes in tests, with no live
 * Supabase connection and no live network access. See
 * docs/technical/crawler-run-job-flow.md for the full comparison and known
 * gaps (e.g. `crawl_jobs.lead_id` is still a required physical column).
 */
import type { CrawlErrorCode } from "@/lib/crawler/errors";
import { safeErrorMessage } from "@/lib/crawler/errors";
import { fetchHtmlPage as defaultFetchHtmlPage } from "@/lib/crawler/fetch-page";
import { parseHtmlPage, hashPageContent } from "@/lib/crawler/parse-page";
import { collectInternalLinks, mergeSitemapHints } from "@/lib/crawler/discover-links";
import { loadRobotsPolicy as defaultLoadRobotsPolicy } from "@/lib/crawler/robots";
import {
  normalizeCrawlUrl,
  resolveAndValidatePublicUrl,
  shouldSkipPath,
  type LookupFn,
} from "@/lib/crawler/url-policy";
import { DEFAULT_REQUEST_DELAY_MS } from "@/lib/crawler/types";
import { extractPageCandidates, mergeExtractionCandidates } from "@/lib/crawler/extract-candidates";
import type { ExtractionCandidate } from "@/lib/crawler/extraction-types";
import { calculatePlaceholderScore } from "@/lib/score/calculate";
import { buildOutreachDraft } from "@/lib/outreach/draft";
import type { CrawlRepository } from "./repositories/crawl-repository";
import type { ClinicRepository } from "./repositories/clinic-repository";
import type { ExtractionRepository } from "./repositories/extraction-repository";
import type { ScoreRepository } from "./repositories/score-repository";
import type { OutreachRepository } from "./repositories/outreach-repository";
import type {
  ContactExtractionMethod,
  ContactType,
  CrawlJobRecord,
  CrawlPageInput,
  ExtractedContentRecord,
  OutreachMessageRecord,
  RepoErrorReason,
  ScanAssetRecord,
  ScoreRecord,
} from "./repositories/types";
import type { ScanAssetMetadata } from "@/lib/crawler/screenshot-metadata";

export const EXTRACTION_SCHEMA_VERSION = "extraction-candidates-v1";

export type RunCrawlJobDeps = {
  crawlRepo: CrawlRepository;
  clinicRepo: ClinicRepository;
  extractionRepo: ExtractionRepository;
  scoreRepo: ScoreRepository;
  outreachRepo: OutreachRepository;
  /** Injectable for tests — never call live network from a test. */
  fetchHtmlPage: typeof defaultFetchHtmlPage;
  loadRobotsPolicy: typeof defaultLoadRobotsPolicy;
};

export function createRunCrawlJobDeps(
  overrides: Partial<Omit<RunCrawlJobDeps, "fetchHtmlPage" | "loadRobotsPolicy">> &
    Pick<RunCrawlJobDeps, "crawlRepo" | "clinicRepo" | "extractionRepo" | "scoreRepo" | "outreachRepo"> & {
      fetchHtmlPage?: typeof defaultFetchHtmlPage;
      loadRobotsPolicy?: typeof defaultLoadRobotsPolicy;
    },
): RunCrawlJobDeps {
  return {
    ...overrides,
    fetchHtmlPage: overrides.fetchHtmlPage ?? defaultFetchHtmlPage,
    loadRobotsPolicy: overrides.loadRobotsPolicy ?? defaultLoadRobotsPolicy,
  };
}

export type RunCrawlJobInput = {
  /** Resume an already-created pending crawl job instead of creating one. */
  crawlJobId?: string;
  /**
   * At least one of `leadId` / `clinicId` is required when creating a new
   * job (not required when resuming via `crawlJobId`, since the existing
   * job already carries one). Legacy/inbound crawls pass `leadId`;
   * discovery/outbound crawls pass `clinicId` with `leadId` omitted — this
   * orchestrator never fabricates a `leadId` to satisfy the schema.
   */
  leadId?: string | null;
  clinicId?: string | null;
  requestedUrl: string;
  maxPages?: number;
  fetchImpl?: typeof fetch;
  lookupImpl?: LookupFn;
  delayMs?: number;
  /** Screenshot metadata captured out-of-band. Never binary bytes. */
  screenshots?: ScanAssetMetadata[];
  /** Outreach drafting is opt-in per run — never created implicitly. */
  outreachDraft?: {
    channel: "email" | "whatsapp_manual";
    whatsappDigits?: string | null;
  } | null;
};

export type RunCrawlJobResult =
  | {
      ok: true;
      job: CrawlJobRecord;
      finalStatus: "completed" | "partial" | "failed";
      pagesFetched: number;
      pagesFailed: number;
      extraction: ExtractedContentRecord | null;
      score: ScoreRecord | null;
      assets: ScanAssetRecord[];
      outreachDraft: OutreachMessageRecord | null;
    }
  | {
      ok: false;
      reason: RepoErrorReason | "invalid_url" | "blocked_host" | "robots_denied";
      message: string;
      code?: CrawlErrorCode;
      job?: CrawlJobRecord;
    };

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

const CONTACT_KIND_MAP: Partial<Record<ExtractionCandidate["kind"], ContactType>> = {
  phone: "phone",
  email: "email",
  whatsapp: "whatsapp",
};

const CONTACT_EXTRACTION_METHOD_MAP: Record<
  ExtractionCandidate["extractionMethod"],
  ContactExtractionMethod
> = {
  html_anchor: "html_anchor",
  html_text: "html_text",
  meta: "meta",
  json_ld: "json_ld",
  heading: "other",
  img: "other",
  other: "other",
};

async function persistContactsFromCandidates(
  clinicRepo: ClinicRepository,
  clinicId: string,
  candidates: ExtractionCandidate[],
): Promise<void> {
  for (const candidate of candidates) {
    let contactType: ContactType | null = CONTACT_KIND_MAP[candidate.kind] ?? null;
    if (!contactType && candidate.kind === "social_link" && /instagram\.com/i.test(candidate.value)) {
      contactType = "instagram";
    }
    if (!contactType || candidate.confidence === "low") continue;

    await clinicRepo.addContact({
      clinicId,
      contactType,
      value: candidate.value,
      normalizedValue: candidate.value.trim().toLowerCase(),
      sourceUrl: candidate.sourceUrl,
      extractionMethod: CONTACT_EXTRACTION_METHOD_MAP[candidate.extractionMethod],
      confidence: candidate.confidence,
      provenance: { sourcePage: candidate.sourcePage, kind: candidate.kind },
    });
  }
}

/**
 * Executes a bounded, same-origin crawl against injected repositories.
 * Never performs a real network crawl unless `fetchImpl`/`lookupImpl` are
 * left at their real defaults by the caller — tests must always pass
 * fixtures/mocked transports.
 */
export async function runCrawlJob(
  input: RunCrawlJobInput,
  deps: RunCrawlJobDeps,
): Promise<RunCrawlJobResult> {
  let job: CrawlJobRecord;

  if (input.crawlJobId) {
    const claimed = await deps.crawlRepo.claimCrawlJob(input.crawlJobId);
    if (!claimed.ok) return { ok: false, reason: claimed.reason, message: claimed.message };
    job = claimed.value;
  } else {
    if (!input.leadId && !input.clinicId) {
      return {
        ok: false,
        reason: "validation",
        message: "A crawl job requires at least a leadId or a clinicId.",
      };
    }
    const seedForCreate = await resolveAndValidatePublicUrl(input.requestedUrl, input.lookupImpl);
    if (!seedForCreate.ok) {
      return {
        ok: false,
        reason: seedForCreate.code === "blocked_host" ? "blocked_host" : "invalid_url",
        message: seedForCreate.message,
        code: seedForCreate.code,
      };
    }
    const created = await deps.crawlRepo.createCrawlJob({
      leadId: input.leadId ?? null,
      clinicId: input.clinicId ?? null,
      requestedUrl: seedForCreate.url.href,
      normalizedOrigin: seedForCreate.url.origin,
      maxPages: input.maxPages,
    });
    if (!created.ok) return { ok: false, reason: created.reason, message: created.message };

    const claimed = await deps.crawlRepo.claimCrawlJob(created.value.id);
    if (!claimed.ok) return { ok: false, reason: claimed.reason, message: claimed.message };
    job = claimed.value;
  }

  const clinicId = job.clinicId ?? input.clinicId ?? null;

  const seedValidated = await resolveAndValidatePublicUrl(job.requestedUrl, input.lookupImpl);
  if (!seedValidated.ok) {
    await deps.crawlRepo.failCrawlJob(job.id, seedValidated.code);
    await deps.crawlRepo.recordFinding(job.id, {
      category: seedValidated.code === "blocked_host" ? "security" : "fetch",
      severity: "high",
      code: seedValidated.code,
      summary: safeErrorMessage(seedValidated.code),
    });
    return {
      ok: false,
      reason: seedValidated.code === "blocked_host" ? "blocked_host" : "invalid_url",
      message: seedValidated.message,
      code: seedValidated.code,
      job,
    };
  }

  const allowedOrigin = seedValidated.url.origin;
  const robots = await deps.loadRobotsPolicy({
    origin: allowedOrigin,
    fetchImpl: input.fetchImpl,
    lookupImpl: input.lookupImpl,
  });

  const seedPath = seedValidated.url.pathname || "/";
  if (!robots.isPathAllowed(seedPath)) {
    await deps.crawlRepo.failCrawlJob(job.id, "robots_denied");
    await deps.crawlRepo.recordFinding(job.id, {
      category: "robots",
      severity: "high",
      code: "robots_denied",
      summary: safeErrorMessage("robots_denied"),
    });
    return {
      ok: false,
      reason: "robots_denied",
      message: safeErrorMessage("robots_denied"),
      code: "robots_denied",
      job,
    };
  }

  const delayMs = input.delayMs ?? robots.crawlDelayMs ?? DEFAULT_REQUEST_DELAY_MS;

  const seen = new Set<string>();
  const queue: string[] = [];
  let hitPageLimit = false;

  const seedNormalized = normalizeCrawlUrl(seedValidated.url.href, seedValidated.url.href) ?? seedValidated.url.href;
  seen.add(seedNormalized);
  queue.push(seedNormalized);

  for (const hint of mergeSitemapHints(robots.sitemaps, allowedOrigin, seen)) {
    if (queue.length >= job.maxPages) {
      hitPageLimit = true;
      break;
    }
    queue.push(hint);
  }

  let pagesDiscovered = seen.size;
  let pagesFetched = 0;
  let pagesFailed = 0;
  const candidateBatches: ExtractionCandidate[][] = [];

  async function processOne(url: string): Promise<void> {
    let path = "/";
    try {
      path = new URL(url).pathname || "/";
    } catch {
      pagesFailed += 1;
      return;
    }

    if (shouldSkipPath(path) || !robots.isPathAllowed(path)) {
      await recordPage(job.id, deps, {
        url,
        normalizedUrl: url,
        path,
        statusCode: null,
        contentType: null,
        title: null,
        metaDescription: null,
        canonicalUrl: null,
        headings: [],
        mainText: null,
        linksInternal: [],
        contentHash: null,
        fetchDurationMs: null,
        fetchedAt: new Date().toISOString(),
        errorCode: "robots_denied",
      });
      pagesFailed += 1;
      await deps.crawlRepo.recordFinding(job.id, {
        category: "robots",
        severity: "info",
        code: "robots_denied",
        summary: safeErrorMessage("robots_denied"),
        pageUrl: url,
      });
      return;
    }

    const fetched = await deps.fetchHtmlPage({
      url,
      allowedOrigin,
      fetchImpl: input.fetchImpl,
      lookupImpl: input.lookupImpl,
    });

    if (!fetched.ok) {
      pagesFailed += 1;
      await recordPage(job.id, deps, {
        url,
        normalizedUrl: url,
        path,
        statusCode: fetched.statusCode ?? null,
        contentType: null,
        title: null,
        metaDescription: null,
        canonicalUrl: null,
        headings: [],
        mainText: null,
        linksInternal: [],
        contentHash: null,
        fetchDurationMs: null,
        fetchedAt: new Date().toISOString(),
        errorCode: fetched.code,
      });
      await deps.crawlRepo.recordFinding(job.id, {
        category: "fetch",
        severity: "medium",
        code: fetched.code,
        summary: safeErrorMessage(fetched.code),
        pageUrl: url,
      });
      return;
    }

    let parsed;
    try {
      parsed = parseHtmlPage(fetched.page.bodyText, fetched.page.finalUrl, allowedOrigin);
    } catch {
      pagesFailed += 1;
      await recordPage(job.id, deps, {
        url,
        normalizedUrl: url,
        path,
        statusCode: fetched.page.statusCode,
        contentType: fetched.page.contentType,
        title: null,
        metaDescription: null,
        canonicalUrl: null,
        headings: [],
        mainText: null,
        linksInternal: [],
        contentHash: null,
        fetchDurationMs: fetched.page.fetchDurationMs,
        fetchedAt: new Date().toISOString(),
        errorCode: "parse_failed",
      });
      await deps.crawlRepo.recordFinding(job.id, {
        category: "parse",
        severity: "medium",
        code: "parse_failed",
        summary: safeErrorMessage("parse_failed"),
        pageUrl: url,
      });
      return;
    }

    const normalizedFinal = normalizeCrawlUrl(fetched.page.finalUrl, fetched.page.finalUrl) ?? fetched.page.finalUrl;
    let finalPath = path;
    try {
      finalPath = new URL(normalizedFinal).pathname || "/";
    } catch {
      /* keep */
    }

    const pageRecord: CrawlPageInput = {
      url: fetched.page.finalUrl,
      normalizedUrl: normalizedFinal,
      path: finalPath,
      statusCode: fetched.page.statusCode,
      contentType: fetched.page.contentType,
      title: parsed.title,
      metaDescription: parsed.metaDescription,
      canonicalUrl: parsed.canonicalUrl,
      headings: parsed.headings,
      mainText: parsed.mainText,
      linksInternal: parsed.linksInternal,
      contentHash: hashPageContent(parsed.mainText, parsed.title),
      fetchDurationMs: fetched.page.fetchDurationMs,
      fetchedAt: new Date().toISOString(),
      errorCode: null,
    };

    const persisted = await recordPage(job.id, deps, pageRecord);
    if (!persisted) {
      pagesFailed += 1;
      await deps.crawlRepo.recordFinding(job.id, {
        category: "ops",
        severity: "high",
        code: "persistence_failed",
        summary: safeErrorMessage("persistence_failed"),
        pageUrl: url,
      });
      return;
    }

    pagesFetched += 1;

    // Raw HTML is used in-memory only for extraction candidates; it is
    // never persisted (crawl_pages stores normalized fields only).
    candidateBatches.push(
      extractPageCandidates({
        pageUrl: normalizedFinal,
        html: fetched.page.bodyText,
        title: parsed.title,
        metaDescription: parsed.metaDescription,
        headings: parsed.headings,
        mainText: parsed.mainText,
        linksInternal: parsed.linksInternal,
      }),
    );

    const discovered = collectInternalLinks({
      hrefs: parsed.linksInternal,
      baseUrl: normalizedFinal,
      allowedOrigin,
      alreadySeen: seen,
    });
    for (const link of discovered) {
      pagesDiscovered = seen.size;
      if (pagesFetched + queue.length >= job.maxPages) {
        hitPageLimit = true;
        break;
      }
      queue.push(link);
    }
    pagesDiscovered = seen.size;
  }

  while (queue.length > 0 && pagesFetched < job.maxPages) {
    const next = queue.shift();
    if (!next) break;
    await processOne(next);
    await deps.crawlRepo.updateCrawlJobCounters(job.id, { pagesDiscovered, pagesFetched, pagesFailed });
    if (delayMs > 0) await sleep(delayMs);
  }

  if (hitPageLimit || queue.length > 0) {
    await deps.crawlRepo.recordFinding(job.id, {
      category: "ops",
      severity: "info",
      code: "page_limit_reached",
      summary: safeErrorMessage("page_limit_reached"),
      details: { maxPages: job.maxPages, remaining: queue.length },
    });
  }

  let finalStatus: "completed" | "partial" | "failed";
  let errorCode: CrawlErrorCode | null = null;

  if (pagesFetched === 0) {
    finalStatus = "failed";
    errorCode = "unexpected_error";
  } else if (pagesFailed > 0 || hitPageLimit || queue.length > 0) {
    finalStatus = "partial";
    errorCode = hitPageLimit ? "page_limit_reached" : null;
  } else {
    finalStatus = "completed";
  }

  const finalized = await deps.crawlRepo.updateCrawlJobCounters(job.id, {
    pagesDiscovered,
    pagesFetched,
    pagesFailed,
    status: finalStatus,
    errorCode,
    errorMessage: errorCode ? safeErrorMessage(errorCode) : null,
    completedAt: new Date().toISOString(),
  });
  const finalJob = finalized.ok ? finalized.value : job;

  let extraction: ExtractedContentRecord | null = null;
  let score: ScoreRecord | null = null;
  const assets: ScanAssetRecord[] = [];
  let outreachDraft: OutreachMessageRecord | null = null;

  if (pagesFetched > 0) {
    const candidates = mergeExtractionCandidates(candidateBatches);

    const savedExtraction = await deps.extractionRepo.saveExtractedContent({
      crawlJobId: job.id,
      clinicId,
      schemaVersion: EXTRACTION_SCHEMA_VERSION,
      candidates,
      requiresHumanReview: true,
    });
    if (savedExtraction.ok) extraction = savedExtraction.value;

    for (const screenshot of input.screenshots ?? []) {
      const savedAsset = await deps.crawlRepo.saveAsset({ ...screenshot, crawlJobId: job.id });
      if (savedAsset.ok) assets.push(savedAsset.value);
    }

    const digitalScore = calculatePlaceholderScore({
      candidates,
      pageCount: pagesFetched,
      hasDesktopScreenshotMeta: assets.some((a) => a.assetType === "screenshot_desktop"),
      hasMobileScreenshotMeta: assets.some((a) => a.assetType === "screenshot_mobile"),
    });
    const savedScore = await deps.scoreRepo.saveScore({
      crawlJobId: job.id,
      clinicId,
      score: digitalScore,
    });
    if (savedScore.ok) score = savedScore.value;

    if (clinicId) {
      await persistContactsFromCandidates(deps.clinicRepo, clinicId, candidates);
    }

    if (input.outreachDraft && clinicId) {
      const clinicResult = await deps.clinicRepo.getClinic(clinicId);
      if (clinicResult.ok) {
        const clinic = clinicResult.value;
        const observations = (score?.evidence ?? []).map((e) => ({
          observation: e.reason,
          sourceUrl: e.sourceUrl ?? null,
        }));
        const built = buildOutreachDraft({
          clinicDisplayName: clinic.displayName,
          channel: input.outreachDraft.channel,
          observations,
          whatsappDigits: input.outreachDraft.whatsappDigits ?? null,
          doNotContact: clinic.doNotContact,
        });
        if (built.ok) {
          const savedDraft = await deps.outreachRepo.createDraft({
            clinicId,
            leadId: job.leadId,
            draft: built.draft,
            doNotContact: clinic.doNotContact,
          });
          if (savedDraft.ok) outreachDraft = savedDraft.value;
        }
      }
    }
  }

  return {
    ok: true,
    job: finalJob,
    finalStatus,
    pagesFetched,
    pagesFailed,
    extraction,
    score,
    assets,
    outreachDraft,
  };
}

async function recordPage(
  jobId: string,
  deps: RunCrawlJobDeps,
  page: CrawlPageInput,
): Promise<boolean> {
  const result = await deps.crawlRepo.recordPage(jobId, page);
  return result.ok;
}
