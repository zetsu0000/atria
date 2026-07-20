import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  FakeClinicRepository,
  FakeCrawlRepository,
  FakeExtractionRepository,
  FakeOutreachRepository,
  FakeScoreRepository,
} from "./repositories/fakes";
import { runCrawlJob, type RunCrawlJobDeps } from "./run-crawl-job";
import type { FetchPageResult } from "@/lib/crawler/fetch-page";
import type { RobotsPolicy } from "@/lib/crawler/robots";

/**
 * All tests in this file use fixtures/mocked transports only. `fetchHtmlPage`
 * and `loadRobotsPolicy` are replaced with in-memory fakes, so no real
 * network request is ever made, and no live Supabase connection is used
 * (all repositories are the in-memory fakes from lib/operations/repositories/fakes.ts).
 */

function buildTestDeps(options: {
  pages?: Record<string, string>;
  robotsAllow?: boolean;
  failUrls?: Set<string>;
}): {
  deps: RunCrawlJobDeps;
  crawlRepo: FakeCrawlRepository;
  clinicRepo: FakeClinicRepository;
  extractionRepo: FakeExtractionRepository;
  scoreRepo: FakeScoreRepository;
  outreachRepo: FakeOutreachRepository;
} {
  const htmlPages =
    options.pages ??
    ({
      "https://clinic.example.com/": `<html><body>
        <head><title>Clínica Exemplo</title><meta name="description" content="Dermatologia em São Paulo"></head>
        <main>
          <h1>Clínica Exemplo</h1>
          <h2>Serviços</h2>
          <p>Telefone: (11) 99999-8888. E-mail: contato@clinica-exemplo.com.br</p>
          <a href="/contato">Contato</a>
          <a href="https://wa.me/5511999998888">WhatsApp</a>
        </main>
      </body></html>` as string,
      "https://clinic.example.com/contato": `<html><body><main><h1>Contato</h1><p>Rua das Flores, 123</p></main></body></html>`,
    } as Record<string, string>);

  const crawlRepo = new FakeCrawlRepository();
  const clinicRepo = new FakeClinicRepository();
  const extractionRepo = new FakeExtractionRepository();
  const scoreRepo = new FakeScoreRepository();
  const outreachRepo = new FakeOutreachRepository();

  const fetchHtmlPage: RunCrawlJobDeps["fetchHtmlPage"] = async ({ url }): Promise<FetchPageResult> => {
    if (options.failUrls?.has(url)) {
      return { ok: false, code: "http_error", message: "The remote server returned an HTTP error.", statusCode: 500 };
    }
    const body = htmlPages[url];
    if (!body) {
      return { ok: false, code: "http_error", message: "The remote server returned an HTTP error.", statusCode: 404 };
    }
    return {
      ok: true,
      page: { finalUrl: url, statusCode: 200, contentType: "text/html", bodyText: body, fetchDurationMs: 1 },
    };
  };

  const loadRobotsPolicy: RunCrawlJobDeps["loadRobotsPolicy"] = async (): Promise<RobotsPolicy> => ({
    available: true,
    crawlDelayMs: 0,
    sitemaps: [],
    conservativeFallback: false,
    isPathAllowed: () => options.robotsAllow !== false,
  });

  const deps: RunCrawlJobDeps = {
    crawlRepo,
    clinicRepo,
    extractionRepo,
    scoreRepo,
    outreachRepo,
    fetchHtmlPage,
    loadRobotsPolicy,
  };

  return { deps, crawlRepo, clinicRepo, extractionRepo, scoreRepo, outreachRepo };
}

const lookupImpl = async () => [{ address: "93.184.216.34", family: 4 }];

async function createClinic(clinicRepo: FakeClinicRepository) {
  const created = await clinicRepo.createClinic({
    displayName: "Clínica Exemplo",
    normalizedName: "clinica exemplo",
    websiteUrl: "https://clinic.example.com",
    normalizedWebsiteOrigin: "https://clinic.example.com",
    city: "São Paulo",
    state: "SP",
    specialty: "Dermatologia",
    status: "prospect",
    sourceType: "manual",
    sourceAttribution: {},
    dedupeKey: "clinic-example-dedupe",
  });
  if (!created.ok) throw new Error("setup failed");
  return created.value;
}

