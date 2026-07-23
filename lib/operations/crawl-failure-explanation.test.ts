import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { CRAWL_ERROR_CODES } from "@/lib/crawler/errors";
import { explainCrawlFailure } from "./report/crawl-failure-explanation";

describe("explainCrawlFailure (docs/technical/crawler-error-code-report-surfacing.md)", () => {
  it("returns null when there is no error to explain", () => {
    assert.equal(explainCrawlFailure(null), null);
  });

  it("redirect_blocked: specific, operator-friendly text with a concrete suggested action", () => {
    const result = explainCrawlFailure("redirect_blocked");
    assert.ok(result);
    assert.match(result!.explanation, /redirecionamento/i);
    assert.match(result!.explanation, /domínio aprovado/i);
    assert.match(result!.suggestedNextAction, /revisar manualmente/i);
  });

  it("robots_denied: specific, distinct from redirect_blocked", () => {
    const robots = explainCrawlFailure("robots_denied");
    const redirect = explainCrawlFailure("redirect_blocked");
    assert.ok(robots);
    assert.match(robots!.explanation, /robots\.txt/i);
    assert.notEqual(robots!.explanation, redirect!.explanation);
  });

  it("dns_failed and timeout map to their own stable, distinct explanations", () => {
    const dns = explainCrawlFailure("dns_failed");
    const timeout = explainCrawlFailure("timeout");
    assert.ok(dns && timeout);
    assert.match(dns!.explanation, /dns/i);
    assert.match(timeout!.explanation, /timeout/i);
    assert.notEqual(dns!.explanation, timeout!.explanation);
  });

  it("unexpected_error (today's TLS/certificate bucket) gets an honest, explicitly-unclassified explanation", () => {
    const result = explainCrawlFailure("unexpected_error");
    assert.ok(result);
    assert.match(result!.explanation, /não classificad/i);
  });

  it("every real CrawlErrorCode has an explanation and a suggested action (exhaustive, never silently missing one)", () => {
    for (const code of CRAWL_ERROR_CODES) {
      const result = explainCrawlFailure(code);
      assert.ok(result, `expected an explanation for code: ${code}`);
      assert.ok(result!.explanation.length > 0);
      assert.ok(result!.suggestedNextAction.length > 0);
    }
  });

  it("an unrecognized/unknown code still gets a safe, explicit 'unclassified' fallback rather than throwing or returning nothing", () => {
    const result = explainCrawlFailure("some_future_code_that_does_not_exist_yet");
    assert.ok(result);
    assert.match(result!.explanation, /não classificad/i);
    assert.match(result!.explanation, /some_future_code_that_does_not_exist_yet/);
    assert.match(result!.suggestedNextAction, /revisar manualmente/i);
  });

  it("no medical-quality language appears in any explanation or suggested action, for any code", () => {
    for (const code of CRAWL_ERROR_CODES) {
      const result = explainCrawlFailure(code)!;
      const text = `${result.explanation} ${result.suggestedNextAction}`.toLowerCase();
      assert.doesNotMatch(text, /qualidade m[eé]dica|diagn[oó]stico|paciente|tratamento cl[ií]nico/);
    }
  });

  it("no secret-shaped value appears in any explanation or suggested action, for any code", () => {
    for (const code of CRAWL_ERROR_CODES) {
      const result = explainCrawlFailure(code)!;
      const text = `${result.explanation} ${result.suggestedNextAction}`;
      assert.doesNotMatch(text, /service_role|SUPABASE_|GOOGLE_PLACES_API_KEY|postgresql:\/\/|AIza|eyJ/);
    }
  });

  it("is deterministic — the same code always returns the same explanation", () => {
    const first = explainCrawlFailure("redirect_blocked");
    const second = explainCrawlFailure("redirect_blocked");
    assert.deepEqual(first, second);
  });
});
