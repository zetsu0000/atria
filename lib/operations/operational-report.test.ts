import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  FakeClinicRepository,
  FakeCrawlRepository,
  FakeExtractionRepository,
  FakeOutreachRepository,
  FakeScoreRepository,
} from "./repositories/fakes";
import { buildOperationalReport, type BuildOperationalReportDeps } from "./report/build-operational-report";
import { renderOperationalReportMarkdown } from "./report/render-operational-report-markdown";
import { calculatePlaceholderScore, SCORE_DISCLAIMER } from "@/lib/score/calculate";
import { buildOutreachDraft } from "@/lib/outreach/draft";
import type { ExtractionCandidate } from "@/lib/crawler/extraction-types";
import { selectRepositories } from "./pipeline/select-repositories";
import { KNOWN_PROJECT_REFS } from "./pipeline/target-guard";
import type { LeadCaptureEnv } from "@/lib/security/env";

function buildDeps(): BuildOperationalReportDeps & {
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

async function seedClinic(deps: ReturnType<typeof buildDeps>, dedupeKey = "report-clinic") {
  const clinic = await deps.clinicRepo.createClinic({
    displayName: "Clínica Relatório",
    normalizedName: "clinica relatorio",
    websiteUrl: "https://example.com/",
    normalizedWebsiteOrigin: "https://example.com",
    city: "São Paulo",
    state: "SP",
    specialty: "Dermatologia",
    status: "prospect",
    sourceType: "manual",
    sourceAttribution: { runId: "test-run" },
    dedupeKey,
  });
  if (!clinic.ok) throw new Error("setup failed");
  return clinic.value;
}

async function seedCrawlJob(deps: ReturnType<typeof buildDeps>, clinicId: string) {
  const created = await deps.crawlRepo.createCrawlJob({
    clinicId,
    requestedUrl: "https://example.com/",
    normalizedOrigin: "https://example.com",
    maxPages: 2,
  });
  if (!created.ok) throw new Error("setup failed");
  await deps.crawlRepo.claimCrawlJob(created.value.id);
  const completed = await deps.crawlRepo.updateCrawlJobCounters(created.value.id, {
    status: "completed",
    pagesFetched: 2,
    pagesDiscovered: 2,
    pagesFailed: 0,
    completedAt: new Date().toISOString(),
  });
  if (!completed.ok) throw new Error("setup failed");
  return completed.value;
}

const SAMPLE_CANDIDATES: ExtractionCandidate[] = [
  {
    kind: "title",
    value: "Clínica Relatório",
    sourceUrl: "https://example.com/",
    sourcePage: "https://example.com/",
    extractionMethod: "meta",
    confidence: "high",
    reviewStatus: "pending_review",
  },
  {
    kind: "phone",
    value: "(11) 90000-0000",
    sourceUrl: "https://example.com/contato",
    sourcePage: "https://example.com/contato",
    extractionMethod: "html_text",
    confidence: "medium",
    reviewStatus: "pending_review",
  },
  {
    kind: "email",
    value: "contato@example.com",
    sourceUrl: "https://example.com/contato",
    sourcePage: "https://example.com/contato",
    extractionMethod: "html_anchor",
    confidence: "high",
    reviewStatus: "pending_review",
  },
];

describe("buildOperationalReport: complete report", () => {
  it("combines clinic, crawl, score, screenshots, extraction and outreach draft into one report", async () => {
    const deps = buildDeps();
    const clinic = await seedClinic(deps);
    const crawlJob = await seedCrawlJob(deps, clinic.id);

    await deps.crawlRepo.saveAsset({
      crawlJobId: crawlJob.id,
      assetType: "screenshot_desktop",
      storagePath: "private/scan-assets/x/desktop.png",
      contentType: "image/png",
      widthPx: 1440,
      heightPx: 1200,
      pageUrl: "https://example.com/",
      reviewStatus: "pending_review",
      metadata: { captureStatus: "captured", capturedAt: "2026-07-21T10:00:00.000Z" },
    });
    await deps.crawlRepo.saveAsset({
      crawlJobId: crawlJob.id,
      assetType: "screenshot_mobile",
      storagePath: "private/scan-assets/x/mobile.png",
      contentType: "image/png",
      widthPx: 390,
      heightPx: 844,
      pageUrl: "https://example.com/",
      reviewStatus: "pending_review",
      metadata: { captureStatus: "captured", capturedAt: "2026-07-21T10:00:00.000Z" },
    });

    await deps.extractionRepo.saveExtractedContent({
      crawlJobId: crawlJob.id,
      clinicId: clinic.id,
      schemaVersion: "extraction-candidates-v1",
      candidates: SAMPLE_CANDIDATES,
    });

    const score = calculatePlaceholderScore({ candidates: SAMPLE_CANDIDATES, pageCount: 2 });
    await deps.scoreRepo.saveScore({ crawlJobId: crawlJob.id, clinicId: clinic.id, score });

    const built = buildOutreachDraft({
      clinicDisplayName: clinic.displayName,
      channel: "email",
      observations: [{ observation: "Site sem página de contato clara.", sourceUrl: "https://example.com/" }],
      doNotContact: clinic.doNotContact,
    });
    if (!built.ok) return assert.fail();
    await deps.outreachRepo.createDraft({ clinicId: clinic.id, draft: built.draft, doNotContact: clinic.doNotContact });

    const result = await buildOperationalReport({ clinicId: clinic.id }, deps);
    assert.equal(result.ok, true);
    if (!result.ok) return;

    assert.equal(result.report.status, "draft");
    assert.equal(result.report.reviewRequired, true);
    assert.equal(result.report.clinicIdentity.displayName, "Clínica Relatório");
    assert.equal(result.report.websiteAnalyzed.crawlJobId, crawlJob.id);
    assert.equal(result.report.scoreSummary.available, true);
    // 11. score v1 flows through to the report automatically — no report-layer code change needed.
    assert.equal(result.report.scoreSummary.scoringVersion, "v1");
    assert.equal(result.report.screenshots.desktop.status, "captured");
    assert.equal(result.report.screenshots.mobile.status, "captured");
    assert.equal(result.report.extractedContentSummary.available, true);
    assert.ok(result.report.extractedContentSummary.contacts.some((c) => c.kind === "email"));
    assert.equal(result.report.outreachDraft.available, true);
    assert.equal(result.report.outreachDraft.status, "draft");
  });
});

describe("buildOperationalReport: missing data handling", () => {
  it("still produces a report with pending/missing screenshot status when screenshots are absent", async () => {
    const deps = buildDeps();
    const clinic = await seedClinic(deps, "missing-screenshots");
    const crawlJob = await seedCrawlJob(deps, clinic.id);
    const score = calculatePlaceholderScore({ candidates: [], pageCount: 1 });
    await deps.scoreRepo.saveScore({ crawlJobId: crawlJob.id, clinicId: clinic.id, score });

    const result = await buildOperationalReport({ clinicId: clinic.id }, deps);
    assert.equal(result.ok, true);
    if (!result.ok) return;
    assert.equal(result.report.status, "draft");
    assert.equal(result.report.screenshots.desktop.status, "missing");
    assert.equal(result.report.screenshots.mobile.status, "missing");
    assert.ok(result.report.warnings.some((w) => /Desktop homepage screenshot/.test(w)));
    assert.ok(result.report.warnings.some((w) => /Mobile homepage screenshot/.test(w)));
  });

  it("fails by default when score is missing", async () => {
    const deps = buildDeps();
    const clinic = await seedClinic(deps, "missing-score");
    await seedCrawlJob(deps, clinic.id);

    const result = await buildOperationalReport({ clinicId: clinic.id }, deps);
    assert.equal(result.ok, false);
    if (result.ok) return;
    assert.equal(result.reason, "missing_score");
  });

  it("--allow-incomplete generates an incomplete_report instead of failing", async () => {
    const deps = buildDeps();
    const clinic = await seedClinic(deps, "allow-incomplete");
    await seedCrawlJob(deps, clinic.id);

    const result = await buildOperationalReport({ clinicId: clinic.id, allowIncomplete: true }, deps);
    assert.equal(result.ok, true);
    if (!result.ok) return;
    assert.equal(result.report.status, "incomplete_report");
    assert.equal(result.report.scoreSummary.available, false);
    assert.ok(result.report.warnings.some((w) => /Score is missing/.test(w)));
  });

  it("still produces a report when no crawl job exists at all, given allowIncomplete", async () => {
    const deps = buildDeps();
    const clinic = await seedClinic(deps, "no-crawl-job");

    const result = await buildOperationalReport({ clinicId: clinic.id, allowIncomplete: true }, deps);
    assert.equal(result.ok, true);
    if (!result.ok) return;
    assert.equal(result.report.websiteAnalyzed.crawlJobId, null);
    assert.ok(result.report.warnings.some((w) => /No crawl job found/.test(w)));
  });
});

describe("buildOperationalReport: safety invariants", () => {
  it("always includes the exact required disclaimer, complete or incomplete", async () => {
    const deps = buildDeps();
    const clinic = await seedClinic(deps, "disclaimer-check");
    const result = await buildOperationalReport({ clinicId: clinic.id, allowIncomplete: true }, deps);
    assert.equal(result.ok, true);
    if (!result.ok) return;
    assert.equal(
      result.report.disclaimer,
      "Esta análise avalia apenas a apresentação digital e a facilidade de encontrar informações. Não avalia qualidade médica.",
    );
    assert.equal(result.report.disclaimer, SCORE_DISCLAIMER);
  });

  it("never evaluates medical quality — no medical-quality field or claim appears anywhere in the report", async () => {
    const deps = buildDeps();
    const clinic = await seedClinic(deps, "no-medical-quality");
    const crawlJob = await seedCrawlJob(deps, clinic.id);
    const score = calculatePlaceholderScore({ candidates: SAMPLE_CANDIDATES, pageCount: 2 });
    await deps.scoreRepo.saveScore({ crawlJobId: crawlJob.id, clinicId: clinic.id, score });

    const result = await buildOperationalReport({ clinicId: clinic.id }, deps);
    assert.equal(result.ok, true);
    if (!result.ok) return;
    const serialized = JSON.stringify(result.report).toLowerCase();
    assert.doesNotMatch(serialized, /qualidade m[eé]dica.{0,20}(boa|ruim|excelente|aprovad)/);
    assert.ok(!("medicalQuality" in result.report));
  });

  it("never invents claims, testimonials, awards, credentials, or outcomes not present in the extracted evidence", async () => {
    const deps = buildDeps();
    const clinic = await seedClinic(deps, "no-invented-claims");
    const crawlJob = await seedCrawlJob(deps, clinic.id);
    const score = calculatePlaceholderScore({ candidates: SAMPLE_CANDIDATES, pageCount: 2 });
    await deps.scoreRepo.saveScore({ crawlJobId: crawlJob.id, clinicId: clinic.id, score });
    await deps.extractionRepo.saveExtractedContent({
      crawlJobId: crawlJob.id,
      clinicId: clinic.id,
      schemaVersion: "extraction-candidates-v1",
      candidates: SAMPLE_CANDIDATES,
    });

    const result = await buildOperationalReport({ clinicId: clinic.id }, deps);
    assert.equal(result.ok, true);
    if (!result.ok) return;
    // Exclude humanReviewChecklist: it deliberately *names* these terms to
    // warn the reviewer against adding them — that's not the same as the
    // report itself attributing them to the clinic. Every other section is
    // data derived from the clinic/crawl/score/extraction, so it must never
    // contain these terms.
    const dataOnly = Object.fromEntries(
      Object.entries(result.report).filter(([key]) => key !== "humanReviewChecklist"),
    );
    const serialized = JSON.stringify(dataOnly).toLowerCase();
    for (const forbidden of ["depoimento", "prêmio", "premio", "cliente satisfeito", "crm ", "rqe ", "garantia de cura", "melhor clínica"]) {
      assert.doesNotMatch(serialized, new RegExp(forbidden), `unexpected invented claim: ${forbidden}`);
    }
  });

  it("outreach section stays draft/review_required — the report never marks anything sent", async () => {
    const deps = buildDeps();
    const clinic = await seedClinic(deps, "outreach-stays-draft");
    const crawlJob = await seedCrawlJob(deps, clinic.id);
    const score = calculatePlaceholderScore({ candidates: SAMPLE_CANDIDATES, pageCount: 2 });
    await deps.scoreRepo.saveScore({ crawlJobId: crawlJob.id, clinicId: clinic.id, score });
    const built = buildOutreachDraft({
      clinicDisplayName: clinic.displayName,
      channel: "email",
      observations: [{ observation: "Sem WhatsApp visível." }],
    });
    if (!built.ok) return assert.fail();
    await deps.outreachRepo.createDraft({ clinicId: clinic.id, draft: built.draft, doNotContact: false });

    const result = await buildOperationalReport({ clinicId: clinic.id }, deps);
    assert.equal(result.ok, true);
    if (!result.ok) return;
    assert.equal(result.report.reviewRequired, true);
    assert.notEqual(result.report.status, "sent");
    assert.equal(result.report.outreachDraft.status, "draft");
    // The underlying message itself was never sent either.
    const messages = [...deps.outreachRepo.messages.values()];
    assert.ok(messages.every((m) => m.status === "draft"));
  });

  it("never performs a network call — the builder only reads from injected repositories", async () => {
    const deps = buildDeps();
    const clinic = await seedClinic(deps, "no-network");
    const originalFetch = globalThis.fetch;
    let fetchCalled = false;
    globalThis.fetch = (() => {
      fetchCalled = true;
      throw new Error("buildOperationalReport must never call fetch");
    }) as typeof fetch;
    try {
      await buildOperationalReport({ clinicId: clinic.id, allowIncomplete: true }, deps);
    } finally {
      globalThis.fetch = originalFetch;
    }
    assert.equal(fetchCalled, false);
  });
});

describe("report rendering: stable output shapes", () => {
  it("Markdown rendering is deterministic for the same report object", async () => {
    const deps = buildDeps();
    const clinic = await seedClinic(deps, "markdown-stable");
    const crawlJob = await seedCrawlJob(deps, clinic.id);
    const score = calculatePlaceholderScore({ candidates: SAMPLE_CANDIDATES, pageCount: 2 });
    await deps.scoreRepo.saveScore({ crawlJobId: crawlJob.id, clinicId: clinic.id, score });

    const result = await buildOperationalReport({ clinicId: clinic.id }, deps);
    assert.equal(result.ok, true);
    if (!result.ok) return;

    const first = renderOperationalReportMarkdown(result.report);
    const second = renderOperationalReportMarkdown(result.report);
    assert.equal(first, second);

    // All 13 required sections are present, in order.
    const requiredHeadings = [
      "## 1. Identidade da clínica",
      "## 2. Origem/proveniência",
      "## 3. Website analisado",
      "## 4. Resumo do score",
      "## 5. Dimensões do score",
      "## 6. Evidências por dimensão",
      "## 7. Screenshots (homepage)",
      "## 8. Resumo de conteúdo/contatos extraídos",
      "## 9. Principais problemas de apresentação digital",
      "## 10. Ângulo de melhoria sugerido",
      "## 11. Rascunho de outreach",
      "## 12. Checklist de revisão humana",
      "## 13. Aviso obrigatório",
    ];
    let lastIndex = -1;
    for (const heading of requiredHeadings) {
      const idx = first.indexOf(heading);
      assert.ok(idx > lastIndex, `missing or out-of-order heading: ${heading}`);
      lastIndex = idx;
    }
    assert.match(
      first,
      /Esta análise avalia apenas a apresentação digital e a facilidade de encontrar informações\. Não avalia qualidade médica\./,
    );
  });

  it("11. renders score v1 — the report's scoring-version line reflects the new model without any report-code change", async () => {
    const deps = buildDeps();
    const clinic = await seedClinic(deps, "renders-score-v1");
    const crawlJob = await seedCrawlJob(deps, clinic.id);
    const score = calculatePlaceholderScore({ candidates: SAMPLE_CANDIDATES, pageCount: 2 });
    await deps.scoreRepo.saveScore({ crawlJobId: crawlJob.id, clinicId: clinic.id, score });

    const result = await buildOperationalReport({ clinicId: clinic.id }, deps);
    assert.equal(result.ok, true);
    if (!result.ok) return;
    assert.equal(result.report.scoreSummary.scoringVersion, "v1");

    const markdown = renderOperationalReportMarkdown(result.report);
    assert.match(markdown, /Versão de scoring:\*\* v1/);
  });

  it("JSON report shape is stable and includes every required top-level section", async () => {
    const deps = buildDeps();
    const clinic = await seedClinic(deps, "json-stable");
    const crawlJob = await seedCrawlJob(deps, clinic.id);
    const score = calculatePlaceholderScore({ candidates: SAMPLE_CANDIDATES, pageCount: 2 });
    await deps.scoreRepo.saveScore({ crawlJobId: crawlJob.id, clinicId: clinic.id, score });

    const result = await buildOperationalReport({ clinicId: clinic.id }, deps);
    assert.equal(result.ok, true);
    if (!result.ok) return;

    const expectedKeys = [
      "status",
      "reviewRequired",
      "generatedAt",
      "disclaimer",
      "clinicIdentity",
      "provenance",
      "websiteAnalyzed",
      "scoreSummary",
      "scoreDimensions",
      "evidenceByDimension",
      "screenshots",
      "extractedContentSummary",
      "mainIssues",
      "suggestedImprovementAngle",
      "outreachDraft",
      "humanReviewChecklist",
      "warnings",
    ];
    for (const key of expectedKeys) {
      assert.ok(key in result.report, `missing top-level key: ${key}`);
    }
    assert.equal(result.report.scoreDimensions.length, 5);
    assert.deepEqual(
      result.report.scoreDimensions.map((d) => d.key),
      ["credibility", "clarity", "mobile", "actionability", "freshness"],
    );

    // Round-trips through JSON.stringify/parse without losing shape.
    const roundTripped = JSON.parse(JSON.stringify(result.report));
    assert.deepEqual(Object.keys(roundTripped).sort(), Object.keys(result.report).sort());
  });
});

describe("buildOperationalReport: not_found handling", () => {
  it("returns not_found when the clinic does not exist", async () => {
    const deps = buildDeps();
    const result = await buildOperationalReport({ clinicId: "missing-clinic-id" }, deps);
    assert.equal(result.ok, false);
    if (result.ok) return;
    assert.equal(result.reason, "not_found");
  });
});

describe("report generation: production is refused", () => {
  it("the report CLI's repository-selection gate refuses production regardless of --target", () => {
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
