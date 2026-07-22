import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { runOperatorPreflight } from "./pipeline/operator-preflight";
import { KNOWN_PROJECT_REFS } from "./pipeline/target-guard";

const FULLY_CONFIGURED_STAGING = {
  target: "staging" as const,
  supabaseUrl: `https://${KNOWN_PROJECT_REFS.staging}.supabase.co`,
  hasSupabaseServiceRoleKey: true,
  hasLeadHashSecret: true,
  hasGooglePlacesApiKey: true,
  hasScreenshotStorageBucket: true,
};

describe("runOperatorPreflight", () => {
  it("is ready when target, production guard, and persistence config all check out", () => {
    const result = runOperatorPreflight(FULLY_CONFIGURED_STAGING);
    assert.equal(result.overallStatus, "ready");
    assert.ok(result.checks.every((c) => c.status !== "blocked"));
  });

  it("blocks when --target is missing or invalid", () => {
    const result = runOperatorPreflight({ ...FULLY_CONFIGURED_STAGING, target: undefined });
    assert.equal(result.overallStatus, "blocked");
    const targetCheck = result.checks.find((c) => c.id === "target");
    assert.equal(targetCheck?.status, "blocked");
  });

  it("blocks when SUPABASE_URL resolves to the production project, regardless of --target", () => {
    const result = runOperatorPreflight({
      ...FULLY_CONFIGURED_STAGING,
      supabaseUrl: `https://${KNOWN_PROJECT_REFS.production}.supabase.co`,
    });
    assert.equal(result.overallStatus, "blocked");
    const guardCheck = result.checks.find((c) => c.id === "production_guard");
    assert.equal(guardCheck?.status, "blocked");
    assert.match(guardCheck!.detail, /production/);
  });

  it("blocks when --target staging is claimed but SUPABASE_URL doesn't resolve to the known staging ref", () => {
    const result = runOperatorPreflight({
      ...FULLY_CONFIGURED_STAGING,
      supabaseUrl: "https://some-other-project.supabase.co",
    });
    assert.equal(result.overallStatus, "blocked");
    const guardCheck = result.checks.find((c) => c.id === "production_guard");
    assert.equal(guardCheck?.status, "blocked");
  });

  it("--target local passes the production guard even with no SUPABASE_URL configured at all", () => {
    const result = runOperatorPreflight({
      ...FULLY_CONFIGURED_STAGING,
      target: "local",
      supabaseUrl: null,
      hasSupabaseServiceRoleKey: false,
      hasLeadHashSecret: false,
    });
    const guardCheck = result.checks.find((c) => c.id === "production_guard");
    assert.equal(guardCheck?.status, "ok");
    // But persistence config is still blocked without the env vars — overall stays blocked.
    assert.equal(result.overallStatus, "blocked");
    const persistenceCheck = result.checks.find((c) => c.id === "persistence_config");
    assert.equal(persistenceCheck?.status, "blocked");
  });

  it("blocks when any of SUPABASE_SERVICE_ROLE_KEY / LEAD_HASH_SECRET is missing, even with a valid SUPABASE_URL", () => {
    const result = runOperatorPreflight({ ...FULLY_CONFIGURED_STAGING, hasLeadHashSecret: false });
    assert.equal(result.overallStatus, "blocked");
    const persistenceCheck = result.checks.find((c) => c.id === "persistence_config");
    assert.equal(persistenceCheck?.status, "blocked");
  });

  it("missing GOOGLE_PLACES_API_KEY is a warning, not a blocker", () => {
    const result = runOperatorPreflight({ ...FULLY_CONFIGURED_STAGING, hasGooglePlacesApiKey: false });
    assert.equal(result.overallStatus, "ready");
    const check = result.checks.find((c) => c.id === "google_places_config");
    assert.equal(check?.status, "warning");
  });

  it("missing SCREENSHOT_STORAGE_BUCKET is a warning, not a blocker", () => {
    const result = runOperatorPreflight({ ...FULLY_CONFIGURED_STAGING, hasScreenshotStorageBucket: false });
    assert.equal(result.overallStatus, "ready");
    const check = result.checks.find((c) => c.id === "screenshot_storage_config");
    assert.equal(check?.status, "warning");
  });

  it("never includes a raw secret value anywhere in the result — only booleans/labels/detail strings go in", () => {
    const result = runOperatorPreflight(FULLY_CONFIGURED_STAGING);
    const serialized = JSON.stringify(result);
    assert.doesNotMatch(serialized, /eyJ/); // no JWT-shaped service role key ever appears
  });

  it("result shape is stable and JSON-serializable", () => {
    const result = runOperatorPreflight(FULLY_CONFIGURED_STAGING);
    const roundTripped = JSON.parse(JSON.stringify(result));
    assert.deepEqual(Object.keys(roundTripped).sort(), ["checks", "overallStatus"]);
    for (const check of roundTripped.checks) {
      assert.deepEqual(Object.keys(check).sort(), ["detail", "id", "label", "status"]);
    }
  });
});
