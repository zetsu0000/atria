import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  FakeClinicRepository,
  FakeCrawlRepository,
  FakeDiscoveryRepository,
  FakeExtractionRepository,
  FakeOutreachRepository,
  FakeScoreRepository,
} from "./repositories/fakes";
import { importCandidatesFromCsv } from "./pipeline/import-candidates";
import { processCrawlQueue } from "./pipeline/process-crawl-queue";
import { runControlledPipeline, type RunControlledPipelineDeps } from "./pipeline/run-controlled-pipeline";
import { selectRepositories } from "./pipeline/select-repositories";
import { assertSafeTarget, KNOWN_PROJECT_REFS } from "./pipeline/target-guard";
import {
  ALLOWED_REAL_CRAWL_HOSTNAMES,
  createControlledFetchHtmlPage,
  createControlledLoadRobotsPolicy,
  createControlledLookup,
  isAllowedRealCrawlHost,
  isValidApprovedDomainEntry,
  resolveAllowedRealCrawlHostnames,
} from "./pipeline/controlled-transport";
import { resolveAndValidatePublicUrl, type LookupFn } from "@/lib/crawler/url-policy";
import type { LeadCaptureEnv } from "@/lib/security/env";

const root = join(__dirname, "..", "..");
const EXAMPLE_CSV = readFileSync(join(root, "data/examples/prospect-candidates.example.csv"), "utf8");

function baseEnv(overrides: Partial<LeadCaptureEnv> = {}): LeadCaptureEnv {
  return {
    supabaseUrl: null,
    supabaseServiceRoleKey: null,
    resendApiKey: null,
    leadNotificationEmail: null,
    leadFromEmail: null,
    turnstileSiteKey: null,
    turnstileSecretKey: null,
    leadHashSecret: null,
    siteUrl: null,
    ...overrides,
  };
}

function buildFakeDeps(allowRealCrawl = false): RunControlledPipelineDeps {
  return {
    discoveryRepo: new FakeDiscoveryRepository(),
    clinicRepo: new FakeClinicRepository(),
    crawlRepo: new FakeCrawlRepository(),
    extractionRepo: new FakeExtractionRepository(),
    scoreRepo: new FakeScoreRepository(),
    outreachRepo: new FakeOutreachRepository(),
    fetchHtmlPage: createControlledFetchHtmlPage({ allowRealCrawl }),
    loadRobotsPolicy: createControlledLoadRobotsPolicy({ allowRealCrawl }),
  };
}

describe("target-guard: production refusal", () => {
  it("refuses when SUPABASE_URL resolves to the production project ref, regardless of target", () => {
    const url = `https://${KNOWN_PROJECT_REFS.production}.supabase.co`;
    const asStaging = assertSafeTarget("staging", url);
    assert.equal(asStaging.ok, false);
    const asLocal = assertSafeTarget("local", url);
    assert.equal(asLocal.ok, false);
  });

  it("accepts staging target only when SUPABASE_URL matches the known staging ref", () => {
    const good = assertSafeTarget("staging", `https://${KNOWN_PROJECT_REFS.staging}.supabase.co`);
    assert.equal(good.ok, true);
    const bad = assertSafeTarget("staging", "https://some-other-ref.supabase.co");
    assert.equal(bad.ok, false);
  });

  it("accepts local target only for loopback SUPABASE_URL (or unset)", () => {
    assert.equal(assertSafeTarget("local", null).ok, true);
    assert.equal(assertSafeTarget("local", "http://127.0.0.1:54321").ok, true);
    assert.equal(assertSafeTarget("local", "https://some-remote.supabase.co").ok, false);
  });

  it("rejects an unknown target string", () => {
    // @ts-expect-error deliberately invalid target for the guard
    const result = assertSafeTarget("production", null);
    assert.equal(result.ok, false);
  });
});

