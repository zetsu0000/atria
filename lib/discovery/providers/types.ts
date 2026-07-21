/**
 * Provider-agnostic contract for external clinic-discovery adapters.
 *
 * A provider's only job is: given an explicit query + location, return a
 * bounded list of candidate businesses from an official API. Providers never
 * persist anything themselves, never crawl the returned website, never
 * contact anyone, and never drive a browser — see
 * lib/discovery/providers/google-places.ts for the first implementation.
 */

export type PlacesSearchInput = {
  /** Required. e.g. "dermatologia" or "clínica dermatológica". */
  query: string;
  /** Required. e.g. "São Paulo, SP, Brazil". */
  location: string;
  /** Hard bound on total results returned across all pages. */
  maxResults: number;
  /** Hard bound on how many provider API pages may be requested. */
  maxPages: number;
};

export type RawPlaceResult = {
  /** Stable per-provider identifier (e.g. Google's Place ID). */
  providerPlaceId: string;
  name: string;
  websiteUrl: string | null;
  phone: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
  categories: string[];
  /** Raw provider fields for this place, preserved for source_attribution provenance. */
  raw: Record<string, unknown>;
};

export type PlacesSearchErrorCode =
  | "missing_api_key"
  | "invalid_input"
  | "provider_error"
  | "invalid_response"
  | "rate_limited";

export type PlacesSearchResult =
  | {
      ok: true;
      places: RawPlaceResult[];
      pagesFetched: number;
      truncatedByMaxResults: boolean;
    }
  | {
      ok: false;
      code: PlacesSearchErrorCode;
      message: string;
    };

export interface PlacesProvider {
  searchPlaces(input: PlacesSearchInput): Promise<PlacesSearchResult>;
}
