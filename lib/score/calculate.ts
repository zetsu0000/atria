import { z } from "zod";
import type { ExtractionCandidate } from "@/lib/crawler/extraction-types";

export const SCORE_DISCLAIMER =
  "Esta análise avalia apenas a apresentação digital e a facilidade de encontrar informações. Não avalia qualidade médica.";

export const SCORE_DIMENSION_MAX = 20 as const;
export const SCORE_TOTAL_MAX = 100 as const;
export const SCORE_VERSION = "v1" as const;

export const scoreEvidenceSchema = z.object({
  dimension: z.enum([
    "credibility",
    "clarity",
    "mobile",
    "actionability",
    "freshness",
  ]),
  points: z.number().int().min(0).max(SCORE_DIMENSION_MAX),
  reason: z.string().min(1).max(500),
  sourceUrl: z.string().max(2048).optional().nullable(),
});

export type ScoreEvidence = z.infer<typeof scoreEvidenceSchema>;

export const digitalScoreSchema = z
  .object({
    credibility: z.number().int().min(0).max(SCORE_DIMENSION_MAX),
    clarity: z.number().int().min(0).max(SCORE_DIMENSION_MAX),
    mobile: z.number().int().min(0).max(SCORE_DIMENSION_MAX),
    /** PRODUCT.md: Contato e ação — ease of contact, not commercial conversion. */
    actionability: z.number().int().min(0).max(SCORE_DIMENSION_MAX),
    freshness: z.number().int().min(0).max(SCORE_DIMENSION_MAX),
    total: z.number().int().min(0).max(SCORE_TOTAL_MAX),
    evidence: z.array(scoreEvidenceSchema).min(1),
    disclaimer: z.literal(SCORE_DISCLAIMER),
    scoringVersion: z.string().min(1).max(64),
    reviewStatus: z.enum([
      "pending_review",
      "approved",
      "rejected",
      "needs_review",
      "adjusted",
    ]),
  })
  .refine(
    (s) =>
      s.total ===
      s.credibility + s.clarity + s.mobile + s.actionability + s.freshness,
    { message: "total must equal sum of dimensions" },
  );

export type DigitalScore = z.infer<typeof digitalScoreSchema>;

export type ScoreDimensionKey = "credibility" | "clarity" | "mobile" | "actionability" | "freshness";

export const SCORE_DIMENSION_ORDER: readonly ScoreDimensionKey[] = [
  "credibility",
  "clarity",
  "mobile",
  "actionability",
  "freshness",
];

export const SCORE_DIMENSION_LABELS_PT: Record<ScoreDimensionKey, string> = {
  credibility: "Credibilidade",
  clarity: "Clareza",
  mobile: "Mobile",
  actionability: "Conversão / Contato e ação",
  freshness: "Atualização",
};

/**
 * Why a site is unreachable (`pageCount === 0`) — calibrated in v1 to
 * distinguish *why* no evidence exists, since the three real-world causes
 * warrant genuinely different explanations for a human reader, even
 * though all three still score 0 in every dimension (there is, in every
 * case, zero real evidence to award points for):
 *  - `"no_website"`: the clinic has no website URL recorded at all —
 *    there was never anything to crawl.
 *  - `"robots_denied"`: the site itself explicitly disallowed crawling
 *    via robots.txt — respected, never bypassed.
 *  - `"unreachable_generic"` (the default when unspecified): any other
 *    reason a real crawl attempt still produced zero pages — connection
 *    failure, DNS failure, timeout, TLS/certificate error, or an
 *    unexpected error. There is currently no dedicated `CrawlErrorCode`
 *    that distinguishes a TLS/certificate failure from other low-level
 *    connection failures (see docs/technical/crawler-job-error-reason-fix.md's
 *    own documented limitation), so this bucket intentionally covers all
 *    of them with one honest, connection-oriented explanation rather
 *    than guessing a more specific cause that isn't actually known.
 */
export type UnreachableReasonCode = "no_website" | "robots_denied" | "unreachable_generic";

