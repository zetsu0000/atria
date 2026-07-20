import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  assertOutreachNotAutoSent,
  buildOutreachDraft,
  markOutreachApproved,
} from "./draft";

describe("outreach draft foundation", () => {
  it("builds an email draft with evidence and status draft", () => {
    const result = buildOutreachDraft({
      clinicDisplayName: "Clínica Fixture",
      channel: "email",
      observations: [
        {
          observation: "CTA de contato pouco visível no hero público.",
          sourceUrl: "https://fixture.example/",
        },
      ],
    });
    assert.equal(result.ok, true);
    if (!result.ok) return;
    assert.equal(result.draft.status, "draft");
    assert.equal(result.draft.humanReviewed, false);
    assert.ok(result.draft.body.includes("Clínica Fixture"));
    assert.equal(result.draft.evidence.length, 1);
  });

  it("builds whatsapp click-to-chat draft without sending", () => {
    const result = buildOutreachDraft({
      clinicDisplayName: "Clínica Fixture",
      channel: "whatsapp_manual",
      whatsappDigits: "551198887766",
      observations: [{ observation: "Site móvel com texto truncado no header." }],
    });
    assert.equal(result.ok, true);
    if (!result.ok) return;
    assert.ok(result.draft.clickToChatUrl?.startsWith("https://wa.me/"));
    assert.equal(result.draft.status, "draft");
  });

  it("blocks drafts when do_not_contact is set", () => {
    const result = buildOutreachDraft({
      clinicDisplayName: "X",
      channel: "email",
      doNotContact: true,
      observations: [{ observation: "x" }],
    });
    assert.equal(result.ok, false);
  });

  it("requires human review before sent status", () => {
    const built = buildOutreachDraft({
      clinicDisplayName: "X",
      channel: "email",
      observations: [{ observation: "y" }],
    });
    assert.equal(built.ok, true);
    if (!built.ok) return;
    assert.throws(() =>
      assertOutreachNotAutoSent({ ...built.draft, status: "sent" }),
    );
    const approved = markOutreachApproved(built.draft);
    assert.equal(approved.ok, true);
    if (!approved.ok) return;
    assert.equal(approved.draft.status, "approved");
    assert.equal(approved.draft.humanReviewed, true);
  });
});
