import type { LeadCaptureEnv } from "@/lib/security/env";
import {
  hasPersistenceConfig,
  logConfigWarning,
} from "@/lib/security/env";
import type { RateLimitDecision } from "@/lib/security/rate-limit";
import type { TurnstileDecision } from "@/lib/security/turnstile";
import {
  buildLeadDedupHash,
  buildRateLimitKey,
  hashIpForRateLimit,
} from "./duplicate-protection";
import type { PersistLeadResult } from "./persistence";
import type { NotifyLeadResult } from "./notification";
import { formDataToLeadInput, parseLeadInput, type ParsedLead } from "./schema";
import { USER_MESSAGES, type LeadSubmitResult } from "./types";

export type SubmitLeadDependencies = {
  env: LeadCaptureEnv;
  getClientIp: () => Promise<string | null> | string | null;
  checkRateLimit: (key: string) => RateLimitDecision;
  verifyTurnstile: (
    token: string | null | undefined,
    remoteIp?: string | null,
  ) => Promise<TurnstileDecision>;
  findRecentDuplicate: (
    dedupHash: string,
  ) => Promise<"duplicate" | "clear" | "configuration" | "unavailable">;
  persistLead: (input: {
    lead: ParsedLead;
    dedupHash: string;
    consentAt: string;
  }) => Promise<PersistLeadResult>;
  notifyLeadReceived: (input: {
    lead: ParsedLead;
    leadId: string;
    submittedAt: string;
  }) => Promise<NotifyLeadResult>;
  markNotificationStatus: (
    leadId: string,
    status: "sent" | "failed" | "skipped",
  ) => Promise<void>;
  now?: () => Date;
};

export async function submitLeadWithDependencies(
  input: FormData | Record<string, unknown>,
  deps: SubmitLeadDependencies,
): Promise<LeadSubmitResult> {
  try {
    const raw =
      input instanceof FormData ? formDataToLeadInput(input) : input;

    const parsed = parseLeadInput(raw);
    if (!parsed.ok) {
      return {
        status: "validation_error",
        message: parsed.message,
        fieldErrors: parsed.fieldErrors,
      };
    }

    if (!hasPersistenceConfig(deps.env)) {
      logConfigWarning("submit_blocked_missing_persistence");
      return {
        status: "configuration_error",
        message: USER_MESSAGES.configuration,
      };
    }

    const ip = await deps.getClientIp();
    const ipHash = hashIpForRateLimit(ip, deps.env.leadHashSecret!);
    const rateKey = buildRateLimitKey({
      email: parsed.data.email,
      ipHash,
    });
    const rate = deps.checkRateLimit(rateKey);
    if (!rate.allowed) {
      return {
        status: "rate_limited",
        message: USER_MESSAGES.rateLimited,
      };
    }

    const turnstile = await deps.verifyTurnstile(
      parsed.data.turnstileToken,
      ip,
    );
    if (!turnstile.ok) {
      if (turnstile.reason === "configuration") {
        return {
          status: "configuration_error",
          message: USER_MESSAGES.configuration,
        };
      }
      return {
        status: "spam_rejected",
        message: USER_MESSAGES.spamRejected,
      };
    }

    const dedupHash = buildLeadDedupHash(
      parsed.data,
      deps.env.leadHashSecret!,
    );
    const duplicateState = await deps.findRecentDuplicate(dedupHash);
    if (duplicateState === "configuration") {
      return {
        status: "configuration_error",
        message: USER_MESSAGES.configuration,
      };
    }
    if (duplicateState === "unavailable") {
      return {
        status: "service_unavailable",
        message: USER_MESSAGES.serviceUnavailable,
      };
    }
    if (duplicateState === "duplicate") {
      return {
        status: "duplicate",
        message: USER_MESSAGES.duplicate,
      };
    }

    const consentAt = (deps.now?.() ?? new Date()).toISOString();
    // Never hand the anti-spam token to persistence or notification payloads.
    const leadForStorage: ParsedLead = {
      ...parsed.data,
      turnstileToken: null,
    };
    const persisted = await deps.persistLead({
      lead: leadForStorage,
      dedupHash,
      consentAt,
    });

    if (!persisted.ok) {
      return {
        status:
          persisted.reason === "configuration"
            ? "configuration_error"
            : "service_unavailable",
        message:
          persisted.reason === "configuration"
            ? USER_MESSAGES.configuration
            : USER_MESSAGES.serviceUnavailable,
      };
    }

    if (persisted.duplicate) {
      return {
        status: "duplicate",
        message: USER_MESSAGES.duplicate,
      };
    }

    const notification = await deps.notifyLeadReceived({
      lead: leadForStorage,
      leadId: persisted.leadId,
      submittedAt: consentAt,
    });

    if (notification.ok) {
      await deps.markNotificationStatus(
        persisted.leadId,
        notification.mode === "sent" ? "sent" : "skipped",
      );
    } else {
      await deps.markNotificationStatus(persisted.leadId, "failed");
      console.warn(
        `[atria:leads] notification_failed_after_persist lead=${persisted.leadId}`,
      );
    }

    return {
      status: "success",
      message: USER_MESSAGES.success,
      leadId: persisted.leadId,
    };
  } catch {
    console.warn("[atria:leads] submit_unexpected_error");
    return {
      status: "server_error",
      message: USER_MESSAGES.serverError,
    };
  }
}
