import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { hasPersistenceConfig, readLeadCaptureEnv } from "@/lib/security/env";
import { getOperationsServiceClient } from "./supabase/server-client";
import { createSupabaseDiscoveryRepository } from "./supabase/discovery-repository.supabase";
import { createSupabaseClinicRepository } from "./supabase/clinic-repository.supabase";
import { createSupabaseCrawlRepository } from "./supabase/crawl-repository.supabase";
import { createSupabaseExtractionRepository } from "./supabase/extraction-repository.supabase";
import { createSupabaseScoreRepository } from "./supabase/score-repository.supabase";
import { createSupabaseOutreachRepository } from "./supabase/outreach-repository.supabase";
import { promoteCandidateToClinic } from "./promote-candidate";
import { calculatePlaceholderScore } from "@/lib/score/calculate";
import { buildOutreachDraft } from "@/lib/outreach/draft";
import type { ExtractionCandidate } from "@/lib/crawler/extraction-types";

/**
 * Real integration test against a LOCAL Supabase instance only.
 *
 * This suite reads Supabase credentials exclusively from environment
 * variables (SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, LEAD_HASH_SECRET) —
 * never hardcoded here, never written to any committed file. It is skipped
 * automatically when those variables are not set, so `npm test` stays green
 * for anyone without a local Supabase instance running.
 *
 * Safety: every row this test creates uses a random per-run dedupe suffix
 * and is deleted in an `after` cleanup, in FK-safe order. No fixture used
 * here resembles a real clinic — names/URLs are synthetic
 * ("Integration Test Clinic", example.com). No outreach is ever sent: the
 * draft created below is asserted to stay in `status: "draft"`.
 *
 * Run locally with, e.g.:
 *   SUPABASE_URL=$(supabase status -o json | jq -r .API_URL) \
 *   SUPABASE_SERVICE_ROLE_KEY=$(supabase status -o json | jq -r .SERVICE_ROLE_KEY) \
 *   LEAD_HASH_SECRET=local-integration-test-only \
 *   npm test
 */
const env = readLeadCaptureEnv();
const configured = hasPersistenceConfig(env);

