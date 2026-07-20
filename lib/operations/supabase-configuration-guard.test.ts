import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { LeadCaptureEnv } from "@/lib/security/env";
import { createSupabaseDiscoveryRepository } from "./supabase/discovery-repository.supabase";
import { createSupabaseClinicRepository } from "./supabase/clinic-repository.supabase";
import { createSupabaseCrawlRepository } from "./supabase/crawl-repository.supabase";
import { createSupabaseExtractionRepository } from "./supabase/extraction-repository.supabase";
import { createSupabaseScoreRepository } from "./supabase/score-repository.supabase";
import { createSupabaseOutreachRepository } from "./supabase/outreach-repository.supabase";
import { calculatePlaceholderScore } from "@/lib/score/calculate";
import { buildOutreachDraft } from "@/lib/outreach/draft";

/**
 * These tests never construct a real Supabase client and never touch the
 * network: `unconfiguredEnv` has no Supabase URL/key, so every adapter must
 * short-circuit to a "configuration" error before attempting any request.
 * This proves the adapters fail safely with no credentials present, which
 * is also the state real CI/test runs are in.
 */
const unconfiguredEnv: LeadCaptureEnv = {
  supabaseUrl: null,
  supabaseServiceRoleKey: null,
  resendApiKey: null,
  leadNotificationEmail: null,
  leadFromEmail: null,
  turnstileSiteKey: null,
  turnstileSecretKey: null,
  leadHashSecret: null,
  siteUrl: null,
};

describe("Supabase adapters — configuration guard (no live Supabase, no credentials)", () => {
  it("DiscoveryRepository returns configuration errors without a network call", async () => {
    const repo = createSupabaseDiscoveryRepository(unconfiguredEnv);
    const result = await repo.createDiscoveryJob({ sourceType: "manual" });
    assert.equal(result.ok, false);
    if (result.ok) return;
    assert.equal(result.reason, "configuration");
  });

  it("ClinicRepository returns configuration errors without a network call", async () => {
    const repo = createSupabaseClinicRepository(unconfiguredEnv);
    const result = await repo.getClinic("clinic-1");
    assert.equal(result.ok, false);
    if (result.ok) return;
    assert.equal(result.reason, "configuration");
  });

  it("CrawlRepository returns configuration errors without a network call", async () => {
    const repo = createSupabaseCrawlRepository(unconfiguredEnv);
    const result = await repo.createCrawlJob({
      leadId: "lead-1",
      requestedUrl: "https://clinic.example.com/",
      normalizedOrigin: "https://clinic.example.com",
    });
    assert.equal(result.ok, false);
    if (result.ok) return;
    assert.equal(result.reason, "configuration");
  });

  it("CrawlRepository rejects a missing leadId+clinicId as a validation error before checking configuration", async () => {
    const repo = createSupabaseCrawlRepository(unconfiguredEnv);
    const result = await repo.createCrawlJob({
      requestedUrl: "https://clinic.example.com/",
      normalizedOrigin: "https://clinic.example.com",
    });
    assert.equal(result.ok, false);
    if (result.ok) return;
    // Validation happens before the configuration check — this proves the
    // lead-or-clinic guard runs in application code, not just as a DB
    // constraint, and does so without needing Supabase credentials.
    assert.equal(result.reason, "validation");
  });

  it("CrawlRepository accepts a clinicId-only job (no leadId, no live Supabase)", async () => {
    const repo = createSupabaseCrawlRepository(unconfiguredEnv);
    const result = await repo.createCrawlJob({
      clinicId: "clinic-1",
      requestedUrl: "https://clinic.example.com/",
      normalizedOrigin: "https://clinic.example.com",
    });
    assert.equal(result.ok, false);
    if (result.ok) return;
    // Passes the lead-or-clinic validation and only then hits the
    // (expected, in this unconfigured-env test) configuration guard.
    assert.equal(result.reason, "configuration");
  });

  it("ExtractionRepository returns configuration errors without a network call", async () => {
    const repo = createSupabaseExtractionRepository(unconfiguredEnv);
    const result = await repo.saveExtractedContent({
      crawlJobId: "crawl-1",
      schemaVersion: "extraction-candidates-v1",
      candidates: [],
    });
    assert.equal(result.ok, false);
    if (result.ok) return;
    assert.equal(result.reason, "configuration");
  });

  it("ScoreRepository returns configuration errors without a network call", async () => {
    const repo = createSupabaseScoreRepository(unconfiguredEnv);
    const score = calculatePlaceholderScore({ candidates: [], pageCount: 0 });
    const result = await repo.saveScore({ crawlJobId: "crawl-1", score });
    assert.equal(result.ok, false);
    if (result.ok) return;
    assert.equal(result.reason, "configuration");
  });

  it("OutreachRepository returns configuration errors without a network call", async () => {
    const repo = createSupabaseOutreachRepository(unconfiguredEnv);
    const built = buildOutreachDraft({
      clinicDisplayName: "Clínica Exemplo",
      channel: "email",
      observations: [{ observation: "Sem página de contato clara." }],
    });
    if (!built.ok) return assert.fail();
    const result = await repo.createDraft({ clinicId: "clinic-1", draft: built.draft, doNotContact: false });
    assert.equal(result.ok, false);
    if (result.ok) return;
    assert.equal(result.reason, "configuration");
  });
});
