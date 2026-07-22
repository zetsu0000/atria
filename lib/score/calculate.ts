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

/**
 * Shared "site unreachable" outcome for a single dimension — used when
 * `pageCount === 0` (the crawl could not fetch any public page, e.g. an
 * expired TLS certificate, DNS failure, or timeout). Every dimension
 * reports 0 with one clear, honest evidence entry, rather than silently
 * omitting the dimension or defaulting to an unearned baseline.
 */
function unreachableResult(dimensionKey: ScoreDimensionKey): DimensionCalcResult {
  const label = SCORE_DIMENSION_LABELS_PT[dimensionKey].toLowerCase();
  const reason = `Site inacessível durante o scan (0 páginas públicas obtidas) — não há evidência real para avaliar ${label}.`;
  return {
    score: 0,
    evidence: [{ dimension: dimensionKey, points: 0, reason }],
    rationale: reason,
  };
}

function scoreCredibility(input: ScoreInput, kinds: Set<string>, reachable: boolean): DimensionCalcResult {
  if (!reachable) return unreachableResult("credibility");

  let score = 0;
  const evidence: ScoreEvidence[] = [];
  const rationaleParts: string[] = [];

  score += 6;
  evidence.push({
    dimension: "credibility",
    points: 6,
    reason: "Site acessível — pelo menos uma página pública foi carregada com sucesso durante o scan.",
  });
  rationaleParts.push("site acessível (+6)");

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

  if (kinds.has("team_name_candidate") || kinds.has("service_candidate")) {
    score += 3;
    evidence.push({
      dimension: "credibility",
      points: 3,
      reason: "Sinais de conteúdo institucional (equipe ou serviços) encontrados.",
    });
    rationaleParts.push("conteúdo institucional presente (+3)");
  } else {
    rationaleParts.push("sinais de conteúdo institucional não encontrados (+0)");
  }

  score = clamp(score, 0, SCORE_DIMENSION_MAX);
  return { score, evidence, rationale: `Credibilidade: ${rationaleParts.join(", ")}.` };
}

function scoreClarity(input: ScoreInput, kinds: Set<string>, reachable: boolean): DimensionCalcResult {
  if (!reachable) return unreachableResult("clarity");

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

  if (input.hasDesktopScreenshotMeta) {
    // 0-point evidence entry purely so score/report consumers can see the
    // desktop asset reference — visual review is still a human's job.
    evidence.push({
      dimension: "clarity",
      points: 0,
      reason: input.desktopScreenshotAssetId
        ? `Metadado de screenshot desktop registrado (asset ${input.desktopScreenshotAssetId}; avaliação visual pendente de revisão humana).`
        : "Metadado de screenshot desktop registrado (avaliação visual pendente de revisão humana).",
    });
  }

  score = clamp(score, 0, SCORE_DIMENSION_MAX);
  return { score, evidence, rationale: `Clareza: ${rationaleParts.join(", ")}.` };
}

function scoreMobile(input: ScoreInput, kinds: Set<string>, reachable: boolean): DimensionCalcResult {
  if (!reachable) return unreachableResult("mobile");

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

function scoreActionability(input: ScoreInput, kinds: Set<string>, reachable: boolean): DimensionCalcResult {
  if (!reachable) return unreachableResult("actionability");

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

function scoreFreshness(input: ScoreInput, kinds: Set<string>, reachable: boolean): DimensionCalcResult {
  if (!reachable) return unreachableResult("freshness");

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

/**
 * Score calibration v1 — deterministic, evidence-referenced digital-
 * presentation scoring. Never evaluates medical quality, never invents
 * claims/testimonials/awards (there is no such extraction candidate kind
 * to reference), never estimates patient outcomes, revenue, or
 * conversion. `pageCount === 0` (an unreachable site — e.g. an expired
 * TLS certificate, DNS failure, or timeout) is scored explicitly as 0 in
 * every dimension, with a clear reason, rather than silently omitted.
 */
export function calculateScoreV1(input: ScoreInput): ScoreV1Result {
  const kinds = new Set(input.candidates.map((c) => c.kind));
  const reachable = input.pageCount > 0;
  const warnings: string[] = [];

  if (!reachable) {
    warnings.push(
      "Site inacessível durante o scan (0 páginas obtidas) — todas as dimensões refletem essa limitação (possível falha de TLS, DNS, timeout ou bloqueio).",
    );
  } else {
    if (!input.hasMobileScreenshotMeta) {
      warnings.push("Nenhum screenshot mobile disponível — a dimensão Mobile usa uma avaliação conservadora.");
    }
    if (!kinds.has("service_candidate")) {
      warnings.push("Nenhum serviço/especialidade detectado no conteúdo extraído — Clareza pode estar subestimada por falta de evidência, não por avaliação de qualidade.");
    }
    if (!kinds.has("whatsapp") && !kinds.has("phone")) {
      warnings.push("Nenhum telefone ou WhatsApp público encontrado.");
    }
  }

  const credibility = scoreCredibility(input, kinds, reachable);
  const clarity = scoreClarity(input, kinds, reachable);
  const mobile = scoreMobile(input, kinds, reachable);
  const actionability = scoreActionability(input, kinds, reachable);
  const freshness = scoreFreshness(input, kinds, reachable);

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
