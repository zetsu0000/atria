import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import {
  FakeClinicRepository,
  FakeCrawlRepository,
  FakeDiscoveryRepository,
  FakeHumanReviewRepository,
  FakeManualOutreachLogRepository,
  FakeScoreRepository,
} from "@/lib/operations/repositories/fakes";
import type { PipelineTarget } from "@/lib/operations/pipeline/target-guard";
import { selectRepositories } from "@/lib/operations/pipeline/select-repositories";
import { KNOWN_PROJECT_REFS } from "@/lib/operations/pipeline/target-guard";
import type { LeadCaptureEnv } from "@/lib/security/env";
import {
  prioritizeProspects,
  type PrioritizeProspectsDeps,
} from "./prioritization/prioritize-prospects";
import { renderPrioritizationMarkdown } from "./prioritization/render-prioritization-markdown";

function buildDeps(): PrioritizeProspectsDeps & {
  clinicRepo: FakeClinicRepository;
  discoveryRepo: FakeDiscoveryRepository;
  crawlRepo: FakeCrawlRepository;
  scoreRepo: FakeScoreRepository;
  humanReviewRepo: FakeHumanReviewRepository;
  manualOutreachLogRepo: FakeManualOutreachLogRepository;
} {
  return {
    clinicRepo: new FakeClinicRepository(),
    discoveryRepo: new FakeDiscoveryRepository(),
    crawlRepo: new FakeCrawlRepository(),
    scoreRepo: new FakeScoreRepository(),
    humanReviewRepo: new FakeHumanReviewRepository(),
    manualOutreachLogRepo: new FakeManualOutreachLogRepository(),
  };
}

async function seedClinic(
  deps: ReturnType<typeof buildDeps>,
  dedupeKey: string,
  overrides: { displayName?: string; websiteUrl?: string; normalizedWebsiteOrigin?: string } = {},
) {
  const clinic = await deps.clinicRepo.createClinic({
    displayName: overrides.displayName ?? "Clínica Teste",
    normalizedName: "clinica teste",
    websiteUrl: overrides.websiteUrl ?? "https://www.clinicateste.com.br/",
    normalizedWebsiteOrigin: overrides.normalizedWebsiteOrigin ?? "https://www.clinicateste.com.br",
    city: "São Paulo",
    state: "SP",
    specialty: "skin_care_clinic",
    status: "prospect",
    sourceType: "google_places",
    sourceAttribution: {},
    dedupeKey,
  });
  if (!clinic.ok) throw new Error("setup failed");
  return clinic.value;
}

async function seedCrawlJob(
  deps: ReturnType<typeof buildDeps>,
  clinicId: string,
  patch: { status?: "completed" | "failed" | "partial"; errorCode?: string | null } = {},
) {
  const created = await deps.crawlRepo.createCrawlJob({
    clinicId,
    requestedUrl: "https://www.clinicateste.com.br/",
    normalizedOrigin: "https://www.clinicateste.com.br",
  });
  if (!created.ok) throw new Error("setup failed");
  if (patch.status) {
    await deps.crawlRepo.updateCrawlJobCounters(created.value.id, {
      status: patch.status,
      errorCode: (patch.errorCode as never) ?? null,
      completedAt: new Date().toISOString(),
    });
  }
  return created.value;
}

async function seedScreenshot(deps: ReturnType<typeof buildDeps>, crawlJobId: string) {
  await deps.crawlRepo.saveAsset({
    crawlJobId,
    assetType: "screenshot_desktop",
    storagePath: `private/scan-assets/${crawlJobId}/desktop.png`,
    contentType: "image/png",
    widthPx: 1280,
    heightPx: 800,
    pageUrl: "https://www.clinicateste.com.br/",
    reviewStatus: "pending_review",
    metadata: { captureStatus: "captured", capturedAt: new Date().toISOString() },
  });
}

async function seedScore(deps: ReturnType<typeof buildDeps>, clinicId: string, total: number) {
  const per = Math.floor(total / 5);
  const remainder = total - per * 5;
  await deps.scoreRepo.saveScore({
    clinicId,
    score: {
      credibility: per + remainder,
      clarity: per,
      mobile: per,
      actionability: per,
      freshness: per,
      total,
      evidence: [{ dimension: "credibility", points: per, reason: "Evidência de teste." }],
      disclaimer: "Esta análise avalia apenas a apresentação digital e a facilidade de encontrar informações. Não avalia qualidade médica.",
      scoringVersion: "v1",
      reviewStatus: "pending_review",
    },
  });
}

