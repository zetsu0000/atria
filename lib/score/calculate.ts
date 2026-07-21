import { z } from "zod";
import type { ExtractionCandidate } from "@/lib/crawler/extraction-types";

export const SCORE_DISCLAIMER =
  "Esta análise avalia apenas a apresentação digital e a facilidade de encontrar informações. Não avalia qualidade médica.";

export const SCORE_DIMENSION_MAX = 20 as const;
export const SCORE_TOTAL_MAX = 100 as const;

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

export type ScoreInput = {
  candidates: ExtractionCandidate[];
  pageCount: number;
  hasDesktopScreenshotMeta?: boolean;
  hasMobileScreenshotMeta?: boolean;
  /** scan_assets row id, when known — referenced in the evidence text so score/report readers can look up the actual screenshot. */
  desktopScreenshotAssetId?: string | null;
  mobileScreenshotAssetId?: string | null;
};

/**
 * Placeholder heuristic scorer (v0).
 * TODO: replace with evidence-rich calibrated rules after human-reviewed samples.
 * Does not estimate revenue, patient loss, or medical quality.
 */
export function calculatePlaceholderScore(input: ScoreInput): DigitalScore {
  const kinds = new Set(input.candidates.map((c) => c.kind));
  const evidence: ScoreEvidence[] = [];

  let credibility = 6;
  if (kinds.has("title")) {
    credibility += 3;
    evidence.push({
      dimension: "credibility",
      points: 3,
      reason: "Título institucional encontrado na página pública.",
      sourceUrl: input.candidates.find((c) => c.kind === "title")?.sourceUrl,
    });
  }
  if (kinds.has("team_name_candidate")) {
    credibility += 4;
    evidence.push({
      dimension: "credibility",
      points: 4,
      reason: "Possível menção a equipe (candidato; requer revisão).",
    });
  }
  if (kinds.has("address") || kinds.has("phone") || kinds.has("email")) {
    credibility += 3;
    evidence.push({
      dimension: "credibility",
      points: 3,
      reason: "Contato ou endereço público candidato encontrado.",
    });
  }
  credibility = clamp(credibility, 0, 20);

  let clarity = 8;
  if (kinds.has("heading")) {
    clarity += 4;
    evidence.push({
      dimension: "clarity",
      points: 4,
      reason: "Headings estruturam o conteúdo visível.",
    });
  }
  if (kinds.has("service_candidate")) {
    clarity += 4;
    evidence.push({
      dimension: "clarity",
      points: 4,
      reason: "Candidatos a serviços detectados em headings.",
    });
  }
  if (kinds.has("meta_description")) {
    clarity += 2;
    evidence.push({
      dimension: "clarity",
      points: 2,
      reason: "Meta description presente.",
    });
  }
  if (input.hasDesktopScreenshotMeta) {
    // Desktop screenshot presence doesn't change the placeholder-v0 point
    // total (only mobile does, above) — this is a 0-point evidence entry
    // purely so score/report consumers can see the desktop asset reference.
    evidence.push({
      dimension: "clarity",
      points: 0,
      reason: input.desktopScreenshotAssetId
        ? `Metadado de screenshot desktop registrado (asset ${input.desktopScreenshotAssetId}; avaliação visual pendente).`
        : "Metadado de screenshot desktop registrado (avaliação visual pendente).",
    });
  }
  clarity = clamp(clarity, 0, 20);

  // Mobile: without real screenshots, keep conservative placeholder.
  let mobile = 8;
  if (input.hasMobileScreenshotMeta) {
    mobile += 4;
    evidence.push({
      dimension: "mobile",
      points: 4,
      reason: input.mobileScreenshotAssetId
        ? `Metadado de screenshot mobile registrado (asset ${input.mobileScreenshotAssetId}; avaliação visual pendente).`
        : "Metadado de screenshot mobile registrado (avaliação visual pendente).",
    });
  } else {
    evidence.push({
      dimension: "mobile",
      points: 8,
      reason:
        "TODO: sem screenshot mobile analisado — nota conservadora placeholder.",
    });
  }
  mobile = clamp(mobile, 0, 20);

  let actionability = 4;
  if (kinds.has("whatsapp") || kinds.has("phone")) {
    actionability += 8;
    evidence.push({
      dimension: "actionability",
      points: 8,
      reason: "Telefone ou WhatsApp público candidato encontrado.",
    });
  }
  if (kinds.has("email")) {
    actionability += 4;
    evidence.push({
      dimension: "actionability",
      points: 4,
      reason: "E-mail público candidato encontrado.",
    });
  }
  if (input.candidates.some((c) => c.kind === "page_link" && /contato/i.test(c.value))) {
    actionability += 4;
    evidence.push({
      dimension: "actionability",
      points: 4,
      reason: "Link interno para página de contato.",
    });
  }
  actionability = clamp(actionability, 0, 20);

  let freshness = 8;
  if (input.pageCount >= 3) {
    freshness += 4;
    evidence.push({
      dimension: "freshness",
      points: 4,
      reason: "Múltiplas páginas públicas acessíveis no scan limitado.",
    });
  }
  if (kinds.has("social_link")) {
    freshness += 2;
    evidence.push({
      dimension: "freshness",
      points: 2,
      reason: "Link social público encontrado (não prova atualização).",
    });
  }
  evidence.push({
    dimension: "freshness",
    points: freshness,
    reason:
      "TODO: placeholder — não estima abandono nem resultado comercial.",
  });
  freshness = clamp(freshness, 0, 20);

  if (evidence.length === 0) {
    evidence.push({
      dimension: "clarity",
      points: 0,
      reason: "Sem evidências suficientes; revisão humana obrigatória.",
    });
  }

  const score: DigitalScore = {
    credibility,
    clarity,
    mobile,
    actionability,
    freshness,
    total: credibility + clarity + mobile + actionability + freshness,
    evidence,
    disclaimer: SCORE_DISCLAIMER,
    scoringVersion: "placeholder-v0",
    reviewStatus: "pending_review",
  };

  const parsed = digitalScoreSchema.safeParse(score);
  if (!parsed.success) {
    throw new Error("Placeholder score failed schema validation.");
  }
  return parsed.data;
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}
