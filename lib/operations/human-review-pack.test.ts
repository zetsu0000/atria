import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  FakeClinicRepository,
  FakeCrawlRepository,
  FakeExtractionRepository,
  FakeOutreachRepository,
  FakeScoreRepository,
} from "./repositories/fakes";
import { buildHumanReviewPack, type BuildHumanReviewPackDeps } from "./review/build-human-review-pack";
import { renderHumanReviewPackMarkdown } from "./review/render-human-review-pack-markdown";
import { calculatePlaceholderScore, SCORE_DISCLAIMER } from "@/lib/score/calculate";
import { buildOutreachDraft } from "@/lib/outreach/draft";
import type { ExtractionCandidate } from "@/lib/crawler/extraction-types";
import { selectRepositories } from "./pipeline/select-repositories";
import { KNOWN_PROJECT_REFS } from "./pipeline/target-guard";
import type { LeadCaptureEnv } from "@/lib/security/env";

function buildDeps(): BuildHumanReviewPackDeps & {
  clinicRepo: FakeClinicRepository;
  crawlRepo: FakeCrawlRepository;
  extractionRepo: FakeExtractionRepository;
  scoreRepo: FakeScoreRepository;
  outreachRepo: FakeOutreachRepository;
} {
  return {
    clinicRepo: new FakeClinicRepository(),
    crawlRepo: new FakeCrawlRepository(),
    extractionRepo: new FakeExtractionRepository(),
    scoreRepo: new FakeScoreRepository(),
    outreachRepo: new FakeOutreachRepository(),
  };
}

async function seedClinic(deps: ReturnType<typeof buildDeps>, dedupeKey = "review-pack-clinic") {
  const clinic = await deps.clinicRepo.createClinic({
    displayName: "SkinLaser - Higienopolis",
    normalizedName: "skinlaser higienopolis",
    websiteUrl: "https://www.skinlaser.com.br/",
    normalizedWebsiteOrigin: "https://www.skinlaser.com.br",
    city: null,
    state: "SP",
    specialty: "skin_care_clinic",
    status: "prospect",
    sourceType: "google_places",
    sourceAttribution: { provider: "google_places" },
    dedupeKey,
  });
  if (!clinic.ok) throw new Error("setup failed");
  return clinic.value;
}

async function seedCrawlJob(deps: ReturnType<typeof buildDeps>, clinicId: string) {
  const created = await deps.crawlRepo.createCrawlJob({
    clinicId,
    requestedUrl: "https://www.skinlaser.com.br/",
    normalizedOrigin: "https://www.skinlaser.com.br",
    maxPages: 3,
  });
  if (!created.ok) throw new Error("setup failed");
  await deps.crawlRepo.claimCrawlJob(created.value.id);
  const completed = await deps.crawlRepo.updateCrawlJobCounters(created.value.id, {
    status: "partial",
    pagesFetched: 3,
    pagesDiscovered: 19,
    pagesFailed: 0,
    completedAt: new Date().toISOString(),
  });
  if (!completed.ok) throw new Error("setup failed");
  return completed.value;
}

const SAMPLE_CANDIDATES: ExtractionCandidate[] = [
  {
    kind: "title",
    value: "SkinLaser - Higienopolis",
    sourceUrl: "https://www.skinlaser.com.br/",
    sourcePage: "https://www.skinlaser.com.br/",
    extractionMethod: "meta",
    confidence: "high",
    reviewStatus: "pending_review",
  },
  {
    kind: "phone",
    value: "(11) 3155-5555",
    sourceUrl: "https://www.skinlaser.com.br/",
    sourcePage: "https://www.skinlaser.com.br/",
    extractionMethod: "html_text",
    confidence: "high",
    reviewStatus: "pending_review",
  },
  {
    kind: "email",
    value: "contato@skinlaser.com.br",
    sourceUrl: "https://www.skinlaser.com.br/",
    sourcePage: "https://www.skinlaser.com.br/",
    extractionMethod: "html_anchor",
    confidence: "high",
    reviewStatus: "pending_review",
  },
  {
    kind: "whatsapp",
    value: "https://api.whatsapp.com/send?phone=551131555555&text=Ol%C3%A1",
    sourceUrl: "https://www.skinlaser.com.br/",
    sourcePage: "https://www.skinlaser.com.br/",
    extractionMethod: "html_anchor",
    confidence: "high",
    reviewStatus: "pending_review",
  },
];

