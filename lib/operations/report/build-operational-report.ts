/**
 * Builds the "Raio-X da Primeira Impressão Digital" operational report from
 * already-persisted data (clinic, crawl job, score, scan_assets,
 * extracted_content, outreach draft). Read-only — never crawls, never
 * calls an external API, never creates or sends anything.
 *
 * Missing-data handling:
 *  - Score missing → fails with reason "missing_score" unless
 *    `allowIncomplete` is set, in which case the report is still built with
 *    `status: "incomplete_report"`.
 *  - Screenshots / extracted content / outreach draft missing → the report
 *    is still generated; each section reports its own "missing" status
 *    and a note is added to `warnings`. This is always non-fatal.
 */
import type { ClinicRepository } from "@/lib/operations/repositories/clinic-repository";
import type { CrawlRepository } from "@/lib/operations/repositories/crawl-repository";
import type { ExtractionRepository } from "@/lib/operations/repositories/extraction-repository";
import type { ScoreRepository } from "@/lib/operations/repositories/score-repository";
import type { OutreachRepository } from "@/lib/operations/repositories/outreach-repository";
import type { ScanAssetRecord, ScoreRecord } from "@/lib/operations/repositories/types";
import type { RepoErrorReason } from "@/lib/operations/repositories/types";
import { SCORE_DISCLAIMER } from "@/lib/score/calculate";
import type {
  EvidenceEntry,
  OperationalReport,
  ScoreDimensionKey,
  ScreenshotSection,
  ScreenshotSectionStatus,
} from "./types";

export type BuildOperationalReportInput = {
  clinicId: string;
  crawlJobId?: string;
  allowIncomplete?: boolean;
};

export type BuildOperationalReportDeps = {
  clinicRepo: ClinicRepository;
  crawlRepo: CrawlRepository;
  extractionRepo: ExtractionRepository;
  scoreRepo: ScoreRepository;
  outreachRepo: OutreachRepository;
};

export type BuildOperationalReportResult =
  | { ok: true; report: OperationalReport }
  | { ok: false; reason: RepoErrorReason | "missing_score"; message: string };

const DIMENSION_LABELS: Record<ScoreDimensionKey, string> = {
  credibility: "Credibilidade",
  clarity: "Clareza",
  mobile: "Mobile",
  actionability: "Conversão / Contato e ação",
  freshness: "Atualização",
};

const CONTACT_KINDS = new Set(["phone", "email", "whatsapp", "social_link"]);

const IMPROVEMENT_ANGLES: Record<ScoreDimensionKey, string> = {
  credibility:
    "Considerar reforçar informações institucionais visíveis (equipe, contato, endereço) na página inicial.",
  clarity:
    "Considerar estruturar melhor o conteúdo com headings e descrições claras dos serviços oferecidos.",
  mobile:
    "Avaliação visual mobile pendente de revisão humana; considerar revisar a experiência em smartphones.",
  actionability:
    "Considerar destacar canais de contato (telefone/WhatsApp) de forma mais visível na página.",
  freshness:
    "Considerar sinais de atualização recente (redes sociais ativas, múltiplas páginas públicas acessíveis).",
};

function screenshotSectionFor(asset: ScanAssetRecord | null): ScreenshotSection {
  if (!asset) {
    return { status: "missing", assetId: null, storagePath: null, capturedAt: null };
  }
  const metadata = asset.metadata as Record<string, unknown>;
  const captureStatus =
    typeof metadata.captureStatus === "string" ? (metadata.captureStatus as ScreenshotSectionStatus) : null;
  const capturedAt = typeof metadata.capturedAt === "string" ? metadata.capturedAt : null;
  const storagePath = asset.storagePath && asset.storagePath.length > 0 ? asset.storagePath : null;
  return {
    status: captureStatus ?? (storagePath ? "captured" : "pending_storage"),
    assetId: asset.id,
    storagePath,
    capturedAt,
  };
}

function evidenceByDimensionFrom(score: ScoreRecord | null): Record<ScoreDimensionKey, EvidenceEntry[]> {
  const empty: Record<ScoreDimensionKey, EvidenceEntry[]> = {
    credibility: [],
    clarity: [],
    mobile: [],
    actionability: [],
    freshness: [],
  };
  if (!score) return empty;
  for (const entry of score.evidence) {
    const key = entry.dimension as ScoreDimensionKey;
    if (!(key in empty)) continue;
    empty[key].push({ reason: entry.reason, sourceUrl: entry.sourceUrl ?? null, points: entry.points });
  }
  return empty;
}

