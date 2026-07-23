import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { FakeClinicRepository, FakeDiscoveryRepository } from "./repositories/fakes";
import { promoteCandidateToClinic } from "./promote-candidate";

async function recordCandidate(
  discoveryRepo: FakeDiscoveryRepository,
  overrides: Partial<Parameters<FakeDiscoveryRepository["recordCandidate"]>[0]> = {},
) {
  const result = await discoveryRepo.recordCandidate({
    sourceType: "manual",
    rawName: "Clínica Promovível",
    normalizedName: "clinica promovivel",
    websiteUrl: "https://promovivel.example.com",
    normalizedWebsiteOrigin: "https://promovivel.example.com",
    phone: null,
    email: null,
    city: "Recife",
    state: "PE",
    specialty: "Dermatologia",
    sourceAttribution: { batch: "csv-2026-07" },
    dedupeKey: "promovivel-dedupe",
    ...overrides,
  });
  if (!result.ok) throw new Error("setup failed");
  return result.value;
}

describe("promoteCandidateToClinic (transaction shape)", () => {
  it("creates a clinic from the candidate and marks it promoted, preserving attribution and dedupe key", async () => {
    const discoveryRepo = new FakeDiscoveryRepository();
    const clinicRepo = new FakeClinicRepository();
    const candidate = await recordCandidate(discoveryRepo);

    const result = await promoteCandidateToClinic(candidate.id, { discoveryRepo, clinicRepo });
    assert.equal(result.ok, true);
    if (!result.ok) return;

    assert.equal(result.clinic.displayName, "Clínica Promovível");
    assert.equal(result.clinic.dedupeKey, "promovivel-dedupe");
    assert.equal(result.clinic.sourceAttribution.batch, "csv-2026-07");
    assert.equal(result.clinic.sourceAttribution.promotedFrom, "prospect_candidate");
    assert.equal(result.candidate.status, "promoted_to_clinic");
    assert.equal(result.candidate.promotedClinicId, result.clinic.id);
  });

  it("is idempotent: promoting a second candidate with the same dedupe key links to the existing clinic", async () => {
    const discoveryRepo = new FakeDiscoveryRepository();
    const clinicRepo = new FakeClinicRepository();
    const first = await recordCandidate(discoveryRepo);
    const second = await recordCandidate(discoveryRepo, { rawName: "Clínica Promovível (duplicata)" });

    const firstResult = await promoteCandidateToClinic(first.id, { discoveryRepo, clinicRepo });
    if (!firstResult.ok) return assert.fail();

    const secondResult = await promoteCandidateToClinic(second.id, { discoveryRepo, clinicRepo });
    assert.equal(secondResult.ok, true);
    if (!secondResult.ok) return;

    assert.equal(secondResult.clinic.id, firstResult.clinic.id);
    assert.equal(clinicRepo.clinics.size, 1);
  });

  it("refuses to promote a duplicate-status candidate", async () => {
    const discoveryRepo = new FakeDiscoveryRepository();
    const clinicRepo = new FakeClinicRepository();
    const candidate = await recordCandidate(discoveryRepo, { dedupeKey: "dup-status-key" });
    await discoveryRepo.markCandidateDuplicate(candidate.id);

    const result = await promoteCandidateToClinic(candidate.id, { discoveryRepo, clinicRepo });
    assert.equal(result.ok, false);
    if (result.ok) return;
    assert.equal(result.reason, "not_eligible");
    assert.equal(clinicRepo.clinics.size, 0);
  });

  it("refuses to promote an already-promoted candidate", async () => {
    const discoveryRepo = new FakeDiscoveryRepository();
    const clinicRepo = new FakeClinicRepository();
    const candidate = await recordCandidate(discoveryRepo, { dedupeKey: "already-promoted-key" });

    const first = await promoteCandidateToClinic(candidate.id, { discoveryRepo, clinicRepo });
    if (!first.ok) return assert.fail();

    const second = await promoteCandidateToClinic(candidate.id, { discoveryRepo, clinicRepo });
    assert.equal(second.ok, false);
    if (second.ok) return;
    assert.equal(second.reason, "already_promoted");
    // No duplicate clinic was created on the second attempt.
    assert.equal(clinicRepo.clinics.size, 1);
  });

  it("returns not_found for an unknown candidate id", async () => {
    const discoveryRepo = new FakeDiscoveryRepository();
    const clinicRepo = new FakeClinicRepository();
    const result = await promoteCandidateToClinic("missing-id", { discoveryRepo, clinicRepo });
    assert.equal(result.ok, false);
    if (result.ok) return;
    assert.equal(result.reason, "not_found");
  });

  it("10. documents current, unchanged behavior for a website-only duplicate (different dedupe key, same normalized website): promotion still creates a second clinic rather than linking — this is intentionally out of scope for the website-dedupe-normalization fix (docs/technical/crawler-website-dedupe-normalization.md); the candidate review CLI's --include-existing check is the enforcement point for this case today, not promote-candidate.ts", async () => {
    const discoveryRepo = new FakeDiscoveryRepository();
    const clinicRepo = new FakeClinicRepository();

    // An already-promoted clinic for a real website.
    const existingClinicResult = await clinicRepo.createClinic({
      displayName: "SkinLaser - Higienópolis",
      normalizedName: "skinlaser higienopolis",
      websiteUrl: "https://www.skinlaser.com.br/",
      normalizedWebsiteOrigin: "https://www.skinlaser.com.br",
      city: null,
      state: "SP",
      specialty: "dermatology_clinic",
      status: "prospect",
      sourceType: "google_places",
      sourceAttribution: {},
      dedupeKey: "already-existing-skinlaser",
    });
    if (!existingClinicResult.ok) return assert.fail();

    // A different candidate for the *same real website*, discovered under
    // a different listing name/place id — its dedupeKey is necessarily
    // different (name differs), even though the website is the same site
    // once http/https are treated as equivalent.
    const candidate = await recordCandidate(discoveryRepo, {
      rawName: "Skinlaser Dermatologia Médica Ltda - Moema",
      normalizedName: "skinlaser dermatologia medica ltda moema",
      websiteUrl: "http://www.skinlaser.com.br/",
      normalizedWebsiteOrigin: "http://www.skinlaser.com.br",
      dedupeKey: "different-listing-same-website",
    });

    const result = await promoteCandidateToClinic(candidate.id, { discoveryRepo, clinicRepo });
    assert.equal(result.ok, true);
    if (!result.ok) return;

    // Current, unchanged behavior: a *new*, second clinic row is created —
    // promote-candidate.ts only ever links idempotently on an *exact*
    // dedupeKey match (asserted above by the existing idempotent test),
    // never on a website-only match. An operator following the documented
    // workflow (docs/operations/crawler-operator-handoff-pack.md Step B)
    // would have already seen this flagged as blocked_existing by
    // `crawler:candidates:list --include-existing` before ever reaching
    // this promote step.
    assert.notEqual(result.clinic.id, existingClinicResult.value.id);
    assert.equal(clinicRepo.clinics.size, 2);
  });
});