async function seedScore(deps: ReturnType<typeof buildDeps>, crawlJobId: string, clinicId: string) {
  const score = calculatePlaceholderScore({ candidates: SAMPLE_CANDIDATES, pageCount: 3 });
  const saved = await deps.scoreRepo.saveScore({ crawlJobId, clinicId, score });
  if (!saved.ok) throw new Error("setup failed");
  return saved.value;
}

describe("buildHumanReviewPack: complete package", () => {
  it("1. combines clinic, crawl, score, screenshots, extraction and outreach draft into one package", async () => {
    const deps = buildDeps();
    const clinic = await seedClinic(deps);
    const crawlJob = await seedCrawlJob(deps, clinic.id);

    await deps.crawlRepo.saveAsset({
      crawlJobId: crawlJob.id,
      assetType: "screenshot_desktop",
      storagePath: "",
      contentType: "image/png",
      widthPx: 1440,
      heightPx: 1200,
      pageUrl: "https://www.skinlaser.com.br/",
      reviewStatus: "pending_review",
      metadata: { captureStatus: "pending_storage", capturedAt: "2026-07-21T22:27:52.981Z" },
    });
    await deps.crawlRepo.saveAsset({
      crawlJobId: crawlJob.id,
      assetType: "screenshot_mobile",
      storagePath: "",
      contentType: "image/png",
      widthPx: 390,
      heightPx: 844,
      pageUrl: "https://www.skinlaser.com.br/",
      reviewStatus: "pending_review",
      metadata: { captureStatus: "pending_storage", capturedAt: "2026-07-21T22:27:55.092Z" },
    });

    await deps.extractionRepo.saveExtractedContent({
      crawlJobId: crawlJob.id,
      clinicId: clinic.id,
      schemaVersion: "extraction-candidates-v1",
      candidates: SAMPLE_CANDIDATES,
    });

    await seedScore(deps, crawlJob.id, clinic.id);

    const built = buildOutreachDraft({
      clinicDisplayName: clinic.displayName,
      channel: "email",
      observations: [{ observation: "Telefone e e-mail públicos encontrados.", sourceUrl: "https://www.skinlaser.com.br/" }],
      doNotContact: clinic.doNotContact,
    });
    if (!built.ok) return assert.fail();
    await deps.outreachRepo.createDraft({ clinicId: clinic.id, draft: built.draft, doNotContact: clinic.doNotContact });

    const result = await buildHumanReviewPack({ clinicId: clinic.id }, deps);
    assert.equal(result.ok, true);
    if (!result.ok) return;

    assert.equal(result.pack.status, "draft");
    assert.equal(result.pack.reviewRequired, true);
    assert.equal(result.pack.clinicIdentity.displayName, "SkinLaser - Higienopolis");
    assert.equal(result.pack.websiteAnalyzed.crawlJobId, crawlJob.id);
    assert.equal(result.pack.scoreSummary.available, true);
    assert.equal(result.pack.screenshots.desktop.status, "pending_storage");
    assert.equal(result.pack.screenshots.mobile.status, "pending_storage");
    assert.ok(result.pack.internalSummary.length > 0);
    assert.equal(result.pack.suggestedEmailDraft.available, true);
    assert.equal(result.pack.suggestedEmailDraft.persisted, true);
    // A WhatsApp draft is still generated fresh, since none was persisted —
    // and reuses the phone number the site itself published.
    assert.equal(result.pack.suggestedWhatsappDraft.available, true);
    assert.equal(result.pack.suggestedWhatsappDraft.persisted, false);
    assert.match(result.pack.suggestedWhatsappDraft.clickToChatUrl ?? "", /^https:\/\/wa\.me\/551131555555\?text=/);
  });
});