describe("runCrawlJob (repository-backed orchestrator)", () => {
  it("succeeds end-to-end with fixtures: pages, extraction, score are persisted", async () => {
    const { deps, crawlRepo, extractionRepo, scoreRepo } = buildTestDeps({});
    const result = await runCrawlJob(
      { leadId: "lead-1", requestedUrl: "https://clinic.example.com/", maxPages: 2, lookupImpl, delayMs: 0 },
      deps,
    );

    assert.equal(result.ok, true);
    if (!result.ok) return;
    assert.ok(["completed", "partial"].includes(result.finalStatus));
    assert.ok(result.pagesFetched >= 1);
    assert.ok(result.extraction);
    assert.ok(result.score);
    assert.equal(result.outreachDraft, null, "outreach draft must not be created unless explicitly requested");

    // Pages were actually persisted through the repository, not just returned.
    assert.ok((crawlRepo.pages.get(result.job.id) ?? []).length >= 1);
    assert.ok((extractionRepo.byCrawlJob.get(result.job.id) ?? []).length === 1);
    assert.ok(scoreRepo.records.some((s) => s.crawlJobId === result.job.id));

    // Score always carries the five dimensions, matching total, and the disclaimer.
    assert.equal(
      result.score!.total,
      result.score!.credibility +
        result.score!.clarity +
        result.score!.mobile +
        result.score!.actionability +
        result.score!.freshness,
    );
    assert.match(result.score!.disclaimer, /apresentação digital/);
  });

  it("attaches high-confidence extracted contacts to the clinic when a clinicId is provided", async () => {
    const { deps, clinicRepo } = buildTestDeps({});
    const clinic = await createClinic(clinicRepo);

    const result = await runCrawlJob(
      {
        leadId: "lead-1",
        clinicId: clinic.id,
        requestedUrl: "https://clinic.example.com/",
        maxPages: 2,
        lookupImpl,
        delayMs: 0,
      },
      deps,
    );
    assert.equal(result.ok, true);
    if (!result.ok) return;

    const contacts = await clinicRepo.listContacts(clinic.id);
    assert.equal(contacts.ok, true);
    if (!contacts.ok) return;
    assert.ok(contacts.value.some((c) => c.contactType === "email"));
    assert.ok(contacts.value.every((c) => c.reviewStatus === "pending_review"));
  });

  it("records a partial crawl when some pages fail without stopping the whole job", async () => {
    const { deps, crawlRepo } = buildTestDeps({
      pages: {
        "https://clinic.example.com/": `<html><body><main><h1>Home</h1><a href="/broken">Broken</a></main></body></html>`,
      },
      failUrls: new Set(["https://clinic.example.com/broken"]),
    });

    const result = await runCrawlJob(
      { leadId: "lead-1", requestedUrl: "https://clinic.example.com/", maxPages: 3, lookupImpl, delayMs: 0 },
      deps,
    );
    assert.equal(result.ok, true);
    if (!result.ok) return;
    assert.ok(result.pagesFetched >= 1);
    assert.ok(result.pagesFailed >= 1);
    assert.equal(result.finalStatus, "partial");
    assert.equal(crawlRepo.jobs.get(result.job.id)?.status, "partial");
  });

  it("marks the job failed when every page fails (total failure)", async () => {
    const { deps, crawlRepo, extractionRepo, scoreRepo } = buildTestDeps({
      failUrls: new Set(["https://clinic.example.com/"]),
    });

    const result = await runCrawlJob(
      { leadId: "lead-1", requestedUrl: "https://clinic.example.com/", maxPages: 2, lookupImpl, delayMs: 0 },
      deps,
    );
    assert.equal(result.ok, true);
    if (!result.ok) return;
    assert.equal(result.finalStatus, "failed");
    assert.equal(result.pagesFetched, 0);
    assert.equal(result.extraction, null);
    assert.equal(result.score, null);
    assert.equal(crawlRepo.jobs.get(result.job.id)?.status, "failed");
    // No extraction/score rows were written when nothing was fetched.
    assert.equal(extractionRepo.byCrawlJob.size, 0);
    assert.equal(scoreRepo.records.length, 0);
  });

  it("fails fast when robots.txt denies the seed path, without fetching pages", async () => {
    const { deps, crawlRepo } = buildTestDeps({ robotsAllow: false });
    const result = await runCrawlJob(
      { leadId: "lead-1", requestedUrl: "https://clinic.example.com/", maxPages: 2, lookupImpl, delayMs: 0 },
      deps,
    );
    assert.equal(result.ok, false);
    if (result.ok) return;
    assert.equal(result.reason, "robots_denied");
    assert.equal(crawlRepo.jobs.get(result.job!.id)?.status, "failed");
    assert.equal((crawlRepo.pages.get(result.job!.id) ?? []).length, 0);
  });

  it("creates an outreach draft only when explicitly requested, and never sends it", async () => {
    const { deps, clinicRepo, outreachRepo } = buildTestDeps({});
    const clinic = await createClinic(clinicRepo);

    const withoutDraft = await runCrawlJob(
      {
        leadId: "lead-1",
        clinicId: clinic.id,
        requestedUrl: "https://clinic.example.com/",
        maxPages: 1,
        lookupImpl,
        delayMs: 0,
      },
      deps,
    );
    assert.equal(withoutDraft.ok, true);
    if (!withoutDraft.ok) return;
    assert.equal(withoutDraft.outreachDraft, null);
    assert.equal(outreachRepo.messages.size, 0);

    const { deps: deps2, clinicRepo: clinicRepo2, outreachRepo: outreachRepo2 } = buildTestDeps({});
    const clinic2 = await createClinic(clinicRepo2);
    const withDraft = await runCrawlJob(
      {
        leadId: "lead-1",
        clinicId: clinic2.id,
        requestedUrl: "https://clinic.example.com/",
        maxPages: 1,
        lookupImpl,
        delayMs: 0,
        outreachDraft: { channel: "email" },
      },
      deps2,
    );
    assert.equal(withDraft.ok, true);
    if (!withDraft.ok) return;
    assert.ok(withDraft.outreachDraft);
    assert.equal(withDraft.outreachDraft!.status, "draft");
    assert.equal(withDraft.outreachDraft!.humanReviewed, false);
    // Draft persisted through the repository, and it is never auto-sent.
    assert.equal(outreachRepo2.messages.get(withDraft.outreachDraft!.id)?.status, "draft");
  });

  it("never creates an outreach draft for a do_not_contact clinic, even when explicitly requested", async () => {
    const { deps, clinicRepo, outreachRepo } = buildTestDeps({});
    const clinic = await createClinic(clinicRepo);
    await clinicRepo.setDoNotContact(clinic.id, true, "opted out");

    const result = await runCrawlJob(
      {
        leadId: "lead-1",
        clinicId: clinic.id,
        requestedUrl: "https://clinic.example.com/",
        maxPages: 1,
        lookupImpl,
        delayMs: 0,
        outreachDraft: { channel: "email" },
      },
      deps,
    );
    assert.equal(result.ok, true);
    if (!result.ok) return;
    assert.equal(result.outreachDraft, null);
    assert.equal(outreachRepo.messages.size, 0);
  });

  it("persists provided screenshot metadata as scan_assets without any binary bytes", async () => {
    const { deps, crawlRepo } = buildTestDeps({});
    const result = await runCrawlJob(
      {
        leadId: "lead-1",
        requestedUrl: "https://clinic.example.com/",
        maxPages: 1,
        lookupImpl,
        delayMs: 0,
        screenshots: [
          {
            assetType: "screenshot_desktop",
            storagePath: "private/scan-assets/job/desktop.png",
            contentType: "image/png",
            widthPx: 1440,
            heightPx: 900,
            pageUrl: "https://clinic.example.com/",
            reviewStatus: "pending_review",
            metadata: { captured: false },
          },
        ],
      },
      deps,
    );
    assert.equal(result.ok, true);
    if (!result.ok) return;
    assert.equal(result.assets.length, 1);
    assert.equal(result.assets[0]!.storagePath, "private/scan-assets/job/desktop.png");
    assert.equal(crawlRepo.assets.get(result.job.id)?.length, 1);
  });

  it("resumes an already-created pending crawl job via crawlJobId", async () => {
    const { deps, crawlRepo } = buildTestDeps({});
    const created = await crawlRepo.createCrawlJob({
      leadId: "lead-1",
      requestedUrl: "https://clinic.example.com/",
      normalizedOrigin: "https://clinic.example.com",
      maxPages: 1,
    });
    if (!created.ok) return assert.fail();

    const result = await runCrawlJob(
      { crawlJobId: created.value.id, leadId: "lead-1", requestedUrl: "https://clinic.example.com/", lookupImpl, delayMs: 0 },
      deps,
    );
    assert.equal(result.ok, true);
    if (!result.ok) return;
    assert.equal(result.job.id, created.value.id);
  });

  it("runs a clinic-centric crawl with no leadId at all, without fabricating one", async () => {
    const { deps, crawlRepo, clinicRepo } = buildTestDeps({});
    const clinic = await createClinic(clinicRepo);

    const result = await runCrawlJob(
      {
        clinicId: clinic.id,
        requestedUrl: "https://clinic.example.com/",
        maxPages: 1,
        lookupImpl,
        delayMs: 0,
      },
      deps,
    );
    assert.equal(result.ok, true);
    if (!result.ok) return;
    assert.equal(result.job.clinicId, clinic.id);
    assert.equal(result.job.leadId, null);
    assert.equal(crawlRepo.jobs.get(result.job.id)?.leadId, null);
  });

  it("rejects a new crawl job with neither leadId nor clinicId, before touching any repository", async () => {
    const { deps, crawlRepo } = buildTestDeps({});
    const result = await runCrawlJob(
      { requestedUrl: "https://clinic.example.com/", maxPages: 1, lookupImpl, delayMs: 0 },
      deps,
    );
    assert.equal(result.ok, false);
    if (result.ok) return;
    assert.equal(result.reason, "validation");
    assert.equal(crawlRepo.jobs.size, 0);
  });
});