export type ScoreInput = {
  candidates: ExtractionCandidate[];
  /** Pages successfully fetched. 0 means the crawl could not reach any public page (e.g. TLS failure, DNS failure, timeout) — every dimension reflects this. */
  pageCount: number;
  hasDesktopScreenshotMeta?: boolean;
  hasMobileScreenshotMeta?: boolean;
  /** scan_assets row id, when known — referenced in the evidence text so score/report readers can look up the actual screenshot. */
  desktopScreenshotAssetId?: string | null;
  mobileScreenshotAssetId?: string | null;
  /**
   * The crawl job's requested URL, used only to check the `https:` scheme
   * for Credibilidade's "HTTPS válido" subcriterion. Optional — when
   * omitted, that specific bonus is simply not granted (no penalty, no
   * assumption), which is the correct "graceful handling of missing data"
   * behavior for callers that don't have this context.
   */
  requestedUrl?: string | null;
  /**
   * Only consulted when `pageCount === 0` — picks which explanation
   * `unreachableResult` uses. Defaults to `"unreachable_generic"` when
   * omitted, matching every existing caller's behavior unchanged.
   */
  unreachableReason?: UnreachableReasonCode | null;
  /**
   * True when this site is a known third-party directory/aggregator
   * listing (e.g. Doctoralia), not the clinic's own domain — the same
   * signal `lib/operations/prioritization/prioritize-prospects.ts`
   * already computes. When true, every dimension scores 0 with a clear
   * reason: a directory listing isn't a website the clinic could
   * commission Atria to modernize, so there is no real digital
   * presentation to evaluate, regardless of how much content the
   * directory page itself happens to show. Ignored when the site is
   * also unreachable (`pageCount === 0` takes priority — there's no way
   * to have confirmed it's a directory listing without reaching it).
   */
  isDirectoryListing?: boolean;
};

export type ScoreDimensionResult = {
  key: ScoreDimensionKey;
  labelPt: string;
  score: number;
  max: typeof SCORE_DIMENSION_MAX;
  /** Plain-language, evidence-tied explanation of how this dimension's score was reached — never a medical-quality or commercial-outcome claim. */
  rationale: string;
};

export type ScoreV1Result = {
  version: typeof SCORE_VERSION;
  totalScore: number;
  maxScore: typeof SCORE_TOTAL_MAX;
  dimensions: ScoreDimensionResult[];
  evidence: ScoreEvidence[];
  /** Data-availability notes — never medical or commercial claims (e.g. "no mobile screenshot available", "site unreachable during scan"). */
  warnings: string[];
  disclaimer: string;
};

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

type DimensionCalcResult = { score: number; evidence: ScoreEvidence[]; rationale: string };

const UNREACHABLE_REASON_TEXT: Record<UnreachableReasonCode, (label: string) => string> = {
  no_website: (label) =>
    `Nenhum site próprio cadastrado para esta clínica — não há evidência para avaliar ${label}.`,
  robots_denied: (label) =>
    `O site bloqueou o acesso via robots.txt (respeitado, sem bypass) — não há evidência para avaliar ${label}.`,
  unreachable_generic: (label) =>
    `Site inacessível durante o scan (possível falha de conexão, DNS, certificado/TLS ou timeout) — não há evidência real para avaliar ${label}.`,
};

/**
 * Shared "site unreachable" outcome for a single dimension — used when
 * `pageCount === 0` (the crawl could not fetch any public page). Every
 * dimension reports 0 with one clear, honest evidence entry tied to the
 * specific reason (`UnreachableReasonCode`), rather than silently
 * omitting the dimension, defaulting to an unearned baseline, or using
 * one generic explanation for every distinct cause.
 */
function unreachableResult(dimensionKey: ScoreDimensionKey, reasonCode: UnreachableReasonCode): DimensionCalcResult {
  const label = SCORE_DIMENSION_LABELS_PT[dimensionKey].toLowerCase();
  const reason = UNREACHABLE_REASON_TEXT[reasonCode](label);
  return {
    score: 0,
    evidence: [{ dimension: dimensionKey, points: 0, reason }],
    rationale: reason,
  };
}

/**
 * Shared "directory listing" outcome for a single dimension — used when
 * `isDirectoryListing` is true (and the site is otherwise reachable). A
 * third-party directory/aggregator page is not a website the clinic
 * could commission Atria to modernize, so every dimension scores 0 with
 * one clear, explicit reason — never silently treated the same as a
 * real, own-domain site regardless of how much content the directory
 * page happens to show.
 */
function directoryListingResult(dimensionKey: ScoreDimensionKey): DimensionCalcResult {
  const label = SCORE_DIMENSION_LABELS_PT[dimensionKey].toLowerCase();
  const reason = `Este site é uma listagem de diretório de terceiros, não o domínio próprio da clínica — sem site próprio para avaliar ${label}.`;
  return {
    score: 0,
    evidence: [{ dimension: dimensionKey, points: 0, reason }],
    rationale: reason,
  };
}

