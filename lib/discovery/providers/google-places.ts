/**
 * Google Places discovery adapter.
 *
 * Calls the official Places API (New) `places:searchText` JSON endpoint
 * only — https://developers.google.com/maps/documentation/places/web-service/text-search.
 * This module never scrapes Google Maps, never renders or drives a browser
 * against any Google surface, and never crawls the discovered clinic's own
 * website. It only ever performs the one HTTPS request per page defined
 * below (via an injectable `fetch`, so tests never touch the network).
 *
 * This adapter discovers candidates and maps them into this codebase's
 * existing prospect_candidate shape — it never creates a clinic, never
 * crawls, and never sends outreach. Promotion to `clinics` only happens
 * when the caller explicitly opts in (see `runGooglePlacesDiscovery`'s
 * `promote` input), reusing the same `promoteCandidateToClinic` used by the
 * CSV-driven controlled pipeline.
 */
import {
  classifyCandidateDuplicate,
  createEmptyDedupeLookup,
  normalizeProspectCandidate,
  rememberCandidateInLookup,
} from "@/lib/discovery/normalize";
import type { DiscoveryRepository } from "@/lib/operations/repositories/discovery-repository";
import type { ClinicRepository } from "@/lib/operations/repositories/clinic-repository";
import type { ProspectCandidateRecord } from "@/lib/operations/repositories/types";
import type { PromoteCandidateResult } from "@/lib/operations/promote-candidate";
import { promoteCandidateToClinic } from "@/lib/operations/promote-candidate";
import type {
  PlacesProvider,
  PlacesSearchInput,
  PlacesSearchResult,
  RawPlaceResult,
} from "./types";

export const GOOGLE_PLACES_SEARCH_URL = "https://places.googleapis.com/v1/places:searchText";

/** Requesting exactly these fields keeps one search call sufficient — no separate Place Details call is needed. */
export const GOOGLE_PLACES_FIELD_MASK =
  "places.id,places.displayName,places.formattedAddress,places.websiteUri,places.nationalPhoneNumber,places.types,places.addressComponents,nextPageToken";

const MAX_PAGE_SIZE = 20;

export const DEFAULT_MAX_RESULTS = 10;
export const DEFAULT_MAX_PAGES = 1;

export type FetchLike = typeof fetch;

export type GooglePlacesProviderOptions = {
  /** null when GOOGLE_PLACES_API_KEY is unset — searchPlaces then fails clearly with "missing_api_key". */
  apiKey: string | null;
  /** Injectable for tests; defaults to the global fetch. Never called unless searchPlaces runs outside dry-run. */
  fetchImpl?: FetchLike;
  /** Overridable for tests; defaults to the real Google endpoint. */
  baseUrl?: string;
};

