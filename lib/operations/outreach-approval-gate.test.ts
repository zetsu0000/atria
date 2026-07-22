import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  FakeClinicRepository,
  FakeHumanReviewRepository,
  FakeOutreachRepository,
} from "@/lib/operations/repositories/fakes";
import {
  assertOutreachApprovedForSend,
  canPrepareOutreachForSend,
  OutreachNotApprovedForSendError,
  type OutreachApprovalDeps,
} from "./outreach/approval-gate";
import { buildOutreachDraft } from "@/lib/outreach/draft";
import { selectRepositories } from "@/lib/operations/pipeline/select-repositories";
import { KNOWN_PROJECT_REFS } from "@/lib/operations/pipeline/target-guard";
import type { LeadCaptureEnv } from "@/lib/security/env";

function buildDeps(): OutreachApprovalDeps & {
  clinicRepo: FakeClinicRepository;
  outreachRepo: FakeOutreachRepository;
  humanReviewRepo: FakeHumanReviewRepository;
} {
  return {
    clinicRepo: new FakeClinicRepository(),
    outreachRepo: new FakeOutreachRepository(),
    humanReviewRepo: new FakeHumanReviewRepository(),
  };
}

async function seedClinic(deps: ReturnType<typeof buildDeps>, dedupeKey = "approval-gate-clinic") {
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
    sourceAttribution: {},
    dedupeKey,
  });
  if (!clinic.ok) throw new Error("setup failed");
  return clinic.value;
}

async function seedOutreachMessage(deps: ReturnType<typeof buildDeps>, clinicId: string, doNotContact = false) {
  const built = buildOutreachDraft({
    clinicDisplayName: "SkinLaser - Higienopolis",
    channel: "email",
    observations: [{ observation: "Telefone público encontrado." }],
    doNotContact,
  });
  if (!built.ok) throw new Error("setup failed: " + built.message);
  const created = await deps.outreachRepo.createDraft({ clinicId, draft: built.draft, doNotContact });
  if (!created.ok) throw new Error("setup failed");
  return created.value;
}

describe("canPrepareOutreachForSend: allowed state", () => {
  it("1. an 'approved' latest decision, sendable outreach status, no do_not_contact → allowed", async () => {
    const deps = buildDeps();
    const clinic = await seedClinic(deps);
    const message = await seedOutreachMessage(deps, clinic.id);
    await deps.humanReviewRepo.recordDecision({ clinicId: clinic.id, decision: "approved" });

    const result = await canPrepareOutreachForSend({ clinicId: clinic.id, outreachMessageId: message.id }, deps);
    assert.equal(result.allowed, true);
    if (!result.allowed) return;
    assert.equal(result.decision.decision, "approved");
    assert.ok(result.reason.length > 0);
  });

  it("allowed also when the outreach message's own status is 'approved' (not just 'draft')", async () => {
    const deps = buildDeps();
    const clinic = await seedClinic(deps, "approved-status-clinic");
    const message = await seedOutreachMessage(deps, clinic.id);
    const approved = await deps.outreachRepo.approve(message.id, "AB");
    if (!approved.ok) return assert.fail();
    await deps.humanReviewRepo.recordDecision({ clinicId: clinic.id, decision: "approved" });

    const result = await canPrepareOutreachForSend({ clinicId: clinic.id, outreachMessageId: message.id }, deps);
    assert.equal(result.allowed, true);
  });
});

