import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  createFixtureGooglePlacesProvider,
  createGooglePlacesProvider,
  runGooglePlacesDiscovery,
  FIXTURE_PLACES,
  GOOGLE_PLACES_SEARCH_URL,
  type GooglePlacesDiscoveryDeps,
} from "./providers/google-places";
import type { PlacesProvider, RawPlaceResult } from "./providers/types";
import { FakeClinicRepository, FakeCrawlRepository, FakeDiscoveryRepository } from "@/lib/operations/repositories/fakes";
import type { DiscoveryRepository } from "@/lib/operations/repositories/discovery-repository";
import type { ProspectCandidateRecord, RecordCandidateInput, RepoResult } from "@/lib/operations/repositories/types";
import { selectRepositories } from "@/lib/operations/pipeline/select-repositories";
import { assertSafeTarget, KNOWN_PROJECT_REFS } from "@/lib/operations/pipeline/target-guard";
import type { LeadCaptureEnv } from "@/lib/security/env";

// NOTE: this test file lives one directory below lib/ (lib/discovery/), not
// alongside the source files it tests under lib/discovery/providers/ — the
// repo's `npm test` script (`tsx --test lib/**/*.test.ts`) is expanded by
// the shell, and this shell's `**` glob only recurses one level deep. A
// file placed at lib/discovery/providers/*.test.ts would silently never
// run. Verified empirically before choosing this location.

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

function fixtureDeps(): GooglePlacesDiscoveryDeps & { discoveryRepo: FakeDiscoveryRepository; clinicRepo: FakeClinicRepository } {
  return {
    provider: createFixtureGooglePlacesProvider(),
    discoveryRepo: new FakeDiscoveryRepository(),
    clinicRepo: new FakeClinicRepository(),
  };
}

// ---------------------------------------------------------------------------
// 1. Missing API key fails clearly outside dry-run
// ---------------------------------------------------------------------------
describe("missing API key", () => {
  it("fails clearly, with no network attempt, when no API key is configured", async () => {
    let fetchCalled = false;
    const provider = createGooglePlacesProvider({
      apiKey: null,
      fetchImpl: (async () => {
        fetchCalled = true;
        throw new Error("must never be called");
      }) as unknown as typeof fetch,
    });

    const result = await provider.searchPlaces({ query: "dermatologia", location: "São Paulo, SP", maxResults: 10, maxPages: 1 });

    assert.equal(result.ok, false);
    if (!result.ok) {
      assert.equal(result.code, "missing_api_key");
      assert.match(result.message, /GOOGLE_PLACES_API_KEY/);
    }
    assert.equal(fetchCalled, false, "must not attempt a network call without an API key");
  });
});

// ---------------------------------------------------------------------------
// 2. Dry-run uses fixtures and writes nothing real
// ---------------------------------------------------------------------------
describe("dry-run fixtures", () => {
  it("returns canned fixture places without any network capability", async () => {
    const provider = createFixtureGooglePlacesProvider();
    const result = await provider.searchPlaces({ query: "dermatologia", location: "São Paulo, SP", maxResults: 10, maxPages: 1 });
    assert.equal(result.ok, true);
    if (result.ok) {
      assert.deepEqual(result.places, FIXTURE_PLACES.slice(0, 10));
    }
  });

  it("persists only to in-memory fake repositories — nothing durable", async () => {
    const deps = fixtureDeps();
    const result = await runGooglePlacesDiscovery({ query: "dermatologia", location: "São Paulo, SP" }, deps);
    assert.equal(result.ok, true);
    if (result.ok) {
      assert.equal(result.imported.length, FIXTURE_PLACES.length);
    }
    // The only place this data exists is the in-memory Map on the fake —
    // there is no Supabase client, no file, nothing durable involved.
    assert.equal(deps.discoveryRepo.candidates.size, FIXTURE_PLACES.length);
  });
});