function scoreCredibility(
  input: ScoreInput,
  kinds: Set<string>,
  reachable: boolean,
  unreachableReasonCode: UnreachableReasonCode,
): DimensionCalcResult {
  if (!reachable) return unreachableResult("credibility", unreachableReasonCode);
  if (input.isDirectoryListing) return directoryListingResult("credibility");

  let score = 0;
  const evidence: ScoreEvidence[] = [];
  const rationaleParts: string[] = [];

  // Calibration v1: lowered from the original +6 — "at least one page
  // loaded" is a weak, easy-to-satisfy signal on its own; the points
  // freed up here fund the new desktop-screenshot criterion below,
  // which is stronger, harder-to-fake visual evidence.
  score += 4;
  evidence.push({
    dimension: "credibility",
    points: 4,
    reason: "Site acessível — pelo menos uma página pública foi carregada com sucesso durante o scan.",
  });
  rationaleParts.push("site acessível (+4)");

  const isHttps = typeof input.requestedUrl === "string" && input.requestedUrl.trim().toLowerCase().startsWith("https:");
  if (isHttps) {
    score += 4;
    evidence.push({
      dimension: "credibility",
      points: 4,
      reason: "Conexão HTTPS válida confirmada durante o acesso ao site.",
    });
    rationaleParts.push("HTTPS válido (+4)");
  } else {
    rationaleParts.push("HTTPS não confirmado (+0)");
  }

  if (kinds.has("title")) {
    score += 4;
    evidence.push({
      dimension: "credibility",
      points: 4,
      reason: "Título institucional encontrado na página pública.",
      sourceUrl: input.candidates.find((c) => c.kind === "title")?.sourceUrl,
    });
    rationaleParts.push("identidade institucional clara (+4)");
  } else {
    rationaleParts.push("título institucional não encontrado (+0)");
  }

  if (kinds.has("address") || kinds.has("phone") || kinds.has("email")) {
    score += 3;
    evidence.push({
      dimension: "credibility",
      points: 3,
      reason: "Contato ou endereço público candidato encontrado.",
    });
    rationaleParts.push("contato/endereço visível (+3)");
  } else {
    rationaleParts.push("contato/endereço não encontrado (+0)");
  }

  // Calibration v1: lowered from the original +3 to +2, funding the new
  // desktop-screenshot criterion below.
  if (kinds.has("team_name_candidate") || kinds.has("service_candidate")) {
    score += 2;
    evidence.push({
      dimension: "credibility",
      points: 2,
      reason: "Sinais de conteúdo institucional (equipe ou serviços) encontrados.",
    });
    rationaleParts.push("conteúdo institucional presente (+2)");
  } else {
    rationaleParts.push("sinais de conteúdo institucional não encontrados (+0)");
  }

  // Calibration v1 (new): a real, captured desktop screenshot is direct
  // visual proof the site exists and renders — stronger evidence than
  // "at least one page loaded" alone, so it's rewarded with real points
  // here (previously only a 0-point reference in Clareza).
  if (input.hasDesktopScreenshotMeta) {
    score += 3;
    evidence.push({
      dimension: "credibility",
      points: 3,
      reason: input.desktopScreenshotAssetId
        ? `Screenshot desktop capturado com sucesso (asset ${input.desktopScreenshotAssetId}; avaliação visual detalhada pendente de revisão humana).`
        : "Screenshot desktop capturado com sucesso (avaliação visual detalhada pendente de revisão humana).",
    });
    rationaleParts.push("screenshot desktop capturado (+3)");
  } else {
    evidence.push({
      dimension: "credibility",
      points: 0,
      reason: "Nenhum screenshot desktop disponível — evidência visual adicional ausente.",
    });
    rationaleParts.push("sem screenshot desktop disponível (+0)");
  }

  score = clamp(score, 0, SCORE_DIMENSION_MAX);
  return { score, evidence, rationale: `Credibilidade: ${rationaleParts.join(", ")}.` };
}

