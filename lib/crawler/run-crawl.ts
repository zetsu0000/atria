import { updateLeadStatus } from "@/lib/leads/status-operations";
import {
  readLeadCaptureEnv,
  type LeadCaptureEnv,
} from "@/lib/security/env";
import { collectInternalLinks, mergeSitemapHints } from "./discover-links";
import { safeErrorMessage, type CrawlErrorCode } from "./errors";
import { fetchHtmlPage } from "./fetch-page";
import { hashPageContent, parseHtmlPage } from "./parse-page";
import {
  claimCrawlJob,
  persistCrawlFinding,
  persistCrawlPage,
  updateCrawlJobCounters,
} from "./persistence";
import { loadRobotsPolicy } from "./robots";
import {
  DEFAULT_CONCURRENCY,
  DEFAULT_REQUEST_DELAY_MS,
  type CrawlJobRecord,
  type RunCrawlInput,
} from "./types";
import {
  normalizeCrawlUrl,
  resolveAndValidatePublicUrl,
  shouldSkipPath,
} from "./url-policy";

export type RunCrawlResult =
  | {
      ok: true;
      job: CrawlJobRecord;
      finalStatus: "completed" | "partial" | "failed";
      pagesFetched: number;
      pagesFailed: number;
    }
  | {
      ok: false;
      reason:
        | "not_found"
        | "job_not_pending"
        | "configuration"
        | "unavailable"
        | "invalid_url"
        | "blocked_host"
        | "robots_denied";
      message: string;
      code?: CrawlErrorCode;
    };

export type CrawlRunnerDeps = {
  claimCrawlJob: typeof claimCrawlJob;
  updateCrawlJobCounters: typeof updateCrawlJobCounters;
  persistCrawlPage: typeof persistCrawlPage;
  persistCrawlFinding: typeof persistCrawlFinding;
  updateLeadStatus: typeof updateLeadStatus;
  loadRobotsPolicy: typeof loadRobotsPolicy;
  fetchHtmlPage: typeof fetchHtmlPage;
};

const defaultDeps: CrawlRunnerDeps = {
  claimCrawlJob,
  updateCrawlJobCounters,
  persistCrawlPage,
  persistCrawlFinding,
  updateLeadStatus,
  loadRobotsPolicy,
  fetchHtmlPage,
};

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function failJob(
  jobId: string,
  code: CrawlErrorCode,
  env: LeadCaptureEnv,
  deps: CrawlRunnerDeps,
): Promise<void> {
  await deps.updateCrawlJobCounters(
    jobId,
    {
      status: "failed",
      errorCode: code,
      errorMessage: safeErrorMessage(code),
      completedAt: new Date().toISOString(),
    },
    env,
  );
  await deps.persistCrawlFinding(
    jobId,
    {
      category: code === "robots_denied" ? "robots" : "ops",
      severity: "high",
      code,
      summary: safeErrorMessage(code),
    },
    env,
  );
}

/**
 * Executes a pending crawl job in-process.
 *
 * Not durable across serverless timeouts. Prefer invoking from a worker /
 * background function for production workloads. Safe to call for small jobs
 * (default max 10 pages) when the host allows sufficient runtime.
 */
