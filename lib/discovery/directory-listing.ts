/**
 * Small, explicit allowlist of known third-party directory/aggregator
 * domains — not an exhaustive detector, just the same manual judgment
 * call documented in docs/operations/crawler-operator-runbook.md ("is
 * website_url a directory listing, not the clinic's own domain?") made
 * mechanical for a short, known list. Anything not on this list is
 * treated as the prospect's own domain.
 *
 * Lives at this low level (alongside lib/discovery/normalize.ts, with no
 * dependency on lib/operations/*) so both
 * lib/operations/prioritization/prioritize-prospects.ts and
 * lib/operations/icp-classification/classify-icp.ts can import it
 * directly without a circular import between them.
 * `prioritize-prospects.ts` re-exports `isDirectoryListing` from here for
 * backward compatibility with its existing importers.
 */
const KNOWN_DIRECTORY_LISTING_ORIGINS = [
  "doctoralia.com.br",
  "doctoralia.com",
  "boaconsulta.com",
  "clinicorp.com",
  "guiamedico.com.br",
];

export function hostnameOf(originOrUrl: string | null): string | null {
  if (!originOrUrl) return null;
  try {
    return new URL(originOrUrl).hostname.replace(/^www\./, "").toLowerCase();
  } catch {
    return null;
  }
}

export function isDirectoryListing(normalizedWebsiteOrigin: string | null): boolean {
  const host = hostnameOf(normalizedWebsiteOrigin);
  if (!host) return false;
  return KNOWN_DIRECTORY_LISTING_ORIGINS.some((known) => host === known || host.endsWith(`.${known}`));
}
