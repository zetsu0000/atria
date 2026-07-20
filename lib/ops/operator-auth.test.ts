import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  isEmailAllowlisted,
  requireOperator,
} from "./operator-auth";

describe("operator-auth", () => {
  it("blocks when auth is not configured", async () => {
    const result = await requireOperator({
      env: {
        supabaseUrl: null,
        supabaseAnonKey: null,
        operatorEmails: [],
      },
      accessToken: "token",
    });
    assert.equal(result.ok, false);
    if (!result.ok) assert.equal(result.reason, "not_configured");
  });

  it("blocks unauthenticated access", async () => {
    const result = await requireOperator({
      env: {
        supabaseUrl: "https://example.supabase.co",
        supabaseAnonKey: "anon",
        operatorEmails: ["ops@example.com"],
      },
      accessToken: null,
    });
    assert.equal(result.ok, false);
    if (!result.ok) assert.equal(result.reason, "unauthenticated");
  });

  it("blocks users outside the allow-list", async () => {
    const result = await requireOperator({
      env: {
        supabaseUrl: "https://example.supabase.co",
        supabaseAnonKey: "anon",
        operatorEmails: ["ops@example.com"],
      },
      accessToken: "valid-token",
      resolveUser: async () => ({
        id: "user-1",
        email: "other@example.com",
      }),
    });
    assert.equal(result.ok, false);
    if (!result.ok) assert.equal(result.reason, "forbidden");
  });

  it("allows allow-listed operators", async () => {
    const result = await requireOperator({
      env: {
        supabaseUrl: "https://example.supabase.co",
        supabaseAnonKey: "anon",
        operatorEmails: ["ops@example.com"],
      },
      accessToken: "valid-token",
      resolveUser: async () => ({
        id: "user-1",
        email: "OPS@example.com",
      }),
    });
    assert.equal(result.ok, true);
    if (result.ok) {
      assert.equal(result.operator.email, "ops@example.com");
      assert.equal(result.operator.userId, "user-1");
    }
  });

  it("matches allow-list emails case-insensitively", () => {
    assert.equal(
      isEmailAllowlisted("Ops@Example.com", ["ops@example.com"]),
      true,
    );
    assert.equal(isEmailAllowlisted(null, ["ops@example.com"]), false);
  });
});
