/**
 * Stable server-side contracts for lead operational status.
 * Not exposed via public unauthenticated routes.
 */
import {
  listLeadStatusHistory,
  updateLeadStatus,
} from "@/lib/leads/status-operations";
import {
  listAllowedTransitions,
  type StatusChangeInput,
} from "@/lib/leads/status";
import {
  readLeadCaptureEnv,
  type LeadCaptureEnv,
} from "@/lib/security/env";

export async function opUpdateLeadStatus(
  input: StatusChangeInput,
  env: LeadCaptureEnv = readLeadCaptureEnv(),
) {
  return updateLeadStatus(input, env);
}

export async function opListLeadStatusHistory(
  leadId: string,
  env: LeadCaptureEnv = readLeadCaptureEnv(),
) {
  return listLeadStatusHistory(leadId, env);
}

export function opListAllowedLeadTransitions(fromStatus: Parameters<
  typeof listAllowedTransitions
>[0]) {
  return listAllowedTransitions(fromStatus);
}