function textOf(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function extractAddressComponent(
  components: unknown,
  wantedType: string,
  useShortText: boolean,
): string | null {
  if (!Array.isArray(components)) return null;
  for (const entry of components) {
    if (!entry || typeof entry !== "object") continue;
    const record = entry as Record<string, unknown>;
    const types = record.types;
    if (!Array.isArray(types) || !types.includes(wantedType)) continue;
    const value = useShortText ? record.shortText : record.longText;
    const text = textOf(value);
    if (text) return text;
  }
  return null;
}

function mapRawPlace(raw: unknown): RawPlaceResult | null {
  if (!raw || typeof raw !== "object") return null;
  const record = raw as Record<string, unknown>;

  const providerPlaceId = textOf(record.id);
  const displayName = record.displayName as { text?: unknown } | undefined;
  const name = displayName && typeof displayName === "object" ? textOf(displayName.text) : null;
  if (!providerPlaceId || !name) return null;

  const types = Array.isArray(record.types)
    ? record.types.filter((t): t is string => typeof t === "string")
    : [];

  return {
    providerPlaceId,
    name,
    websiteUrl: textOf(record.websiteUri),
    phone: textOf(record.nationalPhoneNumber),
    address: textOf(record.formattedAddress),
    city: extractAddressComponent(record.addressComponents, "locality", false),
    state: extractAddressComponent(record.addressComponents, "administrative_area_level_1", true),
    categories: types,
    raw: record,
  };
}

/**
 * Real Places API (New) text-search adapter. Never scrapes, never drives a
 * browser — a single `fetch` call to the official JSON endpoint per page.
 */
export function createGooglePlacesProvider(options: GooglePlacesProviderOptions): PlacesProvider {
  const fetchImpl = options.fetchImpl ?? fetch;
  const baseUrl = options.baseUrl ?? GOOGLE_PLACES_SEARCH_URL;

  return {
    async searchPlaces(input: PlacesSearchInput): Promise<PlacesSearchResult> {
      if (!options.apiKey) {
        return {
          ok: false,
          code: "missing_api_key",
          message: "GOOGLE_PLACES_API_KEY is not configured. Set it as an environment variable (never commit it).",
        };
      }
      if (!input.query.trim()) {
        return { ok: false, code: "invalid_input", message: "query is required and cannot be empty." };
      }
      if (!input.location.trim()) {
        return { ok: false, code: "invalid_input", message: "location is required and cannot be empty." };
      }
      if (input.maxResults < 1) {
        return { ok: false, code: "invalid_input", message: "maxResults must be at least 1." };
      }
      if (input.maxPages < 1) {
        return { ok: false, code: "invalid_input", message: "maxPages must be at least 1." };
      }

      const places: RawPlaceResult[] = [];
      let pageToken: string | undefined;
      let pagesFetched = 0;
      let truncatedByMaxResults = false;

      while (pagesFetched < input.maxPages) {
        const remaining = input.maxResults - places.length;
        if (remaining <= 0) {
          truncatedByMaxResults = true;
          break;
        }

        const body: Record<string, unknown> = {
          textQuery: `${input.query} ${input.location}`,
          pageSize: Math.min(MAX_PAGE_SIZE, remaining),
        };
        if (pageToken) body.pageToken = pageToken;

        let response: Response;
        try {
          response = await fetchImpl(baseUrl, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "X-Goog-Api-Key": options.apiKey,
              "X-Goog-FieldMask": GOOGLE_PLACES_FIELD_MASK,
            },
            body: JSON.stringify(body),
          });
        } catch (error) {
          return {
            ok: false,
            code: "provider_error",
            message: `Google Places request failed: ${error instanceof Error ? error.message : "unknown error"}`,
          };
        }

        pagesFetched++;

        if (response.status === 429) {
          return { ok: false, code: "rate_limited", message: "Google Places API rate limit exceeded." };
        }
        if (!response.ok) {
          return {
            ok: false,
            code: "provider_error",
            message: `Google Places API returned HTTP ${response.status}.`,
          };
        }

        let json: unknown;
        try {
          json = await response.json();
        } catch {
          return { ok: false, code: "invalid_response", message: "Google Places API returned invalid JSON." };
        }
        if (!json || typeof json !== "object") {
          return { ok: false, code: "invalid_response", message: "Google Places API returned an unexpected payload." };
        }

        const payload = json as Record<string, unknown>;
        const rawPlaces = Array.isArray(payload.places) ? payload.places : [];
        for (const rawPlace of rawPlaces) {
          if (places.length >= input.maxResults) {
            truncatedByMaxResults = true;
            break;
          }
          const mapped = mapRawPlace(rawPlace);
          if (mapped) places.push(mapped);
        }

        const nextToken = textOf(payload.nextPageToken);
        if (nextToken && places.length < input.maxResults) {
          pageToken = nextToken;
        } else {
          break;
        }
      }

      return { ok: true, places, pagesFetched, truncatedByMaxResults };
    },
  };
}

/**
 * Deterministic, in-memory fixture data for --dry-run — no API key, no
 * network call, ever. Intentionally includes one place with no website to
 * exercise the "missing website → needs_review" path end to end.
 */
export const FIXTURE_PLACES: RawPlaceResult[] = [
  {
    providerPlaceId: "fixture-place-1",
    name: "Clínica Fixture Um",
    websiteUrl: "https://example.com/",
    phone: "11900000001",
    address: "Rua Fixture, 100 - São Paulo, SP",
    city: "São Paulo",
    state: "SP",
    categories: ["doctor", "health"],
    raw: { fixture: true, id: "fixture-place-1" },
  },
  {
    providerPlaceId: "fixture-place-2",
    name: "Clínica Fixture Dois",
    websiteUrl: null,
    phone: null,
    address: "Rua Fixture, 200 - Curitiba, PR",
    city: "Curitiba",
    state: "PR",
    categories: ["doctor"],
    raw: { fixture: true, id: "fixture-place-2" },
  },
];