describe("buildHumanReviewPack: missing data handled gracefully", () => {
  it("2. missing screenshots are handled gracefully — status 'missing', non-fatal warning, pack still built", async () => {
    const deps = buildDeps();
    const clinic = await seedClinic(deps, "missing-screenshots");
    const crawlJob = await seedCrawlJob(deps, clinic.id);
    await seedScore(deps, crawlJob.id, clinic.id);

    const result = await buildHumanReviewPack({ clinicId: clinic.id }, deps);
    assert.equal(result.ok, true);
    if (!result.ok) return;
    assert.equal(result.pack.status, "draft");
    assert.equal(result.pack.screenshots.desktop.status, "missing");
    assert.equal(result.pack.screenshots.mobile.status, "missing");
    assert.ok(result.pack.riskFlags.some((f) => f.code === "missing_screenshot_desktop"));
    assert.ok(result.pack.riskFlags.some((f) => f.code === "missing_screenshot_mobile"));
  });

  it("3. missing outreach draft is handled gracefully — a suggested draft is generated fresh instead of failing", async () => {
    const deps = buildDeps();
    const clinic = await seedClinic(deps, "missing-outreach-draft");
    const crawlJob = await seedCrawlJob(deps, clinic.id);
    await deps.extractionRepo.saveExtractedContent({
      crawlJobId: crawlJob.id,
      clinicId: clinic.id,
      schemaVersion: "extraction-candidates-v1",
      candidates: SAMPLE_CANDIDATES,
    });
    await seedScore(deps, crawlJob.id, clinic.id);

    // No outreach_messages row created at all for this clinic.
    const result = await buildHumanReviewPack({ clinicId: clinic.id }, deps);
    assert.equal(result.ok, true);
    if (!result.ok) return;
    assert.equal(result.pack.suggestedEmailDraft.available, true);
    assert.equal(result.pack.suggestedEmailDraft.persisted, false);
    assert.equal(result.pack.suggestedEmailDraft.status, "draft");
    assert.ok(result.pack.suggestedEmailDraft.body && result.pack.suggestedEmailDraft.body.length > 0);
    assert.ok(result.pack.warnings.some((w) => /No persisted email outreach draft/.test(w)));
    // The fake repository confirms nothing was actually persisted as a side effect.
    assert.equal(deps.outreachRepo.messages.size, 0);
  });

  it("missing outreach draft + no score evidence at all (allowIncomplete) → suggested drafts report unavailable, not a crash", async () => {
    const deps = buildDeps();
    const clinic = await seedClinic(deps, "no-evidence-no-draft");
    await seedCrawlJob(deps, clinic.id);
    // No score, no extraction — allowIncomplete so the pack still builds.
    const result = await buildHumanReviewPack({ clinicId: clinic.id, allowIncomplete: true }, deps);
    assert.equal(result.ok, true);
    if (!result.ok) return;
    assert.equal(result.pack.suggestedEmailDraft.available, false);
    assert.match(result.pack.suggestedEmailDraft.unavailableReason ?? "", /No evidence available/);
    assert.equal(result.pack.suggestedWhatsappDraft.available, false);
  });

  it("4. missing score fails by default", async () => {
    const deps = buildDeps();
    const clinic = await seedClinic(deps, "missing-score");
    await seedCrawlJob(deps, clinic.id);

    const result = await buildHumanReviewPack({ clinicId: clinic.id }, deps);
    assert.equal(result.ok, false);
    if (result.ok) return;
    assert.equal(result.reason, "missing_score");
  });

  it("5. --allow-incomplete works — produces incomplete_review_pack instead of failing", async () => {
    const deps = buildDeps();
    const clinic = await seedClinic(deps, "allow-incomplete");
    await seedCrawlJob(deps, clinic.id);

    const result = await buildHumanReviewPack({ clinicId: clinic.id, allowIncomplete: true }, deps);
    assert.equal(result.ok, true);
    if (!result.ok) return;
    assert.equal(result.pack.status, "incomplete_review_pack");
    assert.equal(result.pack.scoreSummary.available, false);
    assert.ok(result.pack.riskFlags.some((f) => f.code === "missing_score"));
  });
});

