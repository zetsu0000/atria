/**
 * In-memory fake repository adapters for tests.
 *
 * These implementations satisfy the same interfaces as the Supabase
 * adapters in lib/operations/supabase/*, so crawler/discovery/score/
 * outreach orchestration can be exercised without a live Supabase
 * connection and without live network access.
 *
 * Not used by application runtime code — test-only.
 */
import { randomUUID } from "node:crypto";
import type { DiscoveryRepository } from "./discovery-repository";
import type { ClinicRepository } from "./clinic-repository";
import type { CrawlRepository } from "./crawl-repository";
import type { ExtractionRepository } from "./extraction-repository";
import type { ScoreRepository } from "./score-repository";
import type { OutreachRepository } from "./outreach-repository";
import type { HumanReviewRepository } from "./human-review-repository";
import type { ManualOutreachLogRepository } from "./manual-outreach-log-repository";
import { safeErrorMessage } from "@/lib/crawler/errors";
import type {
  ClinicContactRecord,
  ClinicRecord,
  CrawlFindingInput,
  CrawlJobRecord,
  CrawlPageInput,
  CreateClinicContactInput,
  CreateClinicInput,
  CreateCrawlJobInput,
  CreateDiscoveryJobInput,
  CreateExtractedContentInput,
  CreateHumanReviewDecisionInput,
  CreateManualOutreachLogInput,
  CreateOutreachMessageInput,
  CreateScanAssetInput,
  CreateScoreInput,
  DiscoveryJobRecord,
  ExtractedContentRecord,
  HumanReviewDecisionRecord,
  ManualOutreachLogRecord,
  OutreachMessageRecord,
  ProspectCandidateRecord,
  RecordCandidateInput,
  ScanAssetRecord,
  ScoreRecord,
} from "./types";

function nowIso(): string {
  return new Date().toISOString();
}

function notFound(message = "Record not found."): { ok: false; reason: "not_found"; message: string } {
  return { ok: false, reason: "not_found", message };
}

export class FakeDiscoveryRepository implements DiscoveryRepository {
  jobs = new Map<string, DiscoveryJobRecord>();
  candidates = new Map<string, ProspectCandidateRecord>();

  async createDiscoveryJob(input: CreateDiscoveryJobInput) {
    const id = randomUUID();
    const record: DiscoveryJobRecord = {
      id,
      sourceType: input.sourceType,
      status: "queued",
      query: input.query ?? {},
      notes: input.notes ?? null,
      candidatesCreated: 0,
      errorCode: null,
      errorMessage: null,
      createdAt: nowIso(),
      updatedAt: nowIso(),
      completedAt: null,
    };
    this.jobs.set(id, record);
    return { ok: true as const, value: record };
  }

  async completeDiscoveryJob(jobId: string, patch: Parameters<DiscoveryRepository["completeDiscoveryJob"]>[1]) {
    const existing = this.jobs.get(jobId);
    if (!existing) return notFound("Discovery job not found.");
    const updated: DiscoveryJobRecord = {
      ...existing,
      status: patch.status,
      candidatesCreated: patch.candidatesCreated,
      errorCode: patch.errorCode ?? null,
      errorMessage: patch.errorMessage ?? null,
      completedAt: nowIso(),
      updatedAt: nowIso(),
    };
    this.jobs.set(jobId, updated);
    return { ok: true as const, value: updated };
  }

  async recordCandidate(input: RecordCandidateInput) {
    const id = randomUUID();
    const record: ProspectCandidateRecord = {
      id,
      discoveryJobId: input.discoveryJobId ?? null,
      sourceType: input.sourceType,
      status: input.status ?? "new",
      rawName: input.rawName,
      normalizedName: input.normalizedName,
      websiteUrl: input.websiteUrl,
      normalizedWebsiteOrigin: input.normalizedWebsiteOrigin,
      phone: input.phone,
      email: input.email,
      city: input.city,
      state: input.state,
      specialty: input.specialty,
      sourceAttribution: input.sourceAttribution,
      dedupeKey: input.dedupeKey,
      promotedClinicId: null,
      reviewNotes: null,
      createdAt: nowIso(),
      updatedAt: nowIso(),
    };
    this.candidates.set(id, record);
    return { ok: true as const, value: record };
  }

