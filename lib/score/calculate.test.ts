import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  SCORE_DISCLAIMER,
  SCORE_DIMENSION_MAX,
  SCORE_TOTAL_MAX,
  SCORE_VERSION,
  calculatePlaceholderScore,
  calculateScoreV1,
  scoreV1ToDigitalScore,
  digitalScoreSchema,
  type ScoreInput,
} from "./calculate";
import type { ExtractionCandidate } from "../crawler/extraction-types";

function candidate(overrides: Partial<ExtractionCandidate> & Pick<ExtractionCandidate, "kind" | "value">): ExtractionCandidate {
  return {
    sourceUrl: "https://www.example-clinic.com.br/",
    sourcePage: "https://www.example-clinic.com.br/",
    extractionMethod: "html_text",
    confidence: "high",
    reviewStatus: "pending_review",
    ...overrides,
  };
}

const RICH_CANDIDATES: ExtractionCandidate[] = [
  candidate({ kind: "title", value: "Clínica Exemplo" }),
  candidate({ kind: "meta_description", value: "Cuidado dermatológico completo." }),
  candidate({ kind: "heading", value: "Serviços" }),
  candidate({ kind: "service_candidate", value: "Dermatologia clínica" }),
  candidate({ kind: "visible_text", value: "Texto institucional visível na página." }),
  candidate({ kind: "address", value: "Rua Exemplo, 123" }),
  candidate({ kind: "phone", value: "(11) 90000-0000" }),
  candidate({ kind: "email", value: "contato@example-clinic.com.br" }),
  candidate({ kind: "whatsapp", value: "https://wa.me/5511900000000" }),
  candidate({ kind: "social_link", value: "https://www.instagram.com/example" }),
  candidate({ kind: "team_name_candidate", value: "Dra. Exemplo" }),
  candidate({ kind: "page_link", value: "https://www.example-clinic.com.br/contato" }),
  candidate({ kind: "page_link", value: "https://www.example-clinic.com.br/agendamento" }),
];

const RICH_INPUT: ScoreInput = {
  candidates: RICH_CANDIDATES,
  pageCount: 3,
  hasDesktopScreenshotMeta: true,
  hasMobileScreenshotMeta: true,
  desktopScreenshotAssetId: "asset-desktop-1",
  mobileScreenshotAssetId: "asset-mobile-1",
  requestedUrl: "https://www.example-clinic.com.br/",
};

describe("calculateScoreV1: version and shape", () => {
  it("1. includes version 'v1'", () => {
    const result = calculateScoreV1(RICH_INPUT);
    assert.equal(result.version, "v1");
    assert.equal(result.version, SCORE_VERSION);
  });

  it("2. every dimension caps at max 20, and never exceeds it even with maximal evidence", () => {
    const result = calculateScoreV1(RICH_INPUT);
    assert.equal(result.dimensions.length, 5);
    for (const dim of result.dimensions) {
      assert.equal(dim.max, SCORE_DIMENSION_MAX);
      assert.ok(dim.score >= 0 && dim.score <= 20, `${dim.key} score ${dim.score} out of range`);
    }
  });

  it("3. total caps at max 100, and reaches exactly 100 given maximal evidence across all dimensions", () => {
    const result = calculateScoreV1(RICH_INPUT);
    assert.ok(result.totalScore <= SCORE_TOTAL_MAX);
    assert.equal(result.maxScore, 100);
    // RICH_INPUT was constructed to satisfy every subcriterion in every dimension.
    assert.equal(result.totalScore, 100);
    assert.equal(
      result.totalScore,
      result.dimensions.reduce((sum, d) => sum + d.score, 0),
    );
  });

  it("4. disclaimer is always present, verbatim, reachable or not", () => {
    const reachable = calculateScoreV1(RICH_INPUT);
    assert.equal(reachable.disclaimer, SCORE_DISCLAIMER);

    const unreachable = calculateScoreV1({ candidates: [], pageCount: 0 });
    assert.equal(unreachable.disclaimer, SCORE_DISCLAIMER);
  });
});