function scoreClarity(
  input: ScoreInput,
  kinds: Set<string>,
  reachable: boolean,
  unreachableReasonCode: UnreachableReasonCode,
): DimensionCalcResult {
  if (!reachable) return unreachableResult("clarity", unreachableReasonCode);
  if (input.isDirectoryListing) return directoryListingResult("clarity");

  let score = 0;
  const evidence: ScoreEvidence[] = [];
  const rationaleParts: string[] = [];

  if (kinds.has("heading")) {
    score += 5;
    evidence.push({ dimension: "clarity", points: 5, reason: "Headings estruturam o conteúdo visível." });
    rationaleParts.push("conteúdo estruturado com headings (+5)");
  } else {
    rationaleParts.push("sem headings estruturando o conteúdo (+0)");
  }

  if (kinds.has("service_candidate")) {
    score += 5;
    evidence.push({ dimension: "clarity", points: 5, reason: "Serviços ou especialidades candidatos detectados no conteúdo." });
    rationaleParts.push("serviços/especialidades visíveis (+5)");
  } else {
    rationaleParts.push("nenhum serviço/especialidade detectado (+0)");
  }

  if (kinds.has("meta_description")) {
    score += 4;
    evidence.push({ dimension: "clarity", points: 4, reason: "Meta description presente." });
    rationaleParts.push("meta description presente (+4)");
  } else {
    rationaleParts.push("meta description ausente (+0)");
  }

  if (kinds.has("visible_text")) {
    score += 4;
    evidence.push({
      dimension: "clarity",
      points: 4,
      reason: "Conteúdo textual visível suficiente para avaliação (não vazio ou puramente genérico).",
    });
    rationaleParts.push("conteúdo textual não vazio (+4)");
  } else {
    rationaleParts.push("conteúdo textual insuficiente ou não detectado (+0)");
  }

  if (kinds.has("page_link")) {
    score += 2;
    evidence.push({ dimension: "clarity", points: 2, reason: "Navegação interna com múltiplas páginas encontrada." });
    rationaleParts.push("navegação interna presente (+2)");
  }

  score = clamp(score, 0, SCORE_DIMENSION_MAX);
  return { score, evidence, rationale: `Clareza: ${rationaleParts.join(", ")}.` };
}

function scoreMobile(
  input: ScoreInput,
  kinds: Set<string>,
  reachable: boolean,
  unreachableReasonCode: UnreachableReasonCode,
): DimensionCalcResult {
  if (!reachable) return unreachableResult("mobile", unreachableReasonCode);
  if (input.isDirectoryListing) return directoryListingResult("mobile");

  let score = 0;
  const evidence: ScoreEvidence[] = [];
  const rationaleParts: string[] = [];

  if (input.hasMobileScreenshotMeta) {
    score += 10;
    evidence.push({
      dimension: "mobile",
      points: 10,
      reason: input.mobileScreenshotAssetId
        ? `Screenshot mobile capturado com sucesso (asset ${input.mobileScreenshotAssetId}; avaliação visual detalhada pendente de revisão humana).`
        : "Screenshot mobile capturado com sucesso (avaliação visual detalhada pendente de revisão humana).",
    });
    rationaleParts.push("screenshot mobile capturado (+10)");
  } else {
    evidence.push({
      dimension: "mobile",
      points: 0,
      reason: "Nenhum screenshot mobile disponível — não é possível confirmar a apresentação em dispositivos móveis.",
    });
    rationaleParts.push("sem screenshot mobile disponível (+0)");
  }

  if (kinds.has("whatsapp")) {
    score += 6;
    evidence.push({ dimension: "mobile", points: 6, reason: "Link de WhatsApp (canal mobile-first) encontrado." });
    rationaleParts.push("WhatsApp presente (+6)");
  } else {
    rationaleParts.push("WhatsApp não encontrado (+0)");
  }

  if (input.pageCount >= 2) {
    score += 4;
    evidence.push({
      dimension: "mobile",
      points: 4,
      reason: "Múltiplas páginas públicas acessíveis no scan (indício de estrutura navegável).",
    });
    rationaleParts.push("múltiplas páginas acessíveis (+4)");
  }

  score = clamp(score, 0, SCORE_DIMENSION_MAX);
  return { score, evidence, rationale: `Mobile: ${rationaleParts.join(", ")}.` };
}

