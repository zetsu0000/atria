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

/**
 * Calibration fixtures modeled on real, retained staging outcomes
 * (docs/technical/crawler-score-calibration-v1.md), using only fixture
 * names — never a real clinic name inside scoring logic or these fixture
 * definitions themselves.
 */
const STRONG_CLINIC_FIXTURE: ScoreInput = RICH_INPUT;

const CANONICALIZED_CLINIC_FIXTURE: ScoreInput = {
  candidates: [
    candidate({ kind: "title", value: "Clínica Canonicalizada" }),
    candidate({ kind: "heading", value: "Serviços" }),
    candidate({ kind: "service_candidate", value: "Dermatologia" }),
    candidate({ kind: "meta_description", value: "Clínica de dermatologia." }),
    candidate({ kind: "visible_text", value: "Texto institucional." }),
    candidate({ kind: "phone", value: "(41) 90000-0000" }),
    candidate({ kind: "email", value: "contato@canonicalizada.com.br" }),
  ],
  pageCount: 1,
  hasDesktopScreenshotMeta: false,
  hasMobileScreenshotMeta: false,
  requestedUrl: "https://canonicalizada.com.br/",
};

const ROBOTS_DENIED_FIXTURE: ScoreInput = {
  candidates: [],
  pageCount: 0,
  unreachableReason: "robots_denied",
  requestedUrl: "https://blocked-by-robots.example.com.br/",
};

const CONNECTION_FAILURE_FIXTURE: ScoreInput = {
  candidates: [],
  pageCount: 0,
  unreachableReason: "unreachable_generic",
  requestedUrl: "https://connection-failure.example.com.br/",
};

const NO_WEBSITE_FIXTURE: ScoreInput = {
  candidates: [],
  pageCount: 0,
  unreachableReason: "no_website",
  requestedUrl: null,
};