async function seedContact(deps: ReturnType<typeof buildDeps>, clinicId: string) {
  await deps.clinicRepo.addContact({
    clinicId,
    contactType: "whatsapp",
    value: "https://wa.me/5511900000000",
    normalizedValue: "https://wa.me/5511900000000",
    confidence: "high",
  });
}

async function seedDecision(deps: ReturnType<typeof buildDeps>, clinicId: string, decision: "approved" | "rejected" | "needs_changes") {
  await deps.humanReviewRepo.recordDecision({ clinicId, decision, reviewer: "Atria QA" });
}

async function seedManualLog(deps: ReturnType<typeof buildDeps>, clinicId: string, outreachMessageId: string, occurredAt: string, eventType: "manual_send_logged" | "rehearsal_logged" = "manual_send_logged") {
  await deps.manualOutreachLogRepo.recordLog({
    clinicId,
    outreachMessageId,
    channel: "whatsapp",
    eventType,
    operatorName: "AB",
    occurredAt,
  });
}

describe("prioritizeProspects: tiers", () => {
  it("1. high priority: score in sweet spot + contact + screenshot + no blockers", async () => {
    const deps = buildDeps();
    const clinic = await seedClinic(deps, "high-priority-clinic");
    const crawlJob = await seedCrawlJob(deps, clinic.id, { status: "completed" });
    await seedScreenshot(deps, crawlJob.id);
    await seedScore(deps, clinic.id, 70);
    await seedContact(deps, clinic.id);

    const result = await prioritizeProspects({}, deps);
    const item = result.items.find((i) => i.id === clinic.id);
    assert.ok(item);
    assert.equal(item!.priorityTier, "high");
    assert.equal(item!.suggestedNextAction, "review_pack");
  });

  it("2. medium priority: has score + contact, but no screenshot evidence", async () => {
    const deps = buildDeps();
    const clinic = await seedClinic(deps, "medium-priority-clinic");
    await seedCrawlJob(deps, clinic.id, { status: "completed" });
    await seedScore(deps, clinic.id, 70);
    await seedContact(deps, clinic.id);

    const result = await prioritizeProspects({}, deps);
    const item = result.items.find((i) => i.id === clinic.id);
    assert.ok(item);
    assert.equal(item!.priorityTier, "medium");
    assert.equal(item!.facts.hasScreenshotEvidence, false);
  });

  it("3. low priority: missing score entirely (never crawled)", async () => {
    const deps = buildDeps();
    const clinic = await seedClinic(deps, "low-priority-clinic");

    const result = await prioritizeProspects({}, deps);
    const item = result.items.find((i) => i.id === clinic.id);
    assert.ok(item);
    assert.equal(item!.facts.hasScore, false);
    assert.equal(item!.suggestedNextAction, "approve_domain");
    assert.ok(item!.priorityTier === "low" || item!.priorityTier === "medium");
  });
});

describe("prioritizeProspects: hard blockers", () => {
  it("4. blocked: rejected review decision, regardless of otherwise-strong evidence", async () => {
    const deps = buildDeps();
    const clinic = await seedClinic(deps, "rejected-priority-clinic");
    const crawlJob = await seedCrawlJob(deps, clinic.id, { status: "completed" });
    await seedScreenshot(deps, crawlJob.id);
    await seedScore(deps, clinic.id, 70);
    await seedContact(deps, clinic.id);
    await seedDecision(deps, clinic.id, "rejected");

    const result = await prioritizeProspects({}, deps);
    const item = result.items.find((i) => i.id === clinic.id);
    assert.ok(item);
    assert.equal(item!.priorityTier, "blocked");
    assert.equal(item!.suggestedNextAction, "skip");
  });

  it("5. blocked: do_not_contact, regardless of otherwise-strong evidence", async () => {
    const deps = buildDeps();
    const clinic = await seedClinic(deps, "dnc-priority-clinic");
    const crawlJob = await seedCrawlJob(deps, clinic.id, { status: "completed" });
    await seedScreenshot(deps, crawlJob.id);
    await seedScore(deps, clinic.id, 70);
    await seedContact(deps, clinic.id);
    await deps.clinicRepo.setDoNotContact(clinic.id, true, "Pediu para não ser contatada.");

    const result = await prioritizeProspects({}, deps);
    const item = result.items.find((i) => i.id === clinic.id);
    assert.ok(item);
    assert.equal(item!.priorityTier, "blocked");
    assert.equal(item!.suggestedNextAction, "skip");
  });
});