describe("canPrepareOutreachForSend: blocked states", () => {
  it("2. missing decision blocks", async () => {
    const deps = buildDeps();
    const clinic = await seedClinic(deps, "missing-decision-clinic");
    const message = await seedOutreachMessage(deps, clinic.id);

    const result = await canPrepareOutreachForSend({ clinicId: clinic.id, outreachMessageId: message.id }, deps);
    assert.equal(result.allowed, false);
    if (result.allowed) return;
    assert.equal(result.code, "missing_review_decision");
    assert.equal(result.decision, null);
  });

  it("3. a 'rejected' latest decision blocks", async () => {
    const deps = buildDeps();
    const clinic = await seedClinic(deps, "rejected-clinic");
    const message = await seedOutreachMessage(deps, clinic.id);
    await deps.humanReviewRepo.recordDecision({ clinicId: clinic.id, decision: "rejected" });

    const result = await canPrepareOutreachForSend({ clinicId: clinic.id, outreachMessageId: message.id }, deps);
    assert.equal(result.allowed, false);
    if (result.allowed) return;
    assert.equal(result.code, "review_decision_rejected");
    assert.equal(result.decision?.decision, "rejected");
  });

  it("4. a 'needs_changes' latest decision blocks", async () => {
    const deps = buildDeps();
    const clinic = await seedClinic(deps, "needs-changes-clinic");
    const message = await seedOutreachMessage(deps, clinic.id);
    await deps.humanReviewRepo.recordDecision({ clinicId: clinic.id, decision: "needs_changes" });

    const result = await canPrepareOutreachForSend({ clinicId: clinic.id, outreachMessageId: message.id }, deps);
    assert.equal(result.allowed, false);
    if (result.allowed) return;
    assert.equal(result.code, "review_decision_needs_changes");
  });

  it("5. the latest decision wins — approved-then-needs_changes blocks; needs_changes-then-approved allows", async () => {
    const deps = buildDeps();

    const clinicA = await seedClinic(deps, "latest-wins-a");
    const messageA = await seedOutreachMessage(deps, clinicA.id);
    await deps.humanReviewRepo.recordDecision({ clinicId: clinicA.id, decision: "approved" });
    await deps.humanReviewRepo.recordDecision({ clinicId: clinicA.id, decision: "needs_changes" });
    const resultA = await canPrepareOutreachForSend({ clinicId: clinicA.id, outreachMessageId: messageA.id }, deps);
    assert.equal(resultA.allowed, false);
    if (resultA.allowed) return;
    assert.equal(resultA.code, "review_decision_needs_changes");

    const clinicB = await seedClinic(deps, "latest-wins-b");
    const messageB = await seedOutreachMessage(deps, clinicB.id);
    await deps.humanReviewRepo.recordDecision({ clinicId: clinicB.id, decision: "needs_changes" });
    await deps.humanReviewRepo.recordDecision({ clinicId: clinicB.id, decision: "approved" });
    const resultB = await canPrepareOutreachForSend({ clinicId: clinicB.id, outreachMessageId: messageB.id }, deps);
    assert.equal(resultB.allowed, true);
  });

  it("6. do_not_contact blocks, even with an 'approved' decision already on record", async () => {
    const deps = buildDeps();
    const clinic = await seedClinic(deps, "do-not-contact-clinic");
    const message = await seedOutreachMessage(deps, clinic.id);
    await deps.humanReviewRepo.recordDecision({ clinicId: clinic.id, decision: "approved" });
    // do_not_contact set *after* the approval — must still block.
    await deps.clinicRepo.setDoNotContact(clinic.id, true, "Paciente pediu para não ser contatado.");

    const result = await canPrepareOutreachForSend({ clinicId: clinic.id, outreachMessageId: message.id }, deps);
    assert.equal(result.allowed, false);
    if (result.allowed) return;
    assert.equal(result.code, "do_not_contact");
    assert.match(result.reason, /Paciente pediu/);
  });

  it("7. a missing outreach message blocks", async () => {
    const deps = buildDeps();
    const clinic = await seedClinic(deps, "missing-outreach-clinic");
    await deps.humanReviewRepo.recordDecision({ clinicId: clinic.id, decision: "approved" });

    const result = await canPrepareOutreachForSend({ clinicId: clinic.id, outreachMessageId: "does-not-exist" }, deps);
    assert.equal(result.allowed, false);
    if (result.allowed) return;
    assert.equal(result.code, "outreach_message_not_found");
  });

  it("8. an already-'sent' outreach message blocks", async () => {
    const deps = buildDeps();
    const clinic = await seedClinic(deps, "already-sent-clinic");
    const message = await seedOutreachMessage(deps, clinic.id);
    await deps.humanReviewRepo.recordDecision({ clinicId: clinic.id, decision: "approved" });
    const approved = await deps.outreachRepo.approve(message.id, "AB");
    if (!approved.ok) return assert.fail();
    const sent = await deps.outreachRepo.markSent(message.id);
    if (!sent.ok) return assert.fail();

    const result = await canPrepareOutreachForSend({ clinicId: clinic.id, outreachMessageId: message.id }, deps);
    assert.equal(result.allowed, false);
    if (result.allowed) return;
    assert.equal(result.code, "outreach_not_sendable_status");
  });

  it("blocks when the clinic does not exist", async () => {
    const deps = buildDeps();
    const result = await canPrepareOutreachForSend({ clinicId: "missing-clinic", outreachMessageId: "whatever" }, deps);
    assert.equal(result.allowed, false);
    if (result.allowed) return;
    assert.equal(result.code, "clinic_not_found");
  });

  it("blocks when the outreach message belongs to a different clinic", async () => {
    const deps = buildDeps();
    const clinicA = await seedClinic(deps, "wrong-clinic-a");
    const clinicB = await seedClinic(deps, "wrong-clinic-b");
    const messageForB = await seedOutreachMessage(deps, clinicB.id);
    await deps.humanReviewRepo.recordDecision({ clinicId: clinicA.id, decision: "approved" });

    const result = await canPrepareOutreachForSend({ clinicId: clinicA.id, outreachMessageId: messageForB.id }, deps);
    assert.equal(result.allowed, false);
    if (result.allowed) return;
    assert.equal(result.code, "outreach_message_wrong_clinic");
  });

  it("blocks when the outreach message itself was created do_not_contact_blocked, even if the clinic flag was later cleared", async () => {
    const deps = buildDeps();
    const clinic = await seedClinic(deps, "message-level-dnc-clinic");
    // buildOutreachDraft refuses to build a draft at all when doNotContact
    // is true, so simulate a message that was already blocked at creation
    // by inserting it directly via the repository's internal map shape —
    // instead, exercise the realistic path: mark do_not_contact, attempt
    // (refused), then unblock and create normally but flip the persisted
    // flag directly to simulate a stale do_not_contact_blocked record.
    const message = await seedOutreachMessage(deps, clinic.id);
    (deps.outreachRepo as FakeOutreachRepository).messages.set(message.id, {
      ...message,
      doNotContactBlocked: true,
    });
    await deps.humanReviewRepo.recordDecision({ clinicId: clinic.id, decision: "approved" });

    const result = await canPrepareOutreachForSend({ clinicId: clinic.id, outreachMessageId: message.id }, deps);
    assert.equal(result.allowed, false);
    if (result.allowed) return;
    assert.equal(result.code, "do_not_contact");
  });
});

