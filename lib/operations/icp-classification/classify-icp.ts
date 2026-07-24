/**
 * Pure, deterministic ICP (Ideal Customer Profile) classifier — no
 * network call, no LLM, no invented facts. Given only a name, website
 * origin, and (optionally) already-persisted Google Places category
 * types, flags prospects that are commercially poor fits for the Atria
 * MVP even when they technically look like a clinic: hospitals,
 * franchises, clinic chains, directory listings, and wrong-audience
 * businesses (pharmacies, labs, suppliers, schools, marketplaces).
 *
 * Deliberately conservative, per the product spec this implements: a
 * single weak signal (e.g. one occurrence of "grupo" or "centro médico"
 * alone) never escalates past a soft nudge — only a strong keyword
 * ("franquia", "hospital") or two or more weak signals together
 * ("grupo" + "unidade") escalate a classification away from
 * `independent_clinic`. When genuinely uncertain, this always resolves to
 * `maybe`/`unknown` with a `needs_manual_review` reason, never a
 * confident block on a single ambiguous word.
 *
 * See docs/technical/crawler-icp-classification.md for the full model
 * and rationale.
 */
import { normalizeClinicName } from "@/lib/discovery/normalize";
import { isSocialProfileWebsite } from "@/lib/discovery/social-profile-website";
import { isDirectoryListing } from "@/lib/operations/prioritization/prioritize-prospects";
import type { IcpClassification, IcpDecisionComplexity, IcpFit, IcpOrganizationType, IcpReasonCode } from "./types";

export type ClassifyIcpInput = {
  name: string;
  websiteUrl: string | null;
  normalizedWebsiteOrigin: string | null;
  /**
   * Optional Google Places category types (e.g. `["hospital", "health"]`)
   * — already-public, already-persisted metadata (see
   * `sourceAttribution.raw.types` on a real discovery record), never
   * fetched fresh. Purely a secondary, reinforcing signal; the name-based
   * heuristic alone is always sufficient to classify.
   */
  sourceCategoryTypes?: readonly string[] | null;
};

const HOSPITAL_NAME_KEYWORDS = ["hospital", "instituto hospitalar", "pronto socorro"];
const HOSPITAL_CATEGORY_TYPES = new Set(["hospital"]);

const WRONG_AUDIENCE_NAME_KEYWORDS = [
  "farmacia",
  "drogaria",
  "laboratorio de analises",
  "laboratorio clinico",
  "distribuidora",
  "fornecedor",
  "importadora",
  "curso de",
  "faculdade",
  "universidade",
  "marketplace",
  "loja de equipamentos",
  "equipamentos medicos",
  "material medico hospitalar",
  "livraria",
  "editora",
];
/**
 * Deliberately does NOT include the generic "store" category type — real
 * dermatology/aesthetic clinics that also sell skincare products at
 * retail are routinely tagged "store" by Google Places alongside their
 * genuine clinic categories (confirmed against real staging data: a
 * legitimate clinic candidate carried
 * `["beautician", "skin_care_clinic", "medical_clinic", "store", "doctor", ...]`).
 * Only category types that are essentially incompatible with being a real
 * clinic are used here.
 */
const WRONG_AUDIENCE_CATEGORY_TYPES = new Set(["pharmacy", "drugstore", "school", "university", "supermarket", "shopping_mall", "electronics_store", "book_store"]);
/**
 * If any of these clinic-positive category types are also present, a
 * wrong-audience category match is ignored — defense-in-depth against
 * exactly the "store" false-positive class of bug above, for any category
 * not yet on the exclusion list either. Deliberately does NOT include the
 * broad "health" category — a pharmacy or wellness store is routinely
 * tagged "health" too, so it isn't a reliable clinic-specific signal.
 */
const CLINIC_POSITIVE_CATEGORY_TYPES = new Set(["doctor", "medical_clinic", "clinic", "dermatologist", "skin_care_clinic", "beautician"]);

/** A single occurrence of any of these strongly indicates a franchise/chain — sufficient on its own. */
const STRONG_CHAIN_NAME_KEYWORDS = ["franquia", "franchise"];
/** Two or more of these together escalate to franchise/chain; a single one alone is only a soft nudge (test: weak "grupo"/"centro médico" must not overblock). */
const WEAK_CHAIN_NAME_KEYWORDS = ["rede", "grupo", "unidade", "matriz", "filial", "filiais"];
/** Presence of any of these suggests this specific listing is a branch/unit, not the parent chain entity. */
const UNIT_NAME_KEYWORDS = ["unidade", "filial", "filiais"];

