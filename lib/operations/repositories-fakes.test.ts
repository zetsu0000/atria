import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  FakeClinicRepository,
  FakeCrawlRepository,
  FakeDiscoveryRepository,
  FakeExtractionRepository,
  FakeOutreachRepository,
  FakeScoreRepository,
} from "./repositories/fakes";
import type { NormalizedProspectCandidate } from "@/lib/discovery/types";
import { buildOutreachDraft } from "@/lib/outreach/draft";
import { calculatePlaceholderScore } from "@/lib/score/calculate";
import type { ExtractionCandidate } from "@/lib/crawler/extraction-types";

function sampleCandidate(overrides: Partial<NormalizedProspectCandidate> = {}): NormalizedProspectCandidate {
  return {
    rawName: "Clínica Exemplo",
    normalizedName: "clinica exemplo",
    websiteUrl: "https://clinica-exemplo.com.br",
    normalizedWebsiteOrigin: "https://clinica-exemplo.com.br",
    phone: "11999998888",
    email: "contato@clinica-exemplo.com.br",
    city: "São Paulo",
    state: "SP",
    specialty: "Dermatologia",
    sourceType: "manual",
    sourceAttribution: { importedBy: "test" },
    dedupeKey: "dedupe-key-1",
    status: "new",
    ...overrides,
  };
}

describe("DiscoveryRepository (fake)", () => {
  it("creates a discovery job and records raw candidates preserving attribution + dedupe key", async () => {
    const repo = new FakeDiscoveryRepository();
    const job = await repo.createDiscoveryJob({ sourceType: "csv_import", notes: "batch 1" });
    assert.equal(job.ok, true);
    if (!job.ok) return;
    assert.equal(job.value.status, "queued");

    const candidate = sampleCandidate();
    const recorded = await repo.recordCandidate({
      discoveryJobId: job.value.id,
      sourceType: candidate.sourceType,
      rawName: candidate.rawName,
      normalizedName: candidate.normalizedName,
      websiteUrl: candidate.websiteUrl,
      normalizedWebsiteOrigin: candidate.normalizedWebsiteOrigin,
      phone: candidate.phone,
      email: candidate.email,
      city: candidate.city,
      state: candidate.state,
      specialty: candidate.specialty,
      sourceAttribution: candidate.sourceAttribution,
      dedupeKey: candidate.dedupeKey,
    });
    assert.equal(recorded.ok, true);
    if (!recorded.ok) return;
    assert.equal(recorded.value.status, "new");
    assert.equal(recorded.value.dedupeKey, "dedupe-key-1");
    assert.deepEqual(recorded.value.sourceAttribution, { importedBy: "test" });
    assert.equal(recorded.value.discoveryJobId, job.value.id);
  });

  it("marks a candidate duplicate and preserves it in lookups", async () => {
    const repo = new FakeDiscoveryRepository();
    const recorded = await repo.recordCandidate({
      sourceType: "manual",
      rawName: "Dup Clinic",
      normalizedName: "dup clinic",
      websiteUrl: null,
      normalizedWebsiteOrigin: null,
      phone: null,
      email: null,
      city: null,
      state: null,
      specialty: null,
      sourceAttribution: {},
      dedupeKey: "dup-key",
    });
    assert.equal(recorded.ok, true);
    if (!recorded.ok) return;

    const marked = await repo.markCandidateDuplicate(recorded.value.id, "matches existing clinic");
    assert.equal(marked.ok, true);
    if (!marked.ok) return;
    assert.equal(marked.value.status, "duplicate");
    assert.equal(marked.value.reviewNotes, "matches existing clinic");
  });

  it("marks a candidate rejected", async () => {
    const repo = new FakeDiscoveryRepository();
    const recorded = await repo.recordCandidate({
      sourceType: "manual",
      rawName: "Bad Candidate",
      normalizedName: "bad candidate",
      websiteUrl: null,
      normalizedWebsiteOrigin: null,
      phone: null,
      email: null,
      city: null,
      state: null,
      specialty: null,
      sourceAttribution: {},
      dedupeKey: "reject-key",
    });
    if (!recorded.ok) return assert.fail();
    const rejected = await repo.markCandidateRejected(recorded.value.id, "not a clinic");
    assert.equal(rejected.ok, true);
    if (!rejected.ok) return;
    assert.equal(rejected.value.status, "rejected");
  });

  it("marks a candidate promoted with the target clinic id", async () => {
    const repo = new FakeDiscoveryRepository();
    const recorded = await repo.recordCandidate({
      sourceType: "manual",
      rawName: "Promotable Clinic",
      normalizedName: "promotable clinic",
      websiteUrl: null,
      normalizedWebsiteOrigin: null,
      phone: null,
      email: null,
      city: null,
      state: null,
      specialty: null,
      sourceAttribution: {},
      dedupeKey: "promote-key",
    });
    if (!recorded.ok) return assert.fail();
    const promoted = await repo.markCandidatePromoted(recorded.value.id, "clinic-123");
    assert.equal(promoted.ok, true);
    if (!promoted.ok) return;
    assert.equal(promoted.value.status, "promoted_to_clinic");
    assert.equal(promoted.value.promotedClinicId, "clinic-123");
  });

  it("returns not_found for an unknown candidate", async () => {
    const repo = new FakeDiscoveryRepository();
    const result = await repo.getCandidate("missing");
    assert.equal(result.ok, false);
    if (result.ok) return;
    assert.equal(result.reason, "not_found");
  });
});

