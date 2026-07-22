import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, it } from "node:test";
import {
  FakeClinicRepository,
  FakeCrawlRepository,
  FakeHumanReviewRepository,
  FakeOutreachRepository,
  FakeScoreRepository,
} from "./repositories/fakes";
import { listReviewQueue, type ListReviewQueueDeps } from "./review-queue/list-review-queue";
import { recordReviewDecision, type RecordReviewDecisionDeps } from "./review-queue/record-review-decision";
import { calculatePlaceholderScore } from "@/lib/score/calculate";
import { buildOutreachDraft } from "@/lib/outreach/draft";
import { selectRepositories } from "./pipeline/select-repositories";
import { KNOWN_PROJECT_REFS } from "./pipeline/target-guard";
import type { LeadCaptureEnv } from "@/lib/security/env";

const root = join(__dirname, "..", "..");

function buildDeps(): RecordReviewDecisionDeps &
  ListReviewQueueDeps & {
    clinicRepo: FakeClinicRepository;
    crawlRepo: FakeCrawlRepository;
    scoreRepo: FakeScoreRepository;
    outreachRepo: FakeOutreachRepository;
    humanReviewRepo: FakeHumanReviewRepository;
  } {
  return {
    clinicRepo: new FakeClinicRepository(),
    crawlRepo: new FakeCrawlRepository(),
    scoreRepo: new FakeScoreRepository(),
    outreachRepo: new FakeOutreachRepository(),
    humanReviewRepo: new FakeHumanReviewRepository(),
  };
}

async function seedClinic(deps: ReturnType<typeof buildDeps>, dedupeKey = "review-queue-clinic") {
  const clinic = await deps.clinicRepo.createClinic({
    displayName: "SkinLaser - Higienopolis",
    normalizedName: "skinlaser higienopolis",
    websiteUrl: "https://www.skinlaser.com.br/",
    normalizedWebsiteOrigin: "https://www.skinlaser.com.br",
    city: null,
    state: "SP",
    specialty: "skin_care_clinic",
    status: "prospect",
    sourceType: "google_places",
    sourceAttribution: {},
    dedupeKey,
  });
  if (!clinic.ok) throw new Error("setup failed");
  return clinic.value;
}

async function seedCrawlJob(deps: ReturnType<typeof buildDeps>, clinicId: string) {
  const created = await deps.crawlRepo.createCrawlJob({
    clinicId,
    requestedUrl: "https://www.skinlaser.com.br/",
    normalizedOrigin: "https://www.skinlaser.com.br",
    maxPages: 3,
  });
  if (!created.ok) throw new Error("setup failed");
  await deps.crawlRepo.claimCrawlJob(created.value.id);
  const completed = await deps.crawlRepo.updateCrawlJobCounters(created.value.id, {
    status: "completed",
    pagesFetched: 3,
    pagesDiscovered: 3,
    pagesFailed: 0,
    completedAt: new Date().toISOString(),
  });
  if (!completed.ok) throw new Error("setup failed");
  return completed.value;
}

async function seedScore(deps: ReturnType<typeof buildDeps>, crawlJobId: string, clinicId: string) {
  const score = calculatePlaceholderScore({ candidates: [], pageCount: 3 });
  const saved = await deps.scoreRepo.saveScore({ crawlJobId, clinicId, score });
  if (!saved.ok) throw new Error("setup failed");
  return saved.value;
}

describe("listReviewQueue", () => {
  it("1. a review-ready clinic with no decision yet appears in the queue as 'pending'", async () => {
    const deps = buildDeps();
    const clinic = await seedClinic(deps, "pending-clinic");
    const crawlJob = await seedCrawlJob(deps, clinic.id);
    await seedScore(deps, crawlJob.id, clinic.id);

    const result = await listReviewQueue({}, deps);
    assert.equal(result.ok, true);
    if (!result.ok) return;
    const item = result.items.find((i) => i.clinicId === clinic.id);
    assert.ok(item, "expected the clinic to appear in the queue");
    assert.equal(item!.status, "pending");
    assert.equal(item!.latestDecision, null);
  });

  it("filters by --status", async () => {
    const deps = buildDeps();
    const clinicA = await seedClinic(deps, "queue-filter-a");
    const crawlA = await seedCrawlJob(deps, clinicA.id);
    await seedScore(deps, crawlA.id, clinicA.id);

    const clinicB = await seedClinic(deps, "queue-filter-b");
    const crawlB = await seedCrawlJob(deps, clinicB.id);
    await seedScore(deps, crawlB.id, clinicB.id);
    await recordReviewDecision({ clinicId: clinicB.id, decision: "approved" }, deps);

    const pendingOnly = await listReviewQueue({ status: "pending" }, deps);
    assert.equal(pendingOnly.ok, true);
    if (!pendingOnly.ok) return;
    assert.ok(pendingOnly.items.some((i) => i.clinicId === clinicA.id));
    assert.ok(!pendingOnly.items.some((i) => i.clinicId === clinicB.id));

    const approvedOnly = await listReviewQueue({ status: "approved" }, deps);
    assert.equal(approvedOnly.ok, true);
    if (!approvedOnly.ok) return;
    assert.ok(approvedOnly.items.some((i) => i.clinicId === clinicB.id));
    assert.ok(!approvedOnly.items.some((i) => i.clinicId === clinicA.id));
  });

  it("respects --limit", async () => {
    const deps = buildDeps();
    for (let i = 0; i < 5; i++) {
      const clinic = await seedClinic(deps, `limit-clinic-${i}`);
      const crawlJob = await seedCrawlJob(deps, clinic.id);
      await seedScore(deps, crawlJob.id, clinic.id);
    }
    const result = await listReviewQueue({ limit: 2 }, deps);
    assert.equal(result.ok, true);
    if (!result.ok) return;
    assert.equal(result.items.length, 2);
  });
});