describe(
  "Supabase local integration (real local Postgres, no fakes)",
  { skip: configured ? false : "local Supabase not configured — set SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY / LEAD_HASH_SECRET to run" },
  () => {
    it("runs the full discovery -> clinic -> crawl -> extraction -> score -> outreach-draft flow against local Postgres", async () => {
      const runId = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      const discoveryRepo = createSupabaseDiscoveryRepository(env);
      const clinicRepo = createSupabaseClinicRepository(env);
      const crawlRepo = createSupabaseCrawlRepository(env);
      const extractionRepo = createSupabaseExtractionRepository(env);
      const scoreRepo = createSupabaseScoreRepository(env);
      const outreachRepo = createSupabaseOutreachRepository(env);

      const createdIds = {
        discoveryJobId: null as string | null,
        candidateId: null as string | null,
        clinicId: null as string | null,
        crawlJobId: null as string | null,
        scoreId: null as string | null,
        outreachMessageId: null as string | null,
      };

      try {
        // 1. create discovery job
        const discoveryJob = await discoveryRepo.createDiscoveryJob({
          sourceType: "manual",
          notes: `local integration test ${runId}`,
        });
        assert.equal(discoveryJob.ok, true, JSON.stringify(discoveryJob));
        if (!discoveryJob.ok) return;
        createdIds.discoveryJobId = discoveryJob.value.id;
        assert.equal(discoveryJob.value.status, "queued");

        // 2. create candidate (preserving source attribution + dedupe key)
        const candidate = await discoveryRepo.recordCandidate({
          discoveryJobId: discoveryJob.value.id,
          sourceType: "manual",
          rawName: `Integration Test Clinic ${runId}`,
          normalizedName: `integration test clinic ${runId}`,
          websiteUrl: "https://integration-test.example.com",
          normalizedWebsiteOrigin: "https://integration-test.example.com",
          phone: null,
          email: null,
          city: "Testville",
          state: "TS",
          specialty: "Dermatologia",
          sourceAttribution: { runId, origin: "local-integration-test" },
          dedupeKey: `integration-test-dedupe-${runId}`,
        });
        assert.equal(candidate.ok, true, JSON.stringify(candidate));
        if (!candidate.ok) return;
        createdIds.candidateId = candidate.value.id;
        assert.deepEqual(candidate.value.sourceAttribution, { runId, origin: "local-integration-test" });

        // 3. promote candidate to clinic
        const promoted = await promoteCandidateToClinic(candidate.value.id, { discoveryRepo, clinicRepo });
        assert.equal(promoted.ok, true, JSON.stringify(promoted));
        if (!promoted.ok) return;
        createdIds.clinicId = promoted.clinic.id;
        assert.equal(promoted.candidate.status, "promoted_to_clinic");
        assert.equal(promoted.clinic.sourceAttribution.promotedFrom, "prospect_candidate");

        // 4. create clinic contact (preserving source URL + review status)
        const contact = await clinicRepo.addContact({
          clinicId: promoted.clinic.id,
          contactType: "email",
          value: `contato-${runId}@integration-test.example.com`,
          normalizedValue: `contato-${runId}@integration-test.example.com`,
          sourceUrl: "https://integration-test.example.com/contato",
          extractionMethod: "html_anchor",
          confidence: "high",
        });
        assert.equal(contact.ok, true, JSON.stringify(contact));
        if (!contact.ok) return;
        assert.equal(contact.value.sourceUrl, "https://integration-test.example.com/contato");
        assert.equal(contact.value.reviewStatus, "pending_review");

        // 5. create a clinic-centric crawl job (clinic_id only, no lead_id —
        // exercises the crawl_jobs_requires_lead_or_clinic constraint path)
        const crawlJob = await crawlRepo.createCrawlJob({
          clinicId: promoted.clinic.id,
          requestedUrl: "https://integration-test.example.com/",
          normalizedOrigin: "https://integration-test.example.com",
          maxPages: 1,
        });
        assert.equal(crawlJob.ok, true, JSON.stringify(crawlJob));
        if (!crawlJob.ok) return;
        createdIds.crawlJobId = crawlJob.value.id;
        assert.equal(crawlJob.value.leadId, null);
        assert.equal(crawlJob.value.clinicId, promoted.clinic.id);

        const claimed = await crawlRepo.claimCrawlJob(crawlJob.value.id);
        assert.equal(claimed.ok, true, JSON.stringify(claimed));

        // 6. persist a crawl page (fixture data only — no real fetch happened)
        const pageResult = await crawlRepo.recordPage(crawlJob.value.id, {
          url: "https://integration-test.example.com/",
          normalizedUrl: "https://integration-test.example.com/",
          path: "/",
          statusCode: 200,
          contentType: "text/html",
          title: "Integration Test Clinic",
          metaDescription: "Fixture description for local integration test.",
          canonicalUrl: null,
          headings: ["Integration Test Clinic", "Serviços"],
          mainText: "Fixture main text for local integration test.",
          linksInternal: ["https://integration-test.example.com/contato"],
          contentHash: "fixture-hash",
          fetchDurationMs: 1,
          fetchedAt: new Date().toISOString(),
          errorCode: null,
        });
        assert.equal(pageResult.ok, true, JSON.stringify(pageResult));

        // 7. persist extracted_content (never approved on create)
        const candidates: ExtractionCandidate[] = [
          {
            kind: "title",
            value: "Integration Test Clinic",
            sourceUrl: "https://integration-test.example.com/",
            sourcePage: "https://integration-test.example.com/",
            extractionMethod: "meta",
            confidence: "high",
            reviewStatus: "pending_review",
          },
        ];
        const extraction = await extractionRepo.saveExtractedContent({
          crawlJobId: crawlJob.value.id,
          clinicId: promoted.clinic.id,
          schemaVersion: "extraction-candidates-v1",
          candidates,
        });
        assert.equal(extraction.ok, true, JSON.stringify(extraction));
        if (!extraction.ok) return;
        assert.equal(extraction.value.reviewStatus, "pending_review");
        assert.equal(extraction.value.requiresHumanReview, true);

        // 8. persist scan_assets metadata (metadata only — no bytes, nothing uploaded)
        const asset = await crawlRepo.saveAsset({
          crawlJobId: crawlJob.value.id,
          assetType: "screenshot_desktop",
          storagePath: `private/scan-assets/${runId}/desktop.png`,
          contentType: "image/png",
          widthPx: 1440,
          heightPx: 900,
          pageUrl: "https://integration-test.example.com/",
          reviewStatus: "pending_review",
          metadata: { captured: false, note: "local integration test fixture" },
        });
        assert.equal(asset.ok, true, JSON.stringify(asset));

        // 9. calculate + persist score
        const digitalScore = calculatePlaceholderScore({ candidates, pageCount: 1 });
        const score = await scoreRepo.saveScore({
          crawlJobId: crawlJob.value.id,
          clinicId: promoted.clinic.id,
          score: digitalScore,
        });
        assert.equal(score.ok, true, JSON.stringify(score));
        if (!score.ok) return;
        createdIds.scoreId = score.value.id;
        assert.equal(
          score.value.total,
          score.value.credibility + score.value.clarity + score.value.mobile + score.value.actionability + score.value.freshness,
        );

        // 10. create outreach draft — and confirm no send occurs
        const built = buildOutreachDraft({
          clinicDisplayName: promoted.clinic.displayName,
          channel: "email",
          observations: [{ observation: "Fixture observation for local integration test." }],
          doNotContact: promoted.clinic.doNotContact,
        });
        assert.equal(built.ok, true, JSON.stringify(built));
        if (!built.ok) return;

        const draft = await outreachRepo.createDraft({
          clinicId: promoted.clinic.id,
          draft: built.draft,
          doNotContact: promoted.clinic.doNotContact,
        });
        assert.equal(draft.ok, true, JSON.stringify(draft));
        if (!draft.ok) return;
        createdIds.outreachMessageId = draft.value.id;
        assert.equal(draft.value.status, "draft");
        assert.equal(draft.value.humanReviewed, false);

        // Re-fetch from the DB to prove the "no send" guarantee is
        // enforced by the actual row, not just the in-process return value.
        const refetched = await outreachRepo.getMessage(draft.value.id);
        assert.equal(refetched.ok, true, JSON.stringify(refetched));
        if (!refetched.ok) return;
        assert.equal(refetched.value.status, "draft");
      } finally {
        // Cleanup — FK-safe order. This is a disposable local DB, but we
        // still leave it as we found it.
        const client = getOperationsServiceClient(env);
        if (client) {
          if (createdIds.scoreId) await client.from("scores").delete().eq("id", createdIds.scoreId);
          if (createdIds.crawlJobId) await client.from("crawl_jobs").delete().eq("id", createdIds.crawlJobId);
          if (createdIds.clinicId) await client.from("clinics").delete().eq("id", createdIds.clinicId);
          if (createdIds.candidateId) await client.from("prospect_candidates").delete().eq("id", createdIds.candidateId);
          if (createdIds.discoveryJobId) await client.from("discovery_jobs").delete().eq("id", createdIds.discoveryJobId);
        }
      }
    });
  },
);