function scoreActionability(
  input: ScoreInput,
  kinds: Set<string>,
  reachable: boolean,
  unreachableReasonCode: UnreachableReasonCode,
): DimensionCalcResult {
  if (!reachable) return unreachableResult("actionability", unreachableReasonCode);
  if (input.isDirectoryListing) return directoryListingResult("actionability");

  let score = 0;
  const evidence: ScoreEvidence[] = [];
  const rationaleParts: string[] = [];

  if (kinds.has("whatsapp") || kinds.has("phone")) {
    score += 8;
    evidence.push({ dimension: "actionability", points: 8, reason: "Telefone ou WhatsApp público candidato encontrado." });
    rationaleParts.push("telefone/WhatsApp visível (+8)");
  } else {
    rationaleParts.push("nenhum telefone/WhatsApp encontrado (+0)");
  }

  if (kinds.has("email")) {
    score += 4;
    evidence.push({ dimension: "actionability", points: 4, reason: "E-mail público candidato encontrado." });
    rationaleParts.push("e-mail visível (+4)");
  } else {
    rationaleParts.push("e-mail não encontrado (+0)");
  }

  if (input.candidates.some((c) => c.kind === "page_link" && /contato/i.test(c.value))) {
    score += 4;
    evidence.push({ dimension: "actionability", points: 4, reason: "Link interno para página de contato encontrado." });
    rationaleParts.push("página de contato encontrada (+4)");
  } else {
    rationaleParts.push("página de contato não encontrada (+0)");
  }

  if (input.candidates.some((c) => c.kind === "page_link" && /agend|marca[cç][aã]o/i.test(c.value))) {
    score += 4;
    evidence.push({ dimension: "actionability", points: 4, reason: "Link candidato de agendamento/marcação encontrado." });
    rationaleParts.push("caminho de agendamento encontrado (+4)");
  } else {
    rationaleParts.push("nenhum caminho de agendamento identificado (+0)");
  }

  score = clamp(score, 0, SCORE_DIMENSION_MAX);
  return { score, evidence, rationale: `Conversão/Contato e ação: ${rationaleParts.join(", ")}.` };
}

function scoreFreshness(
  input: ScoreInput,
  kinds: Set<string>,
  reachable: boolean,
  unreachableReasonCode: UnreachableReasonCode,
): DimensionCalcResult {
  if (!reachable) return unreachableResult("freshness", unreachableReasonCode);
  if (input.isDirectoryListing) return directoryListingResult("freshness");

  let score = 4;
  const evidence: ScoreEvidence[] = [
    {
      dimension: "freshness",
      points: 4,
      reason:
        "Nota conservadora: a atualização do conteúdo não pode ser verificada de forma confiável a partir do HTML estático (nenhuma data de última modificação disponível).",
    },
  ];
  const rationaleParts: string[] = ["nota conservadora por falta de evidência de data (+4)"];

  if (input.pageCount >= 2) {
    score += 8;
    evidence.push({
      dimension: "freshness",
      points: 8,
      reason: "Múltiplas páginas públicas acessíveis no scan limitado (indício estrutural — não prova atualização).",
    });
    rationaleParts.push("múltiplas páginas acessíveis (+8)");
  }

  if (kinds.has("social_link")) {
    score += 8;
    evidence.push({
      dimension: "freshness",
      points: 8,
      reason: "Link social público encontrado (indício de presença ativa — não prova atualização do site).",
    });
    rationaleParts.push("presença social encontrada (+8)");
  }

  score = clamp(score, 0, SCORE_DIMENSION_MAX);
  return { score, evidence, rationale: `Atualização: ${rationaleParts.join(", ")}.` };
}

const UNREACHABLE_WARNING_TEXT: Record<UnreachableReasonCode, string> = {
  no_website: "Nenhum site próprio cadastrado para esta clínica — todas as dimensões refletem a ausência de um site para avaliar.",
  robots_denied: "O site bloqueou o acesso via robots.txt (respeitado, sem bypass) — todas as dimensões refletem essa limitação.",
  unreachable_generic:
    "Site inacessível durante o scan (0 páginas obtidas) — todas as dimensões refletem essa limitação (possível falha de conexão, DNS, certificado/TLS ou timeout).",
};

/**
 * Score calibration v1 — deterministic, evidence-referenced digital-
 * presentation scoring. Never evaluates medical quality, never invents
 * claims/testimonials/awards (there is no such extraction candidate kind
 * to reference), never estimates patient outcomes, revenue, or
 * conversion. `pageCount === 0` (an unreachable site) is scored
 * explicitly as 0 in every dimension, with a reason tied to the specific
 * cause (`unreachableReason` — missing website, robots denied, or a
 * generic connection/TLS/DNS/timeout failure), rather than one generic
 * explanation for every distinct cause. A known third-party directory
 * listing (`isDirectoryListing`) is scored explicitly as 0 with its own
 * clear reason for the same "no real evidence of the clinic's own site"
 * principle. See docs/technical/crawler-score-calibration-v1.md for the
 * full calibration rationale.
 */
