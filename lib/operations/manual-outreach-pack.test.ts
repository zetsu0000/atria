import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  FakeClinicRepository,
  FakeCrawlRepository,
  FakeExtractionRepository,
  FakeHumanReviewRepository,
  FakeOutreachRepository,
  FakeScoreRepository,
} from "@/lib/operations/repositories/fakes";
import { buildOutreachDraft } from "@/lib/outreach/draft";
import { SCORE_DISCLAIMER } from "@/lib/score/calculate";
import { selectRepositories } from "@/lib/operations/pipeline/select-repositories";
import { KNOWN_PROJECT_REFS } from "@/lib/operations/pipeline/target-guard";
import type { LeadCaptureEnv } from "@/lib/security/env";
import {
  buildManualOutreachPack,
  type BuildManualOutreachPackDeps,
} from "./manual-outreach/build-manual-outreach-pack";
import { renderManualOutreachPackMarkdown } from "./manual-outreach/render-manual-outreach-pack-markdown";

function buildDeps(): BuildManualOutreachPackDeps & {
  clinicRepo: FakeClinicRepository;
  crawlRepo: FakeCrawlRepository;
  extractionRepo: FakeExtractionRepository;
  scoreRepo: FakeScoreRepository;
  outreachRepo: FakeOutreachRepository;
  humanReviewRepo: FakeHumanReviewRepository;
} {
  return {
    clinicRepo: new FakeClinicRepository(),
    crawlRepo: new FakeCrawlRepository(),
    extractionRepo: new FakeExtractionRepository(),
    scoreRepo: new FakeScoreRepository(),
    outreachRepo: new FakeOutreachRepository(),
    humanReviewRepo: new FakeHumanReviewRepository(),
  };
}

