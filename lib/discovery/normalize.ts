import { createHash } from "node:crypto";
import {
  FORBIDDEN_PATIENT_DATA_KEYS,
  type ClinicRecordShape,
  type NormalizedProspectCandidate,
  type RawProspectCandidateInput,
  rawProspectCandidateSchema,
} from "./types";

function collapseWhitespace(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

export function normalizeClinicName(raw: string): string {
  return collapseWhitespace(raw)
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function normalizePhoneDigits(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const digits = raw.replace(/\D+/g, "");
  if (digits.length < 8 || digits.length > 15) return null;
  return digits;
}

export function normalizeEmail(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const value = raw.trim().toLowerCase();
  if (!value || !value.includes("@")) return null;
  return value.slice(0, 254);
}

/**
 * Best-effort origin extraction without network.
 * Invalid / non-http(s) URLs return null (caller may still keep raw URL for review).
 */
export function normalizeWebsiteOrigin(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const trimmed = raw.trim();
  if (!trimmed) return null;
  try {
    const url = new URL(trimmed.includes("://") ? trimmed : `https://${trimmed}`);
    if (url.protocol !== "http:" && url.protocol !== "https:") return null;
    if (url.username || url.password) return null;
    return url.origin.toLowerCase();
  } catch {
    return null;
  }
}

export function buildCandidateDedupeKey(input: {
  normalizedName: string;
  normalizedWebsiteOrigin: string | null;
  phone: string | null;
  email: string | null;
  city: string | null;
}): string {
  const material = [
    input.normalizedWebsiteOrigin ?? "",
    input.normalizedName,
    input.phone ?? "",
    input.email ?? "",
    (input.city ?? "").toLowerCase(),
  ].join("|");

  return createHash("sha256").update(material).digest("hex");
}

export function assertNoPatientDataFields(record: Record<string, unknown>): void {
  for (const key of Object.keys(record)) {
    if (
      (FORBIDDEN_PATIENT_DATA_KEYS as readonly string[]).includes(key) ||
      /patient|symptom|prontu[aá]rio|health_?record/i.test(key)
    ) {
      throw new Error(`Forbidden patient-data field: ${key}`);
    }
  }
}

export function normalizeProspectCandidate(
  input: unknown,
):
  | { ok: true; candidate: NormalizedProspectCandidate }
  | { ok: false; message: string } {
  const parsed = rawProspectCandidateSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, message: "Invalid prospect candidate input." };
  }

  const data: RawProspectCandidateInput = parsed.data;
  assertNoPatientDataFields(data as unknown as Record<string, unknown>);

  const rawName = collapseWhitespace(data.rawName);
  const normalizedName = normalizeClinicName(rawName);
  if (!normalizedName) {
    return { ok: false, message: "Candidate name is empty after normalization." };
  }

  const websiteUrl = data.websiteUrl?.trim() || null;
  const normalizedWebsiteOrigin = normalizeWebsiteOrigin(websiteUrl);
  const phone = normalizePhoneDigits(data.phone);
  const email = normalizeEmail(data.email ?? null);
  const city = data.city ? collapseWhitespace(data.city) : null;
  const state = data.state ? collapseWhitespace(data.state) : null;
  const specialty = data.specialty ? collapseWhitespace(data.specialty) : null;

  const candidate: NormalizedProspectCandidate = {
    rawName,
    normalizedName,
    websiteUrl,
    normalizedWebsiteOrigin,
    phone,
    email,
    city,
    state,
    specialty,
    sourceType: data.sourceType,
    sourceAttribution: data.sourceAttribution ?? {},
    dedupeKey: buildCandidateDedupeKey({
      normalizedName,
      normalizedWebsiteOrigin,
      phone,
      email,
      city,
    }),
    status: "new",
  };

  return { ok: true, candidate };
}

export type DedupeLookup = {
  byDedupeKey: Set<string>;
  byWebsiteOrigin: Set<string>;
};

export function createEmptyDedupeLookup(): DedupeLookup {
  return { byDedupeKey: new Set(), byWebsiteOrigin: new Set() };
}

/**
 * Pure deduplication against an in-memory index (CSV/manual batch).
 * Does not call external APIs.
 */