/** Presence of either suggests a genuine clinic business rather than a bare personal-name page, even when a "Dr./Dra." prefix is also present. */
const CLINIC_BUSINESS_NAME_KEYWORDS = ["clinica", "instituto"];

function containsWholeWordOrPhrase(normalizedName: string, phrase: string): boolean {
  const escaped = phrase.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`\\b${escaped}\\b`).test(normalizedName);
}

function matchesAny(normalizedName: string, phrases: readonly string[]): boolean {
  return phrases.some((phrase) => containsWholeWordOrPhrase(normalizedName, phrase));
}

function countMatches(normalizedName: string, phrases: readonly string[]): number {
  return phrases.filter((phrase) => containsWholeWordOrPhrase(normalizedName, phrase)).length;
}

function isSoloPractitionerName(normalizedName: string): boolean {
  return containsWholeWordOrPhrase(normalizedName, "dr") || containsWholeWordOrPhrase(normalizedName, "dra");
}

/**
 * Safely reads `sourceAttribution.raw.types` (the shape a Google Places
 * discovery record already persists) without assuming it exists or is
 * well-formed. Never throws; returns null for anything unexpected.
 */
export function extractGooglePlacesCategoryTypes(sourceAttribution: Record<string, unknown>): string[] | null {
  const raw = sourceAttribution.raw;
  if (!raw || typeof raw !== "object") return null;
  const types = (raw as Record<string, unknown>).types;
  if (!Array.isArray(types)) return null;
  const strings = types.filter((t): t is string => typeof t === "string");
  return strings.length > 0 ? strings : null;
}

function unique(codes: IcpReasonCode[]): IcpReasonCode[] {
  return [...new Set(codes)];
}