describe("selectRepositories", () => {
  it("dry-run always returns in-memory fakes and never requires a target", () => {
    const result = selectRepositories({ dryRun: true, env: baseEnv() });
    assert.equal(result.ok, true);
    if (!result.ok) return;
    assert.equal(result.value.usedFakes, true);
    assert.ok(result.value.discoveryRepo instanceof FakeDiscoveryRepository);
    assert.ok(result.value.clinicRepo instanceof FakeClinicRepository);
  });

  it("refuses non-dry-run without an explicit target", () => {
    const result = selectRepositories({ dryRun: false, env: baseEnv() });
    assert.equal(result.ok, false);
  });

  it("refuses non-dry-run staging target when SUPABASE_URL is production", () => {
    const result = selectRepositories({
      dryRun: false,
      target: "staging",
      env: baseEnv({ supabaseUrl: `https://${KNOWN_PROJECT_REFS.production}.supabase.co` }),
    });
    assert.equal(result.ok, false);
    if (result.ok) return;
    assert.match(result.reason, /production/);
  });

  it("accepts non-dry-run local target with a loopback SUPABASE_URL and builds real Supabase repos", () => {
    const result = selectRepositories({
      dryRun: false,
      target: "local",
      env: baseEnv({ supabaseUrl: "http://127.0.0.1:54321" }),
    });
    assert.equal(result.ok, true);
    if (!result.ok) return;
    assert.equal(result.value.usedFakes, false);
  });
});

describe("controlled-transport: fixture-only default and real-crawl allowlist", () => {
  it("never calls the network when allowRealCrawl is false, regardless of URL", async () => {
    const fetchHtmlPage = createControlledFetchHtmlPage({ allowRealCrawl: false });
    const result = await fetchHtmlPage({ url: "https://not-a-real-clinic.invalid/", allowedOrigin: "https://not-a-real-clinic.invalid" });
    assert.equal(result.ok, true);
    if (result.ok) assert.match(result.page.bodyText, /Clínica Fixture/);
  });

  it("blocks a real fetch to a non-allowlisted host even when allowRealCrawl is true", async () => {
    const fetchHtmlPage = createControlledFetchHtmlPage({ allowRealCrawl: true });
    const result = await fetchHtmlPage({ url: "https://some-arbitrary-clinic.example.org/", allowedOrigin: "https://some-arbitrary-clinic.example.org" });
    assert.equal(result.ok, false);
    if (!result.ok) assert.equal(result.code, "blocked_host");
  });

  it("exposes example.com as the only default allowed real-crawl hostname", () => {
    assert.deepEqual([...ALLOWED_REAL_CRAWL_HOSTNAMES], ["example.com", "www.example.com"]);
  });

  it("controlled lookup never performs a real DNS call when allowRealCrawl is false", async () => {
    const lookupImpl = createControlledLookup({ allowRealCrawl: false });
    const addresses = await lookupImpl("this-hostname-does-not-exist.invalid");
    assert.ok(addresses.length > 0);
    assert.equal(addresses[0]!.family, 4);
  });

  it("fixture-mode robots policy allows every path without any network call", async () => {
    const loadRobotsPolicy = createControlledLoadRobotsPolicy({ allowRealCrawl: false });
    const policy = await loadRobotsPolicy({ origin: "https://not-a-real-clinic.invalid" });
    assert.equal(policy.isPathAllowed("/qualquer-caminho"), true);
  });
});

