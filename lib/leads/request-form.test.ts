import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  prepareLeadFormData,
  TURNSTILE_REQUIRED_MESSAGE,
  validateRequestForm,
} from "./request-form";

function createValidFormData(): FormData {
  const formData = new FormData();
  formData.set("name", "Ana Silva");
  formData.set("clinic", "Clínica Horizonte");
  formData.set("role", "gestor");
  formData.set("location", "Campinas / SP");
  formData.set("siteUrl", "https://clinica-horizonte.example");
  formData.set("whatsapp", "19988887777");
  formData.set("email", "ana@example.com");
  formData.set("consent", "on");
  return formData;
}

describe("request form submission preparation", () => {
  it("removes Cloudflare's injected field from the Server Action payload", () => {
    const formData = createValidFormData();
    formData.set("cf-turnstile-response", "cloudflare-managed-token");

    const prepared = prepareLeadFormData(formData, {
      turnstileConfigured: true,
      turnstileToken: "controlled-token",
    });

    assert.equal(prepared.has("cf-turnstile-response"), false);
  });

  it("preserves the controlled Turnstile token in the Server Action payload", () => {
    const prepared = prepareLeadFormData(createValidFormData(), {
      turnstileConfigured: true,
      turnstileToken: "controlled-token",
    });

    assert.equal(prepared.get("turnstileToken"), "controlled-token");
    assert.equal(prepared.get("source"), "landing-solicitar");
  });

  it("blocks submission when Turnstile is configured without a token", () => {
    const errors = validateRequestForm(createValidFormData(), {
      turnstileConfigured: true,
      turnstileToken: null,
    });

    assert.equal(errors.turnstileToken, TURNSTILE_REQUIRED_MESSAGE);
    assert.equal(Object.keys(errors).length, 1);
  });

  it("does not require a token when Turnstile is not configured", () => {
    const errors = validateRequestForm(createValidFormData(), {
      turnstileConfigured: false,
      turnstileToken: null,
    });

    assert.equal(errors.turnstileToken, undefined);
    assert.equal(Object.keys(errors).length, 0);
  });

  it("accepts a bare domain for siteUrl and normalizes https://", () => {
    const formData = createValidFormData();
    formData.set("siteUrl", "www.suaclinica.com.br");

    const errors = validateRequestForm(formData, {
      turnstileConfigured: false,
      turnstileToken: null,
    });
    assert.equal(errors.siteUrl, undefined);

    const prepared = prepareLeadFormData(formData, {
      turnstileConfigured: false,
      turnstileToken: null,
    });
    assert.equal(prepared.get("siteUrl"), "https://www.suaclinica.com.br/");
  });

  it("rejects an implausible siteUrl without inventing a protocol requirement message", () => {
    const formData = createValidFormData();
    formData.set("siteUrl", "clinica");

    const errors = validateRequestForm(formData, {
      turnstileConfigured: false,
      turnstileToken: null,
    });
    assert.match(errors.siteUrl ?? "", /site válido/i);
    assert.doesNotMatch(errors.siteUrl ?? "", /http:\/\/ ou https:\/\//i);
  });
});