describe("ClinicRepository (fake)", () => {
  it("creates a clinic and attaches a contact preserving source URL and review status", async () => {
    const repo = new FakeClinicRepository();
    const clinic = await repo.createClinic({
      displayName: "Clínica Boa Vista",
      normalizedName: "clinica boa vista",
      websiteUrl: "https://boavista.example.com",
      normalizedWebsiteOrigin: "https://boavista.example.com",
      city: "Curitiba",
      state: "PR",
      specialty: "Dermatologia",
      status: "prospect",
      sourceType: "manual",
      sourceAttribution: {},
      dedupeKey: "clinic-dedupe-1",
    });
    assert.equal(clinic.ok, true);
    if (!clinic.ok) return;
    assert.equal(clinic.value.doNotContact, false);

    const contact = await repo.addContact({
      clinicId: clinic.value.id,
      contactType: "email",
      value: "contato@boavista.example.com",
      normalizedValue: "contato@boavista.example.com",
      sourceUrl: "https://boavista.example.com/contato",
      extractionMethod: "html_anchor",
      confidence: "high",
    });
    assert.equal(contact.ok, true);
    if (!contact.ok) return;
    assert.equal(contact.value.sourceUrl, "https://boavista.example.com/contato");
    assert.equal(contact.value.reviewStatus, "pending_review");

    const listed = await repo.listContacts(clinic.value.id);
    assert.equal(listed.ok, true);
    if (!listed.ok) return;
    assert.equal(listed.value.length, 1);
  });

  it("updates the normalized website host", async () => {
    const repo = new FakeClinicRepository();
    const clinic = await repo.createClinic({
      displayName: "Clínica Sem Site",
      normalizedName: "clinica sem site",
      websiteUrl: null,
      normalizedWebsiteOrigin: null,
      city: null,
      state: null,
      specialty: null,
      status: "prospect",
      sourceType: "manual",
      sourceAttribution: {},
      dedupeKey: "clinic-dedupe-2",
    });
    if (!clinic.ok) return assert.fail();

    const updated = await repo.updateNormalizedWebsiteHost(clinic.value.id, {
      websiteUrl: "https://clinicasemsite.com.br",
      normalizedWebsiteOrigin: "https://clinicasemsite.com.br",
    });
    assert.equal(updated.ok, true);
    if (!updated.ok) return;
    assert.equal(updated.value.normalizedWebsiteOrigin, "https://clinicasemsite.com.br");
  });

  it("blocks a clinic for do_not_contact and preserves the reason", async () => {
    const repo = new FakeClinicRepository();
    const clinic = await repo.createClinic({
      displayName: "Clínica Opt-out",
      normalizedName: "clinica opt-out",
      websiteUrl: null,
      normalizedWebsiteOrigin: null,
      city: null,
      state: null,
      specialty: null,
      status: "prospect",
      sourceType: "manual",
      sourceAttribution: {},
      dedupeKey: "clinic-dedupe-3",
    });
    if (!clinic.ok) return assert.fail();

    const blocked = await repo.setDoNotContact(clinic.value.id, true, "requested opt-out by phone");
    assert.equal(blocked.ok, true);
    if (!blocked.ok) return;
    assert.equal(blocked.value.doNotContact, true);
    assert.equal(blocked.value.doNotContactReason, "requested opt-out by phone");

    const refetched = await repo.getClinic(clinic.value.id);
    assert.equal(refetched.ok, true);
    if (!refetched.ok) return;
    assert.equal(refetched.value.doNotContact, true);
  });
});