/** --dry-run provider: no API key required, no network call, canned results only. */
export function createFixtureGooglePlacesProvider(): PlacesProvider {
  return {
    async searchPlaces(input: PlacesSearchInput): Promise<PlacesSearchResult> {
      if (!input.query.trim()) {
        return { ok: false, code: "invalid_input", message: "query is required and cannot be empty." };
      }
      if (!input.location.trim()) {
        return { ok: false, code: "invalid_input", message: "location is required and cannot be empty." };
      }
      const places = FIXTURE_PLACES.slice(0, input.maxResults);
      return {
        ok: true,
        places,
        pagesFetched: 1,
        truncatedByMaxResults: FIXTURE_PLACES.length > input.maxResults,
      };
    },
  };
}

// ---------------------------------------------------------------------------
// Discovery orchestration: search → normalize → dedupe → persist as
// prospect_candidates. Optional, explicit-only promotion to clinics.
// ---------------------------------------------------------------------------

export type GooglePlacesDiscoveryInput = {
  query: string;
  location: string;
  /** Default 10. */
  maxResults?: number;
  /** Default 1. */
  maxPages?: number;
  /**
   * Default false. When true, every newly-recorded (non-duplicate,
   * non-rejected) candidate is immediately promoted to a clinic via
   * lib/operations/promote-candidate.ts. Requires `deps.clinicRepo`.
   */
  promote?: boolean;
};

export type GooglePlacesDiscoveryDeps = {
  provider: PlacesProvider;
  discoveryRepo: DiscoveryRepository;
  /** Required only when `input.promote` is true. */
  clinicRepo?: ClinicRepository;
};

export type GooglePlacesDiscoveryResult =
  | {
      ok: true;
      discoveryJobId: string;
      query: string;
      location: string;
      pagesFetched: number;
      truncatedByMaxResults: boolean;
      totalFoundByProvider: number;
      imported: ProspectCandidateRecord[];
      duplicates: Array<{ dedupeKey: string; reason: string; rawName: string }>;
      rejected: Array<{ providerPlaceId: string; rawName: string; message: string }>;
      promotions: Array<{ candidateId: string; rawName: string; result: PromoteCandidateResult }>;
    }
  | {
      ok: false;
      discoveryJobId: string | null;
      reason: string;
      message: string;
    };

/**
 * Runs one bounded Google Places search and persists results as
 * prospect_candidates only. Never crawls the discovered websites, never
 * builds or sends outreach, never promotes to a clinic unless
 * `input.promote` is explicitly true.
 */
