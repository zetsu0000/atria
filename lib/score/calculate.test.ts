import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  SCORE_DISCLAIMER,
  calculatePlaceholderScore,
  digitalScoreSchema,
} from "../score/calculate";
import type { ExtractionCandidate } from "../crawler/extraction-types";

describe("score foundation", () => {
  it("builds a schema-valid score with disclaimer and evidence", () => {
    const candidates: ExtractionCandidate[] = [
      {
        kind: "title",
        value: "Clinica",
        sourceUrl: "https://x.example/",
        sourcePage: "https://x.example/",
        extractionMethod: "meta",
        confidence: "high",
        reviewStatus: "pending_review",
      },
      {
        kind: "whatsapp",
        value: "https://wa.me/5511999999999",
        sourceUrl: "https://x.example/",
        sourcePage: "https://x.example/",
        extractionMethod: "html_anchor",
        confidence: "high",
        reviewStatus: "pending_review",
      },
      {
        kind: "heading",
        value: "Serviços",
        sourceUrl: "https://x.example/",
        sourcePage: "https://x.example/",
        extractionMethod: "heading",
        confidence: "medium",
        reviewStatus: "pending_review",
      },
      {
        kind: "service_candidate",
        value: "Serviços",
        sourceUrl: "https://x.example/",
        sourcePage: "https://x.example/",
        extractionMethod: "heading",
        confidence: "low",
        reviewStatus: "pending_review",
      },
    ];

    const score = calculatePlaceholderScore({
      candidates,
      pageCount: 3,
      hasMobileScreenshotMeta: false,
    });

    assert.equal(score.disclaimer, SCORE_DISCLAIMER);
    assert.ok(score.evidence.length >= 1);
    assert.equal(
      score.total,
      score.credibility +
        score.clarity +
        score.mobile +
        score.actionability +
        score.freshness,
    );
    assert.equal(score.reviewStatus, "pending_review");
    assert.equal(digitalScoreSchema.safeParse(score).success, true);
    assert.equal(/qualidade médica/i.test(score.disclaimer), true);
    assert.equal(/pacientes|receita|conversão real/i.test(JSON.stringify(score)), false);
  });
});
