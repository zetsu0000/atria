import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { FakeClinicRepository, FakeDiscoveryRepository } from "./repositories/fakes";
import {
  listCandidatesForReview,
  type ListCandidatesForReviewDeps,
} from "./discovery/list-candidates";
import { renderCandidateListMarkdown } from "./discovery/render-candidate-list-markdown";
import type { CandidateReviewResult } from "./discovery/types";
import { selectRepositories } from "./pipeline/select-repositories";
import { KNOWN_PROJECT_REFS } from "./pipeline/target-guard";
import type { LeadCaptureEnv } from "@/lib/security/env";
import type { RecordCandidateInput } from "./repositories/types";

function buildDeps(): ListCandidatesForReviewDeps & {
  discoveryRepo: FakeDiscoveryRepository;
  clinicRepo: FakeClinicRepository;
} {
  return { discoveryRepo: new FakeDiscoveryRepository(), clinicRepo: new FakeClinicRepository() };
}

async function seedJob(deps: ReturnType<typeof buildDeps>) {
  const job = await deps.discoveryRepo.createDiscoveryJob({ sourceType: "google_places", query: {} });
  if (!job.ok) throw new Error("setup failed");
  return job.value;
}

async function seedCandidate(
  deps: ReturnType<typeof buildDeps>,
  overrides: Partial<RecordCandidateInput> & { rawName: string; dedupeKey: string },
) {
  const input: RecordCandidateInput = {
    discoveryJobId: null,
    sourceType: "google_places",
    normalizedName: overrides.rawName.toLowerCase(),
    websiteUrl: "https://www.example-clinic.com.br/",
    normalizedWebsiteOrigin: "https://www.example-clinic.com.br",
    phone: null,
    email: null,
    city: "São Paulo",
    state: "SP",
    specialty: "dermatology_clinic",
    sourceAttribution: {},
    ...overrides,
  };
  const recorded = await deps.discoveryRepo.recordCandidate(input);
  if (!recorded.ok) throw new Error("setup failed");
  return recorded.value;
}