describe("prioritizeProspects: robots/TLS blocker with and without salvageable evidence", () => {
  it("6a. robots_denied with no screenshot evidence is a severe blocker", async () => {
    const deps = buildDeps();
    const clinic = await seedClinic(deps, "robots-denied-no-evidence-clinic");
    await seedCrawlJob(deps, clinic.id, { status: "failed", errorCode: "robots_denied" });

    const result = await prioritizeProspects({}, deps);
    const item = result.items.find((i) => i.id === clinic.id);
    assert.ok(item);
    assert.ok(item!.blockers.some((b) => /robots\.txt/.test(b)));
    assert.ok(item!.priorityTier === "low" || item!.priorityTier === "blocked");
  });

  it("6b. a fetch failure with screenshot evidence is a much smaller penalty than the same failure without it", async () => {
    const withoutEvidenceDeps = buildDeps();
    const clinicA = await seedClinic(withoutEvidenceDeps, "fetch-fail-no-evidence-clinic");
    await seedCrawlJob(withoutEvidenceDeps, clinicA.id, { status: "failed", errorCode: "unexpected_error" });
    const resultA = await prioritizeProspects({}, withoutEvidenceDeps);
    const itemA = resultA.items.find((i) => i.id === clinicA.id)!;

    const withEvidenceDeps = buildDeps();
    const clinicB = await seedClinic(withEvidenceDeps, "fetch-fail-with-evidence-clinic");
    const crawlJobB = await seedCrawlJob(withEvidenceDeps, clinicB.id, { status: "failed", errorCode: "unexpected_error" });
    await seedScreenshot(withEvidenceDeps, crawlJobB.id);
    const resultB = await prioritizeProspects({}, withEvidenceDeps);
    const itemB = resultB.items.find((i) => i.id === clinicB.id)!;

    assert.ok(itemB.priorityScore > itemA.priorityScore, "screenshot evidence must meaningfully raise priority over a bare fetch failure");
    assert.equal(itemB.suggestedNextAction, "retry_crawl");
  });
});

describe("prioritizeProspects: recency", () => {
  it("7. recently manually logged (real contact, not rehearsal) lowers priority vs. the same clinic without a recent log", async () => {
    const now = new Date("2026-07-23T12:00:00Z");

    const depsWithoutLog = buildDeps();
    const clinicA = await seedClinic(depsWithoutLog, "no-recent-contact-clinic");
    await seedCrawlJob(depsWithoutLog, clinicA.id, { status: "completed" });
    await seedScore(depsWithoutLog, clinicA.id, 70);
    const resultA = await prioritizeProspects({ now }, depsWithoutLog);
    const itemA = resultA.items.find((i) => i.id === clinicA.id)!;

    const depsWithLog = buildDeps();
    const clinicB = await seedClinic(depsWithLog, "recent-contact-clinic");
    await seedCrawlJob(depsWithLog, clinicB.id, { status: "completed" });
    await seedScore(depsWithLog, clinicB.id, 70);
    await seedManualLog(depsWithLog, clinicB.id, "fake-outreach-message-id", "2026-07-10T12:00:00Z");
    const resultB = await prioritizeProspects({ now }, depsWithLog);
    const itemB = resultB.items.find((i) => i.id === clinicB.id)!;

    assert.equal(itemA.facts.recentlyLogged, false);
    assert.equal(itemB.facts.recentlyLogged, true);
    assert.ok(itemA.priorityScore > itemB.priorityScore);
  });

  it("a rehearsal_logged event never counts as a real recent contact", async () => {
    const now = new Date("2026-07-23T12:00:00Z");
    const deps = buildDeps();
    const clinic = await seedClinic(deps, "rehearsal-log-clinic");
    await seedCrawlJob(deps, clinic.id, { status: "completed" });
    await seedScore(deps, clinic.id, 70);
    await seedManualLog(deps, clinic.id, "fake-outreach-message-id", "2026-07-10T12:00:00Z", "rehearsal_logged");

    const result = await prioritizeProspects({ now }, deps);
    const item = result.items.find((i) => i.id === clinic.id)!;
    assert.equal(item.facts.recentlyLogged, false);
  });
});

