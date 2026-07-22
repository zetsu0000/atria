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

const MANY_OBSERVATIONS = Array.from({ length: 17 }, (_, i) => ({
  observation: `Observação de evidência número ${i + 1} extraída do site público, bem detalhada e específica.`,
  sourceUrl: "https://www.skinlaser.com.br/",
}));

describe("outreach draft copy: short, human, non-spammy first contact", () => {
  it("email body stays short even with many observations — no per-observation bullet dump", () => {
    const result = buildOutreachDraft({
      clinicDisplayName: "SkinLaser - Higienopolis",
      channel: "email",
      observations: MANY_OBSERVATIONS,
    });
    assert.equal(result.ok, true);
    if (!result.ok) return;
    assert.ok(result.draft.body.length < 500, `body too long: ${result.draft.body.length} chars`);
    for (const o of MANY_OBSERVATIONS) {
      assert.ok(!result.draft.body.includes(o.observation), "body must not enumerate raw evidence text");
    }
  });

  it("whatsapp body stays short even with many observations — no per-observation bullet dump", () => {
    const result = buildOutreachDraft({
      clinicDisplayName: "SkinLaser - Higienopolis",
      channel: "whatsapp_manual",
      whatsappDigits: "5511900000000",
      observations: MANY_OBSERVATIONS,
    });
    assert.equal(result.ok, true);
    if (!result.ok) return;
    assert.ok(result.draft.body.length < 400, `body too long: ${result.draft.body.length} chars`);
    for (const o of MANY_OBSERVATIONS) {
      assert.ok(!result.draft.body.includes(o.observation), "body must not enumerate raw evidence text");
    }
  });

  it("full evidence is still preserved verbatim in draft.evidence, even though the body doesn't list it", () => {
    const result = buildOutreachDraft({
      clinicDisplayName: "SkinLaser - Higienopolis",
      channel: "email",
      observations: MANY_OBSERVATIONS,
    });
    assert.equal(result.ok, true);
    if (!result.ok) return;
    assert.equal(result.draft.evidence.length, MANY_OBSERVATIONS.length);
    assert.deepEqual(
      result.draft.evidence.map((e) => e.observation),
      MANY_OBSERVATIONS.map((o) => o.observation),
    );
  });

  it("contains the required soft-open phrasing (raio-X, disclaimer-adjacent, soft CTA)", () => {
    for (const channel of ["email", "whatsapp_manual"] as const) {
      const result = buildOutreachDraft({
        clinicDisplayName: "SkinLaser - Higienopolis",
        channel,
        whatsappDigits: channel === "whatsapp_manual" ? "5511900000000" : undefined,
        observations: [{ observation: "Telefone e e-mail públicos encontrados." }],
      });
      assert.equal(result.ok, true);
      if (!result.ok) return;
      assert.match(result.draft.body, /raio-X/i);
      assert.match(result.draft.body, /não avalia qualidade médica/i);
      assert.match(result.draft.body, /resumo/i);
    }
  });

  it("never contains pressure/spam language, automated-send language, score numbers, or screenshot mentions", () => {
    for (const channel of ["email", "whatsapp_manual"] as const) {
      const result = buildOutreachDraft({
        clinicDisplayName: "SkinLaser - Higienopolis",
        channel,
        whatsappDigits: channel === "whatsapp_manual" ? "5511900000000" : undefined,
        observations: MANY_OBSERVATIONS,
      });
      assert.equal(result.ok, true);
      if (!result.ok) return;
      const body = result.draft.body.toLowerCase();
      for (const forbidden of [
        "urgente",
        "última chance",
        "por tempo limitado",
        "imperdível",
        "aproveite",
        "não perca",
        "enviado automaticamente",
        "mensagem automática",
        "screenshot",
        "score",
        "/100",
        "qualidade médica boa",
        "qualidade médica ruim",
      ]) {
        assert.doesNotMatch(body, new RegExp(forbidden), `unexpected phrase "${forbidden}" in ${channel} body`);
      }
    }
  });

  it("never diagnoses the clinic or claims the site is bad — stays neutral/observational", () => {
    const result = buildOutreachDraft({
      clinicDisplayName: "SkinLaser - Higienopolis",
      channel: "email",
      observations: MANY_OBSERVATIONS,
    });
    assert.equal(result.ok, true);
    if (!result.ok) return;
    const body = result.draft.body.toLowerCase();
    for (const forbidden of ["ruim", "péssimo", "fraco", "problema grave", "perdendo pacientes", "perdendo clientes"]) {
      assert.doesNotMatch(body, new RegExp(forbidden), `unexpected diagnostic/negative phrase: ${forbidden}`);
    }
  });
});