describe("CrawlRepository (fake) — lead-or-clinic requirement", () => {
  it("creates a crawl job with leadId only (legacy/inbound flow)", async () => {
    const repo = new FakeCrawlRepository();
    const created = await repo.createCrawlJob({
      leadId: "lead-1",
      requestedUrl: "https://clinic.example.com/",
      normalizedOrigin: "https://clinic.example.com",
    });
    assert.equal(created.ok, true);
    if (!created.ok) return;
    assert.equal(created.value.leadId, "lead-1");
    assert.equal(created.value.clinicId, null);
  });

  it("creates a crawl job with clinicId only, no fabricated leadId (discovery/outbound flow)", async () => {
    const repo = new FakeCrawlRepository();
    const created = await repo.createCrawlJob({
      clinicId: "clinic-1",
      requestedUrl: "https://clinic.example.com/",
      normalizedOrigin: "https://clinic.example.com",
    });
    assert.equal(created.ok, true);
    if (!created.ok) return;
    assert.equal(created.value.clinicId, "clinic-1");
    assert.equal(created.value.leadId, null);
  });

  it("rejects a crawl job with neither leadId nor clinicId", async () => {
    const repo = new FakeCrawlRepository();
    const created = await repo.createCrawlJob({
      requestedUrl: "https://clinic.example.com/",
      normalizedOrigin: "https://clinic.example.com",
    });
    assert.equal(created.ok, false);
    if (created.ok) return;
    assert.equal(created.reason, "validation");
  });
});