describe("approval gate: production is refused", () => {
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
    const selection = selectRepositories({ dryRun: false, target: "staging", env });
    assert.equal(selection.ok, false);
    if (selection.ok) return;
    assert.match(selection.reason, /production/);
  });
});

describe("approval gate: read-only, no sending", () => {
  it("10. the guard is read-only — never writes to any repository, allowed or blocked", async () => {
    const deps = buildDeps();
    const clinic = await seedClinic(deps, "read-only-clinic");
    const message = await seedOutreachMessage(deps, clinic.id);
    await deps.humanReviewRepo.recordDecision({ clinicId: clinic.id, decision: "approved" });

    const decisionsBefore = deps.humanReviewRepo.decisions.length;
    const messagesBefore = deps.outreachRepo.messages.size;
    const clinicsBefore = deps.clinicRepo.clinics.size;

    await canPrepareOutreachForSend({ clinicId: clinic.id, outreachMessageId: message.id }, deps);
    // Also exercise a blocked path — still must not write anything.
    await deps.humanReviewRepo.recordDecision({ clinicId: clinic.id, decision: "needs_changes" });
    const decisionsAfterSecondRecord = deps.humanReviewRepo.decisions.length;
    await canPrepareOutreachForSend({ clinicId: clinic.id, outreachMessageId: message.id }, deps);

    assert.equal(deps.humanReviewRepo.decisions.length, decisionsAfterSecondRecord);
    assert.equal(deps.outreachRepo.messages.size, messagesBefore);
    assert.equal(deps.clinicRepo.clinics.size, clinicsBefore);
    void decisionsBefore;
  });

  it("11. no sending method is called — markSent/approve/createDraft on outreachRepo and recordDecision on humanReviewRepo are never invoked by the guard", async () => {
    const deps = buildDeps();
    const clinic = await seedClinic(deps, "no-sending-method-clinic");
    const message = await seedOutreachMessage(deps, clinic.id);
    await deps.humanReviewRepo.recordDecision({ clinicId: clinic.id, decision: "approved" });

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

    const result = await canPrepareOutreachForSend({ clinicId: clinic.id, outreachMessageId: message.id }, deps);
    assert.equal(result.allowed, true);
    assert.equal(markSentCalled, false);
    assert.equal(approveCalled, false);
    assert.equal(createDraftCalled, false);
    assert.equal(recordDecisionCalled, false);

    // assertOutreachApprovedForSend (the throwing variant) must be equally read-only.
    await assertOutreachApprovedForSend({ clinicId: clinic.id, outreachMessageId: message.id }, deps);
    assert.equal(markSentCalled, false);
    assert.equal(approveCalled, false);
  });

  it("assertOutreachApprovedForSend throws OutreachNotApprovedForSendError with the same code when blocked", async () => {
    const deps = buildDeps();
    const clinic = await seedClinic(deps, "assert-throws-clinic");
    const message = await seedOutreachMessage(deps, clinic.id);
    await deps.humanReviewRepo.recordDecision({ clinicId: clinic.id, decision: "rejected" });

    await assert.rejects(
      () => assertOutreachApprovedForSend({ clinicId: clinic.id, outreachMessageId: message.id }, deps),
      (error: unknown) => {
        assert.ok(error instanceof OutreachNotApprovedForSendError);
        assert.equal(error.code, "review_decision_rejected");
        return true;
      },
    );
  });
});

