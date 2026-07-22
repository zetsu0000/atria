import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { execFileSync } from "node:child_process";
import { join } from "node:path";
import {
  FakeClinicRepository,
  FakeHumanReviewRepository,
  FakeManualOutreachLogRepository,
  FakeOutreachRepository,
} from "@/lib/operations/repositories/fakes";
import { buildOutreachDraft } from "@/lib/outreach/draft";
import { selectRepositories } from "@/lib/operations/pipeline/select-repositories";
import { KNOWN_PROJECT_REFS } from "@/lib/operations/pipeline/target-guard";
import type { LeadCaptureEnv } from "@/lib/security/env";
import {
  recordManualOutreachLog,
  type RecordManualOutreachLogDeps,
} from "./manual-outreach-logging/record-manual-outreach-log";
import { listManualOutreachLogs } from "./manual-outreach-logging/list-manual-outreach-logs";

function buildDeps(): RecordManualOutreachLogDeps & {
  clinicRepo: FakeClinicRepository;
  outreachRepo: FakeOutreachRepository;
  humanReviewRepo: FakeHumanReviewRepository;
  manualOutreachLogRepo: FakeManualOutreachLogRepository;
} {
  return {
    clinicRepo: new FakeClinicRepository(),
    outreachRepo: new FakeOutreachRepository(),
    humanReviewRepo: new FakeHumanReviewRepository(),
    manualOutreachLogRepo: new FakeManualOutreachLogRepository(),
  };
}