describe("buildHumanReviewPack: safety invariants", () => {
  it("6. always includes the exact required disclaimer, complete or incomplete", async () => {
    const deps = buildDeps();
    const clinic = await seedClinic(deps, "disclaimer-check");
    const result = await buildHumanReviewPack({ clinicId: clinic.id, allowIncomplete: true }, deps);
    assert.equal(result.ok, true);
    if (!result.ok) return;
    assert.equal(
      result.pack.disclaimer,
      "Esta análise avalia apenas a apresentação digital e a facilidade de encontrar informações. Não avalia qualidade médica.",
    );
    assert.equal(result.pack.disclaimer, SCORE_DISCLAIMER);
    // Also present verbatim in the rendered Markdown.
    const markdown = renderHumanReviewPackMarkdown(result.pack);
    assert.match(markdown, /Esta análise avalia apenas a apresentação digital/);
  });

  it("7. never evaluates medical quality — no medical-quality field or claim appears anywhere in the package", async () => {
    const deps = buildDeps();
    const clinic = await seedClinic(deps, "no-medical-quality");
    const crawlJob = await seedCrawlJob(deps, clinic.id);
    await seedScore(deps, crawlJob.id, clinic.id);

    const result = await buildHumanReviewPack({ clinicId: clinic.id }, deps);
    assert.equal(result.ok, true);
    if (!result.ok) return;
    const serialized = JSON.stringify(result.pack).toLowerCase();
    assert.doesNotMatch(serialized, /qualidade m[eé]dica.{0,20}(boa|ruim|excelente|aprovad)/);
    assert.ok(!("medicalQuality" in result.pack));
    assert.doesNotMatch(serialized, /resultado (clínico|do paciente)/);
    assert.doesNotMatch(serialized, /patient outcome/);
  });

  it("8. never invents testimonials, awards, credentials, or client claims not present in the extracted evidence", async () => {
    const deps = buildDeps();
    const clinic = await seedClinic(deps, "no-invented-claims");
    const crawlJob = await seedCrawlJob(deps, clinic.id);
    await deps.extractionRepo.saveExtractedContent({
      crawlJobId: crawlJob.id,
      clinicId: clinic.id,
      schemaVersion: "extraction-candidates-v1",
      candidates: SAMPLE_CANDIDATES,
    });
    await seedScore(deps, crawlJob.id, clinic.id);

    const result = await buildHumanReviewPack({ clinicId: clinic.id }, deps);
    assert.equal(result.ok, true);
    if (!result.ok) return;
    // Exclude humanApprovalChecklist: it deliberately *names* these terms to
    // warn the reviewer against adding them — not the pack itself claiming them.
    const dataOnly = Object.fromEntries(
      Object.entries(result.pack).filter(([key]) => key !== "humanApprovalChecklist"),
    );
    const serialized = JSON.stringify(dataOnly).toLowerCase();
    for (const forbidden of ["depoimento", "prêmio", "premio", "cliente satisfeito", "crm ", "rqe ", "garantia de cura", "melhor clínica"]) {
      assert.doesNotMatch(serialized, new RegExp(forbidden), `unexpected invented claim: ${forbidden}`);
    }
  });

  it("9. suggested WhatsApp draft stays draft/review_required — never sent", async () => {
    const deps = buildDeps();
    const clinic = await seedClinic(deps, "whatsapp-review-required");
    const crawlJob = await seedCrawlJob(deps, clinic.id);
    await deps.extractionRepo.saveExtractedContent({
      crawlJobId: crawlJob.id,
      clinicId: clinic.id,
      schemaVersion: "extraction-candidates-v1",
      candidates: SAMPLE_CANDIDATES,
    });
    await seedScore(deps, crawlJob.id, clinic.id);

    const result = await buildHumanReviewPack({ clinicId: clinic.id }, deps);
    assert.equal(result.ok, true);
    if (!result.ok) return;
    assert.equal(result.pack.suggestedWhatsappDraft.reviewRequired, true);
    assert.equal(result.pack.suggestedWhatsappDraft.status, "draft");
    assert.notEqual(result.pack.suggestedWhatsappDraft.status, "sent");
  });

  it("10. suggested email draft stays draft/review_required — never sent", async () => {
    const deps = buildDeps();
    const clinic = await seedClinic(deps, "email-review-required");
    const crawlJob = await seedCrawlJob(deps, clinic.id);
    await seedScore(deps, crawlJob.id, clinic.id);

    const result = await buildHumanReviewPack({ clinicId: clinic.id }, deps);
    assert.equal(result.ok, true);
    if (!result.ok) return;
    assert.equal(result.pack.suggestedEmailDraft.reviewRequired, true);
    assert.equal(result.pack.suggestedEmailDraft.status, "draft");
    assert.notEqual(result.pack.suggestedEmailDraft.status, "sent");
  });

  it("do_not_contact clinics never get a freshly-suggested draft", async () => {
    const deps = buildDeps();
    const clinic = await deps.clinicRepo.createClinic({
      displayName: "Clínica Bloqueada",
      normalizedName: "clinica bloqueada",
      websiteUrl: "https://example.com/",
      normalizedWebsiteOrigin: "https://example.com",
      city: null,
      state: null,
      specialty: null,
      status: "prospect",
      sourceType: "manual",
      sourceAttribution: {},
      dedupeKey: "do-not-contact-clinic",
    });
    if (!clinic.ok) return assert.fail();
    await deps.clinicRepo.setDoNotContact(clinic.value.id, true, "Paciente pediu para não ser contatado.");
    const crawlJob = await seedCrawlJob(deps, clinic.value.id);
    await seedScore(deps, crawlJob.id, clinic.value.id);

    const result = await buildHumanReviewPack({ clinicId: clinic.value.id }, deps);
    assert.equal(result.ok, true);
    if (!result.ok) return;
    assert.equal(result.pack.suggestedEmailDraft.available, false);
    assert.match(result.pack.suggestedEmailDraft.unavailableReason ?? "", /do_not_contact/);
    assert.ok(result.pack.riskFlags.some((f) => f.code === "do_not_contact" && f.severity === "high"));
  });
});

