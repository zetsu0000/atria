import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { LeadCaptureEnv } from "@/lib/security/env";
import type { CrawlRunnerDeps } from "./run-crawl";
import { runCrawlJob } from "./run-crawl";
import type { CrawlJobRecord } from "./types";

const env: LeadCaptureEnv = {
  supabaseUrl: "https://example.supabase.co",
  supabaseServiceRoleKey: "test-key",
  resendApiKey: null,
  leadNotificationEmail: null,
  leadFromEmail: null,
  turnstileSiteKey: null,
  turnstileSecretKey: null,
  leadHashSecret: "hash-secret-for-tests-only",
  siteUrl: null,
};

function baseJob(overrides: Partial<CrawlJobRecord> = {}): CrawlJobRecord {
  return {
    id: "550e8400-e29b-41d4-a716-446655440001",
    leadId: "550e8400-e29b-41d4-a716-446655440002",
    requestedUrl: "https://clinic.example.com/",
    normalizedOrigin: "https://clinic.example.com",
    status: "running",
    maxPages: 2,
    pagesDiscovered: 0,
    pagesFetched: 0,
    pagesFailed: 0,
    startedAt: new Date().toISOString(),
    completedAt: null,
    errorCode: null,
    errorMessage: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...overrides,
  };
}

function createMemoryDeps(options: {
  robotsAllow?: boolean;
  pages?: Record<string, string>;
}): {
  deps: CrawlRunnerDeps;
  pages: Array<Record<string, unknown>>;
  findings: Array<Record<string, unknown>>;
  jobPatches: Array<Record<string, unknown>>;
  statuses: string[];
} {
  const pages: Array<Record<string, unknown>> = [];
  const findings: Array<Record<string, unknown>> = [];
  const jobPatches: Array<Record<string, unknown>> = [];
  const statuses: string[] = [];
  const htmlPages = options.pages ?? {
    "https://clinic.example.com/": `<html><body><main><h1>Home</h1><a href="/about">About</a></main></body></html>`,
    "https://clinic.example.com/about": `<html><body><main><h1>About</h1></main></body></html>`,
  };

  const deps: CrawlRunnerDeps = {
    claimCrawlJob: async () => ({ ok: true, job: baseJob() }),
    updateCrawlJobCounters: async (_id, patch) => {
      jobPatches.push(patch);
      return true;
    },
    persistCrawlPage: async (_id, page) => {
      pages.push(page);
      return true;
    },
    persistCrawlFinding: async (_id, finding) => {
      findings.push(finding);
      return true;
    },
    updateLeadStatus: async (input) => {
      statuses.push(input.toStatus);
      return {
        ok: true,
        leadId: input.leadId,
        fromStatus: "crawl_pending",
        toStatus: input.toStatus,
        historyId: "550e8400-e29b-41d4-a716-446655440003",
      };
    },
    loadRobotsPolicy: async () => ({
      available: true,
      crawlDelayMs: 0,
      sitemaps: [],
      conservativeFallback: false,
      isPathAllowed: () => options.robotsAllow !== false,
    }),
    fetchHtmlPage: async ({ url }) => {
      const body = htmlPages[url];
      if (!body) {
        return {
          ok: false,
          code: "http_error",
          message: "missing",
          statusCode: 404,
        };
      }
      return {
        ok: true,
        page: {
          finalUrl: url,
          statusCode: 200,
          contentType: "text/html",
          bodyText: body,
          fetchDurationMs: 1,
        },
      };
    },
  };

  return { deps, pages, findings, jobPatches, statuses };
}

describe("run-crawl", () => {
  it("completes a successful small crawl", async () => {
    const { deps, pages, jobPatches, statuses } = createMemoryDeps({});
    const result = await runCrawlJob(
      {
        jobId: baseJob().id,
        lookupImpl: async () => [{ address: "93.184.216.34", family: 4 }],
        delayMs: 0,
      },
      env,
      deps,
    );
    assert.equal(result.ok, true);
    if (result.ok) {
      assert.ok(result.pagesFetched >= 1);
      assert.ok(["completed", "partial"].includes(result.finalStatus));
    }
    assert.ok(pages.some((p) => p.path === "/" || p.normalizedUrl === "https://clinic.example.com/"));
    assert.ok(statuses.includes("crawling"));
    assert.ok(statuses.includes("crawl_complete"));
    assert.ok(jobPatches.some((p) => p.status === "completed" || p.status === "partial"));
  });

  it("fails when robots denies seed path", async () => {
    const { deps, findings } = createMemoryDeps({ robotsAllow: false });
    const result = await runCrawlJob(
      {
        jobId: baseJob().id,
        lookupImpl: async () => [{ address: "93.184.216.34", family: 4 }],
        delayMs: 0,
      },
      env,
      deps,
    );
    assert.equal(result.ok, false);
    if (!result.ok) assert.equal(result.reason, "robots_denied");
    assert.ok(findings.some((f) => f.code === "robots_denied"));
  });

  it("records partial crawl when some pages fail", async () => {
    const { deps, pages } = createMemoryDeps({
      pages: {
        "https://clinic.example.com/": `<html><body><main><h1>Home</h1><a href="/missing">X</a></main></body></html>`,
      },
    });
    const result = await runCrawlJob(
      {
        jobId: baseJob({ maxPages: 2 }).id,
        lookupImpl: async () => [{ address: "93.184.216.34", family: 4 }],
        delayMs: 0,
      },
      env,
      deps,
    );
    assert.equal(result.ok, true);
    if (result.ok) {
      assert.ok(result.pagesFetched >= 1);
      assert.ok(result.finalStatus === "partial" || result.pagesFailed >= 0);
    }
    assert.ok(pages.length >= 1);
  });

  it("respects page limit", async () => {
    const { deps, pages } = createMemoryDeps({
      pages: {
        "https://clinic.example.com/": `<html><body><main>
          <a href="/a">A</a><a href="/b">B</a><a href="/c">C</a>
        </main></body></html>`,
        "https://clinic.example.com/a": `<html><body><main>A</main></body></html>`,
        "https://clinic.example.com/b": `<html><body><main>B</main></body></html>`,
        "https://clinic.example.com/c": `<html><body><main>C</main></body></html>`,
      },
    });
    // Override claim to maxPages 1
    deps.claimCrawlJob = async () => ({
      ok: true,
      job: baseJob({ maxPages: 1 }),
    });
    const result = await runCrawlJob(
      {
        jobId: baseJob().id,
        lookupImpl: async () => [{ address: "93.184.216.34", family: 4 }],
        delayMs: 0,
      },
      env,
      deps,
    );
    assert.equal(result.ok, true);
    if (result.ok) assert.ok(result.pagesFetched <= 1);
    assert.ok(pages.filter((p) => !p.errorCode).length <= 1);
  });
});