describe("controlled-transport: manual approved-domain mechanism", () => {
  const APPROVED = ["grupocpd.com.br", "www.grupocpd.com.br"];
  // A fake "real" DNS lookup standing in for node:dns — never a real network
  // call — used only to exercise the allowlist gate all the way through
  // createControlledLookup's allowed branch without touching the network.
  const publicIpLookup: LookupFn = async () => [{ address: "8.8.8.8", family: 4 }];

  it("1. an unapproved real domain stays blocked, even while a different domain is approved", async () => {
    const fetchHtmlPage = createControlledFetchHtmlPage({ allowRealCrawl: true, approvedRealCrawlHostnames: APPROVED });
    const result = await fetchHtmlPage({
      url: "https://some-other-unapproved-clinic.example.org/",
      allowedOrigin: "https://some-other-unapproved-clinic.example.org",
    });
    assert.equal(result.ok, false);
    if (!result.ok) assert.equal(result.code, "blocked_host");

    const lookupImpl = createControlledLookup({ allowRealCrawl: true, approvedRealCrawlHostnames: APPROVED, realLookupImpl: publicIpLookup });
    await assert.rejects(() => lookupImpl("some-other-unapproved-clinic.example.org"));
  });

  it("2. an approved real domain is allowed only once explicitly passed — not by default, and not for unlisted domains", async () => {
    const withoutApproval = resolveAllowedRealCrawlHostnames({ allowRealCrawl: true });
    assert.equal(isAllowedRealCrawlHost("grupocpd.com.br", withoutApproval), false);

    const withApproval = resolveAllowedRealCrawlHostnames({ allowRealCrawl: true, approvedRealCrawlHostnames: APPROVED });
    assert.equal(isAllowedRealCrawlHost("grupocpd.com.br", withApproval), true);
    assert.equal(isAllowedRealCrawlHost("www.grupocpd.com.br", withApproval), true);
    assert.equal(isAllowedRealCrawlHost("random-other-domain.com", withApproval), false);
    // The default example.com allowlist is still intact — approval only extends it.
    assert.equal(isAllowedRealCrawlHost("example.com", withApproval), true);

    // Full gate, exercised end-to-end via createControlledLookup (still no real network — see publicIpLookup).
    const lookupWithoutApproval = createControlledLookup({ allowRealCrawl: true, realLookupImpl: publicIpLookup });
    await assert.rejects(() => lookupWithoutApproval("grupocpd.com.br"));

    const lookupWithApproval = createControlledLookup({
      allowRealCrawl: true,
      approvedRealCrawlHostnames: APPROVED,
      realLookupImpl: publicIpLookup,
    });
    const addresses = await lookupWithApproval("grupocpd.com.br");
    assert.deepEqual(addresses, [{ address: "8.8.8.8", family: 4 }]);
    const wwwAddresses = await lookupWithApproval("www.grupocpd.com.br");
    assert.ok(wwwAddresses.length > 0);
  });

  it("3. production is refused even when a real domain has been explicitly approved — fully independent gates", () => {
    const productionUrl = `https://${KNOWN_PROJECT_REFS.production}.supabase.co`;
    const selection = selectRepositories({
      dryRun: false,
      target: "staging",
      env: baseEnv({ supabaseUrl: productionUrl }),
    });
    assert.equal(selection.ok, false);
    if (!selection.ok) assert.match(selection.reason, /production/);

    // Approving a domain never touches SUPABASE_URL / the target-guard —
    // it only ever widens the controlled-transport hostname allowlist.
    const withApproval = resolveAllowedRealCrawlHostnames({ allowRealCrawl: true, approvedRealCrawlHostnames: APPROVED });
    assert.equal(isAllowedRealCrawlHost("grupocpd.com.br", withApproval), true);
    assert.equal(assertSafeTarget("staging", productionUrl).ok, false);
  });

  it("4a. 'localhost' is blocked before the hostname allowlist is even consulted, even if explicitly (mistakenly) approved", async () => {
    const lookupImpl = createControlledLookup({ allowRealCrawl: true, approvedRealCrawlHostnames: ["localhost"], realLookupImpl: publicIpLookup });
    const result = await resolveAndValidatePublicUrl("http://localhost:9999/", lookupImpl);
    assert.equal(result.ok, false);
    if (!result.ok) assert.equal(result.code, "blocked_host");
  });

  it("4b. an approved domain that resolves to a private IP is still blocked — the SSRF guard is independent of hostname approval", async () => {
    const privateIpLookup: LookupFn = async () => [{ address: "10.0.0.5", family: 4 }];
    const lookupImpl = createControlledLookup({
      allowRealCrawl: true,
      approvedRealCrawlHostnames: APPROVED,
      realLookupImpl: privateIpLookup,
    });
    const result = await resolveAndValidatePublicUrl("https://grupocpd.com.br/", lookupImpl);
    assert.equal(result.ok, false);
    if (!result.ok) assert.equal(result.code, "blocked_host");
  });

  it("6a. isValidApprovedDomainEntry rejects wildcards, protocols, paths, ports, whitespace, and raw IPs", () => {
    const bad = [
      "*",
      "*.grupocpd.com.br",
      "grupocpd.*",
      "",
      "   ",
      "https://grupocpd.com.br",
      "grupocpd.com.br/path",
      "grupocpd.com.br:8080",
      "8.8.8.8",
      "grupocpd..com.br",
      ".grupocpd.com.br",
      "grupocpd.com.br.",
      "user@grupocpd.com.br",
    ];
    for (const entry of bad) {
      assert.equal(isValidApprovedDomainEntry(entry), false, `expected "${entry}" to be rejected`);
    }
    assert.equal(isValidApprovedDomainEntry("grupocpd.com.br"), true);
    assert.equal(isValidApprovedDomainEntry("www.grupocpd.com.br"), true);
    assert.equal(isValidApprovedDomainEntry("GRUPOCPD.COM.BR"), true);
  });

  it("6b. a literal wildcard-looking approved entry never behaves as a real wildcard match (no glob semantics)", () => {
    const allowed = resolveAllowedRealCrawlHostnames({ allowRealCrawl: true, approvedRealCrawlHostnames: ["*.grupocpd.com.br"] });
    assert.equal(isAllowedRealCrawlHost("sub.grupocpd.com.br", allowed), false);
    assert.equal(isAllowedRealCrawlHost("grupocpd.com.br", allowed), false);
  });

  it("7. approvedRealCrawlHostnames has no effect in fixture mode — still zero network calls, fixture content only", async () => {
    const fetchHtmlPage = createControlledFetchHtmlPage({ allowRealCrawl: false, approvedRealCrawlHostnames: APPROVED });
    const result = await fetchHtmlPage({ url: "https://grupocpd.com.br/", allowedOrigin: "https://grupocpd.com.br" });
    assert.equal(result.ok, true);
    if (result.ok) assert.match(result.page.bodyText, /Clínica Fixture/);

    const lookupImpl = createControlledLookup({ allowRealCrawl: false, approvedRealCrawlHostnames: APPROVED });
    const addresses = await lookupImpl("grupocpd.com.br");
    assert.deepEqual(addresses, [{ address: "93.184.216.34", family: 4 }]);
  });
});

