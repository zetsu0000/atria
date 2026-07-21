/**
 * Builds the human review package: a cleaner, internal/commercial-review
 * repackaging of the operational report, for a human to approve before any
 * contact with a clinic. Read-only — never crawls, never calls an external
 * API, never creates or sends anything. Reuses buildOperationalReport for
 * all repository-querying and missing-data handling, then transforms its
 * output; it does not re-implement that logic.
 *
 * Suggested WhatsApp/email drafts:
 *  - If a persisted `outreach_messages` draft already exists for that
 *    channel, it is surfaced as-is (`persisted: true`).
 *  - Otherwise, one is computed fresh, in-memory only, from the same
 *    evidence used for scoring (via lib/outreach/draft.ts's
 *    buildOutreachDraft) — never persisted by this builder, never sent.
 *  - Only unavailable when there is no evidence to draft from at all, or
 *    the clinic is marked do_not_contact.
 *
 * Missing-data handling mirrors buildOperationalReport:
 *  - Score missing → fails with reason "missing_score" unless
 *    `allowIncomplete` is set, in which case the pack is still built with
 *    `status: "incomplete_review_pack"`.
 *  - Screenshots / extracted content / outreach drafts missing → the pack
 *    is still generated; each section reports its own status and a note is
 *    added to `warnings`. Always non-fatal.
 */
import type { ClinicRepository } from "@/lib/operations/repositories/clinic-repository";
import type { CrawlRepository } from "@/lib/operations/repositories/crawl-repository";
import type { ExtractionRepository } from "@/lib/operations/repositories/extraction-repository";
import type { ScoreRepository } from "@/lib/operations/repositories/score-repository";
import type { OutreachRepository } from "@/lib/operations/repositories/outreach-repository";
import type { OutreachMessageRecord, RepoErrorReason } from "@/lib/operations/repositories/types";
import { buildOperationalReport } from "@/lib/operations/report/build-operational-report";
import type { OperationalReport, ScoreDimensionKey } from "@/lib/operations/report/types";
import { buildOutreachDraft } from "@/lib/outreach/draft";
import type { HumanReviewPack, RiskFlag, SuggestedMessageDraft } from "./types";

export type BuildHumanReviewPackInput = {
  clinicId: string;
  crawlJobId?: string;
  allowIncomplete?: boolean;
};

export type BuildHumanReviewPackDeps = {
  clinicRepo: ClinicRepository;
  crawlRepo: CrawlRepository;
  extractionRepo: ExtractionRepository;
  scoreRepo: ScoreRepository;
  outreachRepo: OutreachRepository;
};

export type BuildHumanReviewPackResult =
  | { ok: true; pack: HumanReviewPack }
  | { ok: false; reason: RepoErrorReason | "missing_score"; message: string };

const DIMENSION_ORDER: ScoreDimensionKey[] = ["credibility", "clarity", "mobile", "actionability", "freshness"];

function latestByChannel(
  messages: OutreachMessageRecord[],
  channel: "email" | "whatsapp_manual",
): OutreachMessageRecord | null {
  const matching = messages.filter((m) => m.channel === channel);
  if (matching.length === 0) return null;
  return matching.reduce((a, b) => (a.createdAt >= b.createdAt ? a : b));
}

/** Only ever reads a phone number the site itself already published as a click-to-chat link — never guessed or inferred. */
function whatsappDigitsFromContacts(report: OperationalReport): string | null {
  const contact = report.extractedContentSummary.contacts.find((c) => c.kind === "whatsapp");
  if (!contact) return null;
  try {
    const url = new URL(contact.value);
    const phone = url.searchParams.get("phone");
    return phone && /^\d{10,15}$/.test(phone) ? phone : null;
  } catch {
    return null;
  }
}

function fromPersisted(message: OutreachMessageRecord): SuggestedMessageDraft {
  return {
    channel: message.channel === "whatsapp_manual" ? "whatsapp_manual" : "email",
    available: true,
    unavailableReason: null,
    subject: message.subject,
    body: message.body,
    clickToChatUrl: message.clickToChatUrl,
    status: "draft",
    reviewRequired: true,
    persisted: true,
    persistedMessageId: message.id,
  };
}

function unavailableDraft(channel: "email" | "whatsapp_manual", reason: string): SuggestedMessageDraft {
  return {
    channel,
    available: false,
    unavailableReason: reason,
    subject: null,
    body: null,
    clickToChatUrl: null,
    status: null,
    reviewRequired: true,
    persisted: false,
    persistedMessageId: null,
  };
}