const LOW_SCORE_THRESHOLD = 12;

function mainIssuesFrom(score: ScoreRecord | null, evidenceByDimension: Record<ScoreDimensionKey, EvidenceEntry[]>): string[] {
  if (!score) return [];
  const issues: string[] = [];
  const dims: ScoreDimensionKey[] = ["credibility", "clarity", "mobile", "actionability", "freshness"];
  for (const key of dims) {
    const points = score[key];
    if (points < LOW_SCORE_THRESHOLD) {
      const firstReason = evidenceByDimension[key][0]?.reason;
      issues.push(
        `${DIMENSION_LABELS[key]} abaixo do esperado (${points}/20)${firstReason ? `: ${firstReason}` : "."}`,
      );
    }
  }
  return issues;
}

function suggestedImprovementAngleFrom(score: ScoreRecord | null): string {
  if (!score) return "Score pendente — gerar score antes de sugerir ângulo de melhoria.";
  const dims: ScoreDimensionKey[] = ["credibility", "clarity", "mobile", "actionability", "freshness"];
  let lowest: ScoreDimensionKey = "credibility";
  for (const key of dims) {
    if (score[key] < score[lowest]) lowest = key;
  }
  return IMPROVEMENT_ANGLES[lowest];
}

function humanReviewChecklist(): string[] {
  return [
    "Confirmar que nenhum dado de paciente foi coletado ou aparece neste relatório.",
    "Confirmar que o score reflete evidências reais extraídas do site público (não um valor genérico).",
    "Revisar e ajustar o rascunho de outreach antes de qualquer contato — nada é enviado automaticamente.",
    "Não adicionar CRM, RQE, credenciais, depoimentos, prêmios ou alegações médicas que não estejam nas evidências.",
    "Validar screenshots (quando disponíveis) antes de qualquer apresentação ao cliente.",
    "Confirmar que a clínica não está marcada como do_not_contact antes de prosseguir.",
    "Aprovação humana obrigatória antes de qualquer envio — este relatório é apenas material de preparação.",
  ];
}