describe("importCandidatesFromCsv: bounded, deduplicated, no external API calls", () => {
  it("imports at most maxCandidates rows from the bundled example CSV (default 5 of 6)", async () => {
    const discoveryRepo = new FakeDiscoveryRepository();
    const result = await importCandidatesFromCsv({ csvText: EXAMPLE_CSV }, { discoveryRepo });
    assert.equal(result.totalRowsInCsv, 6);
    assert.equal(result.imported.length, 5);
    assert.equal(result.truncatedByMaxCandidates, true);
    assert.equal(result.duplicates.length, 0);
  });

  it("respects a custom --max-candidates bound", async () => {
    const discoveryRepo = new FakeDiscoveryRepository();
    const result = await importCandidatesFromCsv({ csvText: EXAMPLE_CSV, maxCandidates: 2 }, { discoveryRepo });
    assert.equal(result.imported.length, 2);
    assert.equal(result.truncatedByMaxCandidates, true);
  });

  it("deduplicates candidates sharing the same website origin", async () => {
    const discoveryRepo = new FakeDiscoveryRepository();
    const csv = [
      "name,website_url,city",
      "Clínica A,https://same-origin.example.com/pagina-a,São Paulo",
      "Clínica B,https://same-origin.example.com/pagina-b,São Paulo",
    ].join("\n");
    const result = await importCandidatesFromCsv({ csvText: csv, maxCandidates: 10 }, { discoveryRepo });
    assert.equal(result.imported.length, 1);
    assert.equal(result.duplicates.length, 1);
    assert.equal(result.duplicates[0]!.reason, "website_origin");
  });

  it("only ever reads CSV/fixture text — no fetch/network global is touched", async () => {
    const discoveryRepo = new FakeDiscoveryRepository();
    const originalFetch = globalThis.fetch;
    let fetchCalled = false;
    globalThis.fetch = (() => {
      fetchCalled = true;
      throw new Error("importCandidatesFromCsv must never call fetch");
    }) as typeof fetch;
    try {
      await importCandidatesFromCsv({ csvText: EXAMPLE_CSV }, { discoveryRepo });
    } finally {
      globalThis.fetch = originalFetch;
    }
    assert.equal(fetchCalled, false);
  });
});