function computeFreshDraft(
  channel: "email" | "whatsapp_manual",
  clinicDisplayName: string,
  observations: Array<{ observation: string; sourceUrl: string | null }>,
  doNotContact: boolean,
  whatsappDigits: string | null,
): SuggestedMessageDraft {
  if (doNotContact) return unavailableDraft(channel, "Clinic is marked do_not_contact.");
  if (observations.length === 0) {
    return unavailableDraft(channel, "No evidence available yet to draft outreach — score/evidence missing.");
  }
  const built = buildOutreachDraft({
    clinicDisplayName,
    channel,
    observations,
    whatsappDigits: channel === "whatsapp_manual" ? whatsappDigits : undefined,
    doNotContact,
  });
  if (!built.ok) return unavailableDraft(channel, built.message);
  return {
    channel,
    available: true,
    unavailableReason: null,
    subject: built.draft.subject ?? null,
    body: built.draft.body,
    clickToChatUrl: built.draft.clickToChatUrl ?? null,
    status: "draft",
    reviewRequired: true,
    persisted: false,
    persistedMessageId: null,
  };
}

function riskFlagsFor(report: OperationalReport, doNotContact: boolean, doNotContactReason: string | null): RiskFlag[] {
  const flags: RiskFlag[] = [];

  if (doNotContact) {
    flags.push({
      code: "do_not_contact",
      severity: "high",
      message: doNotContactReason
        ? `Clinic is marked do_not_contact: ${doNotContactReason}`
        : "Clinic is marked do_not_contact.",
    });
  }

  if (!report.websiteAnalyzed.crawlJobId) {
    flags.push({ code: "no_crawl_job", severity: "high", message: "No crawl job found for this clinic." });
  } else if (report.websiteAnalyzed.crawlStatus === "failed") {
    flags.push({ code: "crawl_failed", severity: "high", message: "The most recent crawl job failed." });
  } else if (report.websiteAnalyzed.crawlStatus === "partial") {
    flags.push({
      code: "crawl_partial",
      severity: "medium",
      message: "The most recent crawl job only partially completed (page limit or fetch failures) — content may be incomplete.",
    });
  }

  if (!report.scoreSummary.available) {
    flags.push({ code: "missing_score", severity: "high", message: "No score is available for this clinic/crawl job." });
  } else if (report.scoreSummary.total !== null && report.scoreSummary.total < 50) {
    flags.push({
      code: "low_score",
      severity: "medium",
      message: `Digital presence score is low (${report.scoreSummary.total}/100) — review before positioning this as a light-touch improvement.`,
    });
  }

  if (report.screenshots.desktop.status === "missing" || report.screenshots.desktop.status === "capture_failed") {
    flags.push({ code: "missing_screenshot_desktop", severity: "info", message: "Desktop homepage screenshot is missing or failed to capture." });
  }
  if (report.screenshots.mobile.status === "missing" || report.screenshots.mobile.status === "capture_failed") {
    flags.push({ code: "missing_screenshot_mobile", severity: "info", message: "Mobile homepage screenshot is missing or failed to capture." });
  }

  if (report.extractedContentSummary.contacts.some((c) => c.confidence === "low")) {
    flags.push({
      code: "low_confidence_contact_data",
      severity: "info",
      message: "Some extracted contact candidates have low confidence — verify before including in outreach.",
    });
  }

  if (report.extractedContentSummary.available && report.extractedContentSummary.requiresHumanReview) {
    flags.push({
      code: "requires_human_review",
      severity: "info",
      message: "Extracted content is flagged as requiring human review before commercial use.",
    });
  }

  return flags;
}

function internalSummaryFor(report: OperationalReport): string {
  const parts: string[] = [];
  parts.push(report.clinicIdentity.displayName);
  parts.push(
    report.scoreSummary.available
      ? `score ${report.scoreSummary.total}/100 (${report.scoreSummary.scoringVersion})`
      : "score indisponível",
  );
  parts.push(
    report.websiteAnalyzed.crawlJobId
      ? `crawl ${report.websiteAnalyzed.crawlStatus} (${report.websiteAnalyzed.pagesFetched ?? 0} páginas analisadas)`
      : "nenhum crawl encontrado",
  );
  const desktopOk = report.screenshots.desktop.status === "captured" || report.screenshots.desktop.status === "pending_storage";
  const mobileOk = report.screenshots.mobile.status === "captured" || report.screenshots.mobile.status === "pending_storage";
  parts.push(`screenshots: desktop ${desktopOk ? "capturado" : "pendente"}, mobile ${mobileOk ? "capturado" : "pendente"}`);
  return `${parts.join(" — ")}. Revisão humana obrigatória antes de qualquer contato.`;
}