describe("CrawlRepository (fake)", () => {
  it("runs the crawl job lifecycle: create -> claim -> counters -> complete", async () => {
    const repo = new FakeCrawlRepository();
    const created = await repo.createCrawlJob({
      leadId: "lead-1",
      requestedUrl: "https://clinic.example.com/",
      normalizedOrigin: "https://clinic.example.com",
      maxPages: 4,
    });
    assert.equal(created.ok, true);
    if (!created.ok) return;
    assert.equal(created.value.status, "pending");

    const claimed = await repo.claimCrawlJob(created.value.id);
    assert.equal(claimed.ok, true);
    if (!claimed.ok) return;
    assert.equal(claimed.value.status, "running");

    // Claiming a second time must fail — a job can only be locked once.
    const reclaimed = await repo.claimCrawlJob(created.value.id);
    assert.equal(reclaimed.ok, false);

    const updated = await repo.updateCrawlJobCounters(created.value.id, {
      pagesFetched: 2,
      pagesDiscovered: 3,
    });
    assert.equal(updated.ok, true);
    if (!updated.ok) return;
    assert.equal(updated.value.pagesFetched, 2);

    const completed = await repo.updateCrawlJobCounters(created.value.id, {
      status: "completed",
      completedAt: new Date().toISOString(),
    });
    assert.equal(completed.ok, true);
    if (!completed.ok) return;
    assert.equal(completed.value.status, "completed");
  });

  it("records page statuses and never leaks raw error text (only safe codes)", async () => {
    const repo = new FakeCrawlRepository();
    const created = await repo.createCrawlJob({
      leadId: "lead-1",
      requestedUrl: "https://clinic.example.com/",
      normalizedOrigin: "https://clinic.example.com",
    });
    if (!created.ok) return assert.fail();

    const recorded = await repo.recordPage(created.value.id, {
      url: "https://clinic.example.com/missing",
      normalizedUrl: "https://clinic.example.com/missing",
      path: "/missing",
      statusCode: 404,
      contentType: null,
      title: null,
      metaDescription: null,
      canonicalUrl: null,
      headings: [],
      mainText: null,
      linksInternal: [],
      contentHash: null,
      fetchDurationMs: null,
      fetchedAt: new Date().toISOString(),
      errorCode: "http_error",
    });
    assert.equal(recorded.ok, true);
    assert.equal(repo.pages.get(created.value.id)?.[0]?.errorCode, "http_error");

    const failed = await repo.failCrawlJob(created.value.id, "timeout");
    assert.equal(failed.ok, true);
    if (!failed.ok) return;
    assert.equal(failed.value.errorCode, "timeout");
    // Safe message text only — never a raw exception/stack trace.
    assert.equal(failed.value.errorMessage, "The request timed out.");
  });

  it("saves scan_asset metadata only (no binary bytes in the type)", async () => {
    const repo = new FakeCrawlRepository();
    const created = await repo.createCrawlJob({
      leadId: "lead-1",
      requestedUrl: "https://clinic.example.com/",
      normalizedOrigin: "https://clinic.example.com",
    });
    if (!created.ok) return assert.fail();

    const asset = await repo.saveAsset({
      crawlJobId: created.value.id,
      assetType: "screenshot_desktop",
      storagePath: "private/scan-assets/clinic-example/desktop.png",
      contentType: "image/png",
      widthPx: 1440,
      heightPx: 900,
      pageUrl: "https://clinic.example.com/",
      reviewStatus: "pending_review",
      metadata: { captured: false },
    });
    assert.equal(asset.ok, true);
    if (!asset.ok) return;
    assert.equal(asset.value.storagePath, "private/scan-assets/clinic-example/desktop.png");
    assert.equal(asset.value.reviewStatus, "pending_review");
  });
});

describe("ExtractionRepository (fake)", () => {
  it("saves extracted content with schema_version and requires_human_review", async () => {
    const repo = new FakeExtractionRepository();
    const candidates: ExtractionCandidate[] = [
      {
        kind: "title",
        value: "Clínica Exemplo",
        sourceUrl: "https://clinic.example.com/",
        sourcePage: "https://clinic.example.com/",
        extractionMethod: "meta",
        confidence: "high",
        reviewStatus: "pending_review",
      },
    ];
    const saved = await repo.saveExtractedContent({
      crawlJobId: "job-1",
      clinicId: "clinic-1",
      schemaVersion: "extraction-candidates-v1",
      candidates,
    });
    assert.equal(saved.ok, true);
    if (!saved.ok) return;
    assert.equal(saved.value.version, 1);
    assert.equal(saved.value.schemaVersion, "extraction-candidates-v1");
    assert.equal(saved.value.requiresHumanReview, true);
    assert.equal(saved.value.reviewStatus, "pending_review");
    assert.equal(saved.value.candidates.length, 1);

    const latest = await repo.getLatestForCrawlJob("job-1");
    assert.equal(latest.ok, true);
    if (!latest.ok) return;
    assert.equal(latest.value?.id, saved.value.id);
  });
});

