import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  classifyCandidateDuplicate,
  createEmptyDedupeLookup,
  normalizeProspectCandidate,
  normalizeWebsiteOrigin,
  parseManualCsvRows,
  promoteCandidateToClinicShape,
  rememberCandidateInLookup,
} from "./normalize";
import { FORBIDDEN_PATIENT_DATA_KEYS } from "./types";

describe("discovery normalize", () => {
  it("normalizes a manual candidate and builds dedupe key", () => {
    const result = normalizeProspectCandidate({
      rawName: "  Clínica Aurora Dermato  ",
      websiteUrl: "https://Aurora.example.com/home",
      phone: "(11) 98888-7777",
      email: "Contato@Aurora.example.com",
      city: "São Paulo",
      state: "SP",
      specialty: "Dermatologia",
      sourceType: "manual",
      sourceAttribution: { operator: "test" },
    });

    assert.equal(result.ok, true);
    if (!result.ok) return;
    assert.equal(result.candidate.normalizedName, "clinica aurora dermato");
    assert.equal(
      result.candidate.normalizedWebsiteOrigin,
      "https://aurora.example.com",
    );
    assert.equal(result.candidate.phone, "11988887777");
    assert.equal(result.candidate.email, "contato@aurora.example.com");
    assert.equal(result.candidate.dedupeKey.length, 64);
    assert.equal(result.candidate.status, "new");
  });

  it("deduplicates by website origin and dedupe key", () => {
    const first = normalizeProspectCandidate({
      rawName: "Clinica A",
      websiteUrl: "https://a.example.com",
      sourceType: "csv_import",
    });
    const second = normalizeProspectCandidate({
      rawName: "Clinica A Filial",
      websiteUrl: "https://a.example.com/contato",
      sourceType: "csv_import",
    });
    assert.equal(first.ok && second.ok, true);
    if (!first.ok || !second.ok) return;

    const lookup = createEmptyDedupeLookup();
    rememberCandidateInLookup(first.candidate, lookup);
    const dup = classifyCandidateDuplicate(second.candidate, lookup);
    assert.equal(dup.isDuplicate, true);
    assert.equal(dup.reason, "website_origin");
  });

  it("promotes candidate to clinic shape", () => {
    const result = normalizeProspectCandidate({
      rawName: "Dermato Centro",
      websiteUrl: "https://dermato.example.com",
      city: "Curitiba",
      sourceType: "manual",
    });
    assert.equal(result.ok, true);
    if (!result.ok) return;
    const clinic = promoteCandidateToClinicShape(result.candidate);
    assert.equal(clinic.status, "prospect");
    assert.equal(clinic.displayName, "Dermato Centro");
    assert.equal(clinic.dedupeKey, result.candidate.dedupeKey);
  });

  it("parses CSV import without network", () => {
    const csv = [
      "name,website_url,phone,email,city,state,specialty",
      "Clinica Beta,https://beta.example.com,11999990000,a@beta.example.com,SP,SP,Dermato",
    ].join("\n");
    const rows = parseManualCsvRows(csv);
    assert.equal(rows.length, 1);
    assert.equal(rows[0]?.ok, true);
  });

  it("forbids patient-data field names in the contract list", () => {
    assert.ok(FORBIDDEN_PATIENT_DATA_KEYS.includes("patientName"));
    assert.ok(FORBIDDEN_PATIENT_DATA_KEYS.includes("symptoms"));
  });
});

describe("normalizeWebsiteOrigin: scheme-insensitive dedupe identity (docs/technical/crawler-website-dedupe-normalization.md)", () => {
  it("1. http:// and https:// on the same host normalize to the same origin", () => {
    assert.equal(
      normalizeWebsiteOrigin("http://www.skinlaser.com.br"),
      normalizeWebsiteOrigin("https://www.skinlaser.com.br"),
    );
    assert.equal(normalizeWebsiteOrigin("http://www.skinlaser.com.br"), "https://www.skinlaser.com.br");
  });

  it("2. https:// and http:// (reverse direction) also normalize to the same origin", () => {
    assert.equal(
      normalizeWebsiteOrigin("https://oldclinic.example.com"),
      normalizeWebsiteOrigin("http://oldclinic.example.com"),
    );
  });

  it("3. a trailing slash does not prevent a match", () => {
    assert.equal(
      normalizeWebsiteOrigin("http://www.skinlaser.com.br/"),
      normalizeWebsiteOrigin("https://www.skinlaser.com.br"),
    );
  });

  it("4. path/query/hash never affect the origin-level match, regardless of scheme", () => {
    const base = normalizeWebsiteOrigin("https://clinic.example.com");
    assert.equal(normalizeWebsiteOrigin("http://clinic.example.com/sobre-nos"), base);
    assert.equal(normalizeWebsiteOrigin("https://clinic.example.com/contato?utm=x"), base);
    assert.equal(normalizeWebsiteOrigin("http://clinic.example.com/#agendar"), base);
  });

  it("5. hostname case is normalized regardless of scheme", () => {
    assert.equal(
      normalizeWebsiteOrigin("http://WWW.Clinic.Example.COM"),
      normalizeWebsiteOrigin("https://www.clinic.example.com"),
    );
  });

  it("6. an unrelated subdomain is never conflated with the apex or a sibling subdomain", () => {
    assert.notEqual(
      normalizeWebsiteOrigin("https://sub.example.com"),
      normalizeWebsiteOrigin("https://example.com"),
    );
    assert.notEqual(
      normalizeWebsiteOrigin("https://blog.example.com"),
      normalizeWebsiteOrigin("https://shop.example.com"),
    );
  });

  it("7. www vs. apex is intentionally NOT normalized here — only scheme is", () => {
    assert.notEqual(
      normalizeWebsiteOrigin("https://www.example.com"),
      normalizeWebsiteOrigin("https://example.com"),
    );
    // But scheme-insensitivity still applies independently on each side.
    assert.equal(
      normalizeWebsiteOrigin("http://www.example.com"),
      normalizeWebsiteOrigin("https://www.example.com"),
    );
  });

  it("does not change crawl-time same-origin safety — isSameOrigin remains scheme-strict and is a separate function", async () => {
    const { isSameOrigin } = await import("@/lib/crawler/url-policy");
    // A redirect from http to https on the identical host is, correctly,
    // still a *different* origin for crawl-time safety purposes — this
    // dedupe-layer fix must never loosen that independent guard.
    assert.equal(isSameOrigin("https://www.example.com/", "http://www.example.com/"), false);
  });
});
