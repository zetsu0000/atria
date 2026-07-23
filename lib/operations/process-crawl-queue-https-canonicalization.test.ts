import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  FakeClinicRepository,
  FakeCrawlRepository,
  FakeExtractionRepository,
  FakeOutreachRepository,
  FakeScoreRepository,
} from "./repositories/fakes";
import { processCrawlQueue, type ProcessCrawlQueueDeps } from "./pipeline/process-crawl-queue";
import {
  createControlledFetchHtmlPage,
  createControlledLoadRobotsPolicy,
} from "./pipeline/controlled-transport";
import { selectRepositories } from "./pipeline/select-repositories";
import { KNOWN_PROJECT_REFS } from "./pipeline/target-guard";
import type { LookupFn } from "@/lib/crawler/url-policy";
import type { LeadCaptureEnv } from "@/lib/security/env";

/**
 * These tests cover the http:// -> https:// starting-URL canonicalization
 * fix (lib/crawler/url-policy.ts's canonicalizeHttpToHttpsIfSafe, wired in
 * lib/operations/pipeline/process-crawl-queue.ts) at the integration level
 * — the pure-function unit tests live in lib/crawler/url-policy.test.ts.
 *
 * Every test here uses fixture-mode fetch/robots
 * (createControlledFetchHtmlPage/{loadRobotsPolicy}({ allowRealCrawl: false }))
 * for the actual crawl transport — even when `input.allowRealCrawl: true`
 * is passed (required to enable canonicalization at all) — so the actual
 * page fetch never touches the network, matching the same pattern already
 * established in lib/operations/screenshot-assets-pipeline.test.ts. The
 * canonicalization preflight itself is exercised via an injected
 * `httpsPreflightFetchImpl` fake — never a live request.
 */

const FAKE_LOOKUP: LookupFn = async () => [{ address: "93.184.216.34", family: 4 }];

function buildDeps(overrides: Partial<ProcessCrawlQueueDeps> = {}): {
  deps: ProcessCrawlQueueDeps;
  clinicRepo: FakeClinicRepository;
  crawlRepo: FakeCrawlRepository;
} {
  const clinicRepo = new FakeClinicRepository();
  const crawlRepo = new FakeCrawlRepository();
  const deps: ProcessCrawlQueueDeps = {
    clinicRepo,
    crawlRepo,
    extractionRepo: new FakeExtractionRepository(),
    scoreRepo: new FakeScoreRepository(),
    outreachRepo: new FakeOutreachRepository(),
    fetchHtmlPage: createControlledFetchHtmlPage({ allowRealCrawl: false }),
    loadRobotsPolicy: createControlledLoadRobotsPolicy({ allowRealCrawl: false }),
    lookupImpl: FAKE_LOOKUP,
    ...overrides,
  };
  return { deps, clinicRepo, crawlRepo };
}

async function seedClinic(clinicRepo: FakeClinicRepository, websiteUrl: string, dedupeKey: string) {
  const clinic = await clinicRepo.createClinic({
    displayName: "Clínica HTTP Teste",
    normalizedName: "clinica http teste",
    websiteUrl,
    normalizedWebsiteOrigin: new URL(websiteUrl).origin,
    city: null,
    state: "SP",
    specialty: null,
    status: "prospect",
    sourceType: "manual",
    sourceAttribution: {},
    dedupeKey,
  });
  if (!clinic.ok) throw new Error("setup failed");
  return clinic.value;
}

function okHttpsPreflight(): typeof fetch {
  return (async () => new Response(null, { status: 200 })) as unknown as typeof fetch;
}