const DIRECTORY_LISTING_FIXTURE: ScoreInput = {
  // Deliberately as rich as RICH_CANDIDATES — proves the directory-listing
  // gate wins regardless of how much content the directory page itself shows.
  candidates: RICH_CANDIDATES,
  pageCount: 3,
  hasDesktopScreenshotMeta: true,
  hasMobileScreenshotMeta: true,
  requestedUrl: "https://www.directory-listing.example.com.br/some-doctor",
  isDirectoryListing: true,
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

describe("calculateScoreV1: calibration (docs/technical/crawler-score-calibration-v1.md)", () => {
  it("1. a strong clinic (real contacts + both screenshots + rich content) scores high", () => {
    const result = calculateScoreV1(STRONG_CLINIC_FIXTURE);
    assert.ok(result.totalScore >= 80, `expected a high score, got ${result.totalScore}`);
  });

  it("2. a crawlable site without screenshots scores lower than the same site with screenshots", () => {
    const withScreenshots = calculateScoreV1(STRONG_CLINIC_FIXTURE);
    const withoutScreenshots = calculateScoreV1({
      ...STRONG_CLINIC_FIXTURE,
      hasDesktopScreenshotMeta: false,
      hasMobileScreenshotMeta: false,
    });
    assert.ok(withoutScreenshots.totalScore < withScreenshots.totalScore);
    // Still a real, reasonable score — no screenshots doesn't mean "broken".
    assert.ok(withoutScreenshots.totalScore > 0);
  });

  it("3. no contacts (phone/WhatsApp/e-mail) lowers the Conversão/Contato e ação dimension specifically", () => {
    const withContacts = calculateScoreV1(CANONICALIZED_CLINIC_FIXTURE);
    const withoutContacts = calculateScoreV1({
      ...CANONICALIZED_CLINIC_FIXTURE,
      candidates: CANONICALIZED_CLINIC_FIXTURE.candidates.filter((c) => c.kind !== "phone" && c.kind !== "email"),
    });
    const actionWith = withContacts.dimensions.find((d) => d.key === "actionability")!.score;
    const actionWithout = withoutContacts.dimensions.find((d) => d.key === "actionability")!.score;
    assert.ok(actionWithout < actionWith);
  });

  it("4. robots_denied produces a fully blocked (0/100) score, with evidence that clearly names robots.txt — never a generic reason", () => {
    const result = calculateScoreV1(ROBOTS_DENIED_FIXTURE);
    assert.equal(result.totalScore, 0);
    for (const dim of result.dimensions) {
      assert.equal(dim.score, 0);
      assert.match(dim.rationale, /robots\.txt/i);
    }
    assert.ok(result.warnings.some((w) => /robots\.txt/i.test(w)));
  });

  it("5. a generic connection/TLS/DNS failure produces a clear credibility penalty, with evidence distinguishable from robots_denied", () => {
    const result = calculateScoreV1(CONNECTION_FAILURE_FIXTURE);
    const credibility = result.dimensions.find((d) => d.key === "credibility")!;
    assert.equal(credibility.score, 0);
    assert.match(credibility.rationale, /(conexão|certificado|tls|dns|timeout)/i);
    assert.doesNotMatch(credibility.rationale, /robots\.txt/i);
  });

  it("5b. redirect_blocked, dns_failed, and timeout each produce their own distinct evidence text (docs/technical/crawler-error-code-report-surfacing.md), never a generic fallback when the specific reason is known", () => {
    const redirect = calculateScoreV1({
      candidates: [],
      pageCount: 0,
      unreachableReason: "redirect_blocked",
      requestedUrl: "https://redirect-blocked.example.com.br/",
    });
    const dns = calculateScoreV1({
      candidates: [],
      pageCount: 0,
      unreachableReason: "dns_failed",
      requestedUrl: "https://dns-failed.example.com.br/",
    });
    const timeout = calculateScoreV1({
      candidates: [],
      pageCount: 0,
      unreachableReason: "timeout",
      requestedUrl: "https://timeout.example.com.br/",
    });

    const redirectCredibility = redirect.dimensions.find((d) => d.key === "credibility")!;
    const dnsCredibility = dns.dimensions.find((d) => d.key === "credibility")!;
    const timeoutCredibility = timeout.dimensions.find((d) => d.key === "credibility")!;

    assert.equal(redirect.totalScore, 0);
    assert.equal(dns.totalScore, 0);
    assert.equal(timeout.totalScore, 0);

    assert.match(redirectCredibility.rationale, /redirecionamento/i);
    assert.match(redirectCredibility.rationale, /domínio aprovado/i);
    assert.doesNotMatch(redirectCredibility.rationale, /robots\.txt/i);

    assert.match(dnsCredibility.rationale, /dns/i);
    assert.match(timeoutCredibility.rationale, /timeout/i);

    // All three are distinguishable from each other and from the generic bucket.
    const genericCredibility = calculateScoreV1(CONNECTION_FAILURE_FIXTURE).dimensions.find((d) => d.key === "credibility")!;
    assert.notEqual(redirectCredibility.rationale, genericCredibility.rationale);
    assert.notEqual(dnsCredibility.rationale, genericCredibility.rationale);
    assert.notEqual(timeoutCredibility.rationale, genericCredibility.rationale);
    assert.notEqual(redirectCredibility.rationale, dnsCredibility.rationale);
    assert.notEqual(dnsCredibility.rationale, timeoutCredibility.rationale);

    assert.ok(redirect.warnings.some((w) => /redirecionamento/i.test(w)));
    assert.ok(dns.warnings.some((w) => /dns/i.test(w)));
    assert.ok(timeout.warnings.some((w) => /timeout/i.test(w)));
  });

  it("6. missing pages (no website at all) never produces a fake positive score, and the reason names the missing website specifically", () => {
    const result = calculateScoreV1(NO_WEBSITE_FIXTURE);
    assert.equal(result.totalScore, 0);
    for (const dim of result.dimensions) assert.equal(dim.score, 0);
    const credibility = result.dimensions.find((d) => d.key === "credibility")!;
    assert.match(credibility.rationale, /nenhum site próprio/i);
    assert.ok(result.warnings.some((w) => /nenhum site próprio/i.test(w)));
  });

  it("7. a directory listing (wrong audience) is fully blocked (0/100), even with otherwise-rich content", () => {
    const result = calculateScoreV1(DIRECTORY_LISTING_FIXTURE);
    assert.equal(result.totalScore, 0);
    for (const dim of result.dimensions) {
      assert.equal(dim.score, 0);
      assert.match(dim.rationale, /diretório de terceiros/i);
    }
    assert.ok(result.warnings.some((w) => /diretório de terceiros/i.test(w)));
  });

  it("8. WhatsApp/contact evidence measurably improves the Conversão/Contato e ação dimension (see also test 3 above)", () => {
    const withoutContact = calculateScoreV1({ candidates: [candidate({ kind: "title", value: "X" })], pageCount: 1 });
    const withContact = calculateScoreV1({
      candidates: [candidate({ kind: "title", value: "X" }), candidate({ kind: "whatsapp", value: "https://wa.me/5511900000000" })],
      pageCount: 1,
    });
    const a1 = withoutContact.dimensions.find((d) => d.key === "actionability")!.score;
    const a2 = withContact.dimensions.find((d) => d.key === "actionability")!.score;
    assert.ok(a2 > a1);
  });

  it("9. screenshot evidence improves both Mobile (mobile screenshot) and Credibilidade (desktop screenshot) where appropriate", () => {
    const base = calculateScoreV1({ ...CANONICALIZED_CLINIC_FIXTURE, hasDesktopScreenshotMeta: false, hasMobileScreenshotMeta: false });
    const withMobile = calculateScoreV1({ ...CANONICALIZED_CLINIC_FIXTURE, hasDesktopScreenshotMeta: false, hasMobileScreenshotMeta: true });
    const withDesktop = calculateScoreV1({ ...CANONICALIZED_CLINIC_FIXTURE, hasDesktopScreenshotMeta: true, hasMobileScreenshotMeta: false });

    const mobileBase = base.dimensions.find((d) => d.key === "mobile")!.score;
    const mobileWith = withMobile.dimensions.find((d) => d.key === "mobile")!.score;
    assert.ok(mobileWith > mobileBase, "a captured mobile screenshot must raise the Mobile dimension");

    const credBase = base.dimensions.find((d) => d.key === "credibility")!.score;
    const credWith = withDesktop.dimensions.find((d) => d.key === "credibility")!.score;
    assert.ok(credWith > credBase, "a captured desktop screenshot must raise the Credibilidade dimension");
  });

  it("10. the disclaimer is present verbatim in every fixture, regardless of tier", () => {
    for (const fixture of [STRONG_CLINIC_FIXTURE, ROBOTS_DENIED_FIXTURE, CONNECTION_FAILURE_FIXTURE, NO_WEBSITE_FIXTURE, DIRECTORY_LISTING_FIXTURE]) {
      assert.equal(calculateScoreV1(fixture).disclaimer, SCORE_DISCLAIMER);
    }
  });

  it("11. no medical-quality evaluation language appears in any fixture's output", () => {
    for (const fixture of [STRONG_CLINIC_FIXTURE, ROBOTS_DENIED_FIXTURE, DIRECTORY_LISTING_FIXTURE]) {
      const serialized = JSON.stringify(calculateScoreV1(fixture)).toLowerCase();
      for (const forbidden of ["qualidade médica boa", "qualidade médica ruim", "diagnosticamos", "melhor clínica", "cura garantida"]) {
        assert.doesNotMatch(serialized, new RegExp(forbidden));
      }
    }
  });

  it("12. output is fully deterministic across every calibration fixture", () => {
    for (const fixture of [STRONG_CLINIC_FIXTURE, CANONICALIZED_CLINIC_FIXTURE, ROBOTS_DENIED_FIXTURE, DIRECTORY_LISTING_FIXTURE]) {
      const a = calculateScoreV1(fixture);
      const b = calculateScoreV1(fixture);
      assert.deepEqual(a, b);
    }
  });

  it("13. every dimension has at least one evidence entry tagged with its own dimension key", () => {
    const result = calculateScoreV1(STRONG_CLINIC_FIXTURE);
    for (const dim of result.dimensions) {
      assert.ok(
        result.evidence.some((e) => e.dimension === dim.key),
        `expected at least one evidence entry for ${dim.key}`,
      );
    }
  });

  it("14. total score always stays within 0-100 across every calibration fixture", () => {
    for (const fixture of [STRONG_CLINIC_FIXTURE, CANONICALIZED_CLINIC_FIXTURE, ROBOTS_DENIED_FIXTURE, CONNECTION_FAILURE_FIXTURE, NO_WEBSITE_FIXTURE, DIRECTORY_LISTING_FIXTURE]) {
      const result = calculateScoreV1(fixture);
      assert.ok(result.totalScore >= 0 && result.totalScore <= 100, `${result.totalScore} out of range`);
    }
  });

  it("15. every dimension always stays within 0-20 across every calibration fixture", () => {
    for (const fixture of [STRONG_CLINIC_FIXTURE, CANONICALIZED_CLINIC_FIXTURE, ROBOTS_DENIED_FIXTURE, CONNECTION_FAILURE_FIXTURE, NO_WEBSITE_FIXTURE, DIRECTORY_LISTING_FIXTURE]) {
      const result = calculateScoreV1(fixture);
      for (const dim of result.dimensions) {
        assert.ok(dim.score >= 0 && dim.score <= 20, `${dim.key}=${dim.score} out of range`);
      }
    }
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