describe("recordReviewDecision", () => {
  it("2. an 'approved' decision is recorded", async () => {
    const deps = buildDeps();
    const clinic = await seedClinic(deps, "approve-me");
    const crawlJob = await seedCrawlJob(deps, clinic.id);
    await seedScore(deps, crawlJob.id, clinic.id);

    const result = await recordReviewDecision({ clinicId: clinic.id, decision: "approved" }, deps);
    assert.equal(result.ok, true);
    if (!result.ok) return;
    assert.equal(result.decision.decision, "approved");
    assert.equal(result.decision.clinicId, clinic.id);
    assert.equal(deps.humanReviewRepo.decisions.length, 1);
  });

  it("3. a 'rejected' decision is recorded", async () => {
    const deps = buildDeps();
    const clinic = await seedClinic(deps, "reject-me");
    const crawlJob = await seedCrawlJob(deps, clinic.id);
    await seedScore(deps, crawlJob.id, clinic.id);

    const result = await recordReviewDecision({ clinicId: clinic.id, decision: "rejected" }, deps);
    assert.equal(result.ok, true);
    if (!result.ok) return;
    assert.equal(result.decision.decision, "rejected");
  });

  it("4. a 'needs_changes' decision is recorded", async () => {
    const deps = buildDeps();
    const clinic = await seedClinic(deps, "needs-changes-me");
    const crawlJob = await seedCrawlJob(deps, clinic.id);
    await seedScore(deps, crawlJob.id, clinic.id);

    const result = await recordReviewDecision({ clinicId: clinic.id, decision: "needs_changes" }, deps);
    assert.equal(result.ok, true);
    if (!result.ok) return;
    assert.equal(result.decision.decision, "needs_changes");
  });

  it("5. reviewer notes are stored verbatim", async () => {
    const deps = buildDeps();
    const clinic = await seedClinic(deps, "notes-clinic");
    const crawlJob = await seedCrawlJob(deps, clinic.id);
    await seedScore(deps, crawlJob.id, clinic.id);

    const result = await recordReviewDecision(
      { clinicId: clinic.id, decision: "needs_changes", reviewerNotes: "Ajustar screenshot mobile antes de reenviar.", reviewer: "AB" },
      deps,
    );
    assert.equal(result.ok, true);
    if (!result.ok) return;
    assert.equal(result.decision.reviewerNotes, "Ajustar screenshot mobile antes de reenviar.");
    assert.equal(result.decision.reviewer, "AB");
  });

  it("6. reviewed_at is set to a real timestamp", async () => {
    const deps = buildDeps();
    const clinic = await seedClinic(deps, "reviewed-at-clinic");
    const crawlJob = await seedCrawlJob(deps, clinic.id);
    await seedScore(deps, crawlJob.id, clinic.id);

    const before = Date.now();
    const result = await recordReviewDecision({ clinicId: clinic.id, decision: "approved" }, deps);
    const after = Date.now();
    assert.equal(result.ok, true);
    if (!result.ok) return;
    const reviewedAtMs = new Date(result.decision.reviewedAt).getTime();
    assert.ok(reviewedAtMs >= before && reviewedAtMs <= after, "reviewed_at should be a real, current timestamp");
  });

  it("8. no outreach send path exists — approving a clinic never marks any outreach message sent or mutates outreach_messages", async () => {
    const deps = buildDeps();
    const clinic = await seedClinic(deps, "no-outreach-send");
    const crawlJob = await seedCrawlJob(deps, clinic.id);
    await seedScore(deps, crawlJob.id, clinic.id);
    const built = buildOutreachDraft({
      clinicDisplayName: clinic.displayName,
      channel: "email",
      observations: [{ observation: "Telefone público encontrado." }],
      doNotContact: false,
    });
    if (!built.ok) return assert.fail();
    const draft = await deps.outreachRepo.createDraft({ clinicId: clinic.id, draft: built.draft, doNotContact: false });
    if (!draft.ok) return assert.fail();

    let markSentCalled = false;
    let approveCalled = false;
    const originalMarkSent = deps.outreachRepo.markSent.bind(deps.outreachRepo);
    const originalApprove = deps.outreachRepo.approve.bind(deps.outreachRepo);
    deps.outreachRepo.markSent = (async (id: string) => {
      markSentCalled = true;
      return originalMarkSent(id);
    }) as typeof deps.outreachRepo.markSent;
    deps.outreachRepo.approve = (async (id: string, reviewedBy: string) => {
      approveCalled = true;
      return originalApprove(id, reviewedBy);
    }) as typeof deps.outreachRepo.approve;

    const result = await recordReviewDecision({ clinicId: clinic.id, decision: "approved" }, deps);
    assert.equal(result.ok, true);
    if (!result.ok) return;
    // The decision links to the draft for traceability...
    assert.equal(result.decision.outreachMessageId, draft.value.id);
    // ...but never touches its status.
    assert.equal(markSentCalled, false);
    assert.equal(approveCalled, false);
    const stillDraft = await deps.outreachRepo.getMessage(draft.value.id);
    assert.equal(stillDraft.ok, true);
    if (stillDraft.ok) assert.equal(stillDraft.value.status, "draft");
  });

  it("9. no automatic approval — a queue listing alone never creates a decision, and no default/inferred decision exists", async () => {
    const deps = buildDeps();
    const clinic = await seedClinic(deps, "no-auto-approval");
    const crawlJob = await seedCrawlJob(deps, clinic.id);
    await seedScore(deps, crawlJob.id, clinic.id);

    // Listing the queue (read-only) must never itself record a decision.
    await listReviewQueue({}, deps);
    await listReviewQueue({ status: "pending" }, deps);
    assert.equal(deps.humanReviewRepo.decisions.length, 0);

    const latest = await deps.humanReviewRepo.getLatestDecisionForClinic(clinic.id);
    assert.equal(latest.ok, true);
    if (latest.ok) assert.equal(latest.value, null);
  });

  it("10. an invalid decision string is rejected, not silently coerced", async () => {
    const deps = buildDeps();
    const clinic = await seedClinic(deps, "invalid-decision-clinic");
    const crawlJob = await seedCrawlJob(deps, clinic.id);
    await seedScore(deps, crawlJob.id, clinic.id);

    const result = await recordReviewDecision({ clinicId: clinic.id, decision: "approve_automatically" }, deps);
    assert.equal(result.ok, false);
    if (result.ok) return;
    assert.equal(result.reason, "invalid_decision");
    assert.equal(deps.humanReviewRepo.decisions.length, 0);
  });

  it("11. a missing clinic is rejected with not_found", async () => {
    const deps = buildDeps();
    const result = await recordReviewDecision({ clinicId: "does-not-exist", decision: "approved" }, deps);
    assert.equal(result.ok, false);
    if (result.ok) return;
    assert.equal(result.reason, "not_found");
    assert.equal(deps.humanReviewRepo.decisions.length, 0);
  });

  it("12. the metadata shape is stable — always exactly scoreTotalAtReview and clinicStatusAtReview", async () => {
    const deps = buildDeps();
    const clinic = await seedClinic(deps, "metadata-shape-clinic");
    const crawlJob = await seedCrawlJob(deps, clinic.id);
    await seedScore(deps, crawlJob.id, clinic.id);

    const result = await recordReviewDecision({ clinicId: clinic.id, decision: "approved" }, deps);
    assert.equal(result.ok, true);
    if (!result.ok) return;
    assert.deepEqual(Object.keys(result.decision.metadata).sort(), ["clinicStatusAtReview", "scoreTotalAtReview"]);
    assert.equal(typeof result.decision.metadata.scoreTotalAtReview, "number");
    assert.equal(result.decision.metadata.clinicStatusAtReview, clinic.status);

    // Also stable when no score exists yet.
    const clinicNoScore = await seedClinic(deps, "metadata-shape-no-score");
    const resultNoScore = await recordReviewDecision({ clinicId: clinicNoScore.id, decision: "rejected" }, deps);
    assert.equal(resultNoScore.ok, true);
    if (!resultNoScore.ok) return;
    assert.deepEqual(Object.keys(resultNoScore.decision.metadata).sort(), ["clinicStatusAtReview", "scoreTotalAtReview"]);
    assert.equal(resultNoScore.decision.metadata.scoreTotalAtReview, null);
  });

  it("auto-links the clinic's latest crawl job and score when --crawl-job-id is omitted", async () => {
    const deps = buildDeps();
    const clinic = await seedClinic(deps, "auto-link-clinic");
    const crawlJob = await seedCrawlJob(deps, clinic.id);
    const score = await seedScore(deps, crawlJob.id, clinic.id);

    const result = await recordReviewDecision({ clinicId: clinic.id, decision: "approved" }, deps);
    assert.equal(result.ok, true);
    if (!result.ok) return;
    assert.equal(result.decision.crawlJobId, crawlJob.id);
    assert.equal(result.decision.scoreId, score.id);
  });

  it("is append-only: a second decision for the same clinic adds a new row rather than overwriting the first", async () => {
    const deps = buildDeps();
    const clinic = await seedClinic(deps, "append-only-clinic");
    const crawlJob = await seedCrawlJob(deps, clinic.id);
    await seedScore(deps, crawlJob.id, clinic.id);

    await recordReviewDecision({ clinicId: clinic.id, decision: "needs_changes", reviewerNotes: "Primeira rodada." }, deps);
    await recordReviewDecision({ clinicId: clinic.id, decision: "approved", reviewerNotes: "Ajustado, aprovado." }, deps);

    const history = await deps.humanReviewRepo.listDecisionsForClinic(clinic.id);
    assert.equal(history.ok, true);
    if (!history.ok) return;
    assert.equal(history.value.length, 2);

    const latest = await deps.humanReviewRepo.getLatestDecisionForClinic(clinic.id);
    assert.equal(latest.ok, true);
    if (!latest.ok) return;
    assert.equal(latest.value?.decision, "approved");
  });
});

