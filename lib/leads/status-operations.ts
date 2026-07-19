import {
  hasPersistenceConfig,
  logConfigWarning,
  readLeadCaptureEnv,
  type LeadCaptureEnv,
} from "@/lib/security/env";
import { createServiceClient } from "@/lib/supabase/service-client";
import {
  canTransitionLeadStatus,
  isLeadStatus,
  type LeadStatus,
  type StatusChangeInput,
  type StatusChangeResult,
} from "./status";

function sanitizeReason(reason: string | null | undefined): string | null {
  if (reason == null) return null;
  const trimmed = reason.trim().replace(/\s+/g, " ");
  if (!trimmed) return null;
  return trimmed.slice(0, 500);
}

function sanitizeActorIdentifier(value: string): string | null {
  const trimmed = value.trim().replace(/\s+/g, " ");
  if (!trimmed || trimmed.length > 160) return null;
  return trimmed;
}

export async function updateLeadStatus(
  input: StatusChangeInput,
  env: LeadCaptureEnv = readLeadCaptureEnv(),
): Promise<StatusChangeResult> {
  if (!isLeadStatus(input.toStatus)) {
    return {
      ok: false,
      reason: "invalid_status",
      message: "Target status is not allowed.",
    };
  }

  const actorIdentifier = sanitizeActorIdentifier(input.actorIdentifier);
  if (!actorIdentifier) {
    return {
      ok: false,
      reason: "validation",
      message: "Actor identifier is required.",
    };
  }

  if (!hasPersistenceConfig(env)) {
    logConfigWarning("status_update_missing_persistence");
    return {
      ok: false,
      reason: "configuration",
      message: "Persistence is not configured.",
    };
  }

  const client = createServiceClient(env);
  if (!client) {
    return {
      ok: false,
      reason: "configuration",
      message: "Persistence is not configured.",
    };
  }

  try {
    const { data: lead, error: leadError } = await client
      .from("leads")
      .select("id, status")
      .eq("id", input.leadId)
      .maybeSingle<{ id: string; status: string }>();

    if (leadError) {
      console.warn("[atria:leads] status_lookup_failed");
      return {
        ok: false,
        reason: "unavailable",
        message: "Unable to load lead status.",
      };
    }

    if (!lead) {
      return {
        ok: false,
        reason: "not_found",
        message: "Lead not found.",
      };
    }

    if (!isLeadStatus(lead.status)) {
      return {
        ok: false,
        reason: "invalid_status",
        message: "Current lead status is not recognized.",
      };
    }

    const fromStatus = lead.status as LeadStatus;
    if (!canTransitionLeadStatus(fromStatus, input.toStatus)) {
      return {
        ok: false,
        reason: "invalid_transition",
        message: "Status transition is not allowed.",
      };
    }

    const reason = sanitizeReason(input.reason);
    const now = new Date().toISOString();

    const { data: history, error: historyError } = await client
      .from("lead_status_history")
      .insert({
        lead_id: input.leadId,
        from_status: fromStatus,
        to_status: input.toStatus,
        reason,
        actor_type: input.actorType,
        actor_identifier: actorIdentifier,
        created_at: now,
      })
      .select("id")
      .single<{ id: string }>();

    if (historyError || !history?.id) {
      console.warn("[atria:leads] status_history_insert_failed");
      return {
        ok: false,
        reason: "unavailable",
        message: "Unable to record status history.",
      };
    }

    const { error: updateError } = await client
      .from("leads")
      .update({ status: input.toStatus })
      .eq("id", input.leadId)
      .eq("status", fromStatus);

    if (updateError) {
      console.warn("[atria:leads] status_update_failed");
      return {
        ok: false,
        reason: "unavailable",
        message: "Unable to update lead status.",
      };
    }

    return {
      ok: true,
      leadId: input.leadId,
      fromStatus,
      toStatus: input.toStatus,
      historyId: history.id,
    };
  } catch {
    console.warn("[atria:leads] status_update_exception");
    return {
      ok: false,
      reason: "unavailable",
      message: "Unable to update lead status.",
    };
  }
}

export async function listLeadStatusHistory(
  leadId: string,
  env: LeadCaptureEnv = readLeadCaptureEnv(),
): Promise<
  | {
      ok: true;
      entries: Array<{
        id: string;
        fromStatus: string | null;
        toStatus: string;
        reason: string | null;
        actorType: string;
        actorIdentifier: string;
        createdAt: string;
      }>;
    }
  | { ok: false; reason: "configuration" | "unavailable" }
> {
  if (!hasPersistenceConfig(env)) {
    return { ok: false, reason: "configuration" };
  }
  const client = createServiceClient(env);
  if (!client) return { ok: false, reason: "configuration" };

  try {
    const { data, error } = await client
      .from("lead_status_history")
      .select(
        "id, from_status, to_status, reason, actor_type, actor_identifier, created_at",
      )
      .eq("lead_id", leadId)
      .order("created_at", { ascending: false })
      .limit(100);

    if (error) {
      console.warn("[atria:leads] status_history_list_failed");
      return { ok: false, reason: "unavailable" };
    }

    return {
      ok: true,
      entries: (data ?? []).map((row) => ({
        id: row.id as string,
        fromStatus: (row.from_status as string | null) ?? null,
        toStatus: row.to_status as string,
        reason: (row.reason as string | null) ?? null,
        actorType: row.actor_type as string,
        actorIdentifier: row.actor_identifier as string,
        createdAt: row.created_at as string,
      })),
    };
  } catch {
    console.warn("[atria:leads] status_history_list_exception");
    return { ok: false, reason: "unavailable" };
  }
}