describe("prioritizeProspects: directory listings", () => {
  it("8. a clinic/candidate on a known third-party directory domain is heavily penalized and suggested to skip", async () => {
    const deps = buildDeps();
    const clinic = await seedClinic(deps, "directory-clinic", {
      websiteUrl: "https://www.doctoralia.com.br/some-doctor",
      normalizedWebsiteOrigin: "https://www.doctoralia.com.br",
    });

    const result = await prioritizeProspects({}, deps);
    const item = result.items.find((i) => i.id === clinic.id);
    assert.ok(item);
    assert.equal(item!.facts.isDirectoryListing, true);
    assert.equal(item!.suggestedNextAction, "skip");
    assert.ok(item!.priorityTier === "low" || item!.priorityTier === "blocked");

    const candidateResult = await deps.discoveryRepo.recordCandidate({
      sourceType: "google_places",
      rawName: "Dr. Fulano — Doctoralia",
      normalizedName: "dr fulano doctoralia",
      websiteUrl: "https://www.doctoralia.com.br/dr-fulano",
      normalizedWebsiteOrigin: "https://www.doctoralia.com.br",
      phone: null,
      email: null,
      city: null,
      state: "SP",
      specialty: null,
      sourceAttribution: {},
      dedupeKey: "directory-candidate-dedupe",
    });
    assert.equal(candidateResult.ok, true);
    const withCandidate = await prioritizeProspects({}, deps);
    const candidateItem = withCandidate.items.find((i) => i.kind === "candidate" && i.id === (candidateResult as { ok: true; value: { id: string } }).value.id);
    assert.ok(candidateItem);
    assert.equal(candidateItem!.suggestedNextAction, "skip");
  });
});