describe("calculateScoreV1: dimension behavior", () => {
  it("5. an unreachable site (0 pages fetched — e.g. TLS/DNS failure) scores credibility at 0 with a clear reason", () => {
    const result = calculateScoreV1({ candidates: [], pageCount: 0, requestedUrl: "https://broken-tls-clinic.example.com/" });
    const credibility = result.dimensions.find((d) => d.key === "credibility")!;
    assert.equal(credibility.score, 0);
    assert.match(credibility.rationale, /inacessível/i);
    // Every other dimension is 0 too — nothing overclaims in the absence of any evidence.
    for (const dim of result.dimensions) {
      assert.equal(dim.score, 0);
    }
    assert.ok(result.warnings.some((w) => /inacessível/i.test(w)));
  });

  it("6. missing mobile screenshot penalizes the Mobile dimension but never fails the computation", () => {
    const withScreenshot = calculateScoreV1({ ...RICH_INPUT, hasMobileScreenshotMeta: true });
    const withoutScreenshot = calculateScoreV1({ ...RICH_INPUT, hasMobileScreenshotMeta: false });

    const mobileWith = withScreenshot.dimensions.find((d) => d.key === "mobile")!.score;
    const mobileWithout = withoutScreenshot.dimensions.find((d) => d.key === "mobile")!.score;
    assert.ok(mobileWithout < mobileWith, "missing screenshot should score lower, not equal or higher");
    // Still a fully valid, complete result — never throws, never omits the dimension.
    assert.equal(withoutScreenshot.dimensions.length, 5);
    assert.ok(withoutScreenshot.warnings.some((w) => /screenshot mobile/i.test(w)));
  });

  it("7. WhatsApp/contact evidence improves the Conversão/Contato e ação (actionability) dimension", () => {
    const withoutContact = calculateScoreV1({
      candidates: [candidate({ kind: "title", value: "Clínica Exemplo" })],
      pageCount: 1,
    });
    const withContact = calculateScoreV1({
      candidates: [
        candidate({ kind: "title", value: "Clínica Exemplo" }),
        candidate({ kind: "whatsapp", value: "https://wa.me/5511900000000" }),
        candidate({ kind: "email", value: "contato@example-clinic.com.br" }),
      ],
      pageCount: 1,
    });

    const actionabilityWithout = withoutContact.dimensions.find((d) => d.key === "actionability")!.score;
    const actionabilityWith = withContact.dimensions.find((d) => d.key === "actionability")!.score;
    assert.ok(actionabilityWith > actionabilityWithout);
  });

  it("no medical quality claim, patient outcome claim, or invented testimonial/award appears anywhere in the result", () => {
    const result = calculateScoreV1(RICH_INPUT);
    const serialized = JSON.stringify(result).toLowerCase();
    assert.doesNotMatch(serialized, /qualidade m[eé]dica.{0,20}(boa|ruim|excelente|aprovad)/);
    assert.doesNotMatch(serialized, /resultado (cl[ií]nico|do paciente)/);
    assert.doesNotMatch(serialized, /patient outcome/);
    for (const forbidden of ["depoimento", "prêmio", "premio", "cliente satisfeito", "crm ", "rqe ", "garantia de cura", "melhor clínica"]) {
      assert.doesNotMatch(serialized, new RegExp(forbidden), `unexpected invented claim: ${forbidden}`);
    }
  });
});

