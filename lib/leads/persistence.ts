import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import {
  hasPersistenceConfig,
  logConfigWarning,
  readLeadCaptureEnv,
  type LeadCaptureEnv,
} from "@/lib/security/env";
import { getDuplicateWindowHours } from "./duplicate-protection";
import type { ParsedLead } from "./schema";

export type PersistLeadInput = {
  lead: ParsedLead;
  dedupHash: string;
  consentAt: string;
};

export type PersistLeadResult =
  | { ok: true; leadId: string; duplicate: false }
  | { ok: true; leadId: string; duplicate: true }
  | { ok: false; reason: "configuration" | "unavailable" };

type LeadRow = {
  id: string;
};

function createServiceClient(env: LeadCaptureEnv): SupabaseClient | null {
  if (!env.supabaseUrl || !env.supabaseServiceRoleKey) return null;
  return createClient(env.supabaseUrl, env.supabaseServiceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}

export async function findRecentDuplicate(
  dedupHash: string,
  env: LeadCaptureEnv = readLeadCaptureEnv(),
): Promise<"duplicate" | "clear" | "configuration" | "unavailable"> {
  if (!hasPersistenceConfig(env)) {
    logConfigWarning("persistence_missing");
    return "configuration";
  }

  const client = createServiceClient(env);
  if (!client) return "configuration";

  const since = new Date(
    Date.now() - getDuplicateWindowHours() * 60 * 60 * 1000,
  ).toISOString();

  try {
    const { data, error } = await client
      .from("leads")
      .select("id")
      .eq("dedup_hash", dedupHash)
      .gte("created_at", since)
      .limit(1)
      .maybeSingle();

    if (error) {
      console.warn("[atria:leads] duplicate_lookup_failed");
      return "unavailable";
    }

    return data ? "duplicate" : "clear";
  } catch {
    console.warn("[atria:leads] duplicate_lookup_exception");
    return "unavailable";
  }
}

export async function persistLead(
  input: PersistLeadInput,
  env: LeadCaptureEnv = readLeadCaptureEnv(),
): Promise<PersistLeadResult> {
  if (!hasPersistenceConfig(env)) {
    logConfigWarning("persistence_missing");
    return { ok: false, reason: "configuration" };
  }

  const client = createServiceClient(env);
  if (!client) {
    return { ok: false, reason: "configuration" };
  }

  const row = {
    contact_name: input.lead.contactName,
    clinic_name: input.lead.clinicName,
    contact_role: input.lead.role,
    website_url: input.lead.websiteUrl,
    email: input.lead.email,
    phone: input.lead.whatsapp,
    city: input.lead.location,
    website_problem: input.lead.concern,
    consent: true,
    consent_at: input.consentAt,
    consent_text_version: input.lead.consentTextVersion,
    source: input.lead.source,
    status: "new",
    dedup_hash: input.dedupHash,
    notification_status: "pending",
  };

  try {
    const { data, error } = await client
      .from("leads")
      .insert(row)
      .select("id")
      .single<LeadRow>();

    if (error) {
      // Unique violation / race on dedup within window is treated as duplicate when detectable.
      if (error.code === "23505") {
        const existing = await client
          .from("leads")
          .select("id")
          .eq("dedup_hash", input.dedupHash)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();

        if (existing.data?.id) {
          return { ok: true, leadId: existing.data.id, duplicate: true };
        }
      }

      console.warn("[atria:leads] persist_failed");
      return { ok: false, reason: "unavailable" };
    }

    if (!data?.id) {
      console.warn("[atria:leads] persist_missing_id");
      return { ok: false, reason: "unavailable" };
    }

    return { ok: true, leadId: data.id, duplicate: false };
  } catch {
    console.warn("[atria:leads] persist_exception");
    return { ok: false, reason: "unavailable" };
  }
}

export async function markNotificationStatus(
  leadId: string,
  status: "sent" | "failed" | "skipped",
  env: LeadCaptureEnv = readLeadCaptureEnv(),
): Promise<void> {
  if (!hasPersistenceConfig(env)) return;
  const client = createServiceClient(env);
  if (!client) return;

  try {
    const { error } = await client
      .from("leads")
      .update({
        notification_status: status,
        notification_attempted_at: new Date().toISOString(),
      })
      .eq("id", leadId);

    if (error) {
      console.warn("[atria:leads] notification_status_update_failed");
    }
  } catch {
    console.warn("[atria:leads] notification_status_update_exception");
  }
}
