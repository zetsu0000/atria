import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  classifyCandidateDuplicate,
  createEmptyDedupeLookup,
  normalizeProspectCandidate,
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
