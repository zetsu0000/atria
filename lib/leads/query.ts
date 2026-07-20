import {
  hasPersistenceConfig,
  logConfigWarning,
  readLeadCaptureEnv,
  type LeadCaptureEnv,
} from "@/lib/security/env";
import { createServiceClient } from "@/lib/supabase/service-client";
import { isLeadStatus, type LeadStatus } from "./status";

export type OperationalLead = {
  id: string;
  contactName: string;
  clinicName: string;
  contactRole: string;
  websiteUrl: string;
  email: string;
  phone: string;
  city: string;
  websiteProblem: string | null;
  source: string;
  status: LeadStatus;
  consent: boolean;
  consentAt: string;
  createdAt: string;
  updatedAt: string;
};

type LeadRow = {
  id: string;
  contact_name: string;
  clinic_name: string;
  contact_role: string;
  website_url: string;
  email: string;
  phone: string;
  city: string;
  website_problem: string | null;
  source: string;
  status: string;
  consent: boolean;
  consent_at: string;
  created_at: string;
  updated_at: string;
};

export type ListLeadsOptions = {
  limit?: number;
  offset?: number;
  status?: LeadStatus | "all";
};

export type ListLeadsResult =
  | {
      ok: true;
      leads: OperationalLead[];
      total: number;
      source: "database";
    }
  | {
      ok: false;
      reason: "configuration" | "unavailable";
      message: string;
    };

export type GetLeadResult =
  | { ok: true; lead: OperationalLead; source: "database" }
  | {
      ok: false;
      reason: "configuration" | "unavailable" | "not_found";
      message: string;
    };

function mapRow(row: LeadRow): OperationalLead | null {
  if (!isLeadStatus(row.status)) return null;
  return {
    id: row.id,
    contactName: row.contact_name,
    clinicName: row.clinic_name,
    contactRole: row.contact_role,
    websiteUrl: row.website_url,
    email: row.email,
    phone: row.phone,
    city: row.city,
    websiteProblem: row.website_problem,
    source: row.source,
    status: row.status,
    consent: row.consent,
    consentAt: row.consent_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

const SELECT_COLUMNS =
  "id, contact_name, clinic_name, contact_role, website_url, email, phone, city, website_problem, source, status, consent, consent_at, created_at, updated_at";

const DEFAULT_LIMIT = 25;
const HARD_LIMIT = 50;

export async function listLeads(
  options: ListLeadsOptions = {},
  env: LeadCaptureEnv = readLeadCaptureEnv(),
): Promise<ListLeadsResult> {
  if (!hasPersistenceConfig(env)) {
    logConfigWarning("list_leads_missing_persistence");
    return {
      ok: false,
      reason: "configuration",
      message: "Persistência não configurada.",
    };
  }

  const client = createServiceClient(env);
  if (!client) {
    return {
      ok: false,
      reason: "configuration",
      message: "Persistência não configurada.",
    };
  }

  const limit = Math.min(
    Math.max(options.limit ?? DEFAULT_LIMIT, 1),
    HARD_LIMIT,
  );
  const offset = Math.max(options.offset ?? 0, 0);
  const status = options.status ?? "all";

  try {
    let countQuery = client
      .from("leads")
      .select("id", { count: "exact", head: true });
    if (status !== "all") {
      countQuery = countQuery.eq("status", status);
    }
    const countResult = await countQuery;
    if (countResult.error) {
      console.warn("[atria:leads] list_count_failed");
      return {
        ok: false,
        reason: "unavailable",
        message: "Não foi possível carregar os leads.",
      };
    }

    let query = client
      .from("leads")
      .select(SELECT_COLUMNS)
      .order("created_at", { ascending: false })
      .range(offset, offset + limit - 1);

    if (status !== "all") {
      query = query.eq("status", status);
    }

    const { data, error } = await query;
    if (error) {
      console.warn("[atria:leads] list_failed");
      return {
        ok: false,
        reason: "unavailable",
        message: "Não foi possível carregar os leads.",
      };
    }

    const leads = ((data as LeadRow[] | null) ?? [])
      .map(mapRow)
      .filter((lead): lead is OperationalLead => lead !== null);

    return {
      ok: true,
      leads,
      total: countResult.count ?? leads.length,
      source: "database",
    };
  } catch {
    console.warn("[atria:leads] list_exception");
    return {
      ok: false,
      reason: "unavailable",
      message: "Não foi possível carregar os leads.",
    };
  }
}

export async function getLead(
  leadId: string,
  env: LeadCaptureEnv = readLeadCaptureEnv(),
): Promise<GetLeadResult> {
  if (!leadId.trim()) {
    return {
      ok: false,
      reason: "not_found",
      message: "Lead não encontrado.",
    };
  }

  if (!hasPersistenceConfig(env)) {
    return {
      ok: false,
      reason: "configuration",
      message: "Persistência não configurada.",
    };
  }

  const client = createServiceClient(env);
  if (!client) {
    return {
      ok: false,
      reason: "configuration",
      message: "Persistência não configurada.",
    };
  }

  try {
    const { data, error } = await client
      .from("leads")
      .select(SELECT_COLUMNS)
      .eq("id", leadId)
      .maybeSingle<LeadRow>();

    if (error) {
      console.warn("[atria:leads] get_failed");
      return {
        ok: false,
        reason: "unavailable",
        message: "Não foi possível carregar o lead.",
      };
    }

    if (!data) {
      return {
        ok: false,
        reason: "not_found",
        message: "Lead não encontrado.",
      };
    }

    const lead = mapRow(data);
    if (!lead) {
      return {
        ok: false,
        reason: "unavailable",
        message: "Status do lead é inválido.",
      };
    }

    return { ok: true, lead, source: "database" };
  } catch {
    console.warn("[atria:leads] get_exception");
    return {
      ok: false,
      reason: "unavailable",
      message: "Não foi possível carregar o lead.",
    };
  }
}
