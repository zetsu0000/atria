import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { FakeClinicRepository, FakeDiscoveryRepository } from "./repositories/fakes";
import { buildOperatorShortlist, type BuildOperatorShortlistDeps } from "./operator-shortlist/build-operator-shortlist";
import { renderOperatorShortlistMarkdown } from "./operator-shortlist/render-operator-shortlist-markdown";
import type { OperatorShortlistResult } from "./operator-shortlist/types";
import { selectRepositories } from "./pipeline/select-repositories";
import { KNOWN_PROJECT_REFS } from "./pipeline/target-guard";
import type { LeadCaptureEnv } from "@/lib/security/env";
import type { RecordCandidateInput } from "./repositories/types";

function buildDeps(): BuildOperatorShortlistDeps & {
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
  overrides: Partial<RecordCandidateInput> & { rawName: string; dedupeKey: string; discoveryJobId: string },
) {
  const input: RecordCandidateInput = {
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

describe("buildOperatorShortlist", () => {
  it("1. ranks an independent core own-website candidate first", async () => {
    const deps = buildDeps();
    const job = await seedJob(deps);
    await seedCandidate(deps, {
      rawName: "Dra. Fernanda Lima - Dermatologista",
      dedupeKey: "shortlist-solo-1",
      discoveryJobId: job.id,
      websiteUrl: "https://fernandalimaderma.example.com.br/",
      normalizedWebsiteOrigin: "https://fernandalimaderma.example.com.br",
    });
    await seedCandidate(deps, {
      rawName: "Clínica Independente Dermic",
      dedupeKey: "shortlist-core-1",
      discoveryJobId: job.id,
      websiteUrl: "https://dermic.example.com.br/",
      normalizedWebsiteOrigin: "https://dermic.example.com.br",
    });

    const result = await buildOperatorShortlist({ discoveryJobId: job.id }, deps);
    assert.equal(result.ok, true);
    if (!result.ok) return;
    assert.equal(result.result.items[0]!.rawName, "Clínica Independente Dermic");
    assert.equal(result.result.items[0]!.operatorRecommendation, "promote_next");
    assert.equal(result.result.recommendedCandidateId, result.result.items[0]!.candidateId);
  });

  it("2. a duplicate candidate is not recommended", async () => {
    const deps = buildDeps();
    const job = await seedJob(deps);
    const dup = await seedCandidate(deps, {
      rawName: "Clínica Duplicada",
      dedupeKey: "shortlist-dup-1",
      discoveryJobId: job.id,
    });
    await deps.discoveryRepo.markCandidateDuplicate(dup.id, "already seen");

    const result = await buildOperatorShortlist({ discoveryJobId: job.id }, deps);
    assert.equal(result.ok, true);
    if (!result.ok) return;
    const item = result.result.items.find((i) => i.candidateId === dup.id);
    assert.ok(item);
    assert.equal(item!.operatorRecommendation, "skip_duplicate");
    assert.notEqual(result.result.recommendedCandidateId, dup.id);
  });

  it("3. a social-profile website is not recommended", async () => {
    const deps = buildDeps();
    const job = await seedJob(deps);
    await seedCandidate(deps, {
      rawName: "Clínica Só Instagram",
      dedupeKey: "shortlist-social-1",
      discoveryJobId: job.id,
      websiteUrl: "https://www.instagram.com/soinstagram/",
      normalizedWebsiteOrigin: "https://www.instagram.com",
    });

    const result = await buildOperatorShortlist({ discoveryJobId: job.id }, deps);
    assert.equal(result.ok, true);
    if (!result.ok) return;
    const item = result.result.items[0]!;
    assert.equal(item.operatorRecommendation, "blocked_no_own_website");
    assert.equal(item.websiteClassification, "social_profile");
    assert.equal(result.result.recommendedCandidateId, null);
  });

  it("4. a directory candidate is blocked", async () => {
    const deps = buildDeps();
    const job = await seedJob(deps);
    await seedCandidate(deps, {
      rawName: "Dra. Fulana - Doctoralia",
      dedupeKey: "shortlist-directory-1",
      discoveryJobId: job.id,
      websiteUrl: "https://www.doctoralia.com.br/dra-fulana",
      normalizedWebsiteOrigin: "https://www.doctoralia.com.br",
    });

    const result = await buildOperatorShortlist({ discoveryJobId: job.id }, deps);
    assert.equal(result.ok, true);
    if (!result.ok) return;
    const item = result.result.items[0]!;
    assert.equal(item.operatorRecommendation, "blocked_directory");
    assert.equal(item.websiteClassification, "directory");
  });

  it("5. a hospital/franchise/chain candidate is not recommended as an MVP prospect", async () => {
    const deps = buildDeps();
    const job = await seedJob(deps);
    await seedCandidate(deps, {
      rawName: "Hospital Santa Clara Dermatologia",
      dedupeKey: "shortlist-hospital-1",
      discoveryJobId: job.id,
      websiteUrl: "https://hospitalsantaclara.example.com.br/",
      normalizedWebsiteOrigin: "https://hospitalsantaclara.example.com.br",
    });

    const result = await buildOperatorShortlist({ discoveryJobId: job.id }, deps);
    assert.equal(result.ok, true);
    if (!result.ok) return;
    const item = result.result.items[0]!;
    assert.equal(item.operatorRecommendation, "blocked_icp");
    assert.notEqual(item.operatorRecommendation, "promote_next");
  });

  it("6. a solo practitioner becomes manual_review", async () => {
    const deps = buildDeps();
    const job = await seedJob(deps);
    await seedCandidate(deps, {
      rawName: "Dra. Fernanda Lima - Dermatologista",
      dedupeKey: "shortlist-solo-2",
      discoveryJobId: job.id,
      websiteUrl: "https://fernandalimaderma2.example.com.br/",
      normalizedWebsiteOrigin: "https://fernandalimaderma2.example.com.br",
    });

    const result = await buildOperatorShortlist({ discoveryJobId: job.id }, deps);
    assert.equal(result.ok, true);
    if (!result.ok) return;
    assert.equal(result.result.items[0]!.operatorRecommendation, "manual_review");
  });

  it("7. wrong-audience is blocked with the more specific blocked_wrong_audience label", async () => {
    const deps = buildDeps();
    const job = await seedJob(deps);
    await seedCandidate(deps, {
      rawName: "Farmácia Popular Bem Estar",
      dedupeKey: "shortlist-wrong-audience-1",
      discoveryJobId: job.id,
      websiteUrl: "https://farmaciapopularbemestar.example.com.br/",
      normalizedWebsiteOrigin: "https://farmaciapopularbemestar.example.com.br",
    });

    const result = await buildOperatorShortlist({ discoveryJobId: job.id }, deps);
    assert.equal(result.ok, true);
    if (!result.ok) return;
    assert.equal(result.result.items[0]!.operatorRecommendation, "blocked_wrong_audience");
  });

  it("8. no website is blocked", async () => {
    const deps = buildDeps();
    const job = await seedJob(deps);
    await seedCandidate(deps, {
      rawName: "Clínica Sem Website",
      dedupeKey: "shortlist-no-website-1",
      discoveryJobId: job.id,
      websiteUrl: null,
      normalizedWebsiteOrigin: null,
    });

    const result = await buildOperatorShortlist({ discoveryJobId: job.id }, deps);
    assert.equal(result.ok, true);
    if (!result.ok) return;
    const item = result.result.items[0]!;
    assert.equal(item.operatorRecommendation, "blocked_no_own_website");
    assert.equal(item.websiteClassification, "unknown");
  });

  it("9. summary counts are correct", async () => {
    const deps = buildDeps();
    const job = await seedJob(deps);
    await seedCandidate(deps, {
      rawName: "Clínica Independente Boa",
      dedupeKey: "shortlist-summary-good-1",
      discoveryJobId: job.id,
      websiteUrl: "https://boa.example.com.br/",
      normalizedWebsiteOrigin: "https://boa.example.com.br",
    });
    const dup = await seedCandidate(deps, {
      rawName: "Clínica Duplicada Summary",
      dedupeKey: "shortlist-summary-dup-1",
      discoveryJobId: job.id,
    });
    await deps.discoveryRepo.markCandidateDuplicate(dup.id, "already seen");
    await seedCandidate(deps, {
      rawName: "Clínica Só Instagram Summary",
      dedupeKey: "shortlist-summary-social-1",
      discoveryJobId: job.id,
      websiteUrl: "https://www.instagram.com/summarycheck/",
      normalizedWebsiteOrigin: "https://www.instagram.com",
    });
    await seedCandidate(deps, {
      rawName: "Hospital Summary Check",
      dedupeKey: "shortlist-summary-hospital-1",
      discoveryJobId: job.id,
      websiteUrl: "https://hospitalsummarycheck.example.com.br/",
      normalizedWebsiteOrigin: "https://hospitalsummarycheck.example.com.br",
    });

    const result = await buildOperatorShortlist({ discoveryJobId: job.id, limit: 20 }, deps);
    assert.equal(result.ok, true);
    if (!result.ok) return;
    assert.equal(result.result.totalReviewed, 4);
    assert.equal(result.result.actionableCount, 1);
    assert.equal(result.result.duplicateCount, 1);
    assert.equal(result.result.socialOrNoOwnWebsiteCount, 1);
    assert.equal(result.result.blockedCount, 3);
  });

  it("10. the recommended next candidate is deterministic across repeated calls", async () => {
    const deps = buildDeps();
    const job = await seedJob(deps);
    await seedCandidate(deps, {
      rawName: "Clínica Determinística A",
      dedupeKey: "shortlist-deterministic-a",
      discoveryJobId: job.id,
      websiteUrl: "https://deterministicoa.example.com.br/",
      normalizedWebsiteOrigin: "https://deterministicoa.example.com.br",
    });
    await seedCandidate(deps, {
      rawName: "Clínica Determinística B",
      dedupeKey: "shortlist-deterministic-b",
      discoveryJobId: job.id,
      websiteUrl: "https://deterministicob.example.com.br/",
      normalizedWebsiteOrigin: "https://deterministicob.example.com.br",
    });

    const first = await buildOperatorShortlist({ discoveryJobId: job.id }, deps);
    const second = await buildOperatorShortlist({ discoveryJobId: job.id }, deps);
    assert.equal(first.ok, true);
    assert.equal(second.ok, true);
    if (!first.ok || !second.ok) return;
    assert.equal(first.result.recommendedCandidateId, second.result.recommendedCandidateId);
    assert.deepEqual(
      first.result.items.map((i) => i.candidateId),
      second.result.items.map((i) => i.candidateId),
    );
  });

  it("11. JSON output shape is stable", async () => {
    const deps = buildDeps();
    const job = await seedJob(deps);
    await seedCandidate(deps, {
      rawName: "Clínica Shape Check",
      dedupeKey: "shortlist-shape-1",
      discoveryJobId: job.id,
      websiteUrl: "https://shapecheck.example.com.br/",
      normalizedWebsiteOrigin: "https://shapecheck.example.com.br",
    });

    const result = await buildOperatorShortlist({ discoveryJobId: job.id }, deps);
    assert.equal(result.ok, true);
    if (!result.ok) return;

    assert.deepEqual(
      Object.keys(result.result).sort(),
      [
        "generatedAt",
        "discoveryJobId",
        "statusFilter",
        "includeExisting",
        "onlyActionable",
        "maxCandidates",
        "limit",
        "totalReviewed",
        "actionableCount",
        "blockedCount",
        "duplicateCount",
        "socialOrNoOwnWebsiteCount",
        "recommendedCandidateId",
        "stopReason",
        "items",
      ].sort(),
    );
    assert.deepEqual(
      Object.keys(result.result.items[0]!).sort(),
      [
        "rank",
        "candidateId",
        "rawName",
        "websiteUrl",
        "city",
        "state",
        "suggestedAction",
        "organizationType",
        "icpFit",
        "decisionComplexity",
        "blockers",
        "reasons",
        "existingClinicId",
        "existingClinicMatchReason",
        "websiteClassification",
        "operatorRecommendation",
        "rankScore",
      ].sort(),
    );
    const roundTripped = JSON.parse(JSON.stringify(result.result)) as OperatorShortlistResult;
    assert.deepEqual(roundTripped, result.result);
  });

  it("12. Markdown output is stable enough — includes summary and recommended candidate", async () => {
    const deps = buildDeps();
    const job = await seedJob(deps);
    await seedCandidate(deps, {
      rawName: "Clínica Markdown Check",
      dedupeKey: "shortlist-markdown-1",
      discoveryJobId: job.id,
      websiteUrl: "https://markdowncheck.example.com.br/",
      normalizedWebsiteOrigin: "https://markdowncheck.example.com.br",
    });

    const result = await buildOperatorShortlist({ discoveryJobId: job.id }, deps);
    assert.equal(result.ok, true);
    if (!result.ok) return;

    const markdown = renderOperatorShortlistMarkdown(result.result);
    assert.match(markdown, /# Shortlist do operador/);
    assert.match(markdown, /## Resumo/);
    assert.match(markdown, /Clínica Markdown Check/);
    assert.match(markdown, /Promover a seguir/);
  });

  it("13. command suggestions use existing script names/flags, or \"não disponível\" when there is no recommendation", async () => {
    const deps = buildDeps();
    const job = await seedJob(deps);
    await seedCandidate(deps, {
      rawName: "Clínica Comando Check",
      dedupeKey: "shortlist-command-1",
      discoveryJobId: job.id,
      websiteUrl: "https://comandocheck.example.com.br/",
      normalizedWebsiteOrigin: "https://comandocheck.example.com.br",
    });

    const result = await buildOperatorShortlist({ discoveryJobId: job.id }, deps);
    assert.equal(result.ok, true);
    if (!result.ok) return;
    const markdown = renderOperatorShortlistMarkdown(result.result);
    assert.match(markdown, /npm run crawler:promote --/);
    assert.match(markdown, /--candidate-id/);
    assert.match(markdown, /npm run crawler:queue:process --/);
    assert.match(markdown, /--clinic-ids/);
    assert.doesNotMatch(markdown, /--clinic-id\s/);

    const dup = await seedCandidate(deps, {
      rawName: "Clínica Sem Recomendação",
      dedupeKey: "shortlist-command-2",
      discoveryJobId: job.id,
    });
    await deps.discoveryRepo.markCandidateDuplicate(dup.id, "already seen");
    const onlyDupJob = await seedJob(deps);
    await deps.discoveryRepo.markCandidateDuplicate(
      (await seedCandidate(deps, { rawName: "Só Duplicado", dedupeKey: "shortlist-command-3", discoveryJobId: onlyDupJob.id })).id,
      "already seen",
    );
    const noRecommendation = await buildOperatorShortlist({ discoveryJobId: onlyDupJob.id }, deps);
    assert.equal(noRecommendation.ok, true);
    if (!noRecommendation.ok) return;
    const noRecMarkdown = renderOperatorShortlistMarkdown(noRecommendation.result);
    assert.match(noRecMarkdown, /Nenhum candidato recomendado nesta leva — nenhum comando sugerido/);
  });

  it("14. no mutation repository methods are called", async () => {
    const deps = buildDeps();
    const job = await seedJob(deps);
    await seedCandidate(deps, {
      rawName: "Clínica Read Only Check",
      dedupeKey: "shortlist-read-only-1",
      discoveryJobId: job.id,
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

    await buildOperatorShortlist({ discoveryJobId: job.id, includeExisting: true }, deps);

    assert.equal(recordCandidateCalled, false);
    assert.equal(markDuplicateCalled, false);
    assert.equal(markRejectedCalled, false);
    assert.equal(markPromotedCalled, false);
    assert.equal(createClinicCalled, false);
  });

  it("15. production is refused", () => {
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

  it("16. a missing --target is rejected for any non-dry-run call", () => {
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

  it("17. an empty result cleanly reports a stop reason", async () => {
    const deps = buildDeps();
    const job = await seedJob(deps);

    const result = await buildOperatorShortlist({ discoveryJobId: job.id }, deps);
    assert.equal(result.ok, true);
    if (!result.ok) return;
    assert.equal(result.result.totalReviewed, 0);
    assert.equal(result.result.items.length, 0);
    assert.equal(result.result.recommendedCandidateId, null);
    assert.ok(result.result.stopReason);
    assert.match(result.result.stopReason!, /Nenhum candidato encontrado/);
  });

  it("17b. a job with only blocked/manual-review candidates (no actionable promote_next) reports a stop reason", async () => {
    const deps = buildDeps();
    const job = await seedJob(deps);
    await seedCandidate(deps, {
      rawName: "Dra. Solo Only",
      dedupeKey: "shortlist-only-manual-1",
      discoveryJobId: job.id,
      websiteUrl: "https://drasoloOnly.example.com.br/",
      normalizedWebsiteOrigin: "https://drasoloOnly.example.com.br",
    });

    const result = await buildOperatorShortlist({ discoveryJobId: job.id }, deps);
    assert.equal(result.ok, true);
    if (!result.ok) return;
    assert.equal(result.result.recommendedCandidateId, null);
    assert.ok(result.result.stopReason);
    assert.match(result.result.stopReason!, /manual_review/);
  });

  it("18. no secrets appear in output", async () => {
    const deps = buildDeps();
    const job = await seedJob(deps);
    const FAKE_SECRET_MARKER = "TEST-FAKE-NOT-A-REAL-SECRET-77777";
    await seedCandidate(deps, {
      rawName: "Clínica Secret Leak Check",
      dedupeKey: "shortlist-secret-1",
      discoveryJobId: job.id,
      sourceAttribution: { providerPlaceId: "places/abc123", raw: { someInternalToken: FAKE_SECRET_MARKER } },
    });

    const result = await buildOperatorShortlist({ discoveryJobId: job.id }, deps);
    assert.equal(result.ok, true);
    if (!result.ok) return;
    const asJson = JSON.stringify(result.result);
    assert.ok(!asJson.includes(FAKE_SECRET_MARKER));
    const markdown = renderOperatorShortlistMarkdown(result.result);
    assert.ok(!markdown.includes(FAKE_SECRET_MARKER));
  });

  it("--only-actionable hides blocked/duplicate rows from display without affecting summary counts", async () => {
    const deps = buildDeps();
    const job = await seedJob(deps);
    await seedCandidate(deps, {
      rawName: "Clínica Boa Actionable",
      dedupeKey: "shortlist-only-actionable-good",
      discoveryJobId: job.id,
      websiteUrl: "https://boaactionable.example.com.br/",
      normalizedWebsiteOrigin: "https://boaactionable.example.com.br",
    });
    const dup = await seedCandidate(deps, {
      rawName: "Clínica Duplicada Actionable",
      dedupeKey: "shortlist-only-actionable-dup",
      discoveryJobId: job.id,
    });
    await deps.discoveryRepo.markCandidateDuplicate(dup.id, "already seen");

    const result = await buildOperatorShortlist({ discoveryJobId: job.id, onlyActionable: true }, deps);
    assert.equal(result.ok, true);
    if (!result.ok) return;
    assert.equal(result.result.items.length, 1);
    assert.equal(result.result.items[0]!.rawName, "Clínica Boa Actionable");
    assert.equal(result.result.totalReviewed, 2);
    assert.equal(result.result.duplicateCount, 1);
  });
});
