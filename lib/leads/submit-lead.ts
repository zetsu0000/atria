"use server";

import { headers } from "next/headers";
import { readLeadCaptureEnv } from "@/lib/security/env";
import { checkRateLimit } from "@/lib/security/rate-limit";
import { verifyTurnstileToken } from "@/lib/security/turnstile";
import {
  findRecentDuplicate,
  markNotificationStatus,
  persistLead,
} from "./persistence";
import { notifyLeadReceived } from "./notification";
import { submitLeadWithDependencies } from "./submit-lead-core";
import type { LeadSubmitResult } from "./types";

async function readClientIp(): Promise<string | null> {
  try {
    const headerStore = await headers();
    return (
      headerStore.get("cf-connecting-ip") ??
      headerStore.get("x-forwarded-for") ??
      headerStore.get("x-real-ip")
    );
  } catch {
    return null;
  }
}

export async function submitLead(
  input: FormData | Record<string, unknown>,
): Promise<LeadSubmitResult> {
  const env = readLeadCaptureEnv();

  return submitLeadWithDependencies(input, {
    env,
    getClientIp: readClientIp,
    checkRateLimit,
    verifyTurnstile: verifyTurnstileToken,
    findRecentDuplicate: (dedupHash) => findRecentDuplicate(dedupHash, env),
    persistLead: (payload) => persistLead(payload, env),
    notifyLeadReceived: (payload) => notifyLeadReceived({ ...payload, env }),
    markNotificationStatus: (leadId, status) =>
      markNotificationStatus(leadId, status, env),
  });
}
