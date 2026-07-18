import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { parseLeadInput } from "./schema";

const validPayload = {
  name: "  Ana Silva  ",
  clinic: " Clínica Horizonte ",
  role: "gestor",
  location: "Campinas / SP",
  siteUrl: "https://www.clinica-horizonte.example",
  whatsapp: "(19) 98888-7777",
  email: "Ana.Silva@Example.com",
  concern: "  O menu móvel está confuso.  ",
  consent: "on",
  source: "landing-solicitar",
};

describe("parseLeadInput", () => {
  it("accepts and normalizes a valid payload", () => {
    const result = parseLeadInput(validPayload);
    assert.equal(result.ok, true);
    if (!result.ok) return;

    assert.equal(result.data.contactName, "Ana Silva");
    assert.equal(result.data.clinicName, "Clínica Horizonte");
    assert.equal(result.data.email, "ana.silva@example.com");
    assert.equal(result.data.whatsapp, "19988887777");
    assert.equal(result.data.concern, "O menu móvel está confuso.");
    assert.equal(result.data.consent, true);
    assert.equal(
      result.data.websiteUrl,
      "https://www.clinica-horizonte.example/",
    );
  });

  it("rejects missing consent", () => {
    const result = parseLeadInput({ ...validPayload, consent: false });
    assert.equal(result.ok, false);
    if (result.ok) return;
    assert.match(result.fieldErrors.consent ?? "", /consentimento|contato/i);
  });

  it("rejects invalid e-mail", () => {
    const result = parseLeadInput({ ...validPayload, email: "not-an-email" });
    assert.equal(result.ok, false);
    if (result.ok) return;
    assert.equal(result.fieldErrors.email, "Informe um e-mail válido.");
  });

  it("rejects invalid URL", () => {
    const result = parseLeadInput({ ...validPayload, siteUrl: "notaurl" });
    assert.equal(result.ok, false);
    if (result.ok) return;
    assert.match(result.fieldErrors.siteUrl ?? "", /http/i);
  });

  it("rejects invalid WhatsApp", () => {
    const result = parseLeadInput({ ...validPayload, whatsapp: "123" });
    assert.equal(result.ok, false);
    if (result.ok) return;
    assert.match(result.fieldErrors.whatsapp ?? "", /DDD|WhatsApp/i);
  });

  it("rejects excessive field length", () => {
    const result = parseLeadInput({
      ...validPayload,
      name: "A".repeat(121),
    });
    assert.equal(result.ok, false);
    if (result.ok) return;
    assert.equal(result.fieldErrors.name, "Use um nome mais curto.");
  });

  it("rejects unexpected fields", () => {
    const result = parseLeadInput({
      ...validPayload,
      patientName: "should-not-pass",
    });
    assert.equal(result.ok, false);
    if (result.ok) return;
    assert.match(result.fieldErrors.form ?? "", /inválido/i);
  });

  it("allows empty optional concern", () => {
    const result = parseLeadInput({ ...validPayload, concern: "   " });
    assert.equal(result.ok, true);
    if (!result.ok) return;
    assert.equal(result.data.concern, null);
  });
});
