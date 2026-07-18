import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { LeadCaptureEnv } from "@/lib/security/env";
import { submitLeadWithDependencies } from "./submit-lead-core";
import type { SubmitLeadDependencies } from "./submit-lead-core";

const configuredEnv: LeadCaptureEnv = {
  supabaseUrl: "https://example.supabase.co",
  supabaseServiceRoleKey: "service-role",
  resendApiKey: "re_test",
  leadNotificationEmail: "ops@example.com",
  leadFromEmail: "Atria <leads@example.com>",
  turnstileSiteKey: "site",
  turnstileSecretKey: "secret",
  leadHashSecret: "hash-secret-for-tests",
  siteUrl: "http://localhost:3000",
};

const validPayload = {
  name: "Ana Silva",
  clinic: "Clínica Horizonte",
  role: "gestor",
  location: "Campinas / SP",
  siteUrl: "https://www.clinica-horizonte.example",
  whatsapp: "19988887777",
  email: "ana.silva@example.com",
  concern: "",
  consent: "on",
  turnstileToken: "token-ok",
  source: "landing-solicitar",
};

function createDeps(
  overrides: Partial<SubmitLeadDependencies> = {},
): SubmitLeadDependencies {
  return {
    env: configuredEnv,
    getClientIp: () => "203.0.113.10",
    checkRateLimit: () => ({ allowed: true }),
    verifyTurnstile: async () => ({ ok: true, mode: "verified" }),
    findRecentDuplicate: async () => "clear",
    persistLead: async () => ({
      ok: true,
      leadId: "lead-123",
      duplicate: false,
    }),
    notifyLeadReceived: async () => ({ ok: true, mode: "sent" }),
    markNotificationStatus: async () => undefined,
    now: () => new Date("2026-07-18T12:00:00.000Z"),
    ...overrides,
  };
}

describe("submitLeadWithDependencies", () => {
  it("returns success for a valid normalized payload", async () => {
    const result = await submitLeadWithDependencies(
      validPayload,
      createDeps(),
    );
    assert.equal(result.status, "success");
    if (result.status !== "success") return;
    assert.equal(result.leadId, "lead-123");
    assert.match(result.message, /recebida/i);
  });

  it("returns duplicate for a repeated payload window hit", async () => {
    const result = await submitLeadWithDependencies(
      validPayload,
      createDeps({
        findRecentDuplicate: async () => "duplicate",
      }),
    );
    assert.equal(result.status, "duplicate");
  });

  it("returns spam_rejected for invalid Turnstile verification", async () => {
    const result = await submitLeadWithDependencies(
      validPayload,
      createDeps({
        verifyTurnstile: async () => ({ ok: false, reason: "rejected" }),
      }),
    );
    assert.equal(result.status, "spam_rejected");
  });

  it("returns configuration_error when Turnstile is missing in production mode", async () => {
    const result = await submitLeadWithDependencies(
      validPayload,
      createDeps({
        verifyTurnstile: async () => ({ ok: false, reason: "configuration" }),
      }),
    );
    assert.equal(result.status, "configuration_error");
    if (result.status !== "configuration_error") return;
    assert.match(result.message, /WhatsApp|disponível|mais tarde/i);
  });

  it("returns configuration_error when persistence is unavailable", async () => {
    const result = await submitLeadWithDependencies(
      validPayload,
      createDeps({
        env: {
          ...configuredEnv,
          supabaseUrl: null,
          supabaseServiceRoleKey: null,
        },
      }),
    );
    assert.equal(result.status, "configuration_error");
    if (result.status !== "configuration_error") return;
    assert.notEqual(result.status, "success");
  });

  it("returns service_unavailable when Supabase persistence fails", async () => {
    const result = await submitLeadWithDependencies(
      validPayload,
      createDeps({
        persistLead: async () => ({ ok: false, reason: "unavailable" }),
      }),
    );
    assert.equal(result.status, "service_unavailable");
    if (result.status !== "service_unavailable") return;
    assert.doesNotMatch(JSON.stringify(result), /supabase|postgres|SELECT/i);
  });

  it("does not pass the Turnstile token into persistence", async () => {
    let storedToken: string | null | undefined = "unset";
    const result = await submitLeadWithDependencies(
      validPayload,
      createDeps({
        persistLead: async (payload) => {
          storedToken = payload.lead.turnstileToken;
          return { ok: true, leadId: "lead-123", duplicate: false };
        },
      }),
    );
    assert.equal(result.status, "success");
    assert.equal(storedToken, null);
  });

  it("keeps success when notification fails after persistence", async () => {
    const statuses: string[] = [];
    const result = await submitLeadWithDependencies(
      validPayload,
      createDeps({
        notifyLeadReceived: async () => ({ ok: false, reason: "failed" }),
        markNotificationStatus: async (_id, status) => {
          statuses.push(status);
        },
      }),
    );
    assert.equal(result.status, "success");
    assert.deepEqual(statuses, ["failed"]);
  });

  it("returns a safe structured server_error without leaking details", async () => {
    const result = await submitLeadWithDependencies(
      validPayload,
      createDeps({
        persistLead: async () => {
          throw new Error("SELECT * FROM secrets WHERE key = 'x'");
        },
      }),
    );
    assert.equal(result.status, "server_error");
    if (result.status !== "server_error") return;
    assert.equal(
      result.message,
      "Não foi possível concluir o envio. Tente novamente em instantes.",
    );
    assert.equal("stack" in result, false);
    assert.doesNotMatch(JSON.stringify(result), /SELECT|secrets/i);
  });

  it("returns rate_limited when the adapter blocks the key", async () => {
    const result = await submitLeadWithDependencies(
      validPayload,
      createDeps({
        checkRateLimit: () => ({ allowed: false, retryAfterSeconds: 60 }),
      }),
    );
    assert.equal(result.status, "rate_limited");
  });
});