describe("processCrawlQueue: http:// -> https:// canonicalization", () => {
  it("1. an http:// clinic on an approved host canonicalizes to https:// before crawling, and the crawl succeeds", async () => {
    const { deps, clinicRepo } = buildDeps({ httpsPreflightFetchImpl: okHttpsPreflight() });
    const clinic = await seedClinic(clinicRepo, "http://www.example.com/", "http-canon-clinic");

    const result = await processCrawlQueue({ clinicIds: [clinic.id], allowRealCrawl: true }, deps);
    const outcome = result.processed[0]!;
    assert.equal(outcome.result.ok, true);
    if (outcome.result.ok) {
      assert.ok(["completed", "partial"].includes(outcome.result.finalStatus));
      assert.equal(outcome.result.job.requestedUrl.startsWith("https://"), true);
    }
  });

  it("7. an unapproved http:// host is never upgraded and never preflighted — the allowlist gate still applies", async () => {
    let preflightCalled = false;
    const spyFetch: typeof fetch = (async () => {
      preflightCalled = true;
      return new Response(null, { status: 200 });
    }) as unknown as typeof fetch;
    // lookupImpl deliberately left undefined so processCrawlQueue falls
    // back to the real, host-allowlist-gated createControlledLookup —
    // matching the exact pattern used by the pre-existing "blocks a
    // non-allowlisted real host" test in screenshot-assets-pipeline.test.ts.
    // No approvedRealCrawlHostnames passed — only example.com is allowlisted by default.
    const { deps, clinicRepo } = buildDeps({ httpsPreflightFetchImpl: spyFetch, lookupImpl: undefined });
    const clinic = await seedClinic(clinicRepo, "http://www.some-unapproved-clinic.example.org/", "http-unapproved-clinic");

    const result = await processCrawlQueue({ clinicIds: [clinic.id], allowRealCrawl: true }, deps);
    const outcome = result.processed[0]!;
    assert.equal(preflightCalled, false, "the https preflight must never fire for a non-allowlisted host");
    // A non-allowlisted seed URL fails validation entirely — runCrawlJob
    // never even creates a job — matching the same pre-existing pattern.
    assert.equal(outcome.result.ok, false);
  });

  it("5. a private/localhost http:// URL remains blocked — never upgraded, never preflighted", async () => {
    let preflightCalled = false;
    const spyFetch: typeof fetch = (async () => {
      preflightCalled = true;
      return new Response(null, { status: 200 });
    }) as unknown as typeof fetch;
    // Lookup resolves the allowlisted hostname to a private IP, simulating DNS rebinding —
    // the SSRF guard inside canonicalizeHttpToHttpsIfSafe must still catch this.
    const privateLookup: LookupFn = async () => [{ address: "127.0.0.1", family: 4 }];
    const { deps, clinicRepo } = buildDeps({ httpsPreflightFetchImpl: spyFetch, lookupImpl: privateLookup });
    const clinic = await seedClinic(clinicRepo, "http://www.example.com/", "http-private-ip-clinic");

    const result = await processCrawlQueue({ clinicIds: [clinic.id], allowRealCrawl: true }, deps);
    assert.equal(preflightCalled, false, "the https preflight must never fire when the resolved address is private");
    const outcome = result.processed[0]!;
    // The main crawl also fails, via the exact same SSRF guard applied to
    // the (unchanged) http:// seed URL — no bypass. A blocked seed URL
    // fails validation entirely (runCrawlJob never creates a job), same
    // as the unapproved-host case above.
    assert.equal(outcome.result.ok, false);
  });

  it("6. an https preflight failure (connection/TLS error) leaves the URL unchanged — no bypass, normal flow proceeds", async () => {
    const throwingFetch: typeof fetch = (async () => {
      throw new Error("simulated TLS/connection failure");
    }) as unknown as typeof fetch;
    const { deps, clinicRepo } = buildDeps({ httpsPreflightFetchImpl: throwingFetch });
    const clinic = await seedClinic(clinicRepo, "http://www.example.com/", "http-tls-fail-clinic");

    const result = await processCrawlQueue({ clinicIds: [clinic.id], allowRealCrawl: true }, deps);
    const outcome = result.processed[0]!;
    assert.equal(outcome.result.ok, true);
    if (outcome.result.ok) {
      assert.equal(outcome.result.job.requestedUrl, "http://www.example.com/", "URL stays http:// — no bypass, no upgrade");
    }
  });

  it("4. a cross-host redirect during the https preflight is refused — never upgraded to a different host", async () => {
    const crossHostRedirect: typeof fetch = (async () =>
      new Response(null, {
        status: 302,
        headers: { location: "https://totally-different-host.example.net/" },
      })) as unknown as typeof fetch;
    const { deps, clinicRepo } = buildDeps({ httpsPreflightFetchImpl: crossHostRedirect });
    const clinic = await seedClinic(clinicRepo, "http://www.example.com/", "http-cross-host-clinic");

    const result = await processCrawlQueue({ clinicIds: [clinic.id], allowRealCrawl: true }, deps);
    const outcome = result.processed[0]!;
    assert.equal(outcome.result.ok, true);
    if (outcome.result.ok) {
      assert.equal(outcome.result.job.requestedUrl, "http://www.example.com/", "must never adopt a different host, even from the site's own redirect");
    }
  });

  it("4d. a same-registrable-domain www -> apex redirect (the real CEPELLE staging case) is accepted when both hosts are in --approved-domains", async () => {
    const wwwToApexRedirect: typeof fetch = (async () =>
      new Response(null, { status: 301, headers: { location: "https://cepelle.com.br/" } })) as unknown as typeof fetch;
    const { deps, clinicRepo } = buildDeps({ httpsPreflightFetchImpl: wwwToApexRedirect });
    const clinic = await seedClinic(clinicRepo, "http://www.cepelle.com.br/", "cepelle-www-to-apex-clinic");

    const result = await processCrawlQueue(
      {
        clinicIds: [clinic.id],
        allowRealCrawl: true,
        approvedRealCrawlHostnames: ["cepelle.com.br", "www.cepelle.com.br"],
      },
      deps,
    );
    const outcome = result.processed[0]!;
    assert.equal(outcome.result.ok, true);
    if (outcome.result.ok) {
      assert.equal(outcome.result.job.requestedUrl, "https://cepelle.com.br/");
    }
  });

  it("2. an https:// clinic is never touched by the canonicalization path at all", async () => {
    let preflightCalled = false;
    const spyFetch: typeof fetch = (async () => {
      preflightCalled = true;
      return new Response(null, { status: 200 });
    }) as unknown as typeof fetch;
    const { deps, clinicRepo } = buildDeps({ httpsPreflightFetchImpl: spyFetch });
    const clinic = await seedClinic(clinicRepo, "https://www.example.com/", "https-unchanged-clinic");

    const result = await processCrawlQueue({ clinicIds: [clinic.id], allowRealCrawl: true }, deps);
    assert.equal(preflightCalled, false);
    const outcome = result.processed[0]!;
    assert.equal(outcome.result.ok, true);
    if (outcome.result.ok) {
      assert.equal(outcome.result.job.requestedUrl, "https://www.example.com/");
    }
  });

  it("9. fixture/default mode (allowRealCrawl: false) never invokes the https preflight, even for an http:// clinic", async () => {
    let preflightCalled = false;
    const spyFetch: typeof fetch = (async () => {
      preflightCalled = true;
      return new Response(null, { status: 200 });
    }) as unknown as typeof fetch;
    const { deps, clinicRepo } = buildDeps({ httpsPreflightFetchImpl: spyFetch });
    const clinic = await seedClinic(clinicRepo, "http://www.example.com/", "fixture-mode-clinic");

    const result = await processCrawlQueue({ clinicIds: [clinic.id], allowRealCrawl: false }, deps);
    assert.equal(preflightCalled, false);
    const outcome = result.processed[0]!;
    assert.equal(outcome.result.ok, true);
    if (outcome.result.ok) {
      assert.equal(outcome.result.job.requestedUrl, "http://www.example.com/", "no canonicalization in fixture mode — URL passed through as-is");
      assert.ok(["completed", "partial"].includes(outcome.result.finalStatus));
    }
  });

  it("10. maxPages is still fully respected after a canonicalized start — no broad crawl", async () => {
    const { deps, clinicRepo } = buildDeps({ httpsPreflightFetchImpl: okHttpsPreflight() });
    const clinic = await seedClinic(clinicRepo, "http://www.example.com/", "max-pages-clinic");

    const result = await processCrawlQueue({ clinicIds: [clinic.id], allowRealCrawl: true, maxPages: 1 }, deps);
    const outcome = result.processed[0]!;
    assert.equal(outcome.result.ok, true);
    if (outcome.result.ok) {
      assert.ok(outcome.result.pagesFetched <= 1);
    }
  });

  it("12. a successful canonicalization records a deterministic, auditable crawl_findings row", async () => {
    const { deps, clinicRepo, crawlRepo } = buildDeps({ httpsPreflightFetchImpl: okHttpsPreflight() });
    const clinic = await seedClinic(clinicRepo, "http://www.example.com/", "canon-metadata-clinic");

    const result = await processCrawlQueue({ clinicIds: [clinic.id], allowRealCrawl: true }, deps);
    const outcome = result.processed[0]!;
    assert.equal(outcome.result.ok, true);
    if (!outcome.result.ok) return;
    const findings = crawlRepo.findings.get(outcome.result.job.id) ?? [];
    const canonFinding = findings.find((f) => f.code === "http_to_https_canonicalized");
    assert.ok(canonFinding, "expected an http_to_https_canonicalized finding to be recorded");
    assert.equal(canonFinding!.category, "ops");
    assert.equal(canonFinding!.severity, "info");
    assert.deepEqual(canonFinding!.details, {
      originalUrl: "http://www.example.com/",
      canonicalUrl: "https://www.example.com/",
      reason: "http_to_https_preflight_ok",
    });
  });

  it("9. combined with the job-level error-reason fix: when a canonicalized crawl still ultimately fails, the job's error_code preserves the real reason, and the canonicalization finding remains present and auditable alongside it", async () => {
    const { deps, clinicRepo, crawlRepo } = buildDeps({
      httpsPreflightFetchImpl: okHttpsPreflight(),
      // The starting URL upgrades successfully (preflight passes), but the
      // actual bounded crawl of the (now https://) URL still fails — e.g.
      // a timeout on the real content fetch, independent of the preflight.
      fetchHtmlPage: async () => ({ ok: false, code: "timeout", message: "simulated timeout for test" }),
    });
    const clinic = await seedClinic(clinicRepo, "http://www.example.com/", "canon-then-fail-clinic");

    const result = await processCrawlQueue({ clinicIds: [clinic.id], allowRealCrawl: true }, deps);
    const outcome = result.processed[0]!;
    assert.equal(outcome.result.ok, true);
    if (!outcome.result.ok) return;
    assert.equal(outcome.result.finalStatus, "failed");
    assert.equal(outcome.result.pagesFetched, 0);
    // The real failure reason (timeout) is preserved — never collapsed to unexpected_error.
    assert.equal(crawlRepo.jobs.get(outcome.result.job.id)?.errorCode, "timeout");
    assert.equal(outcome.result.job.requestedUrl, "https://www.example.com/", "the URL was still canonicalized before the crawl attempt");

    const findings = crawlRepo.findings.get(outcome.result.job.id) ?? [];
    const canonFinding = findings.find((f) => f.code === "http_to_https_canonicalized");
    assert.ok(canonFinding, "the canonicalization finding must still be recorded, even though the crawl itself later failed");
    const fetchFinding = findings.find((f) => f.code === "timeout");
    assert.ok(fetchFinding, "the real fetch failure must also be recorded as its own finding");
  });

  it("11. screenshot capture behavior is unaffected by canonicalization when screenshots aren't requested", async () => {
    const { deps, clinicRepo } = buildDeps({ httpsPreflightFetchImpl: okHttpsPreflight() });
    const clinic = await seedClinic(clinicRepo, "http://www.example.com/", "no-screenshot-request-clinic");

    const result = await processCrawlQueue(
      { clinicIds: [clinic.id], allowRealCrawl: true, captureScreenshots: false },
      deps,
    );
    const outcome = result.processed[0]!;
    assert.equal(outcome.result.ok, true);
    assert.equal(outcome.screenshots.length, 0);
    assert.equal(outcome.screenshotsSkippedReason, null);
  });

  it("8. production is still refused regardless of this change", () => {
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
});