export function classifyIcp(input: ClassifyIcpInput): IcpClassification {
  const reasons: IcpReasonCode[] = [];
  const blockers: IcpReasonCode[] = [];
  const hasWebsite = Boolean(input.websiteUrl);
  if (!hasWebsite) blockers.push("no_own_website");

  const categoryTypes = (input.sourceCategoryTypes ?? []).map((t) => t.toLowerCase());

  function classification(
    organizationType: IcpOrganizationType,
    icpFit: IcpFit,
    decisionComplexity: IcpDecisionComplexity,
  ): IcpClassification {
    return { organizationType, icpFit, decisionComplexity, reasons: unique(reasons), blockers: unique(blockers) };
  }

  // 1. Directory listing — reuses the exact same detector prioritization
  // already uses, so this classifier never disagrees with the existing
  // directory-listing check elsewhere in the pipeline.
  if (isDirectoryListing(input.normalizedWebsiteOrigin)) {
    blockers.push("directory_listing");
    return classification("directory_listing", "blocked", "unknown");
  }

  // 1b. Social/profile/messaging website (Instagram, Facebook, WhatsApp,
  // link-in-bio, etc.) — not a directory (a different kind of "not the
  // clinic's real site"), and not necessarily a bad organizationType by
  // name (a real independent clinic can still only have an Instagram
  // page) — but it caps icpFit at "maybe" below, since there is no real
  // own domain to crawl/screenshot/modernize. Never makes an
  // already-worse classification (hospital/wrong_audience/chain) look
  // better — those return their own fixed icpFit before this matters.
  const isSocialProfile = isSocialProfileWebsite(input.normalizedWebsiteOrigin);
  if (isSocialProfile) blockers.push("social_profile_website");

  const normalizedName = normalizeClinicName(input.name);
  if (!normalizedName) {
    blockers.push("unclear_icp");
    return classification("unknown", "maybe", "unknown");
  }

  // 2. Wrong audience — name or category signal, either sufficient alone
  // (these keyword/category phrases are distinctive enough that a single
  // match is not a "weak" signal). A category-type match is ignored if a
  // clinic-positive category is also present, in case Google Places
  // co-tags a real clinic with a generic secondary category (e.g. many
  // clinics that also sell skincare products retail get tagged "store"
  // alongside their real "medical_clinic"/"doctor" categories).
  const hasClinicPositiveCategory = categoryTypes.some((t) => CLINIC_POSITIVE_CATEGORY_TYPES.has(t));
  const categoryIndicatesWrongAudience =
    categoryTypes.some((t) => WRONG_AUDIENCE_CATEGORY_TYPES.has(t)) && !hasClinicPositiveCategory;
  if (categoryIndicatesWrongAudience || matchesAny(normalizedName, WRONG_AUDIENCE_NAME_KEYWORDS)) {
    blockers.push("wrong_audience");
    return classification("wrong_audience", "blocked", "unknown");
  }

  // 3. Hospital / large institution — name or category signal, either
  // sufficient alone. Note: "centro medico" alone is deliberately NOT a
  // hospital keyword (see module docstring / test 8) — it falls through
  // to the chain-signal check and, absent other evidence, to
  // independent_clinic.
  const categoryIndicatesHospital = categoryTypes.some((t) => HOSPITAL_CATEGORY_TYPES.has(t));
  if (categoryIndicatesHospital || matchesAny(normalizedName, HOSPITAL_NAME_KEYWORDS)) {
    blockers.push("hospital_or_large_institution");
    return classification("hospital", "future_enterprise", "corporate");
  }

  // 4. Franchise / chain — one strong keyword, or two-or-more weak
  // keywords together, escalate. A single weak keyword alone is
  // deliberately not enough (conservative — see module docstring).
  const hasStrongChainSignal = matchesAny(normalizedName, STRONG_CHAIN_NAME_KEYWORDS);
  const weakChainHits = countMatches(normalizedName, WEAK_CHAIN_NAME_KEYWORDS);
  if (hasStrongChainSignal || weakChainHits >= 2) {
    blockers.push("franchise_or_chain");
    const isUnit = hasStrongChainSignal || matchesAny(normalizedName, UNIT_NAME_KEYWORDS);
    if (isUnit) {
      return classification("franchise_unit", "poor", "local_manager");
    }
    return classification("clinic_chain", "future_enterprise", "corporate");
  }
  if (weakChainHits === 1) {
    // Conservative nudge only — never a block on one weak word alone.
    reasons.push("needs_manual_review");
  }

  // 5. Solo practitioner — a bare "Dr./Dra." personal-name page. If the
  // name also contains a clinic-business keyword ("clínica", "instituto"),
  // that's stronger evidence of a real clinic business run by a named
  // doctor, so this branch is skipped in favor of independent_clinic below.
  if (isSoloPractitionerName(normalizedName) && !matchesAny(normalizedName, CLINIC_BUSINESS_NAME_KEYWORDS)) {
    reasons.push("needs_manual_review");
    return classification("solo_practitioner", "maybe", "owner_led");
  }

  // 6. Default: independent clinic — the Atria MVP's preferred profile.
  // Only "core" fit when it also has its own (non-directory,
  // non-social-profile) website; otherwise "maybe", since "own website"
  // is part of the ICP definition itself, not just a bonus. A social
  // profile as the primary website_url never earns "core", even when the
  // name reads as a genuine independent clinic (see
  // docs/technical/crawler-social-profile-website-classification.md —
  // found in crawler-single-prospect-operator-run-v3-icp.md).
  reasons.push("likely_core_icp");
  const icpFit: IcpFit = isSocialProfile ? "maybe" : hasWebsite ? "core" : "maybe";
  return classification("independent_clinic", icpFit, "owner_led");
}

const REASON_TEXT: Record<IcpReasonCode, string> = {
  hospital_or_large_institution:
    "Sinais de hospital/instituição de grande porte no nome — fora do perfil MVP hoje (possível oportunidade enterprise futura).",
  franchise_or_chain: "Sinais de franquia/rede/grupo de clínicas no nome — decisão provavelmente não é local/independente.",
  directory_listing: "Website é uma listagem de diretório de terceiros, não o domínio próprio.",
  wrong_audience: "Sinais de que este não é um negócio de clínica (ex.: farmácia, laboratório, curso, loja de equipamentos).",
  no_own_website: "Nenhum website próprio registrado.",
  social_profile_website:
    "O website informado é um perfil de rede social/mensageria (ex.: Instagram, Facebook, WhatsApp, link-in-bio), não um domínio próprio da clínica.",
  duplicate_existing: "Já existe um registro equivalente no sistema.",
  unclear_icp: "Não foi possível classificar o ICP com o nome disponível.",
  likely_core_icp: "Nome sugere clínica independente — perfil preferencial do MVP da Atria.",
  needs_manual_review: "Sinal fraco/ambíguo — recomenda-se pesquisa manual antes de prosseguir.",
};

/** Turns an IcpReasonCode into an operator-facing, pt-BR sentence — mirrors the crawl-failure-explanation.ts convention. */
export function explainIcpReasonCode(code: IcpReasonCode): string {
  return REASON_TEXT[code];
}