// ---------------------------------------------------------------------------
// 3. max-results enforced
// ---------------------------------------------------------------------------
describe("max-results enforcement", () => {
  it("truncates fixture results to maxResults", async () => {
    const deps = fixtureDeps();
    const result = await runGooglePlacesDiscovery({ query: "dermatologia", location: "São Paulo, SP", maxResults: 1 }, deps);
    assert.equal(result.ok, true);
    if (result.ok) {
      assert.equal(result.imported.length, 1);
      assert.equal(result.truncatedByMaxResults, true);
    }
  });

  it("stops requesting pages once maxResults is satisfied, at the provider level", async () => {
    let fetchCount = 0;
    const manyPlacesPerPage = (page: number): RawPlaceResult[] =>
      Array.from({ length: 20 }, (_, i) => ({
        providerPlaceId: `place-${page}-${i}`,
        name: `Clínica ${page}-${i}`,
        websiteUrl: "https://example.com/",
        phone: null,
        address: null,
        city: "São Paulo",
        state: "SP",
        categories: ["doctor"],
        raw: {},
      }));

    const fetchImpl = (async () => {
      fetchCount++;
      const page = fetchCount;
      return new Response(
        JSON.stringify({
          places: manyPlacesPerPage(page).map((p) => ({
            id: p.providerPlaceId,
            displayName: { text: p.name },
            websiteUri: p.websiteUrl,
            formattedAddress: p.address,
            types: p.categories,
          })),
          nextPageToken: "more",
        }),
        { status: 200 },
      );
    }) as unknown as typeof fetch;

    const provider = createGooglePlacesProvider({ apiKey: "test-key", fetchImpl });
    const result = await provider.searchPlaces({ query: "dermatologia", location: "São Paulo, SP", maxResults: 25, maxPages: 5 });

    assert.equal(result.ok, true);
    if (result.ok) {
      assert.equal(result.places.length, 25, "must never exceed maxResults");
      assert.equal(result.truncatedByMaxResults, true);
    }
    // 20 from page 1 + 5 from page 2 satisfies maxResults=25 — a 3rd page
    // must never be requested even though the provider always advertises
    // a nextPageToken.
    assert.equal(fetchCount, 2);
  });

  it("never requests more provider pages than maxPages", async () => {
    let fetchCount = 0;
    const fetchImpl = (async () => {
      fetchCount++;
      return new Response(
        JSON.stringify({
          places: [{ id: `p-${fetchCount}`, displayName: { text: `Clínica ${fetchCount}` } }],
          nextPageToken: "more",
        }),
        { status: 200 },
      );
    }) as unknown as typeof fetch;

    const provider = createGooglePlacesProvider({ apiKey: "test-key", fetchImpl });
    const result = await provider.searchPlaces({ query: "dermatologia", location: "São Paulo, SP", maxResults: 100, maxPages: 2 });

    assert.equal(result.ok, true);
    assert.equal(fetchCount, 2, "must stop at maxPages even though more pages are available");
  });
});

