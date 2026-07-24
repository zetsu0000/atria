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
import { selectRepositories } from "@/lib/operations/pipeline/select-repositories";
import { KNOWN_PROJECT_REFS } from "@/lib/operations/pipeline/target-guard";
import type { LeadCaptureEnv } from "@/lib/security/env";
import { SCORE_DISCLAIMER } from "@/lib/score/calculate";
import {
  buildCommercialTemplatePack,
  type BuildCommercialTemplatePackDeps,
} from "./commercial-templates/build-commercial-template-pack";
import { renderCommercialTemplatePackMarkdown } from "./commercial-templates/render-commercial-template-pack-markdown";

function buildDeps(): BuildCommercialTemplatePackDeps & {
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

async function seedClinic(deps: ReturnType<typeof buildDeps>, dedupeKey: string) {
  const clinic = await deps.clinicRepo.createClinic({
    displayName: "Clínica Teste",
    normalizedName: "clinica teste",
    websiteUrl: "https://www.clinicateste.com.br/",
    normalizedWebsiteOrigin: "https://www.clinicateste.com.br",
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

async function seedCrawlJobCompleted(deps: ReturnType<typeof buildDeps>, clinicId: string) {
  const created = await deps.crawlRepo.createCrawlJob({
    clinicId,
    requestedUrl: "https://www.clinicateste.com.br/",
    normalizedOrigin: "https://www.clinicateste.com.br",
  });
  if (!created.ok) throw new Error("setup failed");
  await deps.crawlRepo.updateCrawlJobCounters(created.value.id, { status: "completed", completedAt: new Date().toISOString() });
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
      disclaimer: SCORE_DISCLAIMER,
      scoringVersion: "v1",
      reviewStatus: "pending_review",
    },
  });
}

async function seedContact(deps: ReturnType<typeof buildDeps>, clinicId: string) {
  await deps.clinicRepo.addContact({
    clinicId,
    contactType: "whatsapp",
    value: "https://wa.me/5511900000000?phone=5511900000000",
    normalizedValue: "https://wa.me/5511900000000",
    confidence: "high",
  });
}

async function seedDecision(deps: ReturnType<typeof buildDeps>, clinicId: string, decision: "approved" | "rejected" | "needs_changes") {
  await deps.humanReviewRepo.recordDecision({ clinicId, decision, reviewer: "Atria QA" });
}

/** A fully "high tier" clinic: completed crawl, screenshot, sweet-spot score, contact. */
async function seedHighTierClinic(deps: ReturnType<typeof buildDeps>, dedupeKey: string) {
  const clinic = await seedClinic(deps, dedupeKey);
  const crawlJob = await seedCrawlJobCompleted(deps, clinic.id);
  await seedScreenshot(deps, crawlJob.id);
  await seedScore(deps, clinic.id, 70);
  await seedContact(deps, clinic.id);
  return clinic;
}

describe("buildCommercialTemplatePack: tier-driven copy", () => {
  it("1. high tier generates review-ready WhatsApp/email drafts", async () => {
    const deps = buildDeps();
    const clinic = await seedHighTierClinic(deps, "high-tier-clinic");

    const result = await buildCommercialTemplatePack({ clinicId: clinic.id }, deps);
    assert.equal(result.ok, true);
    if (!result.ok) return;
    assert.equal(result.pack.priorityTier, "high");
    assert.equal(result.pack.whatsapp.available, true);
    assert.equal(result.pack.email.available, true);
    if (result.pack.whatsapp.available) {
      assert.match(result.pack.whatsapp.body, /revisão rápida/i);
      assert.match(result.pack.whatsapp.body, /resumo/i);
      assert.ok(result.pack.whatsapp.clickToChatUrl?.startsWith("https://wa.me/"));
    }
    assert.equal(result.pack.blockedReason, null);
  });

  it("2. medium tier generates softer drafts, distinct from high tier", async () => {
    const deps = buildDeps();
    const clinic = await seedClinic(deps, "medium-tier-clinic");
    await seedCrawlJobCompleted(deps, clinic.id);
    await seedScore(deps, clinic.id, 70);
    // No contact, no screenshot — enough for "medium", not "high".

    const result = await buildCommercialTemplatePack({ clinicId: clinic.id }, deps);
    assert.equal(result.ok, true);
    if (!result.ok) return;
    assert.equal(result.pack.priorityTier, "medium");
    assert.equal(result.pack.whatsapp.available, true);
    if (result.pack.whatsapp.available) {
      assert.match(result.pack.whatsapp.body, /observação rápida/i);
      assert.doesNotMatch(result.pack.whatsapp.body, /revisão rápida/i);
    }
  });

  it("3. low tier does not recommend direct outreach by default", async () => {
    const deps = buildDeps();
    const clinic = await seedClinic(deps, "low-tier-clinic");
    // Never crawled — lands in "low" per the prioritization model.

    const result = await buildCommercialTemplatePack({ clinicId: clinic.id }, deps);
    assert.equal(result.ok, true);
    if (!result.ok) return;
    assert.equal(result.pack.priorityTier, "low");
    assert.equal(result.pack.whatsapp.available, false);
    assert.equal(result.pack.email.available, false);
    assert.equal(result.pack.blockedReason, null, "low is a recommendation, not a hard block");
    assert.ok(result.pack.warnings.some((w) => /pesquisa manual|revisita/i.test(w)));
  });

  it("4. blocked tier generates no external draft", async () => {
    const deps = buildDeps();
    const clinic = await seedClinic(deps, "blocked-tier-clinic");
    // A directory-listing-like clinic forces a heavily negative score without any hard override,
    // landing in "blocked" purely on the numeric tier.
    await deps.clinicRepo.updateNormalizedWebsiteHost(clinic.id, {
      websiteUrl: "https://www.doctoralia.com.br/some-doctor",
      normalizedWebsiteOrigin: "https://www.doctoralia.com.br",
    });

    const result = await buildCommercialTemplatePack({ clinicId: clinic.id }, deps);
    assert.equal(result.ok, true);
    if (!result.ok) return;
    assert.equal(result.pack.priorityTier, "blocked");
    assert.equal(result.pack.whatsapp.available, false);
    assert.equal(result.pack.email.available, false);
    assert.ok(result.pack.blockedReason && result.pack.blockedReason.length > 0);
  });
});

describe("buildCommercialTemplatePack: hard blockers and decision states", () => {
  it("5. do_not_contact blocks all external copy, even with otherwise-strong evidence", async () => {
    const deps = buildDeps();
    const clinic = await seedHighTierClinic(deps, "dnc-clinic");
    await deps.clinicRepo.setDoNotContact(clinic.id, true, "Pediu para não ser contatada.");

    const result = await buildCommercialTemplatePack({ clinicId: clinic.id }, deps);
    assert.equal(result.ok, true);
    if (!result.ok) return;
    assert.equal(result.pack.priorityTier, "blocked");
    assert.equal(result.pack.whatsapp.available, false);
    assert.equal(result.pack.email.available, false);
    assert.match(result.pack.blockedReason ?? "", /do_not_contact/i);
  });

  it("6. a rejected review decision blocks all external copy, even with otherwise-strong evidence", async () => {
    const deps = buildDeps();
    const clinic = await seedHighTierClinic(deps, "rejected-clinic");
    await seedDecision(deps, clinic.id, "rejected");

    const result = await buildCommercialTemplatePack({ clinicId: clinic.id }, deps);
    assert.equal(result.ok, true);
    if (!result.ok) return;
    assert.equal(result.pack.priorityTier, "blocked");
    assert.equal(result.pack.whatsapp.available, false);
    assert.equal(result.pack.email.available, false);
  });

  it("7. needs_changes requires revision before any copy, even when the numeric tier would otherwise be high", async () => {
    const deps = buildDeps();
    const clinic = await seedHighTierClinic(deps, "needs-changes-clinic");
    await seedDecision(deps, clinic.id, "needs_changes");

    const result = await buildCommercialTemplatePack({ clinicId: clinic.id }, deps);
    assert.equal(result.ok, true);
    if (!result.ok) return;
    // Tier itself may still be high/medium (needs_changes is only a -10 penalty, not a hard override)...
    assert.notEqual(result.pack.priorityTier, undefined);
    // ...but copy must still be withheld regardless.
    assert.equal(result.pack.whatsapp.available, false);
    assert.equal(result.pack.email.available, false);
    assert.match(result.pack.blockedReason ?? "", /needs_changes/i);
  });

  it("8. an approved review can produce manual-ready copy, but the pack still never sends anything", async () => {
    const deps = buildDeps();
    const clinic = await seedHighTierClinic(deps, "approved-clinic");
    await seedDecision(deps, clinic.id, "approved");

    const result = await buildCommercialTemplatePack({ clinicId: clinic.id }, deps);
    assert.equal(result.ok, true);
    if (!result.ok) return;
    assert.equal(result.pack.priorityTier, "high");
    assert.equal(result.pack.whatsapp.available, true);
    assert.equal(result.pack.email.available, true);
    assert.equal(result.pack.reviewRequired, true);
    assert.ok(result.pack.operatorChecklist.some((c) => /envio permanece manual/i.test(c)));
  });
});

describe("buildCommercialTemplatePack: safety of external copy", () => {
  it("9. disclaimer is always included, verbatim, regardless of tier", async () => {
    const deps = buildDeps();
    const highClinic = await seedHighTierClinic(deps, "disclaimer-high-clinic");
    const lowClinic = await seedClinic(deps, "disclaimer-low-clinic");

    const highResult = await buildCommercialTemplatePack({ clinicId: highClinic.id }, deps);
    const lowResult = await buildCommercialTemplatePack({ clinicId: lowClinic.id }, deps);
    assert.equal(highResult.ok, true);
    assert.equal(lowResult.ok, true);
    if (!highResult.ok || !lowResult.ok) return;
    assert.equal(highResult.pack.disclaimer, SCORE_DISCLAIMER);
    assert.equal(lowResult.pack.disclaimer, SCORE_DISCLAIMER);
    if (highResult.pack.whatsapp.available) {
      assert.match(highResult.pack.whatsapp.body, /não avalia qualidade médica/i);
    }
  });

  it("10. no medical quality evaluation language appears in any generated copy", async () => {
    const deps = buildDeps();
    const highClinic = await seedHighTierClinic(deps, "medical-language-high-clinic");
    const mediumClinic = await seedClinic(deps, "medical-language-medium-clinic");
    await seedCrawlJobCompleted(deps, mediumClinic.id);
    await seedScore(deps, mediumClinic.id, 70);

    for (const clinicId of [highClinic.id, mediumClinic.id]) {
      const result = await buildCommercialTemplatePack({ clinicId }, deps);
      assert.equal(result.ok, true);
      if (!result.ok) continue;
      for (const section of [result.pack.whatsapp, result.pack.email]) {
        if (!section.available) continue;
        const lower = section.body.toLowerCase();
        for (const forbidden of ["qualidade médica boa", "qualidade médica ruim", "diagnosticamos", "avaliamos sua saúde"]) {
          assert.doesNotMatch(lower, new RegExp(forbidden));
        }
      }
    }
  });

  it("11. no invented testimonials/clients/awards/credentials appear in any generated copy", async () => {
    const deps = buildDeps();
    const clinic = await seedHighTierClinic(deps, "no-invented-claims-clinic");
    const result = await buildCommercialTemplatePack({ clinicId: clinic.id }, deps);
    assert.equal(result.ok, true);
    if (!result.ok) return;
    for (const section of [result.pack.whatsapp, result.pack.email]) {
      if (!section.available) continue;
      const lower = section.body.toLowerCase();
      for (const forbidden of ["prêmio", "depoimento", "clientes satisfeitos", "melhor clínica", "crm", "rqe"]) {
        assert.doesNotMatch(lower, new RegExp(forbidden));
      }
    }
  });

  it("12. no private/internal score number ever leaks into external copy", async () => {
    const deps = buildDeps();
    const clinic = await seedHighTierClinic(deps, "no-score-leak-clinic");
    const result = await buildCommercialTemplatePack({ clinicId: clinic.id }, deps);
    assert.equal(result.ok, true);
    if (!result.ok) return;
    for (const section of [result.pack.whatsapp, result.pack.email]) {
      if (!section.available) continue;
      assert.doesNotMatch(section.body, /\/100/);
      assert.doesNotMatch(section.body, /score/i);
    }
    // The score number IS allowed in the internal-only reasonSummary.
    assert.match(result.pack.reasonSummary, /score/i);
  });
});

describe("buildCommercialTemplatePack: production is refused", () => {
  it("13. the shared repository-selection gate refuses production regardless of --target", () => {
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

describe("buildCommercialTemplatePack: stable shapes", () => {
  it("14. Markdown rendering is deterministic for the same pack object", async () => {
    const deps = buildDeps();
    const clinic = await seedHighTierClinic(deps, "deterministic-markdown-clinic");
    const result = await buildCommercialTemplatePack({ clinicId: clinic.id }, deps);
    assert.equal(result.ok, true);
    if (!result.ok) return;
    const a = renderCommercialTemplatePackMarkdown(result.pack);
    const b = renderCommercialTemplatePackMarkdown(result.pack);
    assert.equal(a, b);
    assert.match(a, /Templates comerciais por prioridade/);
  });

  it("15. JSON shape is stable and round-trips through JSON.stringify/parse", async () => {
    const deps = buildDeps();
    const clinic = await seedHighTierClinic(deps, "json-shape-clinic");
    const result = await buildCommercialTemplatePack({ clinicId: clinic.id }, deps);
    assert.equal(result.ok, true);
    if (!result.ok) return;
    const roundTripped = JSON.parse(JSON.stringify(result.pack));
    assert.deepEqual(Object.keys(roundTripped).sort(), Object.keys(result.pack).sort());
    assert.deepEqual(
      Object.keys(result.pack).sort(),
      [
        "blockedReason",
        "disclaimer",
        "displayName",
        "email",
        "generatedAt",
        "id",
        "kind",
        "operatorChecklist",
        "priorityTier",
        "reasonSummary",
        "recommendedNextAction",
        "recommendedNextActionLabel",
        "reviewRequired",
        "riskFlags",
        "warnings",
        "whatsapp",
      ].sort(),
    );
  });
});

describe("buildCommercialTemplatePack: no external calls, no send path", () => {
  it("16. the builder source file never references a network/external-API primitive", () => {
    const source = readFileSync(new URL("./commercial-templates/build-commercial-template-pack.ts", import.meta.url), "utf8");
    for (const forbidden of ["fetch(", "undici", "playwright", "googleapis", "places.googleapis"]) {
      assert.doesNotMatch(source, new RegExp(forbidden.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
    }
  });

  it("17. no send-capable repository method exists anywhere in this builder's dependency surface (it never even accepts an outreachRepo)", async () => {
    const deps = buildDeps();
    const clinic = await seedHighTierClinic(deps, "no-sending-path-clinic");

    const clinicsBefore = deps.clinicRepo.clinics.size;
    const scoresBefore = deps.scoreRepo.records.length;
    const decisionsBefore = deps.humanReviewRepo.decisions.length;
    const logsBefore = deps.manualOutreachLogRepo.logs.length;

    await buildCommercialTemplatePack({ clinicId: clinic.id }, deps);

    assert.equal(deps.clinicRepo.clinics.size, clinicsBefore);
    assert.equal(deps.scoreRepo.records.length, scoresBefore);
    assert.equal(deps.humanReviewRepo.decisions.length, decisionsBefore);
    assert.equal(deps.manualOutreachLogRepo.logs.length, logsBefore);
  });
});

describe("buildCommercialTemplatePack: score-calibration alignment (docs/technical/crawler-score-prioritization-alignment.md)", () => {
  it("a directory listing never receives copy, via the explicit isDirectoryListing check, even with strong other signals", async () => {
    const deps = buildDeps();
    const clinic = await seedHighTierClinic(deps, "alignment-directory-clinic");
    await deps.clinicRepo.updateNormalizedWebsiteHost(clinic.id, {
      websiteUrl: "https://www.doctoralia.com.br/some-doctor",
      normalizedWebsiteOrigin: "https://www.doctoralia.com.br",
    });

    const result = await buildCommercialTemplatePack({ clinicId: clinic.id }, deps);
    assert.equal(result.ok, true);
    if (!result.ok) return;
    assert.equal(result.pack.whatsapp.available, false);
    assert.equal(result.pack.email.available, false);
    assert.match(result.pack.blockedReason ?? "", /diret[oó]rio/i);
  });

  it("7. robots_denied does not receive review-ready copy, even with contact + approved decision + salvageable screenshot", async () => {
    const deps = buildDeps();
    const clinic = await seedClinic(deps, "alignment-robots-denied-clinic");
    const crawlJob = await seedCrawlJobCompleted(deps, clinic.id);
    await deps.crawlRepo.updateCrawlJobCounters(crawlJob.id, { status: "failed", errorCode: "robots_denied" as never, completedAt: new Date().toISOString() });
    await seedScreenshot(deps, crawlJob.id);
    await seedScore(deps, clinic.id, 0);
    await seedContact(deps, clinic.id);
    await seedDecision(deps, clinic.id, "approved");

    const result = await buildCommercialTemplatePack({ clinicId: clinic.id }, deps);
    assert.equal(result.ok, true);
    if (!result.ok) return;
    assert.notEqual(result.pack.priorityTier, "high");
    assert.notEqual(result.pack.priorityTier, "medium");
    assert.equal(result.pack.whatsapp.available, false);
    assert.equal(result.pack.email.available, false);
  });
});

describe("buildCommercialTemplatePack: ICP classification (docs/technical/crawler-icp-classification.md)", () => {
  async function seedHighTierClinicNamed(
    deps: ReturnType<typeof buildDeps>,
    dedupeKey: string,
    displayName: string,
    websiteUrl: string,
    normalizedWebsiteOrigin: string,
  ) {
    const clinic = await deps.clinicRepo.createClinic({
      displayName,
      normalizedName: displayName.toLowerCase(),
      websiteUrl,
      normalizedWebsiteOrigin,
      city: "São Paulo",
      state: "SP",
      specialty: "skin_care_clinic",
      status: "prospect",
      sourceType: "google_places",
      sourceAttribution: {},
      dedupeKey,
    });
    if (!clinic.ok) throw new Error("setup failed");
    const crawlJob = await seedCrawlJobCompleted(deps, clinic.value.id);
    await seedScreenshot(deps, crawlJob.id);
    await seedScore(deps, clinic.value.id, 70);
    await seedContact(deps, clinic.value.id);
    return clinic.value;
  }

  it("13. commercial templates are withheld for a hospital, even with maximal (high-tier-shaped) evidence", async () => {
    const deps = buildDeps();
    const clinic = await seedHighTierClinicNamed(
      deps,
      "icp-hospital-template",
      "Hospital Santa Vida",
      "https://hospitalsantavida.example.com.br/",
      "https://hospitalsantavida.example.com.br",
    );

    const result = await buildCommercialTemplatePack({ clinicId: clinic.id }, deps);
    assert.equal(result.ok, true);
    if (!result.ok) return;
    assert.equal(result.pack.whatsapp.available, false);
    assert.equal(result.pack.email.available, false);
    assert.match(result.pack.warnings.join(" "), /enterprise futura|rede\/hospital/i);
  });

  it("commercial templates are withheld for a franchise unit, even with maximal (high-tier-shaped) evidence", async () => {
    const deps = buildDeps();
    const clinic = await seedHighTierClinicNamed(
      deps,
      "icp-franchise-template",
      "Rede Dermato Brasil - Franquia Curitiba",
      "https://redeDermatoBrasilFranquia.example.com.br/",
      "https://redeDermatoBrasilFranquia.example.com.br",
    );

    const result = await buildCommercialTemplatePack({ clinicId: clinic.id }, deps);
    assert.equal(result.ok, true);
    if (!result.ok) return;
    assert.equal(result.pack.whatsapp.available, false);
    assert.equal(result.pack.email.available, false);
  });

  it("commercial templates are hard-blocked for a wrong-audience business (blocked ICP)", async () => {
    const deps = buildDeps();
    const clinic = await seedHighTierClinicNamed(
      deps,
      "icp-wrong-audience-template",
      "Farmácia Popular Bem Estar",
      "https://farmaciapopularbemestar.example.com.br/",
      "https://farmaciapopularbemestar.example.com.br",
    );

    const result = await buildCommercialTemplatePack({ clinicId: clinic.id }, deps);
    assert.equal(result.ok, true);
    if (!result.ok) return;
    assert.equal(result.pack.priorityTier, "blocked");
    assert.equal(result.pack.whatsapp.available, false);
    assert.equal(result.pack.email.available, false);
    assert.ok(result.pack.blockedReason);
  });

  it("14. existing rejected/do_not_contact/needs_changes behavior is unchanged for an otherwise-core-ICP clinic", async () => {
    const deps = buildDeps();
    const clinic = await seedHighTierClinic(deps, "icp-unchanged-rejected");
    await seedDecision(deps, clinic.id, "rejected");
    const rejectedResult = await buildCommercialTemplatePack({ clinicId: clinic.id }, deps);
    assert.equal(rejectedResult.ok, true);
    if (rejectedResult.ok) {
      assert.equal(rejectedResult.pack.whatsapp.available, false);
      assert.equal(rejectedResult.pack.email.available, false);
    }

    const clinic2 = await seedHighTierClinic(deps, "icp-unchanged-do-not-contact");
    await deps.clinicRepo.setDoNotContact(clinic2.id, true, "Pedido do cliente.");
    const dncResult = await buildCommercialTemplatePack({ clinicId: clinic2.id }, deps);
    assert.equal(dncResult.ok, true);
    if (dncResult.ok) {
      assert.equal(dncResult.pack.whatsapp.available, false);
      assert.equal(dncResult.pack.email.available, false);
    }

    const clinic3 = await seedHighTierClinic(deps, "icp-unchanged-needs-changes");
    await seedDecision(deps, clinic3.id, "needs_changes");
    const needsChangesResult = await buildCommercialTemplatePack({ clinicId: clinic3.id }, deps);
    assert.equal(needsChangesResult.ok, true);
    if (needsChangesResult.ok) {
      assert.equal(needsChangesResult.pack.whatsapp.available, false);
      assert.equal(needsChangesResult.pack.email.available, false);
      assert.match(needsChangesResult.pack.blockedReason ?? "", /needs_changes/i);
    }
  });

  it("20. no medical-quality language or secret-shaped value appears anywhere in an ICP-withheld pack", async () => {
    const deps = buildDeps();
    const clinic = await seedHighTierClinicNamed(
      deps,
      "icp-no-medical-no-secrets",
      "Hospital Sem Alegações",
      "https://hospitalsemalegacoes.example.com.br/",
      "https://hospitalsemalegacoes.example.com.br",
    );

    const result = await buildCommercialTemplatePack({ clinicId: clinic.id }, deps);
    assert.equal(result.ok, true);
    if (!result.ok) return;
    const serialized = JSON.stringify(result.pack).toLowerCase();
    assert.doesNotMatch(serialized, /qualidade m[eé]dica.{0,20}(boa|ruim|excelente|aprovad)|diagn[oó]stico|tratamento cl[ií]nico/);
    assert.doesNotMatch(serialized, /service_role|supabase_|google_places_api_key|postgresql:\/\/|aiza|eyj/);
    assert.equal(result.pack.disclaimer, SCORE_DISCLAIMER);
  });
});

describe("buildCommercialTemplatePack: social-profile website classification (docs/technical/crawler-social-profile-website-classification.md)", () => {
  async function seedHighTierClinicNamed(
    deps: ReturnType<typeof buildDeps>,
    dedupeKey: string,
    displayName: string,
    websiteUrl: string,
    normalizedWebsiteOrigin: string,
  ) {
    const clinic = await deps.clinicRepo.createClinic({
      displayName,
      normalizedName: displayName.toLowerCase(),
      websiteUrl,
      normalizedWebsiteOrigin,
      city: "São Paulo",
      state: "SP",
      specialty: "skin_care_clinic",
      status: "prospect",
      sourceType: "google_places",
      sourceAttribution: {},
      dedupeKey,
    });
    if (!clinic.ok) throw new Error("setup failed");
    const crawlJob = await seedCrawlJobCompleted(deps, clinic.value.id);
    await seedScreenshot(deps, crawlJob.id);
    await seedScore(deps, clinic.value.id, 70);
    await seedContact(deps, clinic.value.id);
    return clinic.value;
  }

  it("11. commercial templates are withheld for an Instagram-only 'website', even with maximal (high-tier-shaped) evidence", async () => {
    const deps = buildDeps();
    const clinic = await seedHighTierClinicNamed(
      deps,
      "social-instagram-template",
      "Clínica Dermatológica e Nutrição Lumina Pelle",
      "https://www.instagram.com/luminapelle/",
      "https://www.instagram.com",
    );

    const result = await buildCommercialTemplatePack({ clinicId: clinic.id }, deps);
    assert.equal(result.ok, true);
    if (!result.ok) return;
    assert.equal(result.pack.whatsapp.available, false);
    assert.equal(result.pack.email.available, false);
    assert.match(result.pack.blockedReason ?? "", /perfil de rede social/i);
  });

  it("an explicitly approved review decision overrides the social-profile-website withhold, per the task's own escape hatch", async () => {
    const deps = buildDeps();
    const clinic = await seedHighTierClinicNamed(
      deps,
      "social-instagram-approved-override",
      "Clínica Dermatológica e Nutrição Lumina Pelle",
      "https://www.instagram.com/luminapelle/",
      "https://www.instagram.com",
    );
    await seedDecision(deps, clinic.id, "approved");

    const result = await buildCommercialTemplatePack({ clinicId: clinic.id }, deps);
    assert.equal(result.ok, true);
    if (!result.ok) return;
    assert.equal(result.pack.whatsapp.available, true);
    assert.equal(result.pack.email.available, true);
  });

  it("a real own domain never triggers the social-profile withhold", async () => {
    const deps = buildDeps();
    const clinic = await seedHighTierClinicNamed(
      deps,
      "social-real-domain-template",
      "Clínica Dra. Natália Segatti",
      "https://nataliasegatti.example.com.br/",
      "https://nataliasegatti.example.com.br",
    );

    const result = await buildCommercialTemplatePack({ clinicId: clinic.id }, deps);
    assert.equal(result.ok, true);
    if (!result.ok) return;
    assert.equal(result.pack.whatsapp.available, true);
    assert.equal(result.pack.email.available, true);
  });
});

describe("buildCommercialTemplatePack: candidates and validation", () => {
  it("a not-yet-promoted candidate never produces copy, regardless of tier", async () => {
    const deps = buildDeps();
    const candidateResult = await deps.discoveryRepo.recordCandidate({
      sourceType: "google_places",
      rawName: "Clínica Candidata",
      normalizedName: "clinica candidata",
      websiteUrl: "https://www.clinicacandidata.com.br/",
      normalizedWebsiteOrigin: "https://www.clinicacandidata.com.br",
      phone: null,
      email: null,
      city: null,
      state: "SP",
      specialty: null,
      sourceAttribution: {},
      dedupeKey: "candidate-copy-test",
    });
    assert.equal(candidateResult.ok, true);
    if (!candidateResult.ok) return;

    const result = await buildCommercialTemplatePack({ candidateId: candidateResult.value.id }, deps);
    assert.equal(result.ok, true);
    if (!result.ok) return;
    assert.equal(result.pack.kind, "candidate");
    assert.equal(result.pack.whatsapp.available, false);
    assert.equal(result.pack.email.available, false);
  });

  it("requires exactly one of clinicId/candidateId", async () => {
    const deps = buildDeps();
    const neither = await buildCommercialTemplatePack({}, deps);
    assert.equal(neither.ok, false);
    if (!neither.ok) assert.equal(neither.reason, "validation");

    const clinic = await seedClinic(deps, "both-ids-clinic");
    const both = await buildCommercialTemplatePack({ clinicId: clinic.id, candidateId: "x" }, deps);
    assert.equal(both.ok, false);
    if (!both.ok) assert.equal(both.reason, "validation");
  });
});
