import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  FakeClinicRepository,
  FakeCrawlRepository,
  FakeExtractionRepository,
  FakeOutreachRepository,
  FakeScoreRepository,
} from "./repositories/fakes";
import { runCrawlJob, selectJobFailureErrorCode, type CrawlFailureSignal, type RunCrawlJobDeps } from "./run-crawl-job";
import type { FetchPageResult } from "@/lib/crawler/fetch-page";
import type { RobotsPolicy } from "@/lib/crawler/robots";
import type { CrawlErrorCode } from "@/lib/crawler/errors";
import { selectRepositories } from "./pipeline/select-repositories";
import { KNOWN_PROJECT_REFS } from "./pipeline/target-guard";
import type { LeadCaptureEnv } from "@/lib/security/env";

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
  /** Overrides the default "http_error" code for a specific failing URL — lets a test simulate any real CrawlErrorCode (redirect_blocked, timeout, blocked_host, dns_failed, ...) from the injected fetchHtmlPage. */
  failureCodesByUrl?: Partial<Record<string, CrawlErrorCode>>;
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
      const code = options.failureCodesByUrl?.[url] ?? "http_error";
      return { ok: false, code, message: `simulated ${code} for test`, statusCode: code === "http_error" ? 500 : undefined };
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

  it("marks the job failed when every page fails (total failure), preserving the real error_code (not a generic fallback)", async () => {
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
    // The seed URL's own real fetch failure (http_error) is now preserved
    // as the job-level error_code, instead of the old hardcoded
    // "unexpected_error" fallback.
    assert.equal(crawlRepo.jobs.get(result.job.id)?.errorCode, "http_error");
    assert.equal(crawlRepo.jobs.get(result.job.id)?.errorMessage, "The remote server returned an HTTP error.");
    // No extraction/score rows were written when nothing was fetched.
    assert.equal(extractionRepo.byCrawlJob.size, 0);
    assert.equal(scoreRepo.records.length, 0);
    // Total failure never creates an outreach draft — the code path that
    // could ever build one is only reached when pagesFetched > 0.
    assert.equal(result.outreachDraft, null);
  });

  describe("job-level error_code preserves the real failure reason (not a generic unexpected_error fallback)", () => {
    const SCENARIOS: Array<{ code: CrawlErrorCode; label: string }> = [
      { code: "redirect_blocked", label: "redirect_blocked" },
      { code: "timeout", label: "timeout" },
      { code: "blocked_host", label: "blocked_host (private/SSRF re-check after the seed-level check already passed)" },
      { code: "dns_failed", label: "dns_failed" },
      { code: "unsupported_content_type", label: "unsupported_content_type" },
      { code: "response_too_large", label: "response_too_large" },
    ];

    for (const scenario of SCENARIOS) {
      it(`${scenario.label} becomes the job's error_code when the seed fetch fails that way`, async () => {
        const { deps, crawlRepo } = buildTestDeps({
          failUrls: new Set(["https://clinic.example.com/"]),
          failureCodesByUrl: { "https://clinic.example.com/": scenario.code },
        });

        const result = await runCrawlJob(
          { leadId: "lead-1", requestedUrl: "https://clinic.example.com/", maxPages: 2, lookupImpl, delayMs: 0 },
          deps,
        );
        assert.equal(result.ok, true);
        if (!result.ok) return;
        assert.equal(result.finalStatus, "failed");
        assert.equal(result.pagesFetched, 0);
        assert.equal(crawlRepo.jobs.get(result.job.id)?.errorCode, scenario.code);
        assert.equal(result.outreachDraft, null);
      });
    }

    it("an unattributable total failure (maxPages: 0, nothing ever attempted) falls back to unexpected_error, never throws", async () => {
      const { deps, crawlRepo } = buildTestDeps({});
      const result = await runCrawlJob(
        { leadId: "lead-1", requestedUrl: "https://clinic.example.com/", maxPages: 0, lookupImpl, delayMs: 0 },
        deps,
      );
      assert.equal(result.ok, true);
      if (!result.ok) return;
      assert.equal(result.finalStatus, "failed");
      assert.equal(result.pagesFetched, 0);
      assert.equal(crawlRepo.jobs.get(result.job.id)?.errorCode, "unexpected_error");
    });

    it("partial jobs (some pages fetched, some failed) are unaffected — status stays partial, error_code stays the existing page_limit_reached/null logic", async () => {
      const { deps, crawlRepo } = buildTestDeps({
        pages: {
          "https://clinic.example.com/": `<html><body><main><h1>Home</h1><a href="/broken">Broken</a></main></body></html>`,
        },
        failUrls: new Set(["https://clinic.example.com/broken"]),
        failureCodesByUrl: { "https://clinic.example.com/broken": "timeout" },
      });

      const result = await runCrawlJob(
        { leadId: "lead-1", requestedUrl: "https://clinic.example.com/", maxPages: 3, lookupImpl, delayMs: 0 },
        deps,
      );
      assert.equal(result.ok, true);
      if (!result.ok) return;
      assert.equal(result.finalStatus, "partial");
      assert.ok(result.pagesFetched >= 1);
      // A partial job's error_code is still governed by the pre-existing
      // page_limit_reached/null logic — this fix only ever changes the
      // pagesFetched === 0 branch.
      assert.equal(crawlRepo.jobs.get(result.job.id)?.errorCode, null);
    });

    it("a fully completed job (nothing failed) is unaffected — status completed, error_code null", async () => {
      // maxPages generous enough that hitPageLimit never triggers — the
      // default fixture has exactly 2 pages ("/" and "/contato") with no
      // further discoverable links, so both are fetched cleanly.
      const { deps, crawlRepo } = buildTestDeps({});
      const result = await runCrawlJob(
        { leadId: "lead-1", requestedUrl: "https://clinic.example.com/", maxPages: 5, lookupImpl, delayMs: 0 },
        deps,
      );
      assert.equal(result.ok, true);
      if (!result.ok) return;
      assert.equal(result.finalStatus, "completed");
      assert.equal(crawlRepo.jobs.get(result.job.id)?.errorCode, null);
    });
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

describe("selectJobFailureErrorCode (pure priority logic)", () => {
  function signal(code: CrawlErrorCode, severity: CrawlFailureSignal["severity"], isPageLevel: boolean): CrawlFailureSignal {
    return { code, severity, isPageLevel };
  }

  it("1. robots_denied wins when it's the first page-level signal", () => {
    assert.equal(selectJobFailureErrorCode([signal("robots_denied", "info", true)]), "robots_denied");
  });

  it("2. blocked_host (private/SSRF) wins when it's the first page-level signal", () => {
    assert.equal(selectJobFailureErrorCode([signal("blocked_host", "high", true)]), "blocked_host");
  });

  it("3. redirect_blocked wins when it's the first page-level signal", () => {
    assert.equal(selectJobFailureErrorCode([signal("redirect_blocked", "medium", true)]), "redirect_blocked");
  });

  it("4. timeout wins when it's the first page-level signal", () => {
    assert.equal(selectJobFailureErrorCode([signal("timeout", "medium", true)]), "timeout");
  });

  it("6. no signals at all falls back to unexpected_error", () => {
    assert.equal(selectJobFailureErrorCode([]), "unexpected_error");
  });

  it("the FIRST page-level signal wins over any later page-level or finding-only signal, regardless of severity", () => {
    const signals = [
      signal("dns_failed", "medium", true), // the seed's own failure — must win
      signal("persistence_failed", "high", false), // higher severity, but not page-level and not first
      signal("timeout", "medium", true), // a later page's failure — not first
    ];
    assert.equal(selectJobFailureErrorCode(signals), "dns_failed");
  });

  it("when no page-level signal exists, the most severe finding-only signal wins, ties broken by recording order", () => {
    const signals = [
      signal("persistence_failed", "high", false),
      signal("invalid_url", "high", false), // same severity, recorded second — first-recorded wins on a tie
    ];
    assert.equal(selectJobFailureErrorCode(signals), "persistence_failed");

    const infoThenHigh = [
      signal("robots_denied", "info", false),
      signal("persistence_failed", "high", false),
    ];
    assert.equal(selectJobFailureErrorCode(infoThenHigh), "persistence_failed", "higher severity must win over recording order when severities differ");
  });

  it("12. the result is fully deterministic — identical input always produces the identical output", () => {
    const signals = [signal("timeout", "medium", true), signal("persistence_failed", "high", false)];
    const a = selectJobFailureErrorCode(signals);
    const b = selectJobFailureErrorCode(signals);
    assert.equal(a, b);
    // The input array itself is never mutated (no sort-in-place side effect).
    assert.deepEqual(signals, [signal("timeout", "medium", true), signal("persistence_failed", "high", false)]);
  });
});

describe("job-level error reason fix: production refused, no outreach", () => {
  it("11. the shared repository-selection gate refuses production regardless of --target", () => {
    const env: LeadCaptureEnv = {
      supabaseUrl: `https://${KNOWN_PROJECT_REFS.production}.supabase.co`,
      supabaseServiceRoleKey: "x",
      resendApiKey: null,
      leadNotificationEmail: null,
      leadFromEmail: null,
      turnstileSiteKey: null,
      turnstileSecretKey: null,
      leadHashSecret: "x",
      siteUrl: null,
    };
    const selection = selectRepositories({ dryRun: false, target: "staging", env });
    assert.equal(selection.ok, false);
    if (selection.ok) return;
    assert.match(selection.reason, /production/);
  });

  it("10. a total-failure job never touches outreachRepo at all — no draft, no send-capable call", async () => {
    const { deps, outreachRepo } = buildTestDeps({
      failUrls: new Set(["https://clinic.example.com/"]),
    });
    const messagesBefore = outreachRepo.messages.size;

    const result = await runCrawlJob(
      { leadId: "lead-1", requestedUrl: "https://clinic.example.com/", maxPages: 2, lookupImpl, delayMs: 0 },
      deps,
    );
    assert.equal(result.ok, true);
    if (!result.ok) return;
    assert.equal(result.outreachDraft, null);
    assert.equal(outreachRepo.messages.size, messagesBefore);
  });
});