export function calculateScoreV1(input: ScoreInput): ScoreV1Result {
  const kinds = new Set(input.candidates.map((c) => c.kind));
  const reachable = input.pageCount > 0;
  const unreachableReasonCode: UnreachableReasonCode = input.unreachableReason ?? "unreachable_generic";
  const warnings: string[] = [];

  if (!reachable) {
    warnings.push(UNREACHABLE_WARNING_TEXT[unreachableReasonCode]);
  } else if (input.isDirectoryListing) {
    warnings.push(
      "Este site é uma listagem de diretório de terceiros, não o domínio próprio da clínica — todas as dimensões refletem a ausência de um site próprio para avaliar.",
    );
  } else {
    if (!input.hasMobileScreenshotMeta) {
      warnings.push("Nenhum screenshot mobile disponível — a dimensão Mobile usa uma avaliação conservadora.");
    }
    if (!input.hasDesktopScreenshotMeta) {
      warnings.push("Nenhum screenshot desktop disponível — a dimensão Credibilidade usa uma avaliação conservadora.");
    }
    if (!kinds.has("service_candidate")) {
      warnings.push("Nenhum serviço/especialidade detectado no conteúdo extraído — Clareza pode estar subestimada por falta de evidência, não por avaliação de qualidade.");
    }
    if (!kinds.has("whatsapp") && !kinds.has("phone")) {
      warnings.push("Nenhum telefone ou WhatsApp público encontrado.");
    }
  }

  const credibility = scoreCredibility(input, kinds, reachable, unreachableReasonCode);
  const clarity = scoreClarity(input, kinds, reachable, unreachableReasonCode);
  const mobile = scoreMobile(input, kinds, reachable, unreachableReasonCode);
  const actionability = scoreActionability(input, kinds, reachable, unreachableReasonCode);
  const freshness = scoreFreshness(input, kinds, reachable, unreachableReasonCode);

  const byKey: Record<ScoreDimensionKey, DimensionCalcResult> = {
    credibility,
    clarity,
    mobile,
    actionability,
    freshness,
  };

  const dimensions: ScoreDimensionResult[] = SCORE_DIMENSION_ORDER.map((key) => ({
    key,
    labelPt: SCORE_DIMENSION_LABELS_PT[key],
    score: byKey[key].score,
    max: SCORE_DIMENSION_MAX,
    rationale: byKey[key].rationale,
  }));

  let evidence = SCORE_DIMENSION_ORDER.flatMap((key) => byKey[key].evidence);
  if (evidence.length === 0) {
    evidence = [{ dimension: "clarity", points: 0, reason: "Sem evidências suficientes; revisão humana obrigatória." }];
  }

  const totalScore = SCORE_DIMENSION_ORDER.reduce((sum, key) => sum + byKey[key].score, 0);

  return {
    version: SCORE_VERSION,
    totalScore,
    maxScore: SCORE_TOTAL_MAX,
    dimensions,
    evidence,
    warnings,
    disclaimer: SCORE_DISCLAIMER,
  };
}

/** Maps the rich v1 result onto the existing, unchanged, flat `scores` table shape — no migration needed. */
export function scoreV1ToDigitalScore(result: ScoreV1Result): DigitalScore {
  const byKey = Object.fromEntries(result.dimensions.map((d) => [d.key, d.score])) as Record<ScoreDimensionKey, number>;

  const score: DigitalScore = {
    credibility: byKey.credibility,
    clarity: byKey.clarity,
    mobile: byKey.mobile,
    actionability: byKey.actionability,
    freshness: byKey.freshness,
    total: result.totalScore,
    evidence: result.evidence,
    disclaimer: SCORE_DISCLAIMER,
    scoringVersion: result.version,
    reviewStatus: "pending_review",
  };

  const parsed = digitalScoreSchema.safeParse(score);
  if (!parsed.success) {
    throw new Error("Score v1 failed schema validation.");
  }
  return parsed.data;
}

/**
 * @deprecated Kept only so every existing caller/test that persists a
 * score via the flat `scores` table shape keeps working unchanged. New
 * code should call `calculateScoreV1` directly for the richer
 * dimensions/rationale/warnings shape, and `scoreV1ToDigitalScore` when a
 * flat, persistable `DigitalScore` is needed.
 */
export function calculatePlaceholderScore(input: ScoreInput): DigitalScore {
  return scoreV1ToDigitalScore(calculateScoreV1(input));
}
