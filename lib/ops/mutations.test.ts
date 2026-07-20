import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { CrawlJobRecord } from "@/lib/crawler/types";
import type { OperationalLead } from "@/lib/leads/query";
import {
  mutateCancelCrawlJob,
  mutateCreateCrawlJob,
  mutateExecuteCrawlJob,
  mutateUpdateLeadStatus,
  type MutationDeps,
} from "./mutations";
import { FIXTURE_LEADS } from "./fixtures";
import { sanitizeOperatorError } from "./labels";

const lead: OperationalLead = {
  ...FIXTURE_LEADS[0],
  status: "new",
};

const pendingJob: CrawlJobRecord = {
  id: "job-1",
  leadId: lead.id,
  requestedUrl: lead.websiteUrl,
  normalizedOrigin: lead.websiteUrl,
  status: "pending",
  maxPages: 10,
  pagesDiscovered: 0,
  pagesFetched: 0,
  pagesFailed: 0,
  startedAt: null,
  completedAt: null,
  errorCode: null,
  errorMessage: null,
  createdAt: lead.createdAt,
  updatedAt: lead.createdAt,
};

function baseDeps(overrides: Partial<MutationDeps> = {}): MutationDeps {
  return {
    requireOperator: async () => ({
      ok: true,
      operator: { userId: "u1", email: "ops@example.com" },
    }),
    getLead: async () => ({ ok: true, lead }),
    updateLeadStatus: async () => ({ ok: true }),
    createCrawlJob: async () => ({ ok: true }),
    getCrawlJob: async () => ({ ok: true, job: pendingJob }),
    executeCrawlJob: async () => ({ ok: true }),
    cancelCrawlJob: async () => ({ ok: true }),
    ...overrides,
  };
}

describe("ops mutations", () => {
  it("rejects unauthorized status updates", async () => {
    const result = await mutateUpdateLeadStatus(
      { leadId: lead.id, toStatus: "contacted" },
      baseDeps({
        requireOperator: async () => ({
          ok: false,
          reason: "unauthenticated",
          message: "É necessário autenticar-se como operador para continuar.",
        }),
      }),
    );
    assert.equal(result.ok, false);
  });

  it("allows a valid transition for an authorized operator", async () => {
    const result = await mutateUpdateLeadStatus(
      { leadId: lead.id, toStatus: "contacted" },
      baseDeps(),
    );
    assert.equal(result.ok, true);
  });

  it("rejects an invalid transition on the server", async () => {
    const result = await mutateUpdateLeadStatus(
      { leadId: lead.id, toStatus: "published" },
      baseDeps(),
    );
    assert.equal(result.ok, false);
    if (!result.ok) {
      assert.match(result.message, /não permitida/i);
    }
  });

  it("reports lead not found", async () => {
    const result = await mutateUpdateLeadStatus(
      { leadId: "missing", toStatus: "contacted" },
      baseDeps({
        getLead: async () => ({ ok: false, reason: "not_found" }),
      }),
    );
    assert.equal(result.ok, false);
    if (!result.ok) assert.match(result.message, /não encontrado/i);
  });

  it("creates a crawl for an authorized operator", async () => {
    let called = false;
    const result = await mutateCreateCrawlJob(
      { leadId: lead.id },
      baseDeps({
        createCrawlJob: async () => {
          called = true;
          return { ok: true };
        },
      }),
    );
    assert.equal(result.ok, true);
    assert.equal(called, true);
  });

  it("executes a pending crawl job", async () => {
    const result = await mutateExecuteCrawlJob(
      { leadId: lead.id, jobId: pendingJob.id },
      baseDeps(),
    );
    assert.equal(result.ok, true);
  });

  it("rejects execute when job is not pending", async () => {
    const result = await mutateExecuteCrawlJob(
      { leadId: lead.id, jobId: pendingJob.id },
      baseDeps({
        getCrawlJob: async () => ({
          ok: true,
          job: { ...pendingJob, status: "completed" },
        }),
      }),
    );
    assert.equal(result.ok, false);
  });

  it("cancels a pending crawl job", async () => {
    const result = await mutateCancelCrawlJob(
      { leadId: lead.id, jobId: pendingJob.id },
      baseDeps(),
    );
    assert.equal(result.ok, true);
  });

  it("returns sanitized error feedback", async () => {
    const result = await mutateCreateCrawlJob(
      { leadId: lead.id },
      baseDeps({
        createCrawlJob: async () => ({
          ok: false,
          message: "supabase postgres jwt api key failure stack",
        }),
      }),
    );
    assert.equal(result.ok, false);
    if (!result.ok) {
      assert.equal(
        result.message,
        sanitizeOperatorError("supabase postgres jwt api key failure stack"),
      );
      assert.doesNotMatch(result.message, /supabase|stack|jwt/i);
    }
  });

  it("blocks mutations in review fixture mode", async () => {
    const result = await mutateCreateCrawlJob(
      { leadId: lead.id },
      baseDeps({ reviewFixturesEnabled: true }),
    );
    assert.equal(result.ok, false);
  });
});

describe("ops labels privacy", () => {
  it("does not echo provider internals", () => {
    assert.doesNotMatch(
      sanitizeOperatorError("Supabase service role JWT stack"),
      /supabase|service role|jwt|stack/i,
    );
  });
});

describe("ops fixtures", () => {
  it("provides a non-empty lead list without sensitive fields", () => {
    assert.ok(FIXTURE_LEADS.length > 0);
    const sample = FIXTURE_LEADS[0] as Record<string, unknown>;
    assert.equal("dedupHash" in sample, false);
    assert.equal("dedup_hash" in sample, false);
    assert.equal("turnstileToken" in sample, false);
  });
});