describe("calculateScoreV1: determinism and graceful degradation", () => {
  it("9. produces byte-for-byte identical output for identical input, called twice", () => {
    const first = calculateScoreV1(RICH_INPUT);
    const second = calculateScoreV1(RICH_INPUT);
    assert.deepEqual(first, second);
    assert.equal(JSON.stringify(first), JSON.stringify(second));
  });

  it("10. missing data (empty candidates, reachable) is handled gracefully — no throw, valid shape, low but honest scores", () => {
    const result = calculateScoreV1({ candidates: [], pageCount: 1 });
    assert.equal(result.dimensions.length, 5);
    assert.ok(result.evidence.length >= 1);
    // Credibility still gets its baseline "reachable" points even with zero other evidence.
    const credibility = result.dimensions.find((d) => d.key === "credibility")!;
    assert.ok(credibility.score > 0 && credibility.score < 20);
  });

  it("gracefully handles a missing requestedUrl (no HTTPS bonus granted or assumed, no throw)", () => {
    const result = calculateScoreV1({ candidates: [candidate({ kind: "title", value: "X" })], pageCount: 1 });
    assert.equal(result.dimensions.length, 5);
    assert.doesNotThrow(() => calculateScoreV1({ candidates: [], pageCount: 1, requestedUrl: undefined }));
  });
});

describe("scoreV1ToDigitalScore + calculatePlaceholderScore: backward-compatible persistence shape", () => {
  it("scoreV1ToDigitalScore adapts the rich result into the existing flat, schema-valid DigitalScore", () => {
    const v1 = calculateScoreV1(RICH_INPUT);
    const flat = scoreV1ToDigitalScore(v1);
    assert.equal(digitalScoreSchema.safeParse(flat).success, true);
    assert.equal(flat.scoringVersion, "v1");
    assert.equal(flat.total, v1.totalScore);
    assert.equal(flat.credibility, v1.dimensions.find((d) => d.key === "credibility")!.score);
    assert.equal(flat.mobile, v1.dimensions.find((d) => d.key === "mobile")!.score);
    assert.deepEqual(flat.evidence, v1.evidence);
  });

  it("calculatePlaceholderScore (kept for backward compatibility) now returns v1-caliber scores", () => {
    const score = calculatePlaceholderScore(RICH_INPUT);
    assert.equal(score.scoringVersion, "v1");
    assert.equal(digitalScoreSchema.safeParse(score).success, true);
    assert.equal(
      score.total,
      score.credibility + score.clarity + score.mobile + score.actionability + score.freshness,
    );
  });

  it("builds a schema-valid score with disclaimer and evidence (legacy structural check, still passes under v1)", () => {
    const candidates: ExtractionCandidate[] = [
      candidate({ kind: "title", value: "Clinica" }),
      candidate({ kind: "whatsapp", value: "https://wa.me/5511999999999" }),
      candidate({ kind: "heading", value: "Serviços" }),
      candidate({ kind: "service_candidate", value: "Serviços" }),
    ];

    const score = calculatePlaceholderScore({ candidates, pageCount: 3, hasMobileScreenshotMeta: false });

    assert.equal(score.disclaimer, SCORE_DISCLAIMER);
    assert.ok(score.evidence.length >= 1);
    assert.equal(
      score.total,
      score.credibility + score.clarity + score.mobile + score.actionability + score.freshness,
    );
    assert.equal(score.reviewStatus, "pending_review");
    assert.equal(digitalScoreSchema.safeParse(score).success, true);
    assert.equal(/qualidade médica/i.test(score.disclaimer), true);
    assert.equal(/pacientes|receita|conversão real/i.test(JSON.stringify(score)), false);
  });
});

describe("calculateScoreV1: JSON shape stability", () => {
  it("12. top-level keys are stable and round-trip through JSON.stringify/parse without losing shape", () => {
    const result = calculateScoreV1(RICH_INPUT);
    const expectedKeys = ["version", "totalScore", "maxScore", "dimensions", "evidence", "warnings", "disclaimer"];
    assert.deepEqual(Object.keys(result).sort(), expectedKeys.sort());

    for (const dim of result.dimensions) {
      assert.deepEqual(Object.keys(dim).sort(), ["key", "labelPt", "score", "max", "rationale"].sort());
    }

    const roundTripped = JSON.parse(JSON.stringify(result));
    assert.deepEqual(Object.keys(roundTripped).sort(), Object.keys(result).sort());
    assert.deepEqual(roundTripped, result);

    assert.deepEqual(
      result.dimensions.map((d) => d.key),
      ["credibility", "clarity", "mobile", "actionability", "freshness"],
    );
  });
});