describe("human review queue: production is refused", () => {
  it("7. the review-queue/review-decision CLIs' repository-selection gate refuses production regardless of --target", () => {
    const env: LeadCaptureEnv = {
      supabaseUrl: `https://${KNOWN_PROJECT_REFS.production}.supabase.co`,
      supabaseServiceRoleKey: "x",
      resendApiKey: null,
      leadNotificationEmail: null,
      leadFromEmail: null,
      turnstileSiteKey: null,
      turnstileSecretKey: null,
      leadHashSecret: "x",
      siteUrl: null,
    };
    const selection = selectRepositories({ dryRun: false, target: "staging", env });
    assert.equal(selection.ok, false);
    if (selection.ok) return;
    assert.match(selection.reason, /production/);
  });

  it("dry-run wires a humanReviewRepo fake, never a real Supabase client", () => {
    const env: LeadCaptureEnv = {
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
    const selection = selectRepositories({ dryRun: true, env });
    assert.equal(selection.ok, true);
    if (!selection.ok) return;
    assert.ok(selection.value.humanReviewRepo instanceof FakeHumanReviewRepository);
  });
});

describe("human_review_decisions migration: additive-only safety", () => {
  it("13. the migration only ever creates, never drops or destructively alters existing schema", () => {
    const migrationsDir = join(root, "supabase/migrations");
    const files = readdirSync(migrationsDir).filter((f) => f.endsWith(".sql"));
    const target = files.find((f) => f.includes("human_review_decisions"));
    assert.ok(target, "expected a human_review_decisions migration file to exist");

    const sql = readFileSync(join(migrationsDir, target!), "utf8").toLowerCase();

    // Must create the new table additively.
    assert.match(sql, /create table if not exists public\.human_review_decisions/);

    // Must never drop or destructively alter anything.
    for (const forbidden of [/drop table/, /drop column/, /truncate/, /delete from/, /alter table public\.clinics/, /alter table public\.scores/, /alter table public\.outreach_messages/]) {
      assert.doesNotMatch(sql, forbidden, `migration must not contain: ${forbidden}`);
    }

    // Follows the same RLS/service_role pattern as every existing table.
    assert.match(sql, /alter table public\.human_review_decisions enable row level security/);
    assert.match(sql, /revoke all on table public\.human_review_decisions from anon, authenticated/);
    assert.match(sql, /grant all on table public\.human_review_decisions to service_role/);

    // Decision values are constrained to exactly the three valid ones.
    assert.match(sql, /check \(decision in \('approved', 'rejected', 'needs_changes'\)\)/);
  });

  it("every existing migration file remains additive-only (no destructive statements were introduced anywhere in this change)", () => {
    const migrationsDir = join(root, "supabase/migrations");
    const files = readdirSync(migrationsDir).filter((f) => f.endsWith(".sql"));
    for (const file of files) {
      const sql = readFileSync(join(migrationsDir, file), "utf8").toLowerCase();
      assert.doesNotMatch(sql, /drop table/, `${file} must not drop a table`);
      assert.doesNotMatch(sql, /\btruncate\b/, `${file} must not truncate a table`);
    }
  });
});