  private async setStatus(
    candidateId: string,
    status: ProspectCandidateRecord["status"],
    reviewNotes: string | null,
    promotedClinicId: string | null = null,
  ) {
    const existing = this.candidates.get(candidateId);
    if (!existing) return notFound("Candidate not found.");
    const updated: ProspectCandidateRecord = {
      ...existing,
      status,
      reviewNotes: reviewNotes ?? existing.reviewNotes,
      promotedClinicId: promotedClinicId ?? existing.promotedClinicId,
      updatedAt: nowIso(),
    };
    this.candidates.set(candidateId, updated);
    return { ok: true as const, value: updated };
  }

  async markCandidateDuplicate(candidateId: string, reason?: string | null) {
    return this.setStatus(candidateId, "duplicate", reason ?? null);
  }

  async markCandidateRejected(candidateId: string, reason?: string | null) {
    return this.setStatus(candidateId, "rejected", reason ?? null);
  }

  async markCandidatePromoted(candidateId: string, clinicId: string) {
    return this.setStatus(candidateId, "promoted_to_clinic", null, clinicId);
  }

  async getCandidate(candidateId: string) {
    const existing = this.candidates.get(candidateId);
    if (!existing) return notFound("Candidate not found.");
    return { ok: true as const, value: existing };
  }

  async findCandidateByDedupeKey(dedupeKey: string) {
    for (const candidate of this.candidates.values()) {
      if (candidate.dedupeKey === dedupeKey) {
        return { ok: true as const, value: candidate };
      }
    }
    return { ok: true as const, value: null };
  }

  async listCandidates(limit: number) {
    const sorted = [...this.candidates.values()].sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
    return { ok: true as const, value: sorted.slice(0, limit) };
  }
}

export class FakeClinicRepository implements ClinicRepository {
  clinics = new Map<string, ClinicRecord>();
  contacts = new Map<string, ClinicContactRecord>();

  async createClinic(input: CreateClinicInput) {
    for (const existing of this.clinics.values()) {
      if (existing.dedupeKey === input.dedupeKey) {
        return { ok: false as const, reason: "conflict" as const, message: "Clinic dedupe key already exists." };
      }
    }
    const id = randomUUID();
    const record: ClinicRecord = {
      id,
      displayName: input.displayName,
      normalizedName: input.normalizedName,
      websiteUrl: input.websiteUrl,
      normalizedWebsiteOrigin: input.normalizedWebsiteOrigin,
      city: input.city,
      state: input.state,
      specialty: input.specialty,
      status: input.status,
      leadId: input.leadId ?? null,
      sourceType: input.sourceType,
      sourceAttribution: input.sourceAttribution,
      dedupeKey: input.dedupeKey,
      notes: null,
      doNotContact: input.sourceAttribution.doNotContact === true,
      doNotContactReason:
        typeof input.sourceAttribution.doNotContactReason === "string"
          ? input.sourceAttribution.doNotContactReason
          : null,
      createdAt: nowIso(),
      updatedAt: nowIso(),
    };
    this.clinics.set(id, record);
    return { ok: true as const, value: record };
  }

  async getClinic(clinicId: string) {
    const existing = this.clinics.get(clinicId);
    if (!existing) return notFound("Clinic not found.");
    return { ok: true as const, value: existing };
  }

  async findClinicByDedupeKey(dedupeKey: string) {
    for (const clinic of this.clinics.values()) {
      if (clinic.dedupeKey === dedupeKey) return { ok: true as const, value: clinic };
    }
    return { ok: true as const, value: null };
  }

  async listClinics(limit: number) {
    const sorted = [...this.clinics.values()].sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
    return { ok: true as const, value: sorted.slice(0, limit) };
  }

