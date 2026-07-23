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
        "existingClinicMatchReason",
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

describe("listCandidatesForReview: website-scheme-normalized duplicate detection", () => {
  it("an http:// candidate matches an https:// existing clinic on the same website, even with a different listing name", async () => {
    const deps = buildDeps();
    await seedCandidate(deps, {
      rawName: "Skinlaser Dermatologia Médica Ltda - Moema",
      dedupeKey: "scheme-mismatch-http-candidate",
      websiteUrl: "http://www.skinlaser.com.br/",
      normalizedWebsiteOrigin: "http://www.skinlaser.com.br",
    });
    const clinic = await deps.clinicRepo.createClinic({
      displayName: "SkinLaser - Higienópolis",
      normalizedName: "skinlaser higienopolis",
      websiteUrl: "https://www.skinlaser.com.br/",
      normalizedWebsiteOrigin: "https://www.skinlaser.com.br",
      city: null,
      state: "SP",
      specialty: "dermatology_clinic",
      status: "prospect",
      sourceType: "google_places",
      sourceAttribution: {},
      dedupeKey: "already-promoted-skinlaser",
    });
    if (!clinic.ok) return assert.fail();

    const result = await listCandidatesForReview({ includeExisting: true }, deps);
    assert.equal(result.ok, true);
    if (!result.ok) return;
    const item = result.result.items.find((i) => i.rawName.startsWith("Skinlaser Dermatologia"));
    assert.ok(item);
    assert.equal(item!.suggestedAction, "blocked_existing");
    assert.equal(item!.existingClinicId, clinic.value.id);
    assert.equal(item!.existingClinicMatchReason, "normalized_website");
    assert.ok(item!.blockers.some((b) => b.includes("mesmo website")));
  });

  it("an https:// candidate matches an http:// existing clinic (reverse direction)", async () => {
    const deps = buildDeps();
    await seedCandidate(deps, {
      rawName: "New Listing For Old Http Clinic",
      dedupeKey: "scheme-mismatch-https-candidate",
      websiteUrl: "https://oldclinic.example.com/",
      normalizedWebsiteOrigin: "https://oldclinic.example.com",
    });
    const clinic = await deps.clinicRepo.createClinic({
      displayName: "Old Clinic (recorded before the scheme fix)",
      normalizedName: "old clinic",
      websiteUrl: "http://oldclinic.example.com/",
      normalizedWebsiteOrigin: "http://oldclinic.example.com",
      city: null,
      state: "SP",
      specialty: "dermatology_clinic",
      status: "prospect",
      sourceType: "google_places",
      sourceAttribution: {},
      dedupeKey: "old-clinic-dedupe",
    });
    if (!clinic.ok) return assert.fail();

    const result = await listCandidatesForReview({ includeExisting: true }, deps);
    assert.equal(result.ok, true);
    if (!result.ok) return;
    const item = result.result.items.find((i) => i.rawName === "New Listing For Old Http Clinic");
    assert.ok(item);
    assert.equal(item!.suggestedAction, "blocked_existing");
    assert.equal(item!.existingClinicId, clinic.value.id);
    assert.equal(item!.existingClinicMatchReason, "normalized_website");
  });

  it("--only-promotable excludes a scheme-only (normalized-website) duplicate", async () => {
    const deps = buildDeps();
    await seedCandidate(deps, {
      rawName: "Scheme Duplicate Candidate",
      dedupeKey: "scheme-only-promotable-check",
      websiteUrl: "http://samesite.example.com/",
      normalizedWebsiteOrigin: "http://samesite.example.com",
    });
    await seedCandidate(deps, {
      rawName: "Genuinely New Candidate",
      dedupeKey: "genuinely-new-1",
      websiteUrl: "https://brandnew.example.com/",
      normalizedWebsiteOrigin: "https://brandnew.example.com",
    });
    const clinic = await deps.clinicRepo.createClinic({
      displayName: "Same Site Clinic",
      normalizedName: "same site clinic",
      websiteUrl: "https://samesite.example.com/",
      normalizedWebsiteOrigin: "https://samesite.example.com",
      city: null,
      state: "SP",
      specialty: "dermatology_clinic",
      status: "prospect",
      sourceType: "google_places",
      sourceAttribution: {},
      dedupeKey: "same-site-dedupe",
    });
    if (!clinic.ok) return assert.fail();

    const result = await listCandidatesForReview({ includeExisting: true, onlyPromotable: true }, deps);
    assert.equal(result.ok, true);
    if (!result.ok) return;
    assert.equal(result.result.count, 1);
    assert.equal(result.result.items[0]!.rawName, "Genuinely New Candidate");
  });

  it("JSON and markdown output surface existingClinicId and existingClinicMatchReason for a scheme-only match", async () => {
    const deps = buildDeps();
    await seedCandidate(deps, {
      rawName: "Render Check Candidate",
      dedupeKey: "render-check-1",
      websiteUrl: "http://rendercheck.example.com/",
      normalizedWebsiteOrigin: "http://rendercheck.example.com",
    });
    const clinic = await deps.clinicRepo.createClinic({
      displayName: "Render Check Clinic",
      normalizedName: "render check clinic",
      websiteUrl: "https://rendercheck.example.com/",
      normalizedWebsiteOrigin: "https://rendercheck.example.com",
      city: null,
      state: "SP",
      specialty: "dermatology_clinic",
      status: "prospect",
      sourceType: "google_places",
      sourceAttribution: {},
      dedupeKey: "render-check-clinic-dedupe",
    });
    if (!clinic.ok) return assert.fail();

    const result = await listCandidatesForReview({ includeExisting: true }, deps);
    assert.equal(result.ok, true);
    if (!result.ok) return;

    const asJson = JSON.parse(JSON.stringify(result.result)) as CandidateReviewResult;
    const jsonItem = asJson.items.find((i) => i.rawName === "Render Check Candidate");
    assert.ok(jsonItem);
    assert.equal(jsonItem!.existingClinicId, clinic.value.id);
    assert.equal(jsonItem!.existingClinicMatchReason, "normalized_website");

    const markdown = renderCandidateListMarkdown(result.result);
    assert.match(markdown, new RegExp(`Clínica existente \\(mesmo website\\):.*${clinic.value.id}`));
  });

  it("an unrelated subdomain does not match — sub.example.com is a different origin from example.com", async () => {
    const deps = buildDeps();
    await seedCandidate(deps, {
      rawName: "Subdomain Candidate",
      dedupeKey: "subdomain-check-1",
      websiteUrl: "https://clinica.example.com/",
      normalizedWebsiteOrigin: "https://clinica.example.com",
    });
    const clinic = await deps.clinicRepo.createClinic({
      displayName: "Apex Domain Clinic",
      normalizedName: "apex domain clinic",
      websiteUrl: "https://example.com/",
      normalizedWebsiteOrigin: "https://example.com",
      city: null,
      state: "SP",
      specialty: "dermatology_clinic",
      status: "prospect",
      sourceType: "google_places",
      sourceAttribution: {},
      dedupeKey: "apex-domain-dedupe",
    });
    if (!clinic.ok) return assert.fail();

    const result = await listCandidatesForReview({ includeExisting: true }, deps);
    assert.equal(result.ok, true);
    if (!result.ok) return;
    const item = result.result.items.find((i) => i.rawName === "Subdomain Candidate");
    assert.ok(item);
    assert.equal(item!.existingClinicId, null);
    assert.equal(item!.suggestedAction, "promote_candidate");
  });

  it("www vs. apex is intentionally NOT normalized — a candidate on the apex domain does not match an existing clinic on www", async () => {
    const deps = buildDeps();
    await seedCandidate(deps, {
      rawName: "Apex Candidate",
      dedupeKey: "apex-vs-www-1",
      websiteUrl: "https://apexvswww.example.com/",
      normalizedWebsiteOrigin: "https://apexvswww.example.com",
    });
    const clinic = await deps.clinicRepo.createClinic({
      displayName: "Www Clinic",
      normalizedName: "www clinic",
      websiteUrl: "https://www.apexvswww.example.com/",
      normalizedWebsiteOrigin: "https://www.apexvswww.example.com",
      city: null,
      state: "SP",
      specialty: "dermatology_clinic",
      status: "prospect",
      sourceType: "google_places",
      sourceAttribution: {},
      dedupeKey: "www-clinic-dedupe",
    });
    if (!clinic.ok) return assert.fail();

    const result = await listCandidatesForReview({ includeExisting: true }, deps);
    assert.equal(result.ok, true);
    if (!result.ok) return;
    const item = result.result.items.find((i) => i.rawName === "Apex Candidate");
    assert.ok(item);
    // Intentional, documented limitation — see
    // docs/technical/crawler-website-dedupe-normalization.md.
    assert.equal(item!.existingClinicId, null);
    assert.equal(item!.suggestedAction, "promote_candidate");
  });

  it("the exact-dedupe-key match still takes priority over a website-only match when both would apply", async () => {
    const deps = buildDeps();
    const candidate = await seedCandidate(deps, {
      rawName: "Priority Check Candidate",
      dedupeKey: "priority-check-exact-match",
      websiteUrl: "http://priority.example.com/",
      normalizedWebsiteOrigin: "http://priority.example.com",
    });
    // Exact-dedupe-key clinic (would match via findClinicByDedupeKey).
    const exactClinic = await deps.clinicRepo.createClinic({
      displayName: "Exact Match Clinic",
      normalizedName: "exact match clinic",
      websiteUrl: "http://priority.example.com/",
      normalizedWebsiteOrigin: "http://priority.example.com",
      city: null,
      state: "SP",
      specialty: "dermatology_clinic",
      status: "prospect",
      sourceType: "google_places",
      sourceAttribution: {},
      dedupeKey: candidate.dedupeKey,
    });
    if (!exactClinic.ok) return assert.fail();
    // A second, different clinic that would only match on website-origin.
    const originOnlyClinic = await deps.clinicRepo.createClinic({
      displayName: "Origin Only Clinic (different dedupe key)",
      normalizedName: "origin only clinic",
      websiteUrl: "https://priority.example.com/",
      normalizedWebsiteOrigin: "https://priority.example.com",
      city: null,
      state: "SP",
      specialty: "dermatology_clinic",
      status: "prospect",
      sourceType: "google_places",
      sourceAttribution: {},
      dedupeKey: "origin-only-different-dedupe",
    });
    if (!originOnlyClinic.ok) return assert.fail();

    const result = await listCandidatesForReview({ includeExisting: true }, deps);
    assert.equal(result.ok, true);
    if (!result.ok) return;
    const item = result.result.items.find((i) => i.rawName === "Priority Check Candidate");
    assert.ok(item);
    assert.equal(item!.existingClinicId, exactClinic.value.id);
    assert.equal(item!.existingClinicMatchReason, "dedupe_key");
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