describe("prioritizeProspects: ICP classification (docs/technical/crawler-icp-classification.md)", () => {
  it("11. a hospital, franchise unit, and wrong-audience business are all lowered/blocked in priority, never ranking as high/core", async () => {
    const deps = buildDeps();
    const hospital = await seedClinic(deps, "icp-hospital-clinic", {
      displayName: "Hospital Santa Vida",
      websiteUrl: "https://hospitalsantavida.example.com.br/",
      normalizedWebsiteOrigin: "https://hospitalsantavida.example.com.br",
    });
    const franchise = await seedClinic(deps, "icp-franchise-clinic", {
      displayName: "Rede Dermato Brasil - Franquia Curitiba",
      websiteUrl: "https://redeDermatoBrasilFranquia.example.com.br/",
      normalizedWebsiteOrigin: "https://redeDermatoBrasilFranquia.example.com.br",
    });
    const wrongAudience = await seedClinic(deps, "icp-wrong-audience-clinic", {
      displayName: "Farmácia Popular Bem Estar",
      websiteUrl: "https://farmaciapopularbemestar.example.com.br/",
      normalizedWebsiteOrigin: "https://farmaciapopularbemestar.example.com.br",
    });

    const result = await prioritizeProspects({}, deps);

    const hospitalItem = result.items.find((i) => i.id === hospital.id)!;
    assert.equal(hospitalItem.icp.organizationType, "hospital");
    assert.notEqual(hospitalItem.priorityTier, "high");

    const franchiseItem = result.items.find((i) => i.id === franchise.id)!;
    assert.equal(franchiseItem.icp.organizationType, "franchise_unit");
    assert.notEqual(franchiseItem.priorityTier, "high");

    const wrongAudienceItem = result.items.find((i) => i.id === wrongAudience.id)!;
    assert.equal(wrongAudienceItem.icp.organizationType, "wrong_audience");
    assert.equal(wrongAudienceItem.priorityTier, "blocked");
    assert.equal(wrongAudienceItem.suggestedNextAction, "skip");
  });

  it("12. a wrong-audience business with maximal technical evidence still ranks blocked — a high technical score never overrides blocked ICP", async () => {
    const deps = buildDeps();
    const clinic = await seedClinic(deps, "icp-blocked-high-score-clinic", {
      displayName: "Farmácia Popular Bem Estar",
      websiteUrl: "https://farmaciapopularbemestar2.example.com.br/",
      normalizedWebsiteOrigin: "https://farmaciapopularbemestar2.example.com.br",
    });
    const crawlJob = await seedCrawlJob(deps, clinic.id, { status: "completed" });
    await seedScreenshot(deps, crawlJob.id);
    await seedScore(deps, clinic.id, 70);
    await seedContact(deps, clinic.id);
    await seedDecision(deps, clinic.id, "approved");

    const result = await prioritizeProspects({}, deps);
    const item = result.items.find((i) => i.id === clinic.id)!;
    assert.equal(item.icp.icpFit, "blocked");
    // Every non-ICP signal here is maximally favorable — proves the
    // blocked ICP hard-override, not just a numeric penalty, is what
    // keeps this out of high/medium.
    assert.equal(item.priorityTier, "blocked");
    assert.equal(item.suggestedNextAction, "skip");
  });

  it("a hospital/franchise with maximal technical evidence still ranks a full tier or more below an equally-evidenced independent clinic — never outranks merely for a better website", async () => {
    const deps = buildDeps();
    const hospital = await seedClinic(deps, "icp-hospital-vs-independent", {
      displayName: "Hospital Grande Porte",
      websiteUrl: "https://hospitalgrandeporte.example.com.br/",
      normalizedWebsiteOrigin: "https://hospitalgrandeporte.example.com.br",
    });
    const hospitalCrawl = await seedCrawlJob(deps, hospital.id, { status: "completed" });
    await seedScreenshot(deps, hospitalCrawl.id);
    await seedScore(deps, hospital.id, 70);
    await seedContact(deps, hospital.id);
    await seedDecision(deps, hospital.id, "approved");

    const independent = await seedClinic(deps, "icp-independent-vs-hospital", {
      displayName: "Clínica Independente Exemplo",
      websiteUrl: "https://clinicaindependenteexemplo.example.com.br/",
      normalizedWebsiteOrigin: "https://clinicaindependenteexemplo.example.com.br",
    });
    const independentCrawl = await seedCrawlJob(deps, independent.id, { status: "completed" });
    await seedScreenshot(deps, independentCrawl.id);
    await seedScore(deps, independent.id, 70);
    await seedContact(deps, independent.id);
    await seedDecision(deps, independent.id, "approved");

    const result = await prioritizeProspects({}, deps);
    const hospitalItem = result.items.find((i) => i.id === hospital.id)!;
    const independentItem = result.items.find((i) => i.id === independent.id)!;
    assert.ok(
      hospitalItem.priorityScore < independentItem.priorityScore,
      "an equally-evidenced hospital must not outrank an equally-evidenced independent clinic",
    );
  });
});

describe("prioritizeProspects: production is refused", () => {
  it("9. the shared repository-selection gate refuses production regardless of --target", () => {
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
    const selection = selectRepositories({ dryRun: false, target: "staging" as PipelineTarget, env });
    assert.equal(selection.ok, false);
    if (selection.ok) return;
    assert.match(selection.reason, /production/);
  });
});