  async updateNormalizedWebsiteHost(
    clinicId: string,
    input: { websiteUrl: string | null; normalizedWebsiteOrigin: string | null },
  ) {
    const existing = this.clinics.get(clinicId);
    if (!existing) return notFound("Clinic not found.");
    const updated: ClinicRecord = {
      ...existing,
      websiteUrl: input.websiteUrl,
      normalizedWebsiteOrigin: input.normalizedWebsiteOrigin,
      updatedAt: nowIso(),
    };
    this.clinics.set(clinicId, updated);
    return { ok: true as const, value: updated };
  }

  async setDoNotContact(clinicId: string, blocked: boolean, reason?: string | null) {
    const existing = this.clinics.get(clinicId);
    if (!existing) return notFound("Clinic not found.");
    const updated: ClinicRecord = {
      ...existing,
      doNotContact: blocked,
      doNotContactReason: blocked ? (reason ?? existing.doNotContactReason) : null,
      sourceAttribution: {
        ...existing.sourceAttribution,
        doNotContact: blocked,
        doNotContactReason: blocked ? (reason ?? null) : null,
      },
      updatedAt: nowIso(),
    };
    this.clinics.set(clinicId, updated);
    return { ok: true as const, value: updated };
  }

  async addContact(input: CreateClinicContactInput) {
    if (!this.clinics.has(input.clinicId)) return notFound("Clinic not found.");
    const id = randomUUID();
    const record: ClinicContactRecord = {
      id,
      clinicId: input.clinicId,
      contactType: input.contactType,
      value: input.value,
      normalizedValue: input.normalizedValue,
      sourceUrl: input.sourceUrl ?? null,
      extractionMethod: input.extractionMethod ?? "manual",
      confidence: input.confidence ?? "medium",
      reviewStatus: "pending_review",
      provenance: input.provenance ?? {},
      createdAt: nowIso(),
      updatedAt: nowIso(),
    };
    this.contacts.set(id, record);
    return { ok: true as const, value: record };
  }

  async listContacts(clinicId: string) {
    const out = [...this.contacts.values()].filter((c) => c.clinicId === clinicId);
    return { ok: true as const, value: out };
  }
}

export class FakeCrawlRepository implements CrawlRepository {
  jobs = new Map<string, CrawlJobRecord>();
  pages = new Map<string, CrawlPageInput[]>();
  findings = new Map<string, CrawlFindingInput[]>();
  assets = new Map<string, ScanAssetRecord[]>();

  async createCrawlJob(input: CreateCrawlJobInput) {
    if (!input.leadId && !input.clinicId) {
      return {
        ok: false as const,
        reason: "validation" as const,
        message: "A crawl job requires at least a leadId or a clinicId.",
      };
    }
    const id = randomUUID();
    const record: CrawlJobRecord = {
      id,
      leadId: input.leadId ?? null,
      clinicId: input.clinicId ?? null,
      requestedUrl: input.requestedUrl,
      normalizedOrigin: input.normalizedOrigin,
      status: "pending",
      maxPages: input.maxPages ?? 8,
      pagesDiscovered: 0,
      pagesFetched: 0,
      pagesFailed: 0,
      requiresHumanReview: true,
      startedAt: null,
      completedAt: null,
      errorCode: null,
      errorMessage: null,
      createdAt: nowIso(),
      updatedAt: nowIso(),
    };
    this.jobs.set(id, record);
    return { ok: true as const, value: record };
  }

  async claimCrawlJob(jobId: string) {
    const existing = this.jobs.get(jobId);
    if (!existing) return notFound("Crawl job not found.");
    if (existing.status !== "pending") {
      return { ok: false as const, reason: "conflict" as const, message: "Crawl job is not pending." };
    }
    const updated: CrawlJobRecord = {
      ...existing,
      status: "running",
      startedAt: nowIso(),
      errorCode: null,
      errorMessage: null,
      updatedAt: nowIso(),
    };
    this.jobs.set(jobId, updated);
    return { ok: true as const, value: updated };
  }