describe("ScoreRepository (fake)", () => {
  it("persists a v1 score with five dimensions, total, evidence and disclaimer", async () => {
    const repo = new FakeScoreRepository();
    const score = calculatePlaceholderScore({
      candidates: [
        {
          kind: "title",
          value: "Clínica",
          sourceUrl: "https://clinic.example.com/",
          sourcePage: "https://clinic.example.com/",
          extractionMethod: "meta",
          confidence: "high",
          reviewStatus: "pending_review",
        },
      ],
      pageCount: 1,
    });

    const saved = await repo.saveScore({ crawlJobId: "job-1", clinicId: "clinic-1", score });
    assert.equal(saved.ok, true);
    if (!saved.ok) return;
    assert.equal(
      saved.value.total,
      saved.value.credibility + saved.value.clarity + saved.value.mobile + saved.value.actionability + saved.value.freshness,
    );
    assert.ok(saved.value.evidence.length > 0);
    assert.match(saved.value.disclaimer, /apresentação digital/);
    assert.equal(saved.value.scoringVersion, "v1");
  });

  it("rejects a score with no crawl job and no clinic", async () => {
    const repo = new FakeScoreRepository();
    const score = calculatePlaceholderScore({ candidates: [], pageCount: 0 });
    const saved = await repo.saveScore({ score });
    assert.equal(saved.ok, false);
  });
});

describe("OutreachRepository (fake)", () => {
  it("creates a draft, approves it, and marks it sent only after review", async () => {
    const repo = new FakeOutreachRepository();
    const built = buildOutreachDraft({
      clinicDisplayName: "Clínica Exemplo",
      channel: "email",
      observations: [{ observation: "Site sem página de contato clara." }],
    });
    assert.equal(built.ok, true);
    if (!built.ok) return;

    const created = await repo.createDraft({ clinicId: "clinic-1", draft: built.draft, doNotContact: false });
    assert.equal(created.ok, true);
    if (!created.ok) return;
    assert.equal(created.value.status, "draft");
    assert.equal(created.value.humanReviewed, false);

    const approved = await repo.approve(created.value.id, "operator@atria.example");
    assert.equal(approved.ok, true);
    if (!approved.ok) return;
    assert.equal(approved.value.status, "approved");
    assert.equal(approved.value.humanReviewed, true);

    const sent = await repo.markSent(created.value.id);
    assert.equal(sent.ok, true);
    if (!sent.ok) return;
    assert.equal(sent.value.status, "sent");
  });

  it("blocks draft creation when the clinic is do_not_contact", async () => {
    const repo = new FakeOutreachRepository();
    const built = buildOutreachDraft({
      clinicDisplayName: "Clínica Bloqueada",
      channel: "whatsapp_manual",
      observations: [{ observation: "Sem WhatsApp visível no site." }],
      whatsappDigits: "5511988887777",
    });
    assert.equal(built.ok, true);
    if (!built.ok) return;

    const created = await repo.createDraft({ clinicId: "clinic-2", draft: built.draft, doNotContact: true });
    assert.equal(created.ok, false);
    if (created.ok) return;
    assert.equal(created.reason, "blocked");
  });

  it("refuses to mark sent without human review", async () => {
    const repo = new FakeOutreachRepository();
    const built = buildOutreachDraft({
      clinicDisplayName: "Clínica Sem Revisão",
      channel: "email",
      observations: [{ observation: "Meta description ausente." }],
    });
    if (!built.ok) return assert.fail();
    const created = await repo.createDraft({ clinicId: "clinic-3", draft: built.draft, doNotContact: false });
    if (!created.ok) return assert.fail();

    const sent = await repo.markSent(created.value.id);
    assert.equal(sent.ok, false);
    if (sent.ok) return;
    assert.equal(sent.reason, "blocked");
  });
});