async function seedClinic(deps: ReturnType<typeof buildDeps>, dedupeKey = "manual-outreach-clinic") {
  const clinic = await deps.clinicRepo.createClinic({
    displayName: "SkinLaser - Higienopolis",
    normalizedName: "skinlaser higienopolis",
    websiteUrl: "https://www.skinlaser.com.br/",
    normalizedWebsiteOrigin: "https://www.skinlaser.com.br",
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

const MANY_OBSERVATIONS = Array.from({ length: 12 }, (_, i) => ({
  observation: `Observação de evidência número ${i + 1} extraída do site público.`,
  sourceUrl: "https://www.skinlaser.com.br/",
}));

async function seedOutreachMessage(
  deps: ReturnType<typeof buildDeps>,
  clinicId: string,
  channel: "email" | "whatsapp_manual" = "email",
  whatsappDigits?: string,
) {
  const built = buildOutreachDraft({
    clinicDisplayName: "SkinLaser - Higienopolis",
    channel,
    observations: MANY_OBSERVATIONS,
    whatsappDigits,
  });
  if (!built.ok) throw new Error("setup failed: " + built.message);
  const created = await deps.outreachRepo.createDraft({ clinicId, draft: built.draft, doNotContact: false });
  if (!created.ok) throw new Error("setup failed");
  return created.value;
}

async function seedApprovedClinicWithBothDrafts(deps: ReturnType<typeof buildDeps>, dedupeKey: string) {
  const clinic = await seedClinic(deps, dedupeKey);
  const email = await seedOutreachMessage(deps, clinic.id, "email");
  const whatsapp = await seedOutreachMessage(deps, clinic.id, "whatsapp_manual", "5511900000000");
  await deps.humanReviewRepo.recordDecision({ clinicId: clinic.id, decision: "approved", reviewer: "Atria QA" });
  return { clinic, email, whatsapp };
}

describe("buildManualOutreachPack: generated only when approval gate passes", () => {
  it("1. pack is generated (ok:true, both channels available) when decision is approved and both drafts are sendable", async () => {
    const deps = buildDeps();
    const { clinic } = await seedApprovedClinicWithBothDrafts(deps, "ready-clinic");

    const result = await buildManualOutreachPack({ clinicId: clinic.id }, deps);
    assert.equal(result.ok, true);
    if (!result.ok) return;
    assert.equal(result.pack.status, "ready");
    assert.equal(result.pack.whatsapp?.available, true);
    assert.equal(result.pack.email?.available, true);
  });
});

describe("buildManualOutreachPack: blocked states", () => {
  it("2. needs_changes blocks — no pack generated", async () => {
    const deps = buildDeps();
    const clinic = await seedClinic(deps, "needs-changes-clinic");
    await seedOutreachMessage(deps, clinic.id, "email");
    await deps.humanReviewRepo.recordDecision({ clinicId: clinic.id, decision: "needs_changes" });

    const result = await buildManualOutreachPack({ clinicId: clinic.id, channel: "email" }, deps);
    assert.equal(result.ok, false);
    if (result.ok) return;
    assert.equal(result.reason, "blocked");
    assert.equal(result.approvalGateResults[0]?.code, "review_decision_needs_changes");
  });

  it("3. rejected blocks — no pack generated", async () => {
    const deps = buildDeps();
    const clinic = await seedClinic(deps, "rejected-clinic");
    await seedOutreachMessage(deps, clinic.id, "email");
    await deps.humanReviewRepo.recordDecision({ clinicId: clinic.id, decision: "rejected" });

    const result = await buildManualOutreachPack({ clinicId: clinic.id, channel: "email" }, deps);
    assert.equal(result.ok, false);
    if (result.ok) return;
    assert.equal(result.approvalGateResults[0]?.code, "review_decision_rejected");
  });

  it("4. missing decision blocks — no pack generated", async () => {
    const deps = buildDeps();
    const clinic = await seedClinic(deps, "missing-decision-clinic");
    await seedOutreachMessage(deps, clinic.id, "email");

    const result = await buildManualOutreachPack({ clinicId: clinic.id, channel: "email" }, deps);
    assert.equal(result.ok, false);
    if (result.ok) return;
    assert.equal(result.approvalGateResults[0]?.code, "missing_review_decision");
  });

  it("5. do_not_contact blocks, even with an approved decision on record", async () => {
    const deps = buildDeps();
    const clinic = await seedClinic(deps, "dnc-clinic");
    await seedOutreachMessage(deps, clinic.id, "email");
    await deps.humanReviewRepo.recordDecision({ clinicId: clinic.id, decision: "approved" });
    await deps.clinicRepo.setDoNotContact(clinic.id, true, "Paciente pediu para não ser contatado.");

    const result = await buildManualOutreachPack({ clinicId: clinic.id, channel: "email" }, deps);
    assert.equal(result.ok, false);
    if (result.ok) return;
    assert.equal(result.approvalGateResults[0]?.code, "do_not_contact");
  });

  it("6. sent/non-draft outreach blocks", async () => {
    const deps = buildDeps();
    const clinic = await seedClinic(deps, "sent-clinic");
    const message = await seedOutreachMessage(deps, clinic.id, "email");
    await deps.humanReviewRepo.recordDecision({ clinicId: clinic.id, decision: "approved" });
    const approved = await deps.outreachRepo.approve(message.id, "AB");
    if (!approved.ok) return assert.fail();
    const sent = await deps.outreachRepo.markSent(message.id);
    if (!sent.ok) return assert.fail();

    const result = await buildManualOutreachPack({ clinicId: clinic.id, channel: "email" }, deps);
    assert.equal(result.ok, false);
    if (result.ok) return;
    assert.equal(result.approvalGateResults[0]?.code, "outreach_not_sendable_status");
  });

  it("7. wrong clinic/outreach relationship blocks (explicit --outreach-message-id from another clinic)", async () => {
    const deps = buildDeps();
    const clinicA = await seedClinic(deps, "wrong-clinic-a");
    const clinicB = await seedClinic(deps, "wrong-clinic-b");
    const messageForB = await seedOutreachMessage(deps, clinicB.id, "email");
    await deps.humanReviewRepo.recordDecision({ clinicId: clinicA.id, decision: "approved" });

    const result = await buildManualOutreachPack(
      { clinicId: clinicA.id, channel: "email", outreachMessageId: messageForB.id },
      deps,
    );
    assert.equal(result.ok, false);
    if (result.ok) return;
    assert.equal(result.approvalGateResults[0]?.code, "outreach_message_wrong_clinic");
  });

  it("no persisted draft for the requested channel blocks with a pack-specific code", async () => {
    const deps = buildDeps();
    const clinic = await seedClinic(deps, "no-draft-clinic");
    await deps.humanReviewRepo.recordDecision({ clinicId: clinic.id, decision: "approved" });

    const result = await buildManualOutreachPack({ clinicId: clinic.id, channel: "whatsapp" }, deps);
    assert.equal(result.ok, false);
    if (result.ok) return;
    assert.equal(result.approvalGateResults[0]?.code, "no_persisted_draft_for_channel");
  });

  it("an explicit --outreach-message-id whose own channel mismatches --channel is blocked before the gate even runs", async () => {
    const deps = buildDeps();
    const clinic = await seedClinic(deps, "wrong-channel-clinic");
    const emailMessage = await seedOutreachMessage(deps, clinic.id, "email");
    await deps.humanReviewRepo.recordDecision({ clinicId: clinic.id, decision: "approved" });

    const result = await buildManualOutreachPack(
      { clinicId: clinic.id, channel: "whatsapp", outreachMessageId: emailMessage.id },
      deps,
    );
    assert.equal(result.ok, false);
    if (result.ok) return;
    assert.equal(result.approvalGateResults[0]?.code, "outreach_message_wrong_channel");
  });

  it("--outreach-message-id with channel=both is refused as ambiguous (validation, gate never called)", async () => {
    const deps = buildDeps();
    const clinic = await seedClinic(deps, "ambiguous-clinic");
    const message = await seedOutreachMessage(deps, clinic.id, "email");
    await deps.humanReviewRepo.recordDecision({ clinicId: clinic.id, decision: "approved" });

    const result = await buildManualOutreachPack(
      { clinicId: clinic.id, channel: "both", outreachMessageId: message.id },
      deps,
    );
    assert.equal(result.ok, false);
    if (result.ok) return;
    assert.equal(result.reason, "validation");
    assert.deepEqual(result.approvalGateResults, []);
  });
});

describe("buildManualOutreachPack: production is refused", () => {
  it("8. the shared repository-selection gate refuses production regardless of --target", () => {
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

describe("buildManualOutreachPack: copy quality", () => {
  it("9. WhatsApp copy is short and permission-based", async () => {
    const deps = buildDeps();
    const { clinic } = await seedApprovedClinicWithBothDrafts(deps, "whatsapp-quality-clinic");
    const result = await buildManualOutreachPack({ clinicId: clinic.id }, deps);
    assert.equal(result.ok, true);
    if (!result.ok) return;
    const wa = result.pack.whatsapp;
    assert.equal(wa?.available, true);
    if (!wa || !wa.available) return;
    assert.ok(wa.body.length < 400, `body too long: ${wa.body.length}`);
    assert.match(wa.body, /resumo/i);
  });

  it("10. email copy is concise and safe", async () => {
    const deps = buildDeps();
    const { clinic } = await seedApprovedClinicWithBothDrafts(deps, "email-quality-clinic");
    const result = await buildManualOutreachPack({ clinicId: clinic.id }, deps);
    assert.equal(result.ok, true);
    if (!result.ok) return;
    const email = result.pack.email;
    assert.equal(email?.available, true);
    if (!email || !email.available) return;
    assert.ok(email.body.length < 600, `body too long: ${email.body.length}`);
    assert.match(email.body, /resumo/i);
  });

  it("11. no medical quality evaluation language in either channel's copy", async () => {
    const deps = buildDeps();
    const { clinic } = await seedApprovedClinicWithBothDrafts(deps, "medical-language-clinic");
    const result = await buildManualOutreachPack({ clinicId: clinic.id }, deps);
    assert.equal(result.ok, true);
    if (!result.ok) return;
    for (const section of [result.pack.whatsapp, result.pack.email]) {
      if (!section || !section.available) continue;
      assert.match(section.body, /não avalia qualidade médica/i);
      const lower = section.body.toLowerCase();
      for (const forbidden of ["qualidade médica boa", "qualidade médica ruim", "diagnosticamos", "avaliamos sua saúde"]) {
        assert.doesNotMatch(lower, new RegExp(forbidden));
      }
    }
  });

  it("12. no invented claims/testimonials in either channel's copy", async () => {
    const deps = buildDeps();
    const { clinic } = await seedApprovedClinicWithBothDrafts(deps, "no-invented-claims-clinic");
    const result = await buildManualOutreachPack({ clinicId: clinic.id }, deps);
    assert.equal(result.ok, true);
    if (!result.ok) return;
    for (const section of [result.pack.whatsapp, result.pack.email]) {
      if (!section || !section.available) continue;
      const lower = section.body.toLowerCase();
      for (const forbidden of ["prêmio", "depoimento", "clientes satisfeitos", "melhor clínica", "número 1"]) {
        assert.doesNotMatch(lower, new RegExp(forbidden));
      }
    }
  });

  it("13. disclaimer is always included, verbatim, in the pack and in rendered Markdown", async () => {
    const deps = buildDeps();
    const { clinic } = await seedApprovedClinicWithBothDrafts(deps, "disclaimer-clinic");
    const result = await buildManualOutreachPack({ clinicId: clinic.id }, deps);
    assert.equal(result.ok, true);
    if (!result.ok) return;
    assert.equal(result.pack.disclaimer, SCORE_DISCLAIMER);
    const markdown = renderManualOutreachPackMarkdown(result.pack);
    assert.ok(markdown.includes(SCORE_DISCLAIMER));
  });

  it("14. score is not included in first-touch copy by default, and only appears as a separate pack-only note when explicitly enabled", async () => {
    const deps = buildDeps();
    const { clinic } = await seedApprovedClinicWithBothDrafts(deps, "score-in-copy-clinic");

    const withoutFlag = await buildManualOutreachPack({ clinicId: clinic.id }, deps);
    assert.equal(withoutFlag.ok, true);
    if (!withoutFlag.ok) return;
    for (const section of [withoutFlag.pack.whatsapp, withoutFlag.pack.email]) {
      if (!section || !section.available) continue;
      assert.doesNotMatch(section.body, /\/100/);
      assert.equal(section.internalScoreNote, null);
    }

    const withFlag = await buildManualOutreachPack({ clinicId: clinic.id, includeScoreInCopy: true }, deps);
    assert.equal(withFlag.ok, true);
    if (!withFlag.ok) return;
    for (const section of [withFlag.pack.whatsapp, withFlag.pack.email]) {
      if (!section || !section.available) continue;
      // Body itself is still never rewritten — the score only ever appears in the separate annotation field.
      assert.doesNotMatch(section.body, /\/100/);
    }
    // No score was ever saved for this clinic, so the note stays null even with the flag on — confirms it's driven by real data, not the flag alone.
    assert.equal(withFlag.pack.email?.available && withFlag.pack.email.internalScoreNote, null);
  });

  it("15. screenshot storage paths are not included by default, only when --include-screenshot-links is passed", async () => {
    const deps = buildDeps();
    const { clinic } = await seedApprovedClinicWithBothDrafts(deps, "screenshot-links-clinic");
    const crawlJob = await deps.crawlRepo.createCrawlJob({
      clinicId: clinic.id,
      requestedUrl: "https://www.skinlaser.com.br/",
      normalizedOrigin: "https://www.skinlaser.com.br",
    });
    if (!crawlJob.ok) return assert.fail();
    await deps.crawlRepo.saveAsset({
      crawlJobId: crawlJob.value.id,
      assetType: "screenshot_desktop",
      storagePath: "crawler-screenshots/private/desktop.png",
      contentType: "image/png",
      widthPx: 1280,
      heightPx: 800,
      pageUrl: "https://www.skinlaser.com.br/",
      reviewStatus: "pending_review",
      metadata: { captureStatus: "captured", capturedAt: new Date().toISOString() },
    });

    const withoutFlag = await buildManualOutreachPack({ clinicId: clinic.id, channel: "email" }, deps);
    assert.equal(withoutFlag.ok, true);
    if (!withoutFlag.ok) return;
    assert.equal(withoutFlag.pack.screenshots.desktop.storagePath, null);
    assert.equal(withoutFlag.pack.screenshots.desktop.status, "captured");

    const withFlag = await buildManualOutreachPack(
      { clinicId: clinic.id, channel: "email", includeScreenshotLinks: true },
      deps,
    );
    assert.equal(withFlag.ok, true);
    if (!withFlag.ok) return;
    assert.equal(withFlag.pack.screenshots.desktop.storagePath, "crawler-screenshots/private/desktop.png");
  });

  it("16. click-to-chat link is generated when a WhatsApp draft with digits exists", async () => {
    const deps = buildDeps();
    const { clinic } = await seedApprovedClinicWithBothDrafts(deps, "click-to-chat-clinic");
    const result = await buildManualOutreachPack({ clinicId: clinic.id }, deps);
    assert.equal(result.ok, true);
    if (!result.ok) return;
    const wa = result.pack.whatsapp;
    assert.equal(wa?.available, true);
    if (!wa || !wa.available) return;
    assert.ok(wa.clickToChatUrl?.startsWith("https://wa.me/"));
  });
});

describe("buildManualOutreachPack: checklists", () => {
  it("17. manual sending checklist is included with the expected items", async () => {
    const deps = buildDeps();
    const { clinic } = await seedApprovedClinicWithBothDrafts(deps, "checklist-clinic");
    const result = await buildManualOutreachPack({ clinicId: clinic.id }, deps);
    assert.equal(result.ok, true);
    if (!result.ok) return;
    assert.ok(result.pack.operatorChecklist.length > 0);
    assert.ok(result.pack.operatorChecklist.some((item) => /enviará manualmente/i.test(item)));
    assert.ok(result.pack.operatorChecklist.some((item) => /aprovação gate|approval gate/i.test(item)));
  });

  it("18. post-send logging checklist is included with the expected items", async () => {
    const deps = buildDeps();
    const { clinic } = await seedApprovedClinicWithBothDrafts(deps, "post-send-checklist-clinic");
    const result = await buildManualOutreachPack({ clinicId: clinic.id }, deps);
    assert.equal(result.ok, true);
    if (!result.ok) return;
    assert.ok(result.pack.postSendLoggingChecklist.length > 0);
    assert.ok(result.pack.postSendLoggingChecklist.some((item) => /canal/i.test(item)));
    assert.ok(result.pack.postSendLoggingChecklist.some((item) => /data\/hora/i.test(item)));
    assert.ok(result.pack.postSendLoggingChecklist.some((item) => /resposta recebida/i.test(item)));
  });
});

describe("buildManualOutreachPack: stable shapes", () => {
  it("19. JSON shape is stable and round-trips through JSON.stringify/parse", async () => {
    const deps = buildDeps();
    const { clinic } = await seedApprovedClinicWithBothDrafts(deps, "json-shape-clinic");
    const result = await buildManualOutreachPack({ clinicId: clinic.id }, deps);
    assert.equal(result.ok, true);
    if (!result.ok) return;
    const roundTripped = JSON.parse(JSON.stringify(result.pack));
    assert.deepEqual(Object.keys(roundTripped).sort(), Object.keys(result.pack).sort());
    assert.deepEqual(
      Object.keys(result.pack).sort(),
      [
        "approvalGateResults",
        "approvalStatus",
        "clinicIdentity",
        "disclaimer",
        "email",
        "generatedAt",
        "includeScoreInCopy",
        "includeScreenshotLinks",
        "keyEvidenceSummary",
        "operatorChecklist",
        "operatorSummary",
        "postSendLoggingChecklist",
        "reviewRequired",
        "riskFlags",
        "scoreSummary",
        "screenshots",
        "status",
        "warnings",
        "websiteAnalyzed",
        "whatsapp",
      ].sort(),
    );
  });

  it("20. Markdown rendering is deterministic for the same pack object", async () => {
    const deps = buildDeps();
    const { clinic } = await seedApprovedClinicWithBothDrafts(deps, "deterministic-markdown-clinic");
    const result = await buildManualOutreachPack({ clinicId: clinic.id }, deps);
    assert.equal(result.ok, true);
    if (!result.ok) return;
    const a = renderManualOutreachPackMarkdown(result.pack);
    const b = renderManualOutreachPackMarkdown(result.pack);
    assert.equal(a, b);
  });
});

describe("buildManualOutreachPack: read-only, no sending", () => {
  it("21. the builder never writes to any repository, allowed or blocked", async () => {
    const deps = buildDeps();
    const { clinic } = await seedApprovedClinicWithBothDrafts(deps, "read-only-clinic");

    const decisionsBefore = deps.humanReviewRepo.decisions.length;
    const messagesBefore = deps.outreachRepo.messages.size;
    const clinicsBefore = deps.clinicRepo.clinics.size;

    await buildManualOutreachPack({ clinicId: clinic.id }, deps);

    assert.equal(deps.humanReviewRepo.decisions.length, decisionsBefore);
    assert.equal(deps.outreachRepo.messages.size, messagesBefore);
    assert.equal(deps.clinicRepo.clinics.size, clinicsBefore);

    // Also exercise a blocked path — still must not write anything.
    await deps.humanReviewRepo.recordDecision({ clinicId: clinic.id, decision: "needs_changes" });
    const decisionsAfterSecondRecord = deps.humanReviewRepo.decisions.length;
    await buildManualOutreachPack({ clinicId: clinic.id }, deps);
    assert.equal(deps.humanReviewRepo.decisions.length, decisionsAfterSecondRecord);
    assert.equal(deps.outreachRepo.messages.size, messagesBefore);
  });

  it("22. no send-capable repository method is ever called by the builder", async () => {
    const deps = buildDeps();
    const { clinic } = await seedApprovedClinicWithBothDrafts(deps, "no-sending-method-clinic");

    let markSentCalled = false;
    let approveCalled = false;
    let createDraftCalled = false;
    let recordDecisionCalled = false;
    const originalMarkSent = deps.outreachRepo.markSent.bind(deps.outreachRepo);
    const originalApprove = deps.outreachRepo.approve.bind(deps.outreachRepo);
    const originalCreateDraft = deps.outreachRepo.createDraft.bind(deps.outreachRepo);
    const originalRecordDecision = deps.humanReviewRepo.recordDecision.bind(deps.humanReviewRepo);
    deps.outreachRepo.markSent = (async (id: string) => {
      markSentCalled = true;
      return originalMarkSent(id);
    }) as typeof deps.outreachRepo.markSent;
    deps.outreachRepo.approve = (async (id: string, reviewedBy: string) => {
      approveCalled = true;
      return originalApprove(id, reviewedBy);
    }) as typeof deps.outreachRepo.approve;
    deps.outreachRepo.createDraft = (async (draftInput: Parameters<typeof originalCreateDraft>[0]) => {
      createDraftCalled = true;
      return originalCreateDraft(draftInput);
    }) as typeof deps.outreachRepo.createDraft;
    deps.humanReviewRepo.recordDecision = (async (decisionInput: Parameters<typeof originalRecordDecision>[0]) => {
      recordDecisionCalled = true;
      return originalRecordDecision(decisionInput);
    }) as typeof deps.humanReviewRepo.recordDecision;

    const result = await buildManualOutreachPack({ clinicId: clinic.id }, deps);
    assert.equal(result.ok, true);
    assert.equal(markSentCalled, false);
    assert.equal(approveCalled, false);
    assert.equal(createDraftCalled, false);
    assert.equal(recordDecisionCalled, false);
  });
});

describe("buildManualOutreachPack: both-channel validation and partial blocking", () => {
  it("23. channel=both validates both channel drafts independently through the gate", async () => {
    const deps = buildDeps();
    const { clinic } = await seedApprovedClinicWithBothDrafts(deps, "both-channel-clinic");
    const result = await buildManualOutreachPack({ clinicId: clinic.id, channel: "both" }, deps);
    assert.equal(result.ok, true);
    if (!result.ok) return;
    assert.equal(result.pack.approvalGateResults.length, 2);
    assert.ok(result.pack.approvalGateResults.every((r) => r.status === "allowed"));
    assert.equal(result.pack.status, "ready");
  });

  it("24. partial_blocked is explicit when one channel fails and the other passes — no copy leaks for the blocked channel", async () => {
    const deps = buildDeps();
    const clinic = await seedClinic(deps, "partial-blocked-clinic");
    const emailMessage = await seedOutreachMessage(deps, clinic.id, "email");
    const whatsappMessage = await seedOutreachMessage(deps, clinic.id, "whatsapp_manual", "5511900000000");
    await deps.humanReviewRepo.recordDecision({ clinicId: clinic.id, decision: "approved" });
    // Block only the WhatsApp draft by marking it sent.
    const approved = await deps.outreachRepo.approve(whatsappMessage.id, "AB");
    if (!approved.ok) return assert.fail();
    const sent = await deps.outreachRepo.markSent(whatsappMessage.id);
    if (!sent.ok) return assert.fail();
    void emailMessage;

    const result = await buildManualOutreachPack({ clinicId: clinic.id, channel: "both" }, deps);
    assert.equal(result.ok, true);
    if (!result.ok) return;
    assert.equal(result.pack.status, "partial_blocked");
    assert.equal(result.pack.email?.available, true);
    assert.equal(result.pack.whatsapp?.available, false);
    if (result.pack.whatsapp?.available !== false) return;
    assert.equal(result.pack.whatsapp.blockCode, "outreach_not_sendable_status");
    assert.ok(result.pack.riskFlags.some((f) => f.code === "channel_blocked"));
  });
});