describe("human review pack rendering: stable output shapes", () => {
  it("12. Markdown rendering is deterministic for the same pack object", async () => {
    const deps = buildDeps();
    const clinic = await seedClinic(deps, "markdown-stable");
    const crawlJob = await seedCrawlJob(deps, clinic.id);
    await seedScore(deps, crawlJob.id, clinic.id);

    const result = await buildHumanReviewPack({ clinicId: clinic.id }, deps);
    assert.equal(result.ok, true);
    if (!result.ok) return;

    const first = renderHumanReviewPackMarkdown(result.pack);
    const second = renderHumanReviewPackMarkdown(result.pack);
    assert.equal(first, second);

    const requiredHeadings = [
      "## 1. Resumo interno",
      "## 2. Identidade da clínica e origem",
      "## 3. Website analisado",
      "## 4. Resumo do score",
      "## 5. Screenshots (homepage)",
      "## 6. Principais problemas identificados",
      "## 7. Ângulo sugerido para outreach",
      "## 8-9. Rascunhos sugeridos de contato (não enviados)",
      "## 10. Checklist de aprovação humana",
      "## 11. Flags de risco",
      "## 12. Aviso obrigatório",
    ];
    let lastIndex = -1;
    for (const heading of requiredHeadings) {
      const idx = first.indexOf(heading);
      assert.ok(idx > lastIndex, `missing or out-of-order heading: ${heading}`);
      lastIndex = idx;
    }
  });

  it("13. JSON pack shape is stable and includes every required top-level section", async () => {
    const deps = buildDeps();
    const clinic = await seedClinic(deps, "json-stable");
    const crawlJob = await seedCrawlJob(deps, clinic.id);
    await seedScore(deps, crawlJob.id, clinic.id);

    const result = await buildHumanReviewPack({ clinicId: clinic.id }, deps);
    assert.equal(result.ok, true);
    if (!result.ok) return;

    const expectedKeys = [
      "status",
      "reviewRequired",
      "generatedAt",
      "disclaimer",
      "internalSummary",
      "clinicIdentity",
      "provenance",
      "websiteAnalyzed",
      "scoreSummary",
      "scoreDimensions",
      "screenshots",
      "keyIssues",
      "suggestedOutreachAngle",
      "suggestedWhatsappDraft",
      "suggestedEmailDraft",
      "humanApprovalChecklist",
      "riskFlags",
      "warnings",
    ];
    for (const key of expectedKeys) {
      assert.ok(key in result.pack, `missing top-level key: ${key}`);
    }
    assert.equal(result.pack.scoreDimensions.length, 5);
    assert.deepEqual(
      result.pack.scoreDimensions.map((d) => d.key),
      ["credibility", "clarity", "mobile", "actionability", "freshness"],
    );

    const roundTripped = JSON.parse(JSON.stringify(result.pack));
    assert.deepEqual(Object.keys(roundTripped).sort(), Object.keys(result.pack).sort());
  });
});