  async getCrawlJob(jobId: string) {
    const existing = this.jobs.get(jobId);
    if (!existing) return notFound("Crawl job not found.");
    return { ok: true as const, value: existing };
  }

  async getLatestCrawlJobForClinic(clinicId: string) {
    const candidates = [...this.jobs.values()]
      .filter((j) => j.clinicId === clinicId)
      .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
    return { ok: true as const, value: candidates[0] ?? null };
  }

  async updateCrawlJobCounters(jobId: string, patch: Parameters<CrawlRepository["updateCrawlJobCounters"]>[1]) {
    const existing = this.jobs.get(jobId);
    if (!existing) return notFound("Crawl job not found.");
    const updated: CrawlJobRecord = {
      ...existing,
      pagesDiscovered: patch.pagesDiscovered ?? existing.pagesDiscovered,
      pagesFetched: patch.pagesFetched ?? existing.pagesFetched,
      pagesFailed: patch.pagesFailed ?? existing.pagesFailed,
      status: patch.status ?? existing.status,
      errorCode: patch.errorCode !== undefined ? patch.errorCode : existing.errorCode,
      errorMessage:
        patch.errorMessage !== undefined ? (patch.errorMessage?.slice(0, 500) ?? null) : existing.errorMessage,
      completedAt: patch.completedAt !== undefined ? patch.completedAt : existing.completedAt,
      updatedAt: nowIso(),
    };
    this.jobs.set(jobId, updated);
    return { ok: true as const, value: updated };
  }

  async failCrawlJob(jobId: string, errorCode: Parameters<CrawlRepository["failCrawlJob"]>[1]) {
    return this.updateCrawlJobCounters(jobId, {
      status: "failed",
      errorCode,
      errorMessage: safeErrorMessage(errorCode),
      completedAt: nowIso(),
    });
  }

  async recordPage(jobId: string, page: CrawlPageInput) {
    if (!this.jobs.has(jobId)) return notFound("Crawl job not found.");
    const list = this.pages.get(jobId) ?? [];
    list.push(page);
    this.pages.set(jobId, list);
    return { ok: true as const, value: undefined };
  }

  async recordFinding(jobId: string, finding: CrawlFindingInput) {
    if (!this.jobs.has(jobId)) return notFound("Crawl job not found.");
    const list = this.findings.get(jobId) ?? [];
    list.push(finding);
    this.findings.set(jobId, list);
    return { ok: true as const, value: undefined };
  }

  async saveAsset(input: CreateScanAssetInput) {
    if (!this.jobs.has(input.crawlJobId)) return notFound("Crawl job not found.");
    const record: ScanAssetRecord = {
      id: randomUUID(),
      crawlJobId: input.crawlJobId,
      assetType: input.assetType,
      storagePath: input.storagePath,
      contentType: input.contentType,
      widthPx: input.widthPx,
      heightPx: input.heightPx,
      pageUrl: input.pageUrl,
      reviewStatus: input.reviewStatus,
      metadata: input.metadata,
      createdAt: nowIso(),
    };
    const list = this.assets.get(input.crawlJobId) ?? [];
    list.push(record);
    this.assets.set(input.crawlJobId, list);
    return { ok: true as const, value: record };
  }

  async listAssetsForCrawlJob(crawlJobId: string) {
    return { ok: true as const, value: this.assets.get(crawlJobId) ?? [] };
  }
}

export class FakeExtractionRepository implements ExtractionRepository {
  byCrawlJob = new Map<string, ExtractedContentRecord[]>();

  async saveExtractedContent(input: CreateExtractedContentInput) {
    const existing = this.byCrawlJob.get(input.crawlJobId) ?? [];
    const version = input.version ?? existing.length + 1;
    const record: ExtractedContentRecord = {
      id: randomUUID(),
      crawlJobId: input.crawlJobId,
      clinicId: input.clinicId ?? null,
      version,
      schemaVersion: input.schemaVersion,
      payload: { ...(input.payload ?? {}), schemaVersion: input.schemaVersion },
      candidates: input.candidates,
      requiresHumanReview: input.requiresHumanReview ?? true,
      reviewStatus: "pending_review",
      createdAt: nowIso(),
    };
    existing.push(record);
    this.byCrawlJob.set(input.crawlJobId, existing);
    return { ok: true as const, value: record };
  }

