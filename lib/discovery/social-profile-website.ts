/**
 * Small, explicit allowlist of known social-media/link-in-bio/messaging
 * platforms — not an exhaustive detector, just a mechanical version of
 * the same judgment call an operator already makes: "is website_url a
 * real, own, crawlable business domain, or just a social profile/
 * messaging link?" A social profile is useful contact/context evidence
 * (see docs/technical/crawler-social-profile-website-classification.md),
 * but is not a clinic's own website for promotion/crawl-readiness
 * purposes — there is no real page to crawl, screenshot, or modernize.
 *
 * Deliberately separate from `isDirectoryListing`
 * (lib/discovery/directory-listing.ts) — a directory listing (Doctoralia,
 * etc.) is a third-party clinic-aggregator page; a social profile is a
 * completely different kind of "not the clinic's real site" (see
 * requirement: "Do not treat social profile as directory listing unless
 * it truly is a directory").
 *
 * Lives at this low level (alongside lib/discovery/normalize.ts and
 * lib/discovery/directory-listing.ts, no dependency on lib/operations/*)
 * so both lib/operations/icp-classification/classify-icp.ts and
 * lib/operations/discovery/list-candidates.ts can import it directly.
 */
import { hostnameOf } from "./directory-listing";

const KNOWN_SOCIAL_PROFILE_ORIGINS = [
  "instagram.com",
  "facebook.com",
  "fb.com",
  "linktr.ee",
  "beacons.ai",
  "bio.link",
  "linkin.bio",
  "wa.me",
  "api.whatsapp.com",
  "chat.whatsapp.com",
];

export function isSocialProfileWebsite(normalizedWebsiteOrigin: string | null): boolean {
  const host = hostnameOf(normalizedWebsiteOrigin);
  if (!host) return false;
  return KNOWN_SOCIAL_PROFILE_ORIGINS.some((known) => host === known || host.endsWith(`.${known}`));
}
