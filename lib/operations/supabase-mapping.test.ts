import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { mapDiscoveryJobRow, mapCandidateRow, type DbDiscoveryJob, type DbCandidate } from "./supabase/discovery-repository.supabase";
import { mapClinicRow, mapContactRow, type DbClinic, type DbContact } from "./supabase/clinic-repository.supabase";
import { mapCrawlJobRow, mapScanAssetRow, type DbCrawlJob, type DbScanAsset } from "./supabase/crawl-repository.supabase";
import { mapExtractedContentRow, type DbExtractedContent } from "./supabase/extraction-repository.supabase";
import { mapScoreRow, type DbScore } from "./supabase/score-repository.supabase";
import { mapOutreachMessageRow, type DbOutreachMessage } from "./supabase/outreach-repository.supabase";

/**
 * These tests exercise the Supabase row -> domain mapping functions
 * directly with synthetic rows. No Supabase client is constructed, no
 * network call is made, and no credentials are required.
 */

describe("Supabase payload mapping (no live Supabase)", () => {
  it("maps discovery_jobs rows to camelCase domain records", () => {
    const row: DbDiscoveryJob = {
      id: "job-1",
      source_type: "csv_import",
      status: "queued",
      query: { city: "São Paulo" },
      notes: "batch 1",
      candidates_created: 0,
      error_code: null,
      error_message: null,
      created_at: "2026-07-20T10:00:00.000Z",
      updated_at: "2026-07-20T10:00:00.000Z",
      completed_at: null,
    };
    const mapped = mapDiscoveryJobRow(row);
    assert.equal(mapped.id, "job-1");
    assert.equal(mapped.sourceType, "csv_import");
    assert.deepEqual(mapped.query, { city: "São Paulo" });
    assert.equal(mapped.candidatesCreated, 0);
  });

  it("maps prospect_candidates rows preserving source attribution and dedupe key", () => {
    const row: DbCandidate = {
      id: "candidate-1",
      discovery_job_id: "job-1",
      source_type: "manual",
      status: "new",
      raw_name: "Clínica X",
      normalized_name: "clinica x",
      website_url: "https://clinicax.example.com",
      normalized_website_origin: "https://clinicax.example.com",
      phone: "11999998888",
      email: "contato@clinicax.example.com",
      city: "São Paulo",
      state: "SP",
      specialty: "Dermatologia",
      source_attribution: { importedBy: "operator" },
      dedupe_key: "dedupe-abc",
      promoted_clinic_id: null,
      review_notes: null,
      created_at: "2026-07-20T10:00:00.000Z",
      updated_at: "2026-07-20T10:00:00.000Z",
    };
    const mapped = mapCandidateRow(row);
    assert.equal(mapped.dedupeKey, "dedupe-abc");
    assert.deepEqual(mapped.sourceAttribution, { importedBy: "operator" });
    assert.equal(mapped.discoveryJobId, "job-1");
  });

  it("maps clinics rows and derives do_not_contact from source_attribution", () => {
    const row: DbClinic = {
      id: "clinic-1",
      display_name: "Clínica Y",
      normalized_name: "clinica y",
      website_url: "https://clinicay.example.com",
      normalized_website_origin: "https://clinicay.example.com",
      city: "Belo Horizonte",
      state: "MG",
      specialty: "Dermatologia",
      status: "prospect",
      lead_id: null,
      source_type: "manual",
      source_attribution: { doNotContact: true, doNotContactReason: "opted out" },
      dedupe_key: "clinic-dedupe",
      notes: null,
      created_at: "2026-07-20T10:00:00.000Z",
      updated_at: "2026-07-20T10:00:00.000Z",
    };
    const mapped = mapClinicRow(row);
    assert.equal(mapped.doNotContact, true);
    assert.equal(mapped.doNotContactReason, "opted out");
  });

  it("maps clinic_contacts rows preserving source URL and review status", () => {
    const row: DbContact = {
      id: "contact-1",
      clinic_id: "clinic-1",
      contact_type: "whatsapp",
      value: "https://wa.me/5511999998888",
      normalized_value: "https://wa.me/5511999998888",
      source_url: "https://clinicay.example.com/contato",
      extraction_method: "html_anchor",
      confidence: "high",
      review_status: "pending_review",
      provenance: { sourcePage: "https://clinicay.example.com/contato" },
      created_at: "2026-07-20T10:00:00.000Z",
      updated_at: "2026-07-20T10:00:00.000Z",
    };
    const mapped = mapContactRow(row);
    assert.equal(mapped.sourceUrl, "https://clinicay.example.com/contato");
    assert.equal(mapped.reviewStatus, "pending_review");
  });

  it("maps crawl_jobs rows including clinic_id and requires_human_review", () => {
    const row: DbCrawlJob = {
      id: "crawl-1",
      lead_id: "lead-1",
      clinic_id: "clinic-1",
      requested_url: "https://clinicay.example.com/",
      normalized_origin: "https://clinicay.example.com",
      status: "completed",
      max_pages: 8,
      pages_discovered: 3,
      pages_fetched: 3,
      pages_failed: 0,
      requires_human_review: true,
      started_at: "2026-07-20T10:00:00.000Z",
      completed_at: "2026-07-20T10:01:00.000Z",
      error_code: null,
      error_message: null,
      created_at: "2026-07-20T10:00:00.000Z",
      updated_at: "2026-07-20T10:01:00.000Z",
    };
    const mapped = mapCrawlJobRow(row);
    assert.equal(mapped.clinicId, "clinic-1");
    assert.equal(mapped.requiresHumanReview, true);
    assert.equal(mapped.status, "completed");
  });

  it("maps a clinic-centric crawl_jobs row with lead_id null, without forcing a lead_id", () => {
    const row: DbCrawlJob = {
      id: "crawl-2",
      lead_id: null,
      clinic_id: "clinic-1",
      requested_url: "https://clinicay.example.com/",
      normalized_origin: "https://clinicay.example.com",
      status: "pending",
      max_pages: 8,
      pages_discovered: 0,
      pages_fetched: 0,
      pages_failed: 0,
      requires_human_review: true,
      started_at: null,
      completed_at: null,
      error_code: null,
      error_message: null,
      created_at: "2026-07-20T10:00:00.000Z",
      updated_at: "2026-07-20T10:00:00.000Z",
    };
    const mapped = mapCrawlJobRow(row);
    assert.equal(mapped.leadId, null);
    assert.equal(mapped.clinicId, "clinic-1");
  });

  it("maps scan_assets rows as metadata only (no byte fields exist on the row shape)", () => {
    const row: DbScanAsset = {
      id: "asset-1",
      crawl_job_id: "crawl-1",
      asset_type: "screenshot_mobile",
      storage_path: "private/scan-assets/crawl-1/mobile.png",
      content_type: "image/png",
      width_px: 390,
      height_px: 844,
      page_url: "https://clinicay.example.com/",
      review_status: "pending_review",
      metadata: { captured: false },
      created_at: "2026-07-20T10:00:00.000Z",
    };
    const mapped = mapScanAssetRow(row);
    assert.equal(mapped.storagePath, "private/scan-assets/crawl-1/mobile.png");
    assert.equal(mapped.assetType, "screenshot_mobile");
    assert.deepEqual(Object.keys(row).includes("bytes"), false);
  });

  it("maps extracted_content rows, deriving schemaVersion from payload and requiresHumanReview from review_status", () => {
    const row: DbExtractedContent = {
      id: "extraction-1",
      crawl_job_id: "crawl-1",
      clinic_id: "clinic-1",
      version: 1,
      payload: { schemaVersion: "extraction-candidates-v1" },
      candidates: [],
      review_status: "pending_review",
      created_at: "2026-07-20T10:00:00.000Z",
    };
    const mapped = mapExtractedContentRow(row);
    assert.equal(mapped.schemaVersion, "extraction-candidates-v1");
    assert.equal(mapped.requiresHumanReview, true);

    const approvedRow: DbExtractedContent = { ...row, review_status: "approved" };
    assert.equal(mapExtractedContentRow(approvedRow).requiresHumanReview, false);
  });

  it("maps scores rows with all five dimensions and the disclaimer", () => {
    const row: DbScore = {
      id: "score-1",
      crawl_job_id: "crawl-1",
      clinic_id: "clinic-1",
      credibility: 12,
      clarity: 14,
      mobile: 8,
      actionability: 16,
      freshness: 10,
      total: 60,
      evidence: [{ dimension: "credibility", points: 3, reason: "Título institucional encontrado." }],
      disclaimer: "Esta análise avalia apenas a apresentação digital e a facilidade de encontrar informações. Não avalia qualidade médica.",
      review_status: "pending_review",
      scoring_version: "placeholder-v0",
      created_at: "2026-07-20T10:00:00.000Z",
      updated_at: "2026-07-20T10:00:00.000Z",
    };
    const mapped = mapScoreRow(row);
    assert.equal(mapped.total, 60);
    assert.equal(mapped.scoringVersion, "placeholder-v0");
    assert.equal(mapped.evidence.length, 1);
  });

  it("maps outreach_messages rows preserving do_not_contact_blocked and human_reviewed", () => {
    const row: DbOutreachMessage = {
      id: "outreach-1",
      clinic_id: "clinic-1",
      lead_id: null,
      channel: "email",
      status: "draft",
      subject: "Prévia digital",
      body: "Olá, equipe...",
      evidence: [{ observation: "Sem página de contato clara." }],
      click_to_chat_url: null,
      human_reviewed: false,
      reviewed_at: null,
      reviewed_by: null,
      do_not_contact_blocked: false,
      created_at: "2026-07-20T10:00:00.000Z",
      updated_at: "2026-07-20T10:00:00.000Z",
    };
    const mapped = mapOutreachMessageRow(row);
    assert.equal(mapped.status, "draft");
    assert.equal(mapped.humanReviewed, false);
    assert.equal(mapped.doNotContactBlocked, false);
  });
});