  async getLatestForCrawlJob(crawlJobId: string) {
    const list = this.byCrawlJob.get(crawlJobId) ?? [];
    if (!list.length) return { ok: true as const, value: null };
    return { ok: true as const, value: list[list.length - 1]! };
  }
}

export class FakeScoreRepository implements ScoreRepository {
  records: ScoreRecord[] = [];

  async saveScore(input: CreateScoreInput) {
    if (!input.crawlJobId && !input.clinicId) {
      return { ok: false as const, reason: "validation" as const, message: "Score requires a crawl job or clinic." };
    }
    const record: ScoreRecord = {
      id: randomUUID(),
      crawlJobId: input.crawlJobId ?? null,
      clinicId: input.clinicId ?? null,
      credibility: input.score.credibility,
      clarity: input.score.clarity,
      mobile: input.score.mobile,
      actionability: input.score.actionability,
      freshness: input.score.freshness,
      total: input.score.total,
      evidence: input.score.evidence,
      disclaimer: input.score.disclaimer,
      reviewStatus: input.score.reviewStatus,
      scoringVersion: input.score.scoringVersion,
      createdAt: nowIso(),
      updatedAt: nowIso(),
    };
    this.records.push(record);
    return { ok: true as const, value: record };
  }

  async getLatestForClinic(clinicId: string) {
    const list = this.records.filter((r) => r.clinicId === clinicId);
    if (!list.length) return { ok: true as const, value: null };
    return { ok: true as const, value: list[list.length - 1]! };
  }

  async getForCrawlJob(crawlJobId: string) {
    const found = this.records.find((r) => r.crawlJobId === crawlJobId) ?? null;
    return { ok: true as const, value: found };
  }

  async listRecent(limit: number) {
    // Most-recently-inserted first, matching getLatestForClinic's own
    // insertion-order semantics rather than a timestamp sort.
    return { ok: true as const, value: [...this.records].reverse().slice(0, limit) };
  }
}

export class FakeOutreachRepository implements OutreachRepository {
  messages = new Map<string, OutreachMessageRecord>();

  async createDraft(input: CreateOutreachMessageInput) {
    if (input.doNotContact) {
      return { ok: false as const, reason: "blocked" as const, message: "Clinic is marked do_not_contact." };
    }
    const id = randomUUID();
    const record: OutreachMessageRecord = {
      id,
      clinicId: input.clinicId,
      leadId: input.leadId ?? null,
      channel: input.draft.channel,
      status: "draft",
      subject: input.draft.subject ?? null,
      body: input.draft.body,
      evidence: input.draft.evidence,
      clickToChatUrl: input.draft.clickToChatUrl ?? null,
      humanReviewed: false,
      reviewedAt: null,
      reviewedBy: null,
      doNotContactBlocked: false,
      createdAt: nowIso(),
      updatedAt: nowIso(),
    };
    this.messages.set(id, record);
    return { ok: true as const, value: record };
  }

  async approve(messageId: string, reviewedBy: string) {
    const existing = this.messages.get(messageId);
    if (!existing) return notFound("Outreach message not found.");
    if (existing.doNotContactBlocked) {
      return { ok: false as const, reason: "blocked" as const, message: "Cannot approve: do_not_contact blocked." };
    }
    const updated: OutreachMessageRecord = {
      ...existing,
      status: "approved",
      humanReviewed: true,
      reviewedAt: nowIso(),
      reviewedBy,
      updatedAt: nowIso(),
    };
    this.messages.set(messageId, updated);
    return { ok: true as const, value: updated };
  }

  async reject(messageId: string, reviewedBy: string, reason?: string | null) {
    const existing = this.messages.get(messageId);
    if (!existing) return notFound("Outreach message not found.");
    const updated: OutreachMessageRecord = {
      ...existing,
      status: "rejected",
      humanReviewed: true,
      reviewedAt: nowIso(),
      reviewedBy,
      updatedAt: nowIso(),
    };
    this.messages.set(messageId, updated);
    void reason;
    return { ok: true as const, value: updated };
  }