describe("approval gate: stable result shape", () => {
  it("12. the allowed/blocked result shape is stable and round-trips through JSON", async () => {
    const deps = buildDeps();
    const clinic = await seedClinic(deps, "shape-stable-clinic");
    const message = await seedOutreachMessage(deps, clinic.id);
    await deps.humanReviewRepo.recordDecision({ clinicId: clinic.id, decision: "approved" });

    const allowedResult = await canPrepareOutreachForSend({ clinicId: clinic.id, outreachMessageId: message.id }, deps);
    assert.equal(allowedResult.allowed, true);
    assert.deepEqual(Object.keys(allowedResult).sort(), ["allowed", "decision", "reason"]);
    const allowedRoundTripped = JSON.parse(JSON.stringify(allowedResult));
    assert.deepEqual(Object.keys(allowedRoundTripped).sort(), Object.keys(allowedResult).sort());

    const clinicBlocked = await seedClinic(deps, "shape-stable-blocked-clinic");
    const messageBlocked = await seedOutreachMessage(deps, clinicBlocked.id);
    const blockedResult = await canPrepareOutreachForSend({ clinicId: clinicBlocked.id, outreachMessageId: messageBlocked.id }, deps);
    assert.equal(blockedResult.allowed, false);
    assert.deepEqual(Object.keys(blockedResult).sort(), ["allowed", "code", "decision", "reason"]);
    const blockedRoundTripped = JSON.parse(JSON.stringify(blockedResult));
    assert.deepEqual(Object.keys(blockedRoundTripped).sort(), Object.keys(blockedResult).sort());

    const validCodes = [
      "clinic_not_found",
      "outreach_message_not_found",
      "outreach_message_wrong_clinic",
      "do_not_contact",
      "outreach_not_sendable_status",
      "missing_review_decision",
      "review_decision_rejected",
      "review_decision_needs_changes",
      "review_decision_not_approved",
    ];
    assert.ok(validCodes.includes((blockedResult as { code: string }).code));
  });
});