export async function runGooglePlacesDiscovery(
  input: GooglePlacesDiscoveryInput,
  deps: GooglePlacesDiscoveryDeps,
): Promise<GooglePlacesDiscoveryResult> {
  const query = input.query.trim();
  const location = input.location.trim();
  const maxResults = input.maxResults ?? DEFAULT_MAX_RESULTS;
  const maxPages = input.maxPages ?? DEFAULT_MAX_PAGES;
  const promote = input.promote ?? false;

  if (!query) {
    return { ok: false, discoveryJobId: null, reason: "validation", message: "query is required." };
  }
  if (!location) {
    return { ok: false, discoveryJobId: null, reason: "validation", message: "location is required." };
  }
  if (promote && !deps.clinicRepo) {
    return {
      ok: false,
      discoveryJobId: null,
      reason: "validation",
      message: "promote=true requires deps.clinicRepo.",
    };
  }

  const discoveryJob = await deps.discoveryRepo.createDiscoveryJob({
    sourceType: "google_places",
    query: { query, location, maxResults, maxPages, promote },
    notes: "Google Places discovery adapter (no crawl, no outreach).",
  });
  if (!discoveryJob.ok) {
    throw new Error(`Failed to create discovery job: ${discoveryJob.message}`);
  }
  const discoveryJobId = discoveryJob.value.id;

  const searchResult = await deps.provider.searchPlaces({ query, location, maxResults, maxPages });
  if (!searchResult.ok) {
    await deps.discoveryRepo.completeDiscoveryJob(discoveryJobId, {
      status: "failed",
      candidatesCreated: 0,
      errorCode: searchResult.code,
      errorMessage: searchResult.message,
    });
    return { ok: false, discoveryJobId, reason: searchResult.code, message: searchResult.message };
  }

  const lookup = createEmptyDedupeLookup();
  const imported: ProspectCandidateRecord[] = [];
  const duplicates: Array<{ dedupeKey: string; reason: string; rawName: string }> = [];
  const rejected: Array<{ providerPlaceId: string; rawName: string; message: string }> = [];

  for (const place of searchResult.places.slice(0, maxResults)) {
    const normalized = normalizeProspectCandidate({
      rawName: place.name,
      websiteUrl: place.websiteUrl,
      phone: place.phone,
      email: null,
      city: place.city,
      state: place.state,
      specialty: place.categories[0] ?? null,
      sourceType: "google_places",
      sourceAttribution: {
        provider: "google_places",
        providerPlaceId: place.providerPlaceId,
        address: place.address,
        categories: place.categories,
        query,
        location,
        raw: place.raw,
      },
    });
    if (!normalized.ok) {
      rejected.push({ providerPlaceId: place.providerPlaceId, rawName: place.name, message: normalized.message });
      continue;
    }
    const candidate = normalized.candidate;

    const inBatchDup = classifyCandidateDuplicate(candidate, lookup);
    if (inBatchDup.isDuplicate) {
      duplicates.push({
        dedupeKey: candidate.dedupeKey,
        reason: inBatchDup.reason ?? "duplicate",
        rawName: candidate.rawName,
      });
      continue;
    }

    const existing = await deps.discoveryRepo.findCandidateByDedupeKey(candidate.dedupeKey);
    if (!existing.ok) {
      rejected.push({
        providerPlaceId: place.providerPlaceId,
        rawName: candidate.rawName,
        message: `Dedupe lookup failed: ${existing.message}`,
      });
      continue;
    }
    if (existing.value) {
      duplicates.push({ dedupeKey: candidate.dedupeKey, reason: "existing_in_db", rawName: candidate.rawName });
      continue;
    }

    const recorded = await deps.discoveryRepo.recordCandidate({
      discoveryJobId,
      sourceType: candidate.sourceType,
      rawName: candidate.rawName,
      normalizedName: candidate.normalizedName,
      websiteUrl: candidate.websiteUrl,
      normalizedWebsiteOrigin: candidate.normalizedWebsiteOrigin,
      phone: candidate.phone,
      email: candidate.email,
      city: candidate.city,
      state: candidate.state,
      specialty: candidate.specialty,
      sourceAttribution: candidate.sourceAttribution,
      dedupeKey: candidate.dedupeKey,
      // No website is the strongest signal this candidate needs a human
      // to verify identity/contact details before anything else happens.
      status: candidate.websiteUrl ? "new" : "needs_review",
    });
    if (!recorded.ok) {
      rejected.push({
        providerPlaceId: place.providerPlaceId,
        rawName: candidate.rawName,
        message: `Record failed: ${recorded.message}`,
      });
      continue;
    }
    imported.push(recorded.value);
    rememberCandidateInLookup(candidate, lookup);
  }

  await deps.discoveryRepo.completeDiscoveryJob(discoveryJobId, {
    status: "completed",
    candidatesCreated: imported.length,
  });

  const promotions: Array<{ candidateId: string; rawName: string; result: PromoteCandidateResult }> = [];
  if (promote && deps.clinicRepo) {
    for (const candidate of imported) {
      const result = await promoteCandidateToClinic(candidate.id, {
        discoveryRepo: deps.discoveryRepo,
        clinicRepo: deps.clinicRepo,
      });
      promotions.push({ candidateId: candidate.id, rawName: candidate.rawName, result });
    }
  }

  return {
    ok: true,
    discoveryJobId,
    query,
    location,
    pagesFetched: searchResult.pagesFetched,
    truncatedByMaxResults: searchResult.truncatedByMaxResults,
    totalFoundByProvider: searchResult.places.length,
    imported,
    duplicates,
    rejected,
    promotions,
  };
}