describe("runControlledPipeline: dry-run creates no real DB writes, only fake in-memory state", () => {
  it("dry-run populates only the injected fake repositories, never a real Supabase client", async () => {
    const deps = buildFakeDeps(false);
    const result = await runControlledPipeline(
      { csvText: EXAMPLE_CSV, maxCandidates: 2, maxPages: 2, allowRealCrawl: false },
      deps,
    );
    assert.equal(result.import.imported.length, 2);
    assert.equal(result.promotions.length, 2);
    assert.ok(result.promotions.every((p) => p.result.ok));

    // The only place data landed is the injected in-memory fakes.
    const crawlRepo = deps.crawlRepo as FakeCrawlRepository;
    assert.equal(crawlRepo.jobs.size, 2);
    const clinicRepo = deps.clinicRepo as FakeClinicRepository;
    assert.equal(clinicRepo.clinics.size, 2);
  });

  it("respects --max-pages for each crawl job", async () => {
    const deps = buildFakeDeps(false);
    const result = await runControlledPipeline(
      { csvText: EXAMPLE_CSV, maxCandidates: 1, maxPages: 1, allowRealCrawl: false },
      deps,
    );
    assert.equal(result.crawl.processed.length, 1);
    const outcome = result.crawl.processed[0]!;
    assert.equal(outcome.result.ok, true);
    if (outcome.result.ok) {
      assert.ok(outcome.result.pagesFetched <= 1);
    }
  });

  it("never sends outreach — every draft stays in status=draft", async () => {
    const deps = buildFakeDeps(false);
    const result = await runControlledPipeline(
      { csvText: EXAMPLE_CSV, maxCandidates: 3, maxPages: 1, allowRealCrawl: false, createOutreachDraft: true },
      deps,
    );
    const outreachRepo = deps.outreachRepo as FakeOutreachRepository;
    assert.ok(outreachRepo.messages.size > 0, "expected at least one outreach draft to be created");
    for (const message of outreachRepo.messages.values()) {
      assert.equal(message.status, "draft");
      assert.equal(message.humanReviewed, false);
    }
    // Also confirmed via the pipeline result itself:
    for (const job of result.crawl.processed) {
      if (job.result.ok && job.result.outreachDraft) {
        assert.equal(job.result.outreachDraft.status, "draft");
      }
    }
  });

  it("skips outreach draft creation when --no-outreach-draft (createOutreachDraft: false)", async () => {
    const deps = buildFakeDeps(false);
    await runControlledPipeline(
      { csvText: EXAMPLE_CSV, maxCandidates: 2, maxPages: 1, allowRealCrawl: false, createOutreachDraft: false },
      deps,
    );
    const outreachRepo = deps.outreachRepo as FakeOutreachRepository;
    assert.equal(outreachRepo.messages.size, 0);
  });

  it("fixture-only by default: allowRealCrawl=false never invokes a real fetch, even with --allow-real-crawl absent", async () => {
    const deps = buildFakeDeps(false);
    const result = await runControlledPipeline(
      { csvText: EXAMPLE_CSV, maxCandidates: 1, maxPages: 1, allowRealCrawl: false },
      deps,
    );
    assert.equal(result.crawl.processed[0]!.result.ok, true);
    const crawlRepo = deps.crawlRepo as FakeCrawlRepository;
    const pages = [...crawlRepo.pages.values()][0] ?? [];
    assert.ok(pages.some((p) => /Fixture/.test(p.title ?? "")));
  });

  it("--allow-real-crawl gate: non-allowlisted candidate hosts fail closed rather than crawling broad internet", async () => {
    const deps = buildFakeDeps(true);
    const csv = [
      "name,website_url,city",
      "Clínica Fora Do Allowlist,https://random-real-clinic-site.example.org/,São Paulo",
    ].join("\n");
    const result = await runControlledPipeline({ csvText: csv, maxCandidates: 1, maxPages: 1, allowRealCrawl: true }, deps);
    const outcome = result.crawl.processed[0]!;
    // Blocked before any network call at all (including DNS) — the
    // controlled lookup refuses to resolve non-allowlisted hosts even in
    // --allow-real-crawl mode, so URL validation fails closed rather than
    // ever reaching a fetch attempt.
    assert.equal(outcome.result.ok, false);
  });

  it("job status transitions: successful jobs complete, and the pipeline reports clinics with no website as validation failures (no orphaned running state)", async () => {
    const deps = buildFakeDeps(false);
    // Promote a clinic with no website directly, then process the queue for it.
    const created = await deps.clinicRepo.createClinic({
      displayName: "Clínica Sem Site",
      normalizedName: "clinica sem site",
      websiteUrl: null,
      normalizedWebsiteOrigin: null,
      city: null,
      state: null,
      specialty: null,
      status: "prospect",
      sourceType: "manual",
      sourceAttribution: {},
      dedupeKey: "no-website-clinic",
    });
    if (!created.ok) return assert.fail();

    const crawl = await processCrawlQueue(
      { clinicIds: [created.value.id], maxPages: 1, allowRealCrawl: false },
      deps,
    );
    const outcome = crawl.processed[0]!;
    assert.equal(outcome.result.ok, false);
    if (!outcome.result.ok) assert.equal(outcome.result.reason, "validation");
    // No crawl_jobs row was ever created for this clinic — nothing left dangling in "pending"/"running".
    const crawlRepo = deps.crawlRepo as FakeCrawlRepository;
    assert.equal(crawlRepo.jobs.size, 0);
  });

  it("cleanup behavior: one candidate's crawl failure does not affect or orphan the others", async () => {
    const deps = buildFakeDeps(false);
    const csv = [
      "name,website_url,city",
      "Clínica OK,https://clinica-ok.example.com/,São Paulo",
      "Clínica Sem Site,,São Paulo",
    ].join("\n");
    // Manually craft: the second row has an empty website_url, which normalizeProspectCandidate
    // still accepts (websiteUrl optional) but leaves null — exercises the "no website" path
    // alongside a healthy candidate in the same run.
    const result = await runControlledPipeline({ csvText: csv, maxCandidates: 5, maxPages: 1, allowRealCrawl: false }, deps);
    assert.equal(result.import.imported.length, 2);
    assert.equal(result.promotions.filter((p) => p.result.ok).length, 2);

    const outcomes = result.crawl.processed;
    const okOutcome = outcomes.find((o) => o.result.ok && o.result.finalStatus);
    const failedOutcome = outcomes.find((o) => !o.result.ok || !o.result.finalStatus);
    assert.ok(okOutcome, "expected the healthy candidate to complete successfully");
    assert.ok(failedOutcome, "expected the no-website candidate to fail validation, not silently disappear");
    if (okOutcome!.result.ok) {
      assert.ok(["completed", "partial"].includes(okOutcome!.result.finalStatus));
    }
  });
});