describe("listCandidatesForReview", () => {
  it("1. lists candidates for one discovery job", async () => {
    const deps = buildDeps();
    const job = await seedJob(deps);
    await seedCandidate(deps, { rawName: "Clínica A", dedupeKey: "job-a-1", discoveryJobId: job.id });
    await seedCandidate(deps, { rawName: "Clínica B", dedupeKey: "job-a-2", discoveryJobId: job.id });

    const result = await listCandidatesForReview({ discoveryJobId: job.id }, deps);
    assert.equal(result.ok, true);
    if (!result.ok) return;
    assert.equal(result.result.count, 2);
    assert.ok(result.result.items.every((i) => i.discoveryJobId === job.id));
  });

  it("2. filters by discovery_job_id, excluding candidates from other jobs", async () => {
    const deps = buildDeps();
    const jobA = await seedJob(deps);
    const jobB = await seedJob(deps);
    await seedCandidate(deps, { rawName: "Clínica A", dedupeKey: "filter-a", discoveryJobId: jobA.id });
    await seedCandidate(deps, { rawName: "Clínica B", dedupeKey: "filter-b", discoveryJobId: jobB.id });

    const result = await listCandidatesForReview({ discoveryJobId: jobA.id }, deps);
    assert.equal(result.ok, true);
    if (!result.ok) return;
    assert.equal(result.result.count, 1);
    assert.equal(result.result.items[0]!.rawName, "Clínica A");
  });

  it("3. --include-existing toggles the live dedupe-against-clinics check", async () => {
    const deps = buildDeps();
    await seedCandidate(deps, { rawName: "Stale Candidate", dedupeKey: "stale-dedupe-1" });
    await deps.clinicRepo.createClinic({
      displayName: "Já Promovida Clínica",
      normalizedName: "ja promovida clinica",
      websiteUrl: "https://www.example-clinic.com.br/",
      normalizedWebsiteOrigin: "https://www.example-clinic.com.br",
      city: null,
      state: "SP",
      specialty: "dermatology_clinic",
      status: "prospect",
      sourceType: "google_places",
      sourceAttribution: {},
      dedupeKey: "stale-dedupe-1",
    });

    const withoutCheck = await listCandidatesForReview({}, deps);
    assert.equal(withoutCheck.ok, true);
    if (!withoutCheck.ok) return;
    const itemWithout = withoutCheck.result.items.find((i) => i.rawName === "Stale Candidate");
    assert.ok(itemWithout);
    assert.equal(itemWithout!.existingClinicId, null);
    assert.equal(itemWithout!.suggestedAction, "promote_candidate");

    const withCheck = await listCandidatesForReview({ includeExisting: true }, deps);
    assert.equal(withCheck.ok, true);
    if (!withCheck.ok) return;
    const itemWith = withCheck.result.items.find((i) => i.rawName === "Stale Candidate");
    assert.ok(itemWith);
    assert.ok(itemWith!.existingClinicId, "expected the live check to find the existing clinic");
    assert.equal(itemWith!.suggestedAction, "blocked_existing");
  });

  it("4. --only-promotable excludes duplicates, no-website, and directory candidates", async () => {
    const deps = buildDeps();
    await seedCandidate(deps, { rawName: "Promotable Clinic", dedupeKey: "promo-1" });
    await seedCandidate(deps, { rawName: "No Website Clinic", dedupeKey: "promo-2", websiteUrl: null, normalizedWebsiteOrigin: null });
    await seedCandidate(deps, {
      rawName: "Directory Listing",
      dedupeKey: "promo-3",
      websiteUrl: "https://www.doctoralia.com.br/clinica-x",
      normalizedWebsiteOrigin: "https://www.doctoralia.com.br",
    });
    const dup = await seedCandidate(deps, { rawName: "Duplicate Candidate", dedupeKey: "promo-4" });
    await deps.discoveryRepo.markCandidateDuplicate(dup.id, "in-batch duplicate");

    const all = await listCandidatesForReview({}, deps);
    assert.equal(all.ok, true);
    if (!all.ok) return;
    assert.equal(all.result.count, 4);

    const onlyPromotable = await listCandidatesForReview({ onlyPromotable: true }, deps);
    assert.equal(onlyPromotable.ok, true);
    if (!onlyPromotable.ok) return;
    assert.equal(onlyPromotable.result.count, 1);
    assert.equal(onlyPromotable.result.items[0]!.rawName, "Promotable Clinic");
    assert.equal(onlyPromotable.result.items[0]!.suggestedAction, "promote_candidate");
  });

  it("5. a directory-listing candidate gets suggestedAction blocked_directory", async () => {
    const deps = buildDeps();
    await seedCandidate(deps, {
      rawName: "Directory Listing Clinic",
      dedupeKey: "directory-1",
      websiteUrl: "https://www.doctoralia.com.br/clinica-y",
      normalizedWebsiteOrigin: "https://www.doctoralia.com.br",
    });

    const result = await listCandidatesForReview({}, deps);
    assert.equal(result.ok, true);
    if (!result.ok) return;
    const item = result.result.items.find((i) => i.rawName === "Directory Listing Clinic");
    assert.ok(item);
    assert.equal(item!.suggestedAction, "blocked_directory");
    assert.ok(item!.blockers.some((b) => b.includes("diretório")));
  });

  it("6. a candidate without a website gets suggestedAction blocked_no_website", async () => {
    const deps = buildDeps();
    await seedCandidate(deps, {
      rawName: "No Website Clinic",
      dedupeKey: "no-website-1",
      websiteUrl: null,
      normalizedWebsiteOrigin: null,
    });

    const result = await listCandidatesForReview({}, deps);
    assert.equal(result.ok, true);
    if (!result.ok) return;
    const item = result.result.items.find((i) => i.rawName === "No Website Clinic");
    assert.ok(item);
    assert.equal(item!.suggestedAction, "blocked_no_website");
    assert.ok(item!.blockers.some((b) => b.includes("Nenhum website")));
  });

  it("7. an already-promoted candidate gets skip_duplicate and surfaces promotedClinicId; a rejected one gets blocked_existing", async () => {
    const deps = buildDeps();
    const promoted = await seedCandidate(deps, { rawName: "Promoted Candidate", dedupeKey: "promoted-1" });
    await deps.discoveryRepo.markCandidatePromoted(promoted.id, "clinic-xyz");

    const rejected = await seedCandidate(deps, { rawName: "Rejected Candidate", dedupeKey: "rejected-1" });
    await deps.discoveryRepo.markCandidateRejected(rejected.id, "Wrong audience.");

    const duplicate = await seedCandidate(deps, { rawName: "Duplicate Candidate", dedupeKey: "dup-status-1" });
    await deps.discoveryRepo.markCandidateDuplicate(duplicate.id, "Already seen.");

    const result = await listCandidatesForReview({}, deps);
    assert.equal(result.ok, true);
    if (!result.ok) return;

    const promotedItem = result.result.items.find((i) => i.rawName === "Promoted Candidate");
    assert.ok(promotedItem);
    assert.equal(promotedItem!.suggestedAction, "skip_duplicate");
    assert.equal(promotedItem!.promotedClinicId, "clinic-xyz");

    const rejectedItem = result.result.items.find((i) => i.rawName === "Rejected Candidate");
    assert.ok(rejectedItem);
    assert.equal(rejectedItem!.suggestedAction, "blocked_existing");

    const duplicateItem = result.result.items.find((i) => i.rawName === "Duplicate Candidate");
    assert.ok(duplicateItem);
    assert.equal(duplicateItem!.suggestedAction, "skip_duplicate");
  });

  it("8. JSON output shape is stable — exactly the documented top-level and item keys", async () => {
    const deps = buildDeps();
    await seedCandidate(deps, { rawName: "Shape Check Clinic", dedupeKey: "shape-1" });

    const result = await listCandidatesForReview({}, deps);
    assert.equal(result.ok, true);
    if (!result.ok) return;

    assert.deepEqual(
      Object.keys(result.result).sort(),
      [
        "generatedAt",
        "discoveryJobId",
        "statusFilter",
        "sourceFilter",
        "queryFilter",
        "onlyPromotable",
        "includeExisting",
        "limit",
        "count",
        "items",
      ].sort(),
    );
    assert.deepEqual(
      Object.keys(result.result.items[0]!).sort(),
      [
        "candidateId",
        "discoveryJobId",
        "rawName",
        "websiteUrl",
        "normalizedWebsiteOrigin",
        "sourceType",
        "sourcePlaceId",
        "city",
        "state",
        "status",
        "promotedClinicId",
        "existingClinicId",
        "blockers",
        "suggestedAction",
        "createdAt",
      ].sort(),
    );
    // Round-trips through JSON without losing shape.
    const roundTripped = JSON.parse(JSON.stringify(result.result)) as CandidateReviewResult;
    assert.deepEqual(roundTripped, result.result);
  });

  it("9. markdown output is stable and readable, including the empty-result branch", async () => {
    const deps = buildDeps();
    await seedCandidate(deps, { rawName: "Markdown Clinic", dedupeKey: "markdown-1" });

    const result = await listCandidatesForReview({}, deps);
    assert.equal(result.ok, true);
    if (!result.ok) return;

    const markdown = renderCandidateListMarkdown(result.result);
    assert.match(markdown, /# Revisão de candidatos/);
    assert.match(markdown, /Markdown Clinic/);
    assert.match(markdown, /Promover candidato/);

    const emptyMarkdown = renderCandidateListMarkdown({
      generatedAt: "2026-01-01T00:00:00.000Z",
      discoveryJobId: null,
      statusFilter: "all",
      sourceFilter: null,
      queryFilter: null,
      onlyPromotable: false,
      includeExisting: false,
      limit: 20,
      count: 0,
      items: [],
    });
    assert.match(emptyMarkdown, /Nenhum candidato encontrado/);
  });

  it("10. is fully read-only — never calls any mutation repository method", async () => {
    const deps = buildDeps();
    const job = await seedJob(deps);
    await seedCandidate(deps, { rawName: "Read Only Check", dedupeKey: "read-only-1", discoveryJobId: job.id });
    await deps.clinicRepo.createClinic({
      displayName: "Existing Clinic",
      normalizedName: "existing clinic",
      websiteUrl: "https://www.example-clinic.com.br/",
      normalizedWebsiteOrigin: "https://www.example-clinic.com.br",
      city: null,
      state: "SP",
      specialty: "dermatology_clinic",
      status: "prospect",
      sourceType: "google_places",
      sourceAttribution: {},
      dedupeKey: "read-only-1",
    });

    let recordCandidateCalled = false;
    let markDuplicateCalled = false;
    let markRejectedCalled = false;
    let markPromotedCalled = false;
    let createClinicCalled = false;

    const originalRecord = deps.discoveryRepo.recordCandidate.bind(deps.discoveryRepo);
    deps.discoveryRepo.recordCandidate = (async (input) => {
      recordCandidateCalled = true;
      return originalRecord(input);
    }) as typeof deps.discoveryRepo.recordCandidate;

    const originalDup = deps.discoveryRepo.markCandidateDuplicate.bind(deps.discoveryRepo);
    deps.discoveryRepo.markCandidateDuplicate = (async (id, reason) => {
      markDuplicateCalled = true;
      return originalDup(id, reason);
    }) as typeof deps.discoveryRepo.markCandidateDuplicate;

    const originalRejected = deps.discoveryRepo.markCandidateRejected.bind(deps.discoveryRepo);
    deps.discoveryRepo.markCandidateRejected = (async (id, reason) => {
      markRejectedCalled = true;
      return originalRejected(id, reason);
    }) as typeof deps.discoveryRepo.markCandidateRejected;

    const originalPromoted = deps.discoveryRepo.markCandidatePromoted.bind(deps.discoveryRepo);
    deps.discoveryRepo.markCandidatePromoted = (async (id, clinicId) => {
      markPromotedCalled = true;
      return originalPromoted(id, clinicId);
    }) as typeof deps.discoveryRepo.markCandidatePromoted;

    const originalCreateClinic = deps.clinicRepo.createClinic.bind(deps.clinicRepo);
    deps.clinicRepo.createClinic = (async (input) => {
      createClinicCalled = true;
      return originalCreateClinic(input);
    }) as typeof deps.clinicRepo.createClinic;

    // Exercise every read path, including the live dedupe check.
    await listCandidatesForReview({ discoveryJobId: job.id, includeExisting: true }, deps);
    await listCandidatesForReview({ onlyPromotable: true }, deps);

    assert.equal(recordCandidateCalled, false);
    assert.equal(markDuplicateCalled, false);
    assert.equal(markRejectedCalled, false);
    assert.equal(markPromotedCalled, false);
    assert.equal(createClinicCalled, false);
  });

  it("13. an empty result (no matching candidates) exits cleanly with count 0", async () => {
    const deps = buildDeps();
    await seedCandidate(deps, { rawName: "Unrelated Clinic", dedupeKey: "empty-check-1" });

    const result = await listCandidatesForReview({ query: "no-such-clinic-name-zzz" }, deps);
    assert.equal(result.ok, true);
    if (!result.ok) return;
    assert.equal(result.result.count, 0);
    assert.deepEqual(result.result.items, []);
  });

  it("14. never surfaces raw sourceAttribution — only the safely-extracted sourcePlaceId field", async () => {
    const deps = buildDeps();
    const FAKE_SECRET_MARKER = "TEST-FAKE-NOT-A-REAL-SECRET-98765";
    await seedCandidate(deps, {
      rawName: "Secret Leak Check",
      dedupeKey: "secret-check-1",
      sourceAttribution: {
        providerPlaceId: "places/abc123",
        raw: { someInternalToken: FAKE_SECRET_MARKER },
      },
    });

    const result = await listCandidatesForReview({}, deps);
    assert.equal(result.ok, true);
    if (!result.ok) return;
    const item = result.result.items.find((i) => i.rawName === "Secret Leak Check");
    assert.ok(item);
    assert.equal(item!.sourcePlaceId, "places/abc123");

    const asJson = JSON.stringify(result.result);
    assert.ok(!asJson.includes(FAKE_SECRET_MARKER), "raw sourceAttribution payload must never leak into the review item");

    const asMarkdown = renderCandidateListMarkdown(result.result);
    assert.ok(!asMarkdown.includes(FAKE_SECRET_MARKER), "raw sourceAttribution payload must never leak into markdown output");
  });
});

describe("candidate review CLI: production and target guards (shared infra, same gate as every other crawler CLI)", () => {
  it("11. the repository-selection gate refuses production regardless of --target", () => {
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

  it("12. a missing --target is rejected for any non-dry-run call", () => {
    const env: LeadCaptureEnv = {
      supabaseUrl: null,
      supabaseServiceRoleKey: null,
      resendApiKey: null,
      leadNotificationEmail: null,
      leadFromEmail: null,
      turnstileSiteKey: null,
      turnstileSecretKey: null,
      leadHashSecret: null,
      siteUrl: null,
    };
    const selection = selectRepositories({ dryRun: false, env });
    assert.equal(selection.ok, false);
    if (selection.ok) return;
    assert.match(selection.reason, /target/);
  });
});