function humanApprovalChecklist(): string[] {
  return [
    "Confirmar que nenhum dado de paciente foi coletado ou aparece neste pacote.",
    "Confirmar que o score e as evidências vêm do site público real (não valores genéricos ou inventados).",
    "Ler e ajustar manualmente os rascunhos de WhatsApp e e-mail antes de qualquer contato — nada é enviado automaticamente por este pacote.",
    "Confirmar que nenhuma alegação médica, depoimento, prêmio ou cliente foi adicionado além do que está nas evidências.",
    "Confirmar que a análise permanece restrita à apresentação digital/website — não avalia qualidade médica.",
    "Validar screenshots (quando disponíveis) antes de qualquer apresentação à clínica.",
    "Confirmar que a clínica não está marcada como do_not_contact antes de prosseguir.",
    "Aprovação humana explícita obrigatória antes de qualquer envio, por qualquer canal.",
  ];
}

export async function buildHumanReviewPack(
  input: BuildHumanReviewPackInput,
  deps: BuildHumanReviewPackDeps,
): Promise<BuildHumanReviewPackResult> {
  const reportResult = await buildOperationalReport(input, {
    clinicRepo: deps.clinicRepo,
    crawlRepo: deps.crawlRepo,
    extractionRepo: deps.extractionRepo,
    scoreRepo: deps.scoreRepo,
    outreachRepo: deps.outreachRepo,
  });
  if (!reportResult.ok) {
    return { ok: false, reason: reportResult.reason, message: reportResult.message };
  }
  const report = reportResult.report;
  const warnings = [...report.warnings];

  const clinicResult = await deps.clinicRepo.getClinic(input.clinicId);
  if (!clinicResult.ok) {
    return { ok: false, reason: clinicResult.reason, message: clinicResult.message };
  }
  const clinic = clinicResult.value;

  const outreachListResult = await deps.outreachRepo.listForClinic(input.clinicId);
  const outreachMessages = outreachListResult.ok ? outreachListResult.value : [];

  const observations = DIMENSION_ORDER.flatMap((key) =>
    report.evidenceByDimension[key].map((e) => ({ observation: e.reason, sourceUrl: e.sourceUrl })),
  );
  const whatsappDigits = whatsappDigitsFromContacts(report);

  const persistedEmail = latestByChannel(outreachMessages, "email");
  const suggestedEmailDraft = persistedEmail
    ? fromPersisted(persistedEmail)
    : computeFreshDraft("email", clinic.displayName, observations, clinic.doNotContact, whatsappDigits);
  if (!persistedEmail) warnings.push("No persisted email outreach draft found — a suggested draft was generated fresh for this package only.");

  const persistedWhatsapp = latestByChannel(outreachMessages, "whatsapp_manual");
  const suggestedWhatsappDraft = persistedWhatsapp
    ? fromPersisted(persistedWhatsapp)
    : computeFreshDraft("whatsapp_manual", clinic.displayName, observations, clinic.doNotContact, whatsappDigits);
  if (!persistedWhatsapp) warnings.push("No persisted WhatsApp outreach draft found — a suggested draft was generated fresh for this package only.");
  if (suggestedWhatsappDraft.available && !suggestedWhatsappDraft.clickToChatUrl) {
    warnings.push("No WhatsApp click-to-chat number could be read from the site's own published links — add one manually before contact.");
  }

  const pack: HumanReviewPack = {
    status: report.status === "incomplete_report" ? "incomplete_review_pack" : "draft",
    reviewRequired: true,
    generatedAt: report.generatedAt,
    disclaimer: report.disclaimer,

    internalSummary: internalSummaryFor(report),

    clinicIdentity: report.clinicIdentity,
    provenance: report.provenance,
    websiteAnalyzed: report.websiteAnalyzed,
    scoreSummary: report.scoreSummary,
    scoreDimensions: report.scoreDimensions,
    screenshots: report.screenshots,

    keyIssues: report.mainIssues,
    suggestedOutreachAngle: report.suggestedImprovementAngle,

    suggestedWhatsappDraft,
    suggestedEmailDraft,

    humanApprovalChecklist: humanApprovalChecklist(),
    riskFlags: riskFlagsFor(report, clinic.doNotContact, clinic.doNotContactReason),

    warnings,
  };

  return { ok: true, pack };
}