export function classifyCandidateDuplicate(
  candidate: NormalizedProspectCandidate,
  lookup: DedupeLookup,
): { isDuplicate: boolean; reason: "dedupe_key" | "website_origin" | null } {
  if (lookup.byDedupeKey.has(candidate.dedupeKey)) {
    return { isDuplicate: true, reason: "dedupe_key" };
  }
  if (
    candidate.normalizedWebsiteOrigin &&
    lookup.byWebsiteOrigin.has(candidate.normalizedWebsiteOrigin)
  ) {
    return { isDuplicate: true, reason: "website_origin" };
  }
  return { isDuplicate: false, reason: null };
}

export function rememberCandidateInLookup(
  candidate: NormalizedProspectCandidate,
  lookup: DedupeLookup,
): void {
  lookup.byDedupeKey.add(candidate.dedupeKey);
  if (candidate.normalizedWebsiteOrigin) {
    lookup.byWebsiteOrigin.add(candidate.normalizedWebsiteOrigin);
  }
}

export function promoteCandidateToClinicShape(
  candidate: NormalizedProspectCandidate,
): ClinicRecordShape {
  return {
    displayName: candidate.rawName,
    normalizedName: candidate.normalizedName,
    websiteUrl: candidate.websiteUrl,
    normalizedWebsiteOrigin: candidate.normalizedWebsiteOrigin,
    city: candidate.city,
    state: candidate.state,
    specialty: candidate.specialty,
    status: "prospect",
    sourceType: candidate.sourceType,
    sourceAttribution: {
      ...candidate.sourceAttribution,
      promotedFrom: "prospect_candidate",
      candidateDedupeKey: candidate.dedupeKey,
    },
    dedupeKey: candidate.dedupeKey,
  };
}

/**
 * Parse a simple CSV of clinic prospects (header required).
 * Expected columns: name, website_url?, phone?, email?, city?, state?, specialty?
 * Does not fetch URLs.
 */
export function parseManualCsvRows(
  csvText: string,
  sourceType: RawProspectCandidateInput["sourceType"] = "csv_import",
): Array<
  | { ok: true; candidate: NormalizedProspectCandidate }
  | { ok: false; message: string; row: number }
> {
  const lines = csvText
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);
  if (lines.length < 2) {
    return [{ ok: false, message: "CSV requires a header and at least one row.", row: 0 }];
  }

  const header = splitCsvLine(lines[0]!).map((h) => h.toLowerCase());
  const nameIdx = header.findIndex((h) => h === "name" || h === "clinic" || h === "raw_name");
  if (nameIdx < 0) {
    return [{ ok: false, message: "CSV missing name column.", row: 0 }];
  }

  const col = (name: string) => header.findIndex((h) => h === name);

  const results: Array<
    | { ok: true; candidate: NormalizedProspectCandidate }
    | { ok: false; message: string; row: number }
  > = [];

  for (let i = 1; i < lines.length; i++) {
    const cols = splitCsvLine(lines[i]!);
    const raw = {
      rawName: cols[nameIdx] ?? "",
      websiteUrl: pick(cols, col("website_url")) ?? pick(cols, col("website")),
      phone: pick(cols, col("phone")),
      email: pick(cols, col("email")),
      city: pick(cols, col("city")),
      state: pick(cols, col("state")),
      specialty: pick(cols, col("specialty")),
      sourceType,
      sourceAttribution: { importRow: i, channel: "csv" },
    };
    const normalized = normalizeProspectCandidate(raw);
    if (!normalized.ok) {
      results.push({ ok: false, message: normalized.message, row: i });
    } else {
      results.push({ ok: true, candidate: normalized.candidate });
    }
  }

  return results;
}

function pick(cols: string[], idx: number): string | null {
  if (idx < 0) return null;
  const value = cols[idx]?.trim();
  return value ? value : null;
}

function splitCsvLine(line: string): string[] {
  const out: string[] = [];
  let current = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i]!;
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }
    if (ch === "," && !inQuotes) {
      out.push(current.trim());
      current = "";
      continue;
    }
    current += ch;
  }
  out.push(current.trim());
  return out;
}
