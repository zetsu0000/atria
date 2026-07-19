/**
 * Operational lead status model for Atria.
 * Legacy capture-era statuses remain readable/transitionable.
 */

export const LEAD_STATUSES = [
  "new",
  "contacted",
  "qualified",
  "crawl_pending",
  "crawling",
  "crawl_complete",
  "preview_in_progress",
  "preview_ready",
  "approved",
  "published",
  "lost",
  "archived",
  // legacy
  "replied",
  "meeting",
  "proposal",
  "won",
  "do_not_contact",
] as const;

export type LeadStatus = (typeof LEAD_STATUSES)[number];

export const ACTOR_TYPES = [
  "system",
  "operator",
  "crawler",
  "automation",
] as const;

export type StatusActorType = (typeof ACTOR_TYPES)[number];

const ALLOWED_TRANSITIONS: Record<LeadStatus, readonly LeadStatus[]> = {
  new: ["contacted", "qualified", "crawl_pending", "lost", "archived"],
  contacted: ["qualified", "crawl_pending", "lost", "archived", "contacted"],
  qualified: ["crawl_pending", "contacted", "lost", "archived"],
  crawl_pending: ["crawling", "qualified", "lost", "archived"],
  crawling: ["crawl_complete", "crawl_pending", "lost", "archived"],
  crawl_complete: [
    "preview_in_progress",
    "crawl_pending",
    "lost",
    "archived",
  ],
  preview_in_progress: ["preview_ready", "crawl_complete", "lost", "archived"],
  preview_ready: ["approved", "preview_in_progress", "lost", "archived"],
  approved: ["published", "preview_ready", "lost", "archived"],
  published: ["archived"],
  lost: ["archived", "contacted", "new"],
  archived: [],
  replied: ["contacted", "qualified", "crawl_pending", "lost", "archived"],
  meeting: ["qualified", "crawl_pending", "proposal", "lost", "archived"],
  proposal: ["won", "lost", "qualified", "archived"],
  won: ["archived"],
  do_not_contact: ["archived"],
};

export function isLeadStatus(value: unknown): value is LeadStatus {
  return (
    typeof value === "string" &&
    (LEAD_STATUSES as readonly string[]).includes(value)
  );
}

export function canTransitionLeadStatus(
  from: LeadStatus,
  to: LeadStatus,
): boolean {
  if (from === to) return false;
  return ALLOWED_TRANSITIONS[from].includes(to);
}

export function listAllowedTransitions(from: LeadStatus): LeadStatus[] {
  return [...ALLOWED_TRANSITIONS[from]];
}

export type StatusChangeInput = {
  leadId: string;
  toStatus: LeadStatus;
  actorType: StatusActorType;
  actorIdentifier: string;
  reason?: string | null;
};

export type StatusChangeResult =
  | {
      ok: true;
      leadId: string;
      fromStatus: LeadStatus;
      toStatus: LeadStatus;
      historyId: string;
    }
  | {
      ok: false;
      reason:
        | "invalid_status"
        | "invalid_transition"
        | "not_found"
        | "configuration"
        | "unavailable"
        | "validation";
      message: string;
    };
