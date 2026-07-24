import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { classifyIcp, explainIcpReasonCode, extractGooglePlacesCategoryTypes } from "./icp-classification/classify-icp";

describe("classifyIcp (docs/technical/crawler-icp-classification.md)", () => {
  it("1. an independent clinic with its own (non-directory) website is classified core", () => {
    const result = classifyIcp({
      name: "Clínica Derma Line",
      websiteUrl: "https://dermaline.com.br/",
      normalizedWebsiteOrigin: "https://dermaline.com.br",
    });
    assert.equal(result.organizationType, "independent_clinic");
    assert.equal(result.icpFit, "core");
    assert.equal(result.decisionComplexity, "owner_led");
    assert.ok(result.reasons.includes("likely_core_icp"));
    assert.deepEqual(result.blockers, []);
  });

  it("2. a hospital is classified blocked or future_enterprise (never core/promotable)", () => {
    const result = classifyIcp({
      name: "Hospital Santa Vida",
      websiteUrl: "https://hospitalsantavida.com.br/",
      normalizedWebsiteOrigin: "https://hospitalsantavida.com.br",
    });
    assert.equal(result.organizationType, "hospital");
    assert.ok(result.icpFit === "blocked" || result.icpFit === "future_enterprise");
    assert.notEqual(result.icpFit, "core");
    assert.ok(result.blockers.includes("hospital_or_large_institution"));
  });

  it("2b. a hospital is also detected via Google Places category type alone, without the word 'hospital' in the name", () => {
    const result = classifyIcp({
      name: "Centro de Saúde Vida Nova",
      websiteUrl: "https://vidanova.example.com.br/",
      normalizedWebsiteOrigin: "https://vidanova.example.com.br",
      sourceCategoryTypes: ["hospital", "health", "point_of_interest"],
    });
    assert.equal(result.organizationType, "hospital");
    assert.equal(result.icpFit, "future_enterprise");
  });

  it("3. a franchise unit is classified poor/future_enterprise, not MVP-ready", () => {
    const result = classifyIcp({
      name: "Rede Dermato Brasil - Franquia Curitiba",
      websiteUrl: "https://redeDermatoBrasil.com.br/",
      normalizedWebsiteOrigin: "https://redeDermatoBrasil.com.br",
    });
    assert.equal(result.organizationType, "franchise_unit");
    assert.ok(result.icpFit === "poor" || result.icpFit === "future_enterprise");
    assert.notEqual(result.icpFit, "core");
    assert.ok(result.blockers.includes("franchise_or_chain"));
    assert.equal(result.decisionComplexity, "local_manager");
  });

  it("4. a clinic chain (parent entity, no single-unit signal) is classified poor/future_enterprise", () => {
    const result = classifyIcp({
      name: "Grupo Vida Saudável - Unidade Moema",
      websiteUrl: "https://grupovidasaudavel.com.br/",
      normalizedWebsiteOrigin: "https://grupovidasaudavel.com.br",
    });
    assert.ok(["franchise_unit", "clinic_chain"].includes(result.organizationType));
    assert.ok(result.icpFit === "poor" || result.icpFit === "future_enterprise");
    assert.notEqual(result.icpFit, "core");
    assert.ok(result.blockers.includes("franchise_or_chain"));
  });

  it("4b. a clinic chain parent entity (rede + matriz, no unit signal) is classified clinic_chain / future_enterprise", () => {
    const result = classifyIcp({
      name: "Rede Sorriso Matriz",
      websiteUrl: "https://redesorriso.com.br/",
      normalizedWebsiteOrigin: "https://redesorriso.com.br",
    });
    assert.equal(result.organizationType, "clinic_chain");
    assert.equal(result.icpFit, "future_enterprise");
    assert.equal(result.decisionComplexity, "corporate");
  });

  it("5. a directory listing is classified blocked", () => {
    const result = classifyIcp({
      name: "Dra. Fulana - Doctoralia",
      websiteUrl: "https://www.doctoralia.com.br/dra-fulana",
      normalizedWebsiteOrigin: "https://www.doctoralia.com.br",
    });
    assert.equal(result.organizationType, "directory_listing");
    assert.equal(result.icpFit, "blocked");
    assert.ok(result.blockers.includes("directory_listing"));
  });

  it("6. a wrong-audience business (pharmacy) is classified blocked", () => {
    const result = classifyIcp({
      name: "Farmácia Popular Saúde",
      websiteUrl: "https://farmaciapopularsaude.com.br/",
      normalizedWebsiteOrigin: "https://farmaciapopularsaude.com.br",
    });
    assert.equal(result.organizationType, "wrong_audience");
    assert.equal(result.icpFit, "blocked");
    assert.ok(result.blockers.includes("wrong_audience"));
  });

  it("6b. a wrong-audience business is also detected via Google Places category type alone", () => {
    const result = classifyIcp({
      name: "Vida Bem Estar",
      websiteUrl: "https://vidabemestar.example.com.br/",
      normalizedWebsiteOrigin: "https://vidabemestar.example.com.br",
      sourceCategoryTypes: ["pharmacy", "store", "health"],
    });
    assert.equal(result.organizationType, "wrong_audience");
    assert.equal(result.icpFit, "blocked");
  });

  it("7. a solo practitioner (bare 'Dr./Dra.' personal-name page, no clinic keyword) is classified maybe/manual_review, not clean high-confidence", () => {
    const result = classifyIcp({
      name: "Dra. Fernanda Lima - Dermatologista",
      websiteUrl: "https://fernandalima.com.br/",
      normalizedWebsiteOrigin: "https://fernandalima.com.br",
    });
    assert.equal(result.organizationType, "solo_practitioner");
    assert.equal(result.icpFit, "maybe");
    assert.notEqual(result.icpFit, "core");
    assert.equal(result.decisionComplexity, "owner_led");
    assert.ok(result.reasons.includes("needs_manual_review"));
  });

  it("7b. a 'Dr./Dra.' name that ALSO contains a clinic-business keyword resolves to independent_clinic instead", () => {
    const result = classifyIcp({
      name: "Dra Mirelle Furlan - Dermatologia Clinica",
      websiteUrl: "https://mirellefurlan.com.br/",
      normalizedWebsiteOrigin: "https://mirellefurlan.com.br",
    });
    assert.equal(result.organizationType, "independent_clinic");
    assert.equal(result.icpFit, "core");
  });

  it("8. a single weak 'grupo' or 'centro médico' signal does not overblock without supporting evidence", () => {
    const grupo = classifyIcp({
      name: "Grupo Bem Estar Dermatologia",
      websiteUrl: "https://grupobemestar.com.br/",
      normalizedWebsiteOrigin: "https://grupobemestar.com.br",
    });
    assert.equal(grupo.organizationType, "independent_clinic");
    assert.equal(grupo.icpFit, "core");
    assert.ok(!grupo.blockers.includes("franchise_or_chain"));

    const centroMedico = classifyIcp({
      name: "Centro Médico Vida Nova",
      websiteUrl: "https://centromedicovidanova.com.br/",
      normalizedWebsiteOrigin: "https://centromedicovidanova.com.br",
    });
    assert.equal(centroMedico.organizationType, "independent_clinic");
    assert.equal(centroMedico.icpFit, "core");
    assert.ok(!centroMedico.blockers.includes("hospital_or_large_institution"));
    assert.ok(!centroMedico.blockers.includes("franchise_or_chain"));
  });

  it("regression (crawler-single-prospect-operator-run-v3-icp.md): an Instagram profile as the primary website_url never earns 'core', even when the name reads as a genuine independent clinic (Lumina Pelle)", () => {
    const result = classifyIcp({
      name: "Clínica Dermatológica e Nutrição Lumina Pelle",
      websiteUrl: "https://www.instagram.com/luminapelle/",
      normalizedWebsiteOrigin: "https://www.instagram.com",
    });
    assert.equal(result.organizationType, "independent_clinic");
    assert.equal(result.icpFit, "maybe");
    assert.notEqual(result.icpFit, "core");
    assert.ok(result.blockers.includes("social_profile_website"));
  });

  it("a Facebook profile as the primary website_url is likewise capped at 'maybe'", () => {
    const result = classifyIcp({
      name: "Clínica Sorriso Facebook",
      websiteUrl: "https://www.facebook.com/clinicasorriso",
      normalizedWebsiteOrigin: "https://www.facebook.com",
    });
    assert.equal(result.icpFit, "maybe");
    assert.ok(result.blockers.includes("social_profile_website"));
  });

  it("a WhatsApp link (wa.me) as the primary website_url is likewise capped at 'maybe'", () => {
    const result = classifyIcp({
      name: "Clínica Contato WhatsApp",
      websiteUrl: "https://wa.me/5511999999999",
      normalizedWebsiteOrigin: "https://wa.me",
    });
    assert.equal(result.icpFit, "maybe");
    assert.ok(result.blockers.includes("social_profile_website"));
  });

  it("a real own clinic domain remains 'core' — no social_profile_website blocker", () => {
    const result = classifyIcp({
      name: "Clínica Dra. Natália Segatti",
      websiteUrl: "http://nataliasegatti.com.br/",
      normalizedWebsiteOrigin: "https://nataliasegatti.com.br",
    });
    assert.equal(result.icpFit, "core");
    assert.ok(!result.blockers.includes("social_profile_website"));
  });

  it("a hospital/wrong-audience classification is not weakened by also having a social-profile website — the worse classification still wins", () => {
    const hospital = classifyIcp({
      name: "Hospital Santa Vida",
      websiteUrl: "https://www.instagram.com/hospitalsantavida/",
      normalizedWebsiteOrigin: "https://www.instagram.com",
    });
    assert.equal(hospital.organizationType, "hospital");
    assert.equal(hospital.icpFit, "future_enterprise");
    assert.ok(hospital.blockers.includes("social_profile_website"));
    assert.ok(hospital.blockers.includes("hospital_or_large_institution"));
  });

  it("a strong 'franquia' signal alone is sufficient (no second weak signal needed)", () => {
    const result = classifyIcp({
      name: "Clínica Sorriso Franquia",
      websiteUrl: "https://clinicasorriso.example.com.br/",
      normalizedWebsiteOrigin: "https://clinicasorriso.example.com.br",
    });
    assert.equal(result.organizationType, "franchise_unit");
    assert.notEqual(result.icpFit, "core");
  });

  it("regression: a real dermatology clinic tagged 'store' alongside genuine clinic categories (retail skincare sales) is NOT misclassified as wrong_audience — found against real staging data (Clinica Derma Line)", () => {
    const result = classifyIcp({
      name: "Clinica Derma Line",
      websiteUrl: "https://dermaline.com.br/",
      normalizedWebsiteOrigin: "https://dermaline.com.br",
      sourceCategoryTypes: ["beautician", "skin_care_clinic", "medical_clinic", "store", "doctor", "health", "point_of_interest", "establishment"],
    });
    assert.equal(result.organizationType, "independent_clinic");
    assert.equal(result.icpFit, "core");
    assert.ok(!result.blockers.includes("wrong_audience"));
  });

  it("no website (independent-clinic-shaped name) resolves to maybe, not core — own website is part of the ICP definition", () => {
    const result = classifyIcp({ name: "Clínica Sem Site Ainda", websiteUrl: null, normalizedWebsiteOrigin: null });
    assert.equal(result.organizationType, "independent_clinic");
    assert.equal(result.icpFit, "maybe");
    assert.ok(result.blockers.includes("no_own_website"));
  });

  it("15. is fully deterministic — same input always produces the same output", () => {
    const input = {
      name: "Clínica Determinística",
      websiteUrl: "https://deterministica.com.br/",
      normalizedWebsiteOrigin: "https://deterministica.com.br",
    };
    const first = classifyIcp(input);
    const second = classifyIcp(input);
    assert.deepEqual(first, second);
  });

  it("17. no medical-quality language appears in any explanation text, for any reason code", () => {
    const codes = [
      "hospital_or_large_institution",
      "franchise_or_chain",
      "directory_listing",
      "wrong_audience",
      "no_own_website",
      "social_profile_website",
      "duplicate_existing",
      "unclear_icp",
      "likely_core_icp",
      "needs_manual_review",
    ] as const;
    for (const code of codes) {
      const text = explainIcpReasonCode(code).toLowerCase();
      assert.doesNotMatch(text, /qualidade m[eé]dica|diagn[oó]stico|paciente|tratamento cl[ií]nico/);
    }
  });

  it("19. no secret-shaped value appears in any explanation text, for any reason code", () => {
    const codes = [
      "hospital_or_large_institution",
      "franchise_or_chain",
      "directory_listing",
      "wrong_audience",
      "no_own_website",
      "social_profile_website",
      "duplicate_existing",
      "unclear_icp",
      "likely_core_icp",
      "needs_manual_review",
    ] as const;
    for (const code of codes) {
      const text = explainIcpReasonCode(code);
      assert.doesNotMatch(text, /service_role|SUPABASE_|GOOGLE_PLACES_API_KEY|postgresql:\/\/|AIza|eyJ/);
    }
  });

  it("21. is pure — never calls a network/external-API primitive (source-level check)", () => {
    const source = readFileSync(new URL("./icp-classification/classify-icp.ts", import.meta.url), "utf8");
    assert.doesNotMatch(source, /\bfetch\(|axios|XMLHttpRequest|supabase|createClient/i);
  });
});

describe("extractGooglePlacesCategoryTypes", () => {
  it("safely reads sourceAttribution.raw.types when present and well-formed", () => {
    const types = extractGooglePlacesCategoryTypes({ raw: { types: ["hospital", "health", 123, null] } });
    assert.deepEqual(types, ["hospital", "health"]);
  });

  it("returns null for missing/malformed shapes without throwing", () => {
    assert.equal(extractGooglePlacesCategoryTypes({}), null);
    assert.equal(extractGooglePlacesCategoryTypes({ raw: null }), null);
    assert.equal(extractGooglePlacesCategoryTypes({ raw: "not an object" }), null);
    assert.equal(extractGooglePlacesCategoryTypes({ raw: { types: "not an array" } }), null);
    assert.equal(extractGooglePlacesCategoryTypes({ raw: { types: [] } }), null);
  });
});