async function seedClinic(deps: ReturnType<typeof buildDeps>, dedupeKey = "outreach-log-clinic") {
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

async function seedOutreachMessage(deps: ReturnType<typeof buildDeps>, clinicId: string) {
  const built = buildOutreachDraft({
    clinicDisplayName: "SkinLaser - Higienopolis",
    channel: "whatsapp_manual",
    observations: [{ observation: "Telefone público encontrado." }],
    whatsappDigits: "5511900000000",
  });
  if (!built.ok) throw new Error("setup failed: " + built.message);
  const created = await deps.outreachRepo.createDraft({ clinicId, draft: built.draft, doNotContact: false });
  if (!created.ok) throw new Error("setup failed");
  return created.value;
}

async function seedReadyClinic(deps: ReturnType<typeof buildDeps>, dedupeKey: string) {
  const clinic = await seedClinic(deps, dedupeKey);
  const message = await seedOutreachMessage(deps, clinic.id);
  await deps.humanReviewRepo.recordDecision({ clinicId: clinic.id, decision: "approved", reviewer: "Atria QA" });
  return { clinic, message };
}

const OCCURRED_AT = "2026-07-22T18:30:00.000Z";

describe("recordManualOutreachLog: manual_send_logged requires the approval gate", () => {
  it("1+2. manual_send_logged succeeds when the latest decision is approved and the gate passes", async () => {
    const deps = buildDeps();
    const { clinic, message } = await seedReadyClinic(deps, "gate-pass-clinic");

    const result = await recordManualOutreachLog(
      {
        clinicId: clinic.id,
        outreachMessageId: message.id,
        eventType: "manual_send_logged",
        channel: "whatsapp",
        operatorName: "AB",
        occurredAt: OCCURRED_AT,
      },
      deps,
    );
    assert.equal(result.ok, true);
    if (!result.ok) return;
    assert.equal(result.log.eventType, "manual_send_logged");
    assert.ok(result.log.humanReviewDecisionId);
  });

  it("3. needs_changes blocks manual_send_logged", async () => {
    const deps = buildDeps();
    const clinic = await seedClinic(deps, "needs-changes-log-clinic");
    const message = await seedOutreachMessage(deps, clinic.id);
    await deps.humanReviewRepo.recordDecision({ clinicId: clinic.id, decision: "needs_changes" });

    const result = await recordManualOutreachLog(
      {
        clinicId: clinic.id,
        outreachMessageId: message.id,
        eventType: "manual_send_logged",
        channel: "whatsapp",
        operatorName: "AB",
        occurredAt: OCCURRED_AT,
      },
      deps,
    );
    assert.equal(result.ok, false);
    if (result.ok) return;
    assert.equal(result.reason, "blocked");
    assert.match(result.message, /review_decision_needs_changes/);
  });

  it("4. rejected blocks manual_send_logged", async () => {
    const deps = buildDeps();
    const clinic = await seedClinic(deps, "rejected-log-clinic");
    const message = await seedOutreachMessage(deps, clinic.id);
    await deps.humanReviewRepo.recordDecision({ clinicId: clinic.id, decision: "rejected" });

    const result = await recordManualOutreachLog(
      {
        clinicId: clinic.id,
        outreachMessageId: message.id,
        eventType: "manual_send_logged",
        channel: "whatsapp",
        operatorName: "AB",
        occurredAt: OCCURRED_AT,
      },
      deps,
    );
    assert.equal(result.ok, false);
    if (result.ok) return;
    assert.match(result.message, /review_decision_rejected/);
  });

  it("5. missing decision blocks manual_send_logged", async () => {
    const deps = buildDeps();
    const clinic = await seedClinic(deps, "missing-decision-log-clinic");
    const message = await seedOutreachMessage(deps, clinic.id);

    const result = await recordManualOutreachLog(
      {
        clinicId: clinic.id,
        outreachMessageId: message.id,
        eventType: "manual_send_logged",
        channel: "whatsapp",
        operatorName: "AB",
        occurredAt: OCCURRED_AT,
      },
      deps,
    );
    assert.equal(result.ok, false);
    if (result.ok) return;
    assert.match(result.message, /missing_review_decision/);
  });

  it("6. wrong clinic/outreach relationship blocks", async () => {
    const deps = buildDeps();
    const clinicA = await seedClinic(deps, "wrong-clinic-log-a");
    const clinicB = await seedClinic(deps, "wrong-clinic-log-b");
    const messageForB = await seedOutreachMessage(deps, clinicB.id);
    await deps.humanReviewRepo.recordDecision({ clinicId: clinicA.id, decision: "approved" });

    const result = await recordManualOutreachLog(
      {
        clinicId: clinicA.id,
        outreachMessageId: messageForB.id,
        eventType: "manual_send_logged",
        channel: "whatsapp",
        operatorName: "AB",
        occurredAt: OCCURRED_AT,
      },
      deps,
    );
    assert.equal(result.ok, false);
    if (result.ok) return;
    assert.equal(result.reason, "validation");
    assert.match(result.message, /does not belong/);
  });

  it("7. sent/non-draft outreach blocks if the gate blocks it", async () => {
    const deps = buildDeps();
    const clinic = await seedClinic(deps, "sent-log-clinic");
    const message = await seedOutreachMessage(deps, clinic.id);
    await deps.humanReviewRepo.recordDecision({ clinicId: clinic.id, decision: "approved" });
    const approved = await deps.outreachRepo.approve(message.id, "AB");
    if (!approved.ok) return assert.fail();
    const sent = await deps.outreachRepo.markSent(message.id);
    if (!sent.ok) return assert.fail();

    const result = await recordManualOutreachLog(
      {
        clinicId: clinic.id,
        outreachMessageId: message.id,
        eventType: "manual_send_logged",
        channel: "whatsapp",
        operatorName: "AB",
        occurredAt: OCCURRED_AT,
      },
      deps,
    );
    assert.equal(result.ok, false);
    if (result.ok) return;
    assert.match(result.message, /outreach_not_sendable_status/);
  });

  it("8. do_not_contact blocks manual_send_logged, even with an approved decision on record", async () => {
    const deps = buildDeps();
    const clinic = await seedClinic(deps, "dnc-log-clinic");
    const message = await seedOutreachMessage(deps, clinic.id);
    await deps.humanReviewRepo.recordDecision({ clinicId: clinic.id, decision: "approved" });
    await deps.clinicRepo.setDoNotContact(clinic.id, true, "Paciente pediu para não ser contatado.");

    const result = await recordManualOutreachLog(
      {
        clinicId: clinic.id,
        outreachMessageId: message.id,
        eventType: "manual_send_logged",
        channel: "whatsapp",
        operatorName: "AB",
        occurredAt: OCCURRED_AT,
      },
      deps,
    );
    assert.equal(result.ok, false);
    if (result.ok) return;
    assert.match(result.message, /do_not_contact/);
  });
});

describe("recordManualOutreachLog: required fields and allowlists", () => {
  it("9. operator_name is required", async () => {
    const deps = buildDeps();
    const { clinic, message } = await seedReadyClinic(deps, "operator-name-required-clinic");

    const result = await recordManualOutreachLog(
      {
        clinicId: clinic.id,
        outreachMessageId: message.id,
        eventType: "rehearsal_logged",
        channel: "whatsapp",
        operatorName: "   ",
        occurredAt: OCCURRED_AT,
      },
      deps,
    );
    assert.equal(result.ok, false);
    if (result.ok) return;
    assert.equal(result.reason, "validation");
    assert.match(result.message, /operator_name/);
  });

  it("10. occurred_at is required and must be a valid timestamp", async () => {
    const deps = buildDeps();
    const { clinic, message } = await seedReadyClinic(deps, "occurred-at-required-clinic");

    const result = await recordManualOutreachLog(
      {
        clinicId: clinic.id,
        outreachMessageId: message.id,
        eventType: "rehearsal_logged",
        channel: "whatsapp",
        operatorName: "AB",
        occurredAt: "not-a-date",
      },
      deps,
    );
    assert.equal(result.ok, false);
    if (result.ok) return;
    assert.equal(result.reason, "validation");
    assert.match(result.message, /occurred_at/);
  });

  it("11. channel allowlist is enforced", async () => {
    const deps = buildDeps();
    const { clinic, message } = await seedReadyClinic(deps, "channel-allowlist-clinic");

    const result = await recordManualOutreachLog(
      {
        clinicId: clinic.id,
        outreachMessageId: message.id,
        eventType: "rehearsal_logged",
        // @ts-expect-error deliberately invalid for the allowlist test
        channel: "sms",
        operatorName: "AB",
        occurredAt: OCCURRED_AT,
      },
      deps,
    );
    assert.equal(result.ok, false);
    if (result.ok) return;
    assert.equal(result.reason, "validation");
    assert.match(result.message, /channel/);
  });

  it("12. event_type allowlist is enforced", async () => {
    const deps = buildDeps();
    const { clinic, message } = await seedReadyClinic(deps, "event-type-allowlist-clinic");

    const result = await recordManualOutreachLog(
      {
        clinicId: clinic.id,
        outreachMessageId: message.id,
        // @ts-expect-error deliberately invalid for the allowlist test
        eventType: "sent_via_carrier_pigeon",
        channel: "whatsapp",
        operatorName: "AB",
        occurredAt: OCCURRED_AT,
      },
      deps,
    );
    assert.equal(result.ok, false);
    if (result.ok) return;
    assert.equal(result.reason, "validation");
    assert.match(result.message, /event_type/);
  });
});

describe("recordManualOutreachLog: response/follow-up require a prior send; rehearsal never does", () => {
  it("13. response_logged requires a prior manual_send_logged for the same outreach message", async () => {
    const deps = buildDeps();
    const { clinic, message } = await seedReadyClinic(deps, "response-requires-send-clinic");

    const withoutPriorSend = await recordManualOutreachLog(
      {
        clinicId: clinic.id,
        outreachMessageId: message.id,
        eventType: "response_logged",
        channel: "whatsapp",
        operatorName: "AB",
        occurredAt: OCCURRED_AT,
        responseReceived: true,
      },
      deps,
    );
    assert.equal(withoutPriorSend.ok, false);
    if (withoutPriorSend.ok) return;
    assert.match(withoutPriorSend.message, /requires a prior "manual_send_logged"/);

    const send = await recordManualOutreachLog(
      {
        clinicId: clinic.id,
        outreachMessageId: message.id,
        eventType: "manual_send_logged",
        channel: "whatsapp",
        operatorName: "AB",
        occurredAt: OCCURRED_AT,
      },
      deps,
    );
    assert.equal(send.ok, true);

    const withPriorSend = await recordManualOutreachLog(
      {
        clinicId: clinic.id,
        outreachMessageId: message.id,
        eventType: "response_logged",
        channel: "whatsapp",
        operatorName: "AB",
        occurredAt: OCCURRED_AT,
        responseReceived: true,
      },
      deps,
    );
    assert.equal(withPriorSend.ok, true);
  });

  it("14. follow_up_logged requires a prior manual_send_logged for the same outreach message", async () => {
    const deps = buildDeps();
    const { clinic, message } = await seedReadyClinic(deps, "follow-up-requires-send-clinic");

    const result = await recordManualOutreachLog(
      {
        clinicId: clinic.id,
        outreachMessageId: message.id,
        eventType: "follow_up_logged",
        channel: "whatsapp",
        operatorName: "AB",
        occurredAt: OCCURRED_AT,
        followUpNeeded: true,
      },
      deps,
    );
    assert.equal(result.ok, false);
    if (result.ok) return;
    assert.match(result.message, /requires a prior "manual_send_logged"/);
  });

  it("15. no_response_logged requires a prior manual_send_logged for the same outreach message", async () => {
    const deps = buildDeps();
    const { clinic, message } = await seedReadyClinic(deps, "no-response-requires-send-clinic");

    const result = await recordManualOutreachLog(
      {
        clinicId: clinic.id,
        outreachMessageId: message.id,
        eventType: "no_response_logged",
        channel: "whatsapp",
        operatorName: "AB",
        occurredAt: OCCURRED_AT,
      },
      deps,
    );
    assert.equal(result.ok, false);
    if (result.ok) return;
    assert.match(result.message, /requires a prior "manual_send_logged"/);
  });

  it("16. rehearsal_logged succeeds with no prior send and without going through the approval gate", async () => {
    const deps = buildDeps();
    // Deliberately NOT approved — rehearsal must still work, proving the pipeline without pretending a real send happened.
    const clinic = await seedClinic(deps, "rehearsal-clinic");
    const message = await seedOutreachMessage(deps, clinic.id);

    const result = await recordManualOutreachLog(
      {
        clinicId: clinic.id,
        outreachMessageId: message.id,
        eventType: "rehearsal_logged",
        channel: "whatsapp",
        operatorName: "AB",
        occurredAt: OCCURRED_AT,
        notes: "Ensaio de pipeline — nenhum envio real ocorreu.",
      },
      deps,
    );
    assert.equal(result.ok, true);
    if (!result.ok) return;
    assert.equal(result.log.eventType, "rehearsal_logged");
    assert.equal(result.log.humanReviewDecisionId, null);
  });
});

describe("recordManualOutreachLog: append-only", () => {
  it("17. recording new events never mutates existing rows", async () => {
    const deps = buildDeps();
    const { clinic, message } = await seedReadyClinic(deps, "append-only-clinic");

    const first = await recordManualOutreachLog(
      {
        clinicId: clinic.id,
        outreachMessageId: message.id,
        eventType: "manual_send_logged",
        channel: "whatsapp",
        operatorName: "AB",
        occurredAt: OCCURRED_AT,
      },
      deps,
    );
    assert.equal(first.ok, true);
    if (!first.ok) return;
    const firstSnapshot = { ...first.log };

    await recordManualOutreachLog(
      {
        clinicId: clinic.id,
        outreachMessageId: message.id,
        eventType: "response_logged",
        channel: "whatsapp",
        operatorName: "CD",
        occurredAt: OCCURRED_AT,
        responseReceived: true,
      },
      deps,
    );

    const stillThere = deps.manualOutreachLogRepo.logs.find((l) => l.id === first.log.id);
    assert.deepEqual(stillThere, firstSnapshot);
    assert.equal(deps.manualOutreachLogRepo.logs.length, 2);
  });

  it("18. the fake repository itself is append-only and list methods filter correctly", async () => {
    const repo = new FakeManualOutreachLogRepository();
    const a = await repo.recordLog({
      clinicId: "clinic-a",
      outreachMessageId: "message-a",
      channel: "whatsapp",
      eventType: "rehearsal_logged",
      operatorName: "AB",
      occurredAt: OCCURRED_AT,
    });
    const b = await repo.recordLog({
      clinicId: "clinic-b",
      outreachMessageId: "message-b",
      channel: "email",
      eventType: "rehearsal_logged",
      operatorName: "AB",
      occurredAt: OCCURRED_AT,
    });
    assert.equal(a.ok, true);
    assert.equal(b.ok, true);
    assert.equal(repo.logs.length, 2);

    const forClinicA = await repo.listForClinic("clinic-a");
    assert.equal(forClinicA.ok, true);
    if (!forClinicA.ok) return;
    assert.equal(forClinicA.value.length, 1);
    assert.equal(forClinicA.value[0]?.clinicId, "clinic-a");

    const forMessageB = await repo.listForOutreachMessage("message-b");
    assert.equal(forMessageB.ok, true);
    if (!forMessageB.ok) return;
    assert.equal(forMessageB.value.length, 1);
    assert.equal(forMessageB.value[0]?.outreachMessageId, "message-b");
  });
});

describe("recordManualOutreachLog: production is refused", () => {
  it("20. the shared repository-selection gate refuses production regardless of --target", () => {
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

describe("record-manual-outreach-log CLI: dry-run safety", () => {
  const cliPath = join(__dirname, "..", "..", "scripts", "crawler", "record-manual-outreach-log.ts");

  it("21. dry-run (the default) prints what would be recorded and inserts nothing — refused with no persistence configured, never crashes trying to write", () => {
    const output = execFileSync(
      "npx",
      [
        "tsx",
        cliPath,
        "--target",
        "local",
        "--clinic-id",
        "does-not-exist",
        "--outreach-message-id",
        "does-not-exist",
        "--event-type",
        "manual_send_logged",
        "--channel",
        "whatsapp",
        "--operator-name",
        "AB",
        "--occurred-at",
        OCCURRED_AT,
      ],
      { encoding: "utf8" },
    );
    const parsed = JSON.parse(output);
    assert.equal(parsed.dryRun, true);
    assert.match(parsed.note, /Nothing was inserted/);
  });

  it("22. --dry-run false with an unconfigured target still never inserts — it fails closed (REFUSED), not open", () => {
    let threw = false;
    try {
      execFileSync(
        "npx",
        [
          "tsx",
          cliPath,
          "--target",
          "local",
          "--clinic-id",
          "does-not-exist",
          "--outreach-message-id",
          "does-not-exist",
          "--event-type",
          "manual_send_logged",
          "--channel",
          "whatsapp",
          "--operator-name",
          "AB",
          "--occurred-at",
          OCCURRED_AT,
          "--dry-run",
          "false",
        ],
        { encoding: "utf8", stdio: ["ignore", "ignore", "pipe"] },
      );
    } catch (error) {
      threw = true;
      const stderr = (error as { stderr?: string }).stderr ?? "";
      assert.match(stderr, /clinic_not_found|FAILED|BLOCKED|REFUSED/);
    }
    assert.equal(threw, true, "expected the CLI to exit non-zero rather than silently succeed against a non-existent clinic");
  });
});

describe("recordManualOutreachLog: no send path, no copy mutation, no decision mutation", () => {
  it("23. no send-capable repository method is ever called by recordManualOutreachLog", async () => {
    const deps = buildDeps();
    const { clinic, message } = await seedReadyClinic(deps, "no-send-path-clinic");

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
    deps.outreachRepo.createDraft = (async (draftInput: Parameters<typeof originalCreateDraft>[0]) => {
      createDraftCalled = true;
      return originalCreateDraft(draftInput);
    }) as typeof deps.outreachRepo.createDraft;

    const result = await recordManualOutreachLog(
      {
        clinicId: clinic.id,
        outreachMessageId: message.id,
        eventType: "manual_send_logged",
        channel: "whatsapp",
        operatorName: "AB",
        occurredAt: OCCURRED_AT,
      },
      deps,
    );
    assert.equal(result.ok, true);
    assert.equal(markSentCalled, false);
    assert.equal(approveCalled, false);
    assert.equal(createDraftCalled, false);
  });

  it("24. the outreach message's own body/subject are never mutated by logging", async () => {
    const deps = buildDeps();
    const { clinic, message } = await seedReadyClinic(deps, "no-copy-mutation-clinic");
    const bodyBefore = message.body;
    const subjectBefore = message.subject;

    await recordManualOutreachLog(
      {
        clinicId: clinic.id,
        outreachMessageId: message.id,
        eventType: "manual_send_logged",
        channel: "whatsapp",
        operatorName: "AB",
        occurredAt: OCCURRED_AT,
      },
      deps,
    );

    const after = await deps.outreachRepo.getMessage(message.id);
    assert.equal(after.ok, true);
    if (!after.ok) return;
    assert.equal(after.value.body, bodyBefore);
    assert.equal(after.value.subject, subjectBefore);
    assert.equal(after.value.status, "draft");
  });

  it("25. no human review decision is ever mutated or created by logging (manual_send_logged, response_logged, or rehearsal_logged)", async () => {
    const deps = buildDeps();
    const { clinic, message } = await seedReadyClinic(deps, "no-decision-mutation-clinic");
    const decisionsBefore = deps.humanReviewRepo.decisions.length;

    await recordManualOutreachLog(
      {
        clinicId: clinic.id,
        outreachMessageId: message.id,
        eventType: "manual_send_logged",
        channel: "whatsapp",
        operatorName: "AB",
        occurredAt: OCCURRED_AT,
      },
      deps,
    );
    await recordManualOutreachLog(
      {
        clinicId: clinic.id,
        outreachMessageId: message.id,
        eventType: "response_logged",
        channel: "whatsapp",
        operatorName: "AB",
        occurredAt: OCCURRED_AT,
        responseReceived: true,
      },
      deps,
    );

    assert.equal(deps.humanReviewRepo.decisions.length, decisionsBefore);

    // rehearsal_logged on a separate, unapproved clinic must also never create a decision.
    const rehearsalClinic = await seedClinic(deps, "rehearsal-no-decision-clinic");
    const rehearsalMessage = await seedOutreachMessage(deps, rehearsalClinic.id);
    await recordManualOutreachLog(
      {
        clinicId: rehearsalClinic.id,
        outreachMessageId: rehearsalMessage.id,
        eventType: "rehearsal_logged",
        channel: "whatsapp",
        operatorName: "AB",
        occurredAt: OCCURRED_AT,
      },
      deps,
    );
    const rehearsalDecisions = await deps.humanReviewRepo.listDecisionsForClinic(rehearsalClinic.id);
    assert.equal(rehearsalDecisions.ok, true);
    if (!rehearsalDecisions.ok) return;
    assert.equal(rehearsalDecisions.value.length, 0);
  });
});

describe("recordManualOutreachLog: do_not_contact_logged side effect", () => {
  it("do_not_contact_logged always inserts the append-only log, and additionally sets clinic.doNotContact using the existing, already-tested setDoNotContact method", async () => {
    const deps = buildDeps();
    const { clinic, message } = await seedReadyClinic(deps, "dnc-logged-side-effect-clinic");
    assert.equal((await deps.clinicRepo.getClinic(clinic.id)).ok && (await deps.clinicRepo.getClinic(clinic.id)).ok, true);

    const result = await recordManualOutreachLog(
      {
        clinicId: clinic.id,
        outreachMessageId: message.id,
        eventType: "do_not_contact_logged",
        channel: "whatsapp",
        operatorName: "AB",
        occurredAt: OCCURRED_AT,
        notes: "Clínica pediu para não ser mais contatada.",
      },
      deps,
    );
    assert.equal(result.ok, true);
    if (!result.ok) return;
    assert.equal(result.sideEffects.doNotContactUpdated, true);

    const updatedClinic = await deps.clinicRepo.getClinic(clinic.id);
    assert.equal(updatedClinic.ok, true);
    if (!updatedClinic.ok) return;
    assert.equal(updatedClinic.value.doNotContact, true);
    assert.match(updatedClinic.value.doNotContactReason ?? "", /não ser mais contatada/);
  });
});

describe("listManualOutreachLogs", () => {
  it("lists logs for a clinic and for a specific outreach message, read-only", async () => {
    const deps = buildDeps();
    const { clinic, message } = await seedReadyClinic(deps, "list-logs-clinic");
    await recordManualOutreachLog(
      {
        clinicId: clinic.id,
        outreachMessageId: message.id,
        eventType: "rehearsal_logged",
        channel: "whatsapp",
        operatorName: "AB",
        occurredAt: OCCURRED_AT,
      },
      deps,
    );

    const byClinic = await listManualOutreachLogs({ clinicId: clinic.id }, deps);
    assert.equal(byClinic.ok, true);
    if (!byClinic.ok) return;
    assert.equal(byClinic.logs.length, 1);

    const byMessage = await listManualOutreachLogs({ outreachMessageId: message.id }, deps);
    assert.equal(byMessage.ok, true);
    if (!byMessage.ok) return;
    assert.equal(byMessage.logs.length, 1);

    const missingBoth = await listManualOutreachLogs({}, deps);
    assert.equal(missingBoth.ok, false);
  });
});