export async function buildOperationalReport(
  input: BuildOperationalReportInput,
  deps: BuildOperationalReportDeps,
): Promise<BuildOperationalReportResult> {
  const clinicResult = await deps.clinicRepo.getClinic(input.clinicId);
  if (!clinicResult.ok) {
    return { ok: false, reason: clinicResult.reason, message: clinicResult.message };
  }
  const clinic = clinicResult.value;
  const warnings: string[] = [];

  let crawlJob = null;
  if (input.crawlJobId) {
    const r = await deps.crawlRepo.getCrawlJob(input.crawlJobId);
    if (r.ok) crawlJob = r.value;
    else warnings.push(`Requested crawl job not found: ${r.message}`);
  } else {
    const r = await deps.crawlRepo.getLatestCrawlJobForClinic(input.clinicId);
    if (r.ok) crawlJob = r.value;
  }
  if (!crawlJob) warnings.push("No crawl job found for this clinic — website analysis section is empty.");

  let score: ScoreRecord | null = null;
  if (crawlJob) {
    const r = await deps.scoreRepo.getForCrawlJob(crawlJob.id);
    if (r.ok) score = r.value;
  }
  if (!score) {
    const r = await deps.scoreRepo.getLatestForClinic(input.clinicId);
    if (r.ok) score = r.value;
  }

  if (!score && !input.allowIncomplete) {
    return {
      ok: false,
      reason: "missing_score",
      message: "No score found for this clinic/crawl job. Pass --allow-incomplete to generate an incomplete_report instead.",
    };
  }
  if (!score) warnings.push("Score is missing — report generated as incomplete_report.");

  let assets: ScanAssetRecord[] = [];
  if (crawlJob) {
    const r = await deps.crawlRepo.listAssetsForCrawlJob(crawlJob.id);
    if (r.ok) assets = r.value;
  }
  const desktopAsset = assets.find((a) => a.assetType === "screenshot_desktop") ?? null;
  const mobileAsset = assets.find((a) => a.assetType === "screenshot_mobile") ?? null;
  if (!desktopAsset) warnings.push("Desktop homepage screenshot is missing or not yet captured.");
  if (!mobileAsset) warnings.push("Mobile homepage screenshot is missing or not yet captured.");

  let extraction = null;
  if (crawlJob) {
    const r = await deps.extractionRepo.getLatestForCrawlJob(crawlJob.id);
    if (r.ok) extraction = r.value;
  }
  if (!extraction) warnings.push("Extracted content is missing for this crawl job.");

  const outreachListResult = await deps.outreachRepo.listForClinic(input.clinicId);
  const outreachDrafts = outreachListResult.ok ? outreachListResult.value : [];
  const latestOutreach =
    outreachDrafts.length > 0
      ? outreachDrafts.reduce((a, b) => (a.createdAt >= b.createdAt ? a : b))
      : null;
  if (!latestOutreach) warnings.push("No outreach draft found for this clinic.");

  const evidenceByDimension = evidenceByDimensionFrom(score);
  const dims: ScoreDimensionKey[] = ["credibility", "clarity", "mobile", "actionability", "freshness"];

  const candidateCountsByKind: Record<string, number> = {};
  const contacts: OperationalReport["extractedContentSummary"]["contacts"] = [];
  if (extraction) {
    for (const candidate of extraction.candidates) {
      candidateCountsByKind[candidate.kind] = (candidateCountsByKind[candidate.kind] ?? 0) + 1;
      if (CONTACT_KINDS.has(candidate.kind)) {
        contacts.push({
          kind: candidate.kind,
          value: candidate.value,
          sourceUrl: candidate.sourceUrl,
          confidence: candidate.confidence,
        });
      }
    }
  }

  const report: OperationalReport = {
    status: score ? "draft" : "incomplete_report",
    reviewRequired: true,
    generatedAt: new Date().toISOString(),
    disclaimer: SCORE_DISCLAIMER,

    clinicIdentity: {
      clinicId: clinic.id,
      displayName: clinic.displayName,
      normalizedWebsiteOrigin: clinic.normalizedWebsiteOrigin,
      city: clinic.city,
      state: clinic.state,
      specialty: clinic.specialty,
      status: clinic.status,
    },

    provenance: {
      sourceType: clinic.sourceType,
      sourceAttribution: clinic.sourceAttribution,
      dedupeKey: clinic.dedupeKey,
      leadId: clinic.leadId,
    },

    websiteAnalyzed: {
      crawlJobId: crawlJob?.id ?? null,
      requestedUrl: crawlJob?.requestedUrl ?? null,
      normalizedOrigin: crawlJob?.normalizedOrigin ?? null,
      crawlStatus: crawlJob?.status ?? null,
      pagesFetched: crawlJob?.pagesFetched ?? null,
      pagesDiscovered: crawlJob?.pagesDiscovered ?? null,
      pagesFailed: crawlJob?.pagesFailed ?? null,
      startedAt: crawlJob?.startedAt ?? null,
      completedAt: crawlJob?.completedAt ?? null,
    },

    scoreSummary: {
      available: Boolean(score),
      total: score?.total ?? null,
      scoringVersion: score?.scoringVersion ?? null,
      reviewStatus: score?.reviewStatus ?? null,
    },

    scoreDimensions: dims.map((key) => ({
      key,
      labelPt: DIMENSION_LABELS[key],
      points: score ? score[key] : null,
      max: 20,
    })),

    evidenceByDimension,

    screenshots: {
      desktop: screenshotSectionFor(desktopAsset),
      mobile: screenshotSectionFor(mobileAsset),
    },

    extractedContentSummary: {
      available: Boolean(extraction),
      schemaVersion: extraction?.schemaVersion ?? null,
      requiresHumanReview: extraction?.requiresHumanReview ?? true,
      candidateCountsByKind,
      contacts,
    },

    mainIssues: mainIssuesFrom(score, evidenceByDimension),
    suggestedImprovementAngle: suggestedImprovementAngleFrom(score),

    outreachDraft: {
      available: Boolean(latestOutreach),
      channel: latestOutreach?.channel ?? null,
      subject: latestOutreach?.subject ?? null,
      body: latestOutreach?.body ?? null,
      status: latestOutreach?.status ?? null,
      clickToChatUrl: latestOutreach?.clickToChatUrl ?? null,
    },

    humanReviewChecklist: humanReviewChecklist(),

    warnings,
  };

  return { ok: true, report };
}