describe("prioritizeProspects: read-only, no external calls", () => {
  it("10. the prioritization source file never references a network/external-API primitive", () => {
    const source = readFileSync(
      new URL("./prioritization/prioritize-prospects.ts", import.meta.url),
      "utf8",
    );
    for (const forbidden of ["fetch(", "undici", "playwright", "googleapis", "places.googleapis"]) {
      assert.doesNotMatch(source, new RegExp(forbidden.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
    }
  });

  it("never writes to any repository — row counts are unchanged before/after", async () => {
    const deps = buildDeps();
    const clinic = await seedClinic(deps, "read-only-clinic");
    await seedCrawlJob(deps, clinic.id, { status: "completed" });
    await seedScore(deps, clinic.id, 70);

    const clinicsBefore = deps.clinicRepo.clinics.size;
    const scoresBefore = deps.scoreRepo.records.length;
    const decisionsBefore = deps.humanReviewRepo.decisions.length;
    const logsBefore = deps.manualOutreachLogRepo.logs.length;

    await prioritizeProspects({}, deps);

    assert.equal(deps.clinicRepo.clinics.size, clinicsBefore);
    assert.equal(deps.scoreRepo.records.length, scoresBefore);
    assert.equal(deps.humanReviewRepo.decisions.length, decisionsBefore);
    assert.equal(deps.manualOutreachLogRepo.logs.length, logsBefore);
  });
});

describe("prioritizeProspects: deterministic ordering and stable shapes", () => {
  it("11. running twice against the same data produces identical ordering", async () => {
    const deps = buildDeps();
    const clinicA = await seedClinic(deps, "order-a");
    await seedCrawlJob(deps, clinicA.id, { status: "completed" });
    await seedScore(deps, clinicA.id, 60);
    const clinicB = await seedClinic(deps, "order-b");
    await seedCrawlJob(deps, clinicB.id, { status: "completed" });
    await seedScore(deps, clinicB.id, 80);
    await seedContact(deps, clinicB.id);
    const clinicC = await seedClinic(deps, "order-c");

    const first = await prioritizeProspects({}, deps);
    const second = await prioritizeProspects({}, deps);
    assert.deepEqual(
      first.items.map((i) => i.id),
      second.items.map((i) => i.id),
    );
    // Higher-evidence clinic B must rank above lower-evidence clinic A, which must rank above never-crawled clinic C.
    const order = first.items.map((i) => i.id);
    assert.ok(order.indexOf(clinicB.id) < order.indexOf(clinicA.id));
    assert.ok(order.indexOf(clinicA.id) < order.indexOf(clinicC.id));
  });

  it("12. JSON shape is stable and round-trips through JSON.stringify/parse", async () => {
    const deps = buildDeps();
    const clinic = await seedClinic(deps, "json-shape-clinic");
    await seedCrawlJob(deps, clinic.id, { status: "completed" });
    await seedScore(deps, clinic.id, 70);

    const result = await prioritizeProspects({}, deps);
    const roundTripped = JSON.parse(JSON.stringify(result));
    assert.deepEqual(Object.keys(roundTripped).sort(), Object.keys(result).sort());
    assert.deepEqual(
      Object.keys(result).sort(),
      ["count", "generatedAt", "items", "limit", "tierFilter"].sort(),
    );
    const item = result.items[0]!;
    assert.deepEqual(
      Object.keys(item).sort(),
      ["blockers", "displayName", "facts", "icp", "id", "kind", "normalizedWebsiteOrigin", "priorityScore", "priorityTier", "reasons", "suggestedNextAction", "websiteUrl"].sort(),
    );
  });

  it("13. Markdown rendering is deterministic for the same result object", async () => {
    const deps = buildDeps();
    const clinic = await seedClinic(deps, "deterministic-markdown-clinic");
    await seedCrawlJob(deps, clinic.id, { status: "completed" });
    await seedScore(deps, clinic.id, 70);
    await seedContact(deps, clinic.id);

    const result = await prioritizeProspects({}, deps);
    const a = renderPrioritizationMarkdown(result);
    const b = renderPrioritizationMarkdown(result);
    assert.equal(a, b);
    assert.match(a, /Priorização de prospects/);
  });
});

describe("prioritizeProspects: score-calibration alignment (docs/technical/crawler-score-prioritization-alignment.md)", () => {
  it("1. a high-scored clinic with screenshot + contact remains high after the alignment fix", async () => {
    const deps = buildDeps();
    const clinic = await seedClinic(deps, "alignment-high-clinic");
    const crawlJob = await seedCrawlJob(deps, clinic.id, { status: "completed" });
    await seedScreenshot(deps, crawlJob.id);
    await seedScore(deps, clinic.id, 70);
    await seedContact(deps, clinic.id);

    const result = await prioritizeProspects({}, deps);
    const item = result.items.find((i) => i.id === clinic.id)!;
    assert.equal(item.priorityTier, "high");
  });

  it("2. a real non-zero score always outranks both a missing score and a real zero-total score", async () => {
    const deps = buildDeps();

    const realEvidenceClinic = await seedClinic(deps, "alignment-real-score-clinic");
    await seedCrawlJob(deps, realEvidenceClinic.id, { status: "completed" });
    await seedScore(deps, realEvidenceClinic.id, 60);
    await seedContact(deps, realEvidenceClinic.id);

    const missingScoreClinic = await seedClinic(deps, "alignment-missing-score-clinic");

    // A clinic whose crawl was blocked by robots.txt: calculateScoreV1
    // (lib/score/calculate.ts) zeroes every dimension for this case, so a
    // real, computed score row exists with total: 0 — this must not be
    // treated as "some evidence available."
    const zeroScoreClinic = await seedClinic(deps, "alignment-zero-score-clinic");
    await seedCrawlJob(deps, zeroScoreClinic.id, { status: "failed", errorCode: "robots_denied" });
    await seedScore(deps, zeroScoreClinic.id, 0);

    const result = await prioritizeProspects({}, deps);
    const order = result.items.map((i) => i.id);
    assert.ok(order.indexOf(realEvidenceClinic.id) < order.indexOf(missingScoreClinic.id));
    assert.ok(order.indexOf(realEvidenceClinic.id) < order.indexOf(zeroScoreClinic.id));

    const zeroItem = result.items.find((i) => i.id === zeroScoreClinic.id)!;
    assert.ok(zeroItem.blockers.some((b) => /sem evidência de presença digital utilizável/.test(b)));
    assert.ok(!zeroItem.reasons.some((r) => /Score digital disponível/.test(r)), "a hard-zero score must never be reported as a positive reason");
  });

  it("3. a directory listing stays capped at low/blocked even with every other signal maximally favorable", async () => {
    const deps = buildDeps();
    const clinic = await seedClinic(deps, "alignment-directory-strong-signals", {
      websiteUrl: "https://www.doctoralia.com.br/some-doctor",
      normalizedWebsiteOrigin: "https://www.doctoralia.com.br",
    });
    const crawlJob = await seedCrawlJob(deps, clinic.id, { status: "completed" });
    await seedScreenshot(deps, crawlJob.id);
    await seedScore(deps, clinic.id, 60);
    await seedContact(deps, clinic.id);
    await seedDecision(deps, clinic.id, "approved");

    const result = await prioritizeProspects({}, deps);
    const item = result.items.find((i) => i.id === clinic.id)!;
    assert.ok(item.priorityTier === "low" || item.priorityTier === "blocked", `expected low/blocked, got ${item.priorityTier}`);
    assert.notEqual(item.priorityTier, "medium");
    assert.notEqual(item.priorityTier, "high");
  });

  it("7. robots_denied cannot reach medium/high tier even with contact + approved decision + salvageable screenshot", async () => {
    const deps = buildDeps();
    const clinic = await seedClinic(deps, "alignment-robots-denied-strong-signals");
    const crawlJob = await seedCrawlJob(deps, clinic.id, { status: "failed", errorCode: "robots_denied" });
    await seedScreenshot(deps, crawlJob.id);
    await seedScore(deps, clinic.id, 0);
    await seedContact(deps, clinic.id);
    await seedDecision(deps, clinic.id, "approved");

    const result = await prioritizeProspects({}, deps);
    const item = result.items.find((i) => i.id === clinic.id)!;
    assert.notEqual(item.priorityTier, "medium");
    assert.notEqual(item.priorityTier, "high");
    assert.ok(item.blockers.some((b) => /robots\.txt/.test(b)));
  });
});

describe("prioritizeProspects: tier filter", () => {
  it("respects --tier by excluding non-matching items", async () => {
    const deps = buildDeps();
    const highClinic = await seedClinic(deps, "filter-high");
    const crawlJob = await seedCrawlJob(deps, highClinic.id, { status: "completed" });
    await seedScreenshot(deps, crawlJob.id);
    await seedScore(deps, highClinic.id, 70);
    await seedContact(deps, highClinic.id);

    const blockedClinic = await seedClinic(deps, "filter-blocked");
    await deps.clinicRepo.setDoNotContact(blockedClinic.id, true, "opt-out");

    const result = await prioritizeProspects({ tier: "high" }, deps);
    assert.ok(result.items.every((i) => i.priorityTier === "high"));
    assert.ok(result.items.some((i) => i.id === highClinic.id));
    assert.ok(!result.items.some((i) => i.id === blockedClinic.id));
  });
});