describe("buildHumanReviewPack: no external calls, no send path", () => {
  it("14. never performs a network call — the builder only reads from injected repositories", async () => {
    const deps = buildDeps();
    const clinic = await seedClinic(deps, "no-network");
    const originalFetch = globalThis.fetch;
    let fetchCalled = false;
    globalThis.fetch = (() => {
      fetchCalled = true;
      throw new Error("buildHumanReviewPack must never call fetch");
    }) as typeof fetch;
    try {
      await buildHumanReviewPack({ clinicId: clinic.id, allowIncomplete: true }, deps);
    } finally {
      globalThis.fetch = originalFetch;
    }
    assert.equal(fetchCalled, false);
  });

  it("15. no sending path exists — the builder never calls markSent/approve and never writes to the outreach repository", async () => {
    const deps = buildDeps();
    const clinic = await seedClinic(deps, "no-sending-path");
    const crawlJob = await seedCrawlJob(deps, clinic.id);
    await seedScore(deps, crawlJob.id, clinic.id);

    let markSentCalled = false;
    let approveCalled = false;
    let createDraftCalled = false;
    const originalMarkSent = deps.outreachRepo.markSent.bind(deps.outreachRepo);
    const originalApprove = deps.outreachRepo.approve.bind(deps.outreachRepo);
    const originalCreateDraft = deps.outreachRepo.createDraft.bind(deps.outreachRepo);
    deps.outreachRepo.markSent = (async (id: string) => {
      markSentCalled = true;
      return originalMarkSent(id);
    }) as typeof deps.outreachRepo.markSent;
    deps.outreachRepo.approve = (async (id: string, reviewedBy: string) => {
      approveCalled = true;
      return originalApprove(id, reviewedBy);
    }) as typeof deps.outreachRepo.approve;
    deps.outreachRepo.createDraft = (async (input: Parameters<typeof originalCreateDraft>[0]) => {
      createDraftCalled = true;
      return originalCreateDraft(input);
    }) as typeof deps.outreachRepo.createDraft;

    const result = await buildHumanReviewPack({ clinicId: clinic.id }, deps);
    assert.equal(result.ok, true);
    assert.equal(markSentCalled, false);
    assert.equal(approveCalled, false);
    assert.equal(createDraftCalled, false);
    assert.equal(deps.outreachRepo.messages.size, 0);
  });
});

describe("human review pack: production is refused", () => {
  it("11. the review-pack CLI's repository-selection gate refuses production regardless of --target", () => {
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

describe("buildHumanReviewPack: not_found handling", () => {
  it("returns not_found when the clinic does not exist", async () => {
    const deps = buildDeps();
    const result = await buildHumanReviewPack({ clinicId: "missing-clinic-id" }, deps);
    assert.equal(result.ok, false);
    if (result.ok) return;
    assert.equal(result.reason, "not_found");
  });
});