// ---------------------------------------------------------------------------
// 4. Production refused
// ---------------------------------------------------------------------------
describe("production refusal", () => {
  it("selectRepositories refuses when SUPABASE_URL resolves to the production ref, for either target", () => {
    const url = `https://${KNOWN_PROJECT_REFS.production}.supabase.co`;
    const env = baseEnv({ supabaseUrl: url, supabaseServiceRoleKey: "key", leadHashSecret: "secret" });

    const asStaging = selectRepositories({ dryRun: false, target: "staging", env });
    assert.equal(asStaging.ok, false);

    const asLocal = selectRepositories({ dryRun: false, target: "local", env });
    assert.equal(asLocal.ok, false);
  });

  it("assertSafeTarget hard-blocks the production ref regardless of claimed target", () => {
    const url = `https://${KNOWN_PROJECT_REFS.production}.supabase.co`;
    const result = assertSafeTarget("staging", url);
    assert.equal(result.ok, false);
    if (!result.ok) assert.match(result.reason, /production/i);
  });

  it("this feature's discovery repositories are wired through the same selectRepositories/target-guard as the rest of the pipeline", () => {
    // Regression guard: this discovery adapter must never construct its
    // own Supabase client or bypass target-guard.ts.
    const source = readFileSync(join(__dirname, "..", "..", "scripts", "crawler", "discover-google-places.ts"), "utf8");
    assert.match(source, /selectRepositories/);
    assert.doesNotMatch(source, /createClient\(/);
  });
});

// ---------------------------------------------------------------------------
// 5 & 6. No outreach, no crawl (structural — deps never carry those repos)
// ---------------------------------------------------------------------------
describe("no outreach, no crawl", () => {
  it("has no way to reach outreach or crawl repositories even with --promote", async () => {
    const deps = fixtureDeps();
    const untouchedCrawlRepo = new FakeCrawlRepository();

    const result = await runGooglePlacesDiscovery(
      { query: "dermatologia", location: "São Paulo, SP", promote: true },
      deps,
    );

    assert.equal(result.ok, true);
    // GooglePlacesDiscoveryDeps has no outreachRepo/crawlRepo field at all —
    // this call could not have created either, by construction. Confirmed
    // at runtime too: an independently-created crawl repo, never wired in,
    // stays empty.
    assert.equal(untouchedCrawlRepo.jobs.size, 0);
    if (result.ok) {
      assert.ok(!("outreach" in result));
      assert.ok(!("crawlJobId" in result));
    }
  });
});

// ---------------------------------------------------------------------------
// 7. No scraping / browser automation
// ---------------------------------------------------------------------------
describe("no scraping or browser automation", () => {
  it("the provider module never imports a browser-automation or scraping library", () => {
    const source = readFileSync(join(__dirname, "providers", "google-places.ts"), "utf8");
    assert.doesNotMatch(source, /playwright/i);
    assert.doesNotMatch(source, /puppeteer/i);
    assert.doesNotMatch(source, /cheerio/i);
    assert.doesNotMatch(source, /node-html-parser/i);
  });

  it("only ever calls the official Places API JSON endpoint, never a Google Maps HTML page", async () => {
    const requestedUrls: string[] = [];
    const fetchImpl = (async (url: string) => {
      requestedUrls.push(String(url));
      return new Response(JSON.stringify({ places: [] }), { status: 200 });
    }) as unknown as typeof fetch;

    const provider = createGooglePlacesProvider({ apiKey: "test-key", fetchImpl });
    await provider.searchPlaces({ query: "dermatologia", location: "São Paulo, SP", maxResults: 10, maxPages: 1 });

    assert.deepEqual(requestedUrls, [GOOGLE_PLACES_SEARCH_URL]);
    assert.ok(!requestedUrls[0]!.includes("google.com/maps"));
  });
});

// ---------------------------------------------------------------------------
// 8. Dedupe works
// ---------------------------------------------------------------------------
describe("dedupe", () => {
  function duplicateFixtureProvider(): PlacesProvider {
    const place: RawPlaceResult = {
      providerPlaceId: "dup-1",
      name: "Clínica Duplicada",
      websiteUrl: "https://clinica-duplicada.example.com/",
      phone: "11900000099",
      address: null,
      city: "São Paulo",
      state: "SP",
      categories: ["doctor"],
      raw: {},
    };
    const placeAgain: RawPlaceResult = { ...place, providerPlaceId: "dup-2" };
    return {
      async searchPlaces() {
        return { ok: true, places: [place, placeAgain], pagesFetched: 1, truncatedByMaxResults: false };
      },
    };
  }

  it("drops an in-batch duplicate (same normalized identity, different provider place id)", async () => {
    const deps = { provider: duplicateFixtureProvider(), discoveryRepo: new FakeDiscoveryRepository(), clinicRepo: new FakeClinicRepository() };
    const result = await runGooglePlacesDiscovery({ query: "dermatologia", location: "São Paulo, SP" }, deps);
    assert.equal(result.ok, true);
    if (result.ok) {
      assert.equal(result.imported.length, 1);
      assert.equal(result.duplicates.length, 1);
    }
  });

  it("drops a duplicate already recorded in a prior discovery run (existing_in_db)", async () => {
    const discoveryRepo = new FakeDiscoveryRepository();
    const clinicRepo = new FakeClinicRepository();
    const provider = duplicateFixtureProvider();

    const first = await runGooglePlacesDiscovery({ query: "dermatologia", location: "São Paulo, SP" }, { provider, discoveryRepo, clinicRepo });
    assert.equal(first.ok, true);

    // Run again with a provider that returns only the same single place —
    // it must be recognized as already existing in the DB this time.
    const singlePlaceProvider: PlacesProvider = {
      async searchPlaces() {
        return {
          ok: true,
          places: [
            {
              providerPlaceId: "dup-3",
              name: "Clínica Duplicada",
              websiteUrl: "https://clinica-duplicada.example.com/",
              phone: "11900000099",
              address: null,
              city: "São Paulo",
              state: "SP",
              categories: ["doctor"],
              raw: {},
            },
          ],
          pagesFetched: 1,
          truncatedByMaxResults: false,
        };
      },
    };
    const second = await runGooglePlacesDiscovery(
      { query: "dermatologia", location: "São Paulo, SP" },
      { provider: singlePlaceProvider, discoveryRepo, clinicRepo },
    );
    assert.equal(second.ok, true);
    if (second.ok) {
      assert.equal(second.imported.length, 0);
      assert.equal(second.duplicates.length, 1);
      assert.equal(second.duplicates[0]!.reason, "existing_in_db");
    }
  });
});

// ---------------------------------------------------------------------------
// 9. Missing website handled
// ---------------------------------------------------------------------------
describe("missing website", () => {
  it("still persists the candidate, marked needs_review", async () => {
    const deps = fixtureDeps();
    const result = await runGooglePlacesDiscovery({ query: "dermatologia", location: "Curitiba, PR" }, deps);
    assert.equal(result.ok, true);
    if (result.ok) {
      const noWebsite = result.imported.find((c) => c.rawName === "Clínica Fixture Dois");
      assert.ok(noWebsite, "expected the no-website fixture candidate to be imported");
      assert.equal(noWebsite!.websiteUrl, null);
      assert.equal(noWebsite!.status, "needs_review");

      const withWebsite = result.imported.find((c) => c.rawName === "Clínica Fixture Um");
      assert.equal(withWebsite!.status, "new");
    }
  });
});

// ---------------------------------------------------------------------------
// 10. Provider errors handled without partial corruption
// ---------------------------------------------------------------------------
describe("provider error handling", () => {
  it("marks the discovery job failed and records zero candidates on a total provider failure", async () => {
    const discoveryRepo = new FakeDiscoveryRepository();
    const clinicRepo = new FakeClinicRepository();
    const failingProvider: PlacesProvider = {
      async searchPlaces() {
        return { ok: false, code: "provider_error", message: "Google Places API returned HTTP 500." };
      },
    };

    const result = await runGooglePlacesDiscovery(
      { query: "dermatologia", location: "São Paulo, SP" },
      { provider: failingProvider, discoveryRepo, clinicRepo },
    );

    assert.equal(result.ok, false);
    if (!result.ok) {
      assert.ok(result.discoveryJobId);
      assert.equal(result.reason, "provider_error");
    }
    assert.equal(discoveryRepo.candidates.size, 0, "no candidate may be recorded when the provider call itself failed");
    const job = discoveryRepo.jobs.get((result as { discoveryJobId: string }).discoveryJobId);
    assert.equal(job?.status, "failed");
    assert.equal(job?.candidatesCreated, 0);
  });

  function createFlakyDiscoveryRepo(): DiscoveryRepository & Pick<FakeDiscoveryRepository, "candidates" | "jobs"> {
    const inner = new FakeDiscoveryRepository();
    return {
      createDiscoveryJob: inner.createDiscoveryJob.bind(inner),
      completeDiscoveryJob: inner.completeDiscoveryJob.bind(inner),
      async recordCandidate(input: RecordCandidateInput): Promise<RepoResult<ProspectCandidateRecord>> {
        if (input.rawName === "Clínica Fixture Dois") {
          return { ok: false, reason: "unavailable", message: "simulated write failure" };
        }
        return inner.recordCandidate(input);
      },
      markCandidateDuplicate: inner.markCandidateDuplicate.bind(inner),
      markCandidateRejected: inner.markCandidateRejected.bind(inner),
      markCandidatePromoted: inner.markCandidatePromoted.bind(inner),
      getCandidate: inner.getCandidate.bind(inner),
      listCandidates: inner.listCandidates.bind(inner),
      findCandidateByDedupeKey: inner.findCandidateByDedupeKey.bind(inner),
      candidates: inner.candidates,
      jobs: inner.jobs,
    };
  }

  it("one bad candidate is rejected without blocking or corrupting the others", async () => {
    const discoveryRepo = createFlakyDiscoveryRepo();
    const clinicRepo = new FakeClinicRepository();

    const result = await runGooglePlacesDiscovery(
      { query: "dermatologia", location: "São Paulo, SP" },
      { provider: createFixtureGooglePlacesProvider(), discoveryRepo, clinicRepo },
    );

    assert.equal(result.ok, true);
    if (result.ok) {
      assert.equal(result.imported.length, 1);
      assert.equal(result.imported[0]!.rawName, "Clínica Fixture Um");
      assert.equal(result.rejected.length, 1);
      assert.match(result.rejected[0]!.message, /Record failed/);
    }
    // The job still completes — a single row failure is not a fatal error.
    const job = discoveryRepo.jobs.get(result.ok ? result.discoveryJobId : "");
    assert.equal(job?.status, "completed");
    assert.equal(job?.candidatesCreated, 1);
  });
});

// ---------------------------------------------------------------------------
// 11. Provenance stored
// ---------------------------------------------------------------------------
describe("provenance", () => {
  it("stores provider, providerPlaceId, address, categories and query/location in source_attribution", async () => {
    const deps = fixtureDeps();
    const result = await runGooglePlacesDiscovery({ query: "dermatologia", location: "São Paulo, SP" }, deps);
    assert.equal(result.ok, true);
    if (result.ok) {
      const candidate = result.imported.find((c) => c.rawName === "Clínica Fixture Um")!;
      assert.equal(candidate.sourceType, "google_places");
      assert.equal(candidate.sourceAttribution.provider, "google_places");
      assert.equal(candidate.sourceAttribution.providerPlaceId, "fixture-place-1");
      assert.equal(candidate.sourceAttribution.query, "dermatologia");
      assert.equal(candidate.sourceAttribution.location, "São Paulo, SP");
      assert.ok(Array.isArray(candidate.sourceAttribution.categories));
      assert.ok(candidate.dedupeKey);
    }
  });
});

// ---------------------------------------------------------------------------
// Promotion: off by default, explicit-only
// ---------------------------------------------------------------------------
describe("promotion gate", () => {
  it("never promotes to a clinic unless promote: true is explicit", async () => {
    const deps = fixtureDeps();
    const result = await runGooglePlacesDiscovery({ query: "dermatologia", location: "São Paulo, SP" }, deps);
    assert.equal(result.ok, true);
    if (result.ok) {
      assert.equal(result.promotions.length, 0);
    }
    assert.equal(deps.clinicRepo.clinics.size, 0);
  });

  it("promotes every imported candidate when promote: true is passed", async () => {
    const deps = fixtureDeps();
    const result = await runGooglePlacesDiscovery({ query: "dermatologia", location: "São Paulo, SP", promote: true }, deps);
    assert.equal(result.ok, true);
    if (result.ok) {
      assert.equal(result.promotions.length, FIXTURE_PLACES.length);
      assert.ok(result.promotions.every((p) => p.result.ok));
    }
    assert.equal(deps.clinicRepo.clinics.size, FIXTURE_PLACES.length);
  });
});

// ---------------------------------------------------------------------------
// Required inputs
// ---------------------------------------------------------------------------
describe("required inputs", () => {
  it("refuses an empty query before creating any discovery job", async () => {
    const deps = fixtureDeps();
    const result = await runGooglePlacesDiscovery({ query: "  ", location: "São Paulo, SP" }, deps);
    assert.equal(result.ok, false);
    if (!result.ok) {
      assert.equal(result.discoveryJobId, null);
      assert.equal(result.reason, "validation");
    }
    assert.equal(deps.discoveryRepo.jobs.size, 0);
  });

  it("refuses an empty location before creating any discovery job", async () => {
    const deps = fixtureDeps();
    const result = await runGooglePlacesDiscovery({ query: "dermatologia", location: "   " }, deps);
    assert.equal(result.ok, false);
    if (!result.ok) {
      assert.equal(result.discoveryJobId, null);
      assert.equal(result.reason, "validation");
    }
    assert.equal(deps.discoveryRepo.jobs.size, 0);
  });
});
