import { createHmac } from "node:crypto";
import type { ParsedLead } from "./schema";

const DUPLICATE_WINDOW_HOURS = 48;

export function getDuplicateWindowHours(): number {
  return DUPLICATE_WINDOW_HOURS;
}

/**
 * Builds an HMAC-SHA256 deduplication digest from normalized safe fields.
 * Never log the source string.
 */
export function buildLeadDedupHash(
  lead: Pick<
    ParsedLead,
    "email" | "whatsapp" | "websiteUrl" | "clinicName"
  >,
  secret: string,
): string {
  const material = [
    lead.email,
    lead.whatsapp,
    lead.websiteUrl.toLowerCase(),
    lead.clinicName.toLowerCase(),
  ].join("|");

  return createHmac("sha256", secret).update(material, "utf8").digest("hex");
}

export function buildRateLimitKey(parts: {
  email: string;
  ipHash?: string | null;
}): string {
  return `lead:${parts.ipHash ?? "noip"}:${parts.email}`;
}

export function hashIpForRateLimit(
  ip: string | null | undefined,
  secret: string,
): string | null {
  if (!ip) return null;
  const trimmed = ip.split(",")[0]?.trim();
  if (!trimmed) return null;
  return createHmac("sha256", secret)
    .update(`ip:${trimmed}`, "utf8")
    .digest("hex")
    .slice(0, 32);
}