export async function runCrawlJob(
  input: RunCrawlInput,
  env: LeadCaptureEnv = readLeadCaptureEnv(),
  deps: CrawlRunnerDeps = defaultDeps,
): Promise<RunCrawlResult> {
  const claimed = await deps.claimCrawlJob(input.jobId, env);
  if (!claimed.ok) {
    return {
      ok: false,
      reason: claimed.reason,
      message:
        claimed.reason === "job_not_pending"
          ? safeErrorMessage("job_not_pending")
          : claimed.reason === "not_found"
            ? safeErrorMessage("job_not_found")
            : safeErrorMessage("configuration"),
      code:
        claimed.reason === "job_not_pending"
          ? "job_not_pending"
          : claimed.reason === "not_found"
            ? "job_not_found"
            : "configuration",
    };
  }

  const job = claimed.job;

  // Move lead into crawling when possible (best-effort; may need crawl_pending first)
  {
    const crawling = await deps.updateLeadStatus(
      {
        leadId: job.leadId,
        toStatus: "crawling",
        actorType: "crawler",
        actorIdentifier: `crawl-job:${job.id}`,
        reason: "Crawl job started",
      },
      env,
    );
    if (!crawling.ok) {
      await deps.updateLeadStatus(
        {
          leadId: job.leadId,
          toStatus: "crawl_pending",
          actorType: "crawler",
          actorIdentifier: `crawl-job:${job.id}`,
          reason: "Crawl job claimed",
        },
        env,
      );
      await deps.updateLeadStatus(
        {
          leadId: job.leadId,
          toStatus: "crawling",
          actorType: "crawler",
          actorIdentifier: `crawl-job:${job.id}`,
          reason: "Crawl job started",
        },
        env,
      );
    }
  }

  const seedValidated = await resolveAndValidatePublicUrl(
    job.requestedUrl,
    input.lookupImpl,
  );
  if (!seedValidated.ok) {
    await failJob(job.id, seedValidated.code, env, deps);
    return {
      ok: false,
      reason:
        seedValidated.code === "blocked_host" ? "blocked_host" : "invalid_url",
      message: seedValidated.message,
      code: seedValidated.code,
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
    await failJob(job.id, "robots_denied", env, deps);
    await deps.updateLeadStatus(
      {
        leadId: job.leadId,
        toStatus: "crawl_pending",
        actorType: "crawler",
        actorIdentifier: `crawl-job:${job.id}`,
        reason: "robots.txt denied seed path",
      },
      env,
    );
    return {
      ok: false,
      reason: "robots_denied",
      message: safeErrorMessage("robots_denied"),
      code: "robots_denied",
    };
  }

  const delayMs =
    input.delayMs ??
    robots.crawlDelayMs ??
    DEFAULT_REQUEST_DELAY_MS;

  const seen = new Set<string>();
  const queue: string[] = [];
  let hitPageLimit = false;

  const seedNormalized =
    normalizeCrawlUrl(seedValidated.url.href, seedValidated.url.href) ??
    seedValidated.url.href;
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

  const concurrency = DEFAULT_CONCURRENCY;

  async function processOne(url: string): Promise<void> {
    let path = "/";
    try {
      path = new URL(url).pathname || "/";
    } catch {
      pagesFailed += 1;
      return;
    }

    if (shouldSkipPath(path) || !robots.isPathAllowed(path)) {
      await deps.persistCrawlPage(
        job.id,
        {
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
        },
        env,
      );
      pagesFailed += 1;
      await deps.persistCrawlFinding(
        job.id,
        {
          category: "robots",
          severity: "info",
          code: "robots_denied",
          summary: safeErrorMessage("robots_denied"),
          pageUrl: url,
        },
        env,
      );
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
      await deps.persistCrawlPage(
        job.id,
        {
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
        },
        env,
      );
      await deps.persistCrawlFinding(
        job.id,
        {
          category: "fetch",
          severity: "medium",
          code: fetched.code,
          summary: safeErrorMessage(fetched.code),
          pageUrl: url,
        },
        env,
      );
      return;
    }

    let parsed;
    try {
      parsed = parseHtmlPage(
        fetched.page.bodyText,
        fetched.page.finalUrl,
        allowedOrigin,
      );
    } catch {
      pagesFailed += 1;
      await deps.persistCrawlPage(
        job.id,
        {
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
        },
        env,
      );
      return;
    }

    const normalizedFinal =
      normalizeCrawlUrl(fetched.page.finalUrl, fetched.page.finalUrl) ??
      fetched.page.finalUrl;
    let finalPath = path;
    try {
      finalPath = new URL(normalizedFinal).pathname || "/";
    } catch {
      /* keep */
    }

    const persisted = await deps.persistCrawlPage(
      job.id,
      {
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
      },
      env,
    );

    if (!persisted) {
      pagesFailed += 1;
      await deps.persistCrawlFinding(
        job.id,
        {
          category: "ops",
          severity: "high",
          code: "persistence_failed",
          summary: safeErrorMessage("persistence_failed"),
          pageUrl: url,
        },
        env,
      );
      return;
    }

    pagesFetched += 1;

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
    const batch: string[] = [];
    while (
      batch.length < concurrency &&
      queue.length > 0 &&
      pagesFetched + batch.length < job.maxPages
    ) {
      const next = queue.shift();
      if (next) batch.push(next);
    }
    if (batch.length === 0) break;

    await Promise.all(batch.map((url) => processOne(url)));
    await deps.updateCrawlJobCounters(
      job.id,
      {
        pagesDiscovered,
        pagesFetched,
        pagesFailed,
      },
      env,
    );
    if (delayMs > 0) await sleep(delayMs);
  }

  if (hitPageLimit || queue.length > 0) {
    await deps.persistCrawlFinding(
      job.id,
      {
        category: "ops",
        severity: "info",
        code: "page_limit_reached",
        summary: safeErrorMessage("page_limit_reached"),
        details: { maxPages: job.maxPages, remaining: queue.length },
      },
      env,
    );
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

  await deps.updateCrawlJobCounters(
    job.id,
    {
      pagesDiscovered,
      pagesFetched,
      pagesFailed,
      status: finalStatus,
      errorCode,
      errorMessage: errorCode ? safeErrorMessage(errorCode) : null,
      completedAt: new Date().toISOString(),
    },
    env,
  );

  if (finalStatus === "completed" || finalStatus === "partial") {
    await deps.updateLeadStatus(
      {
        leadId: job.leadId,
        toStatus: "crawl_complete",
        actorType: "crawler",
        actorIdentifier: `crawl-job:${job.id}`,
        reason: `Crawl ${finalStatus}`,
      },
      env,
    );
  }

  return {
    ok: true,
    job: {
      ...job,
      status: finalStatus,
      pagesDiscovered,
      pagesFetched,
      pagesFailed,
      completedAt: new Date().toISOString(),
      errorCode,
      errorMessage: errorCode ? safeErrorMessage(errorCode) : null,
    },
    finalStatus,
    pagesFetched,
    pagesFailed,
  };
}