  private async transitionState(messageId: string, status: OutreachMessageRecord["status"]) {
    const existing = this.messages.get(messageId);
    if (!existing) return notFound("Outreach message not found.");
    if (status === "sent" && (!existing.humanReviewed || existing.doNotContactBlocked)) {
      return {
        ok: false as const,
        reason: "blocked" as const,
        message: "Outreach cannot be marked sent without human review and do_not_contact clearance.",
      };
    }
    const updated: OutreachMessageRecord = { ...existing, status, updatedAt: nowIso() };
    this.messages.set(messageId, updated);
    return { ok: true as const, value: updated };
  }

  async markSent(messageId: string) {
    return this.transitionState(messageId, "sent");
  }

  async markReplied(messageId: string) {
    return this.transitionState(messageId, "replied");
  }

  async markIgnored(messageId: string) {
    return this.transitionState(messageId, "ignored");
  }

  async getMessage(messageId: string) {
    const existing = this.messages.get(messageId);
    if (!existing) return notFound("Outreach message not found.");
    return { ok: true as const, value: existing };
  }

  async listForClinic(clinicId: string) {
    const out = [...this.messages.values()].filter((m) => m.clinicId === clinicId);
    return { ok: true as const, value: out };
  }
}

export class FakeHumanReviewRepository implements HumanReviewRepository {
  decisions: HumanReviewDecisionRecord[] = [];

  async recordDecision(input: CreateHumanReviewDecisionInput) {
    const now = nowIso();
    const record: HumanReviewDecisionRecord = {
      id: randomUUID(),
      clinicId: input.clinicId,
      crawlJobId: input.crawlJobId ?? null,
      scoreId: input.scoreId ?? null,
      outreachMessageId: input.outreachMessageId ?? null,
      decision: input.decision,
      reviewerNotes: input.reviewerNotes ?? null,
      reviewer: input.reviewer ?? null,
      reviewedAt: now,
      metadata: input.metadata ?? {},
      createdAt: now,
    };
    this.decisions.push(record);
    return { ok: true as const, value: record };
  }

  async getLatestDecisionForClinic(clinicId: string) {
    const list = this.decisions.filter((d) => d.clinicId === clinicId);
    if (!list.length) return { ok: true as const, value: null };
    return { ok: true as const, value: list[list.length - 1]! };
  }

  async listDecisionsForClinic(clinicId: string) {
    const out = this.decisions.filter((d) => d.clinicId === clinicId);
    return { ok: true as const, value: out };
  }
}

export class FakeManualOutreachLogRepository implements ManualOutreachLogRepository {
  logs: ManualOutreachLogRecord[] = [];

  async recordLog(input: CreateManualOutreachLogInput) {
    const now = nowIso();
    const record: ManualOutreachLogRecord = {
      id: randomUUID(),
      clinicId: input.clinicId,
      outreachMessageId: input.outreachMessageId,
      humanReviewDecisionId: input.humanReviewDecisionId ?? null,
      channel: input.channel,
      eventType: input.eventType,
      operatorName: input.operatorName,
      occurredAt: input.occurredAt,
      notes: input.notes ?? null,
      responseReceived: input.responseReceived ?? null,
      followUpNeeded: input.followUpNeeded ?? null,
      followUpAt: input.followUpAt ?? null,
      metadata: input.metadata ?? {},
      createdAt: now,
    };
    this.logs.push(record);
    return { ok: true as const, value: record };
  }

  async listForClinic(clinicId: string) {
    const out = this.logs.filter((l) => l.clinicId === clinicId);
    return { ok: true as const, value: out };
  }

  async listForOutreachMessage(outreachMessageId: string) {
    const out = this.logs.filter((l) => l.outreachMessageId === outreachMessageId);
    return { ok: true as const, value: out };
  }
}
