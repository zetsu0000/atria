import {
  hasTurnstileConfig,
  isProductionRuntime,
  logConfigWarning,
  readLeadCaptureEnv,
} from "./env";

export type TurnstileDecision =
  | { ok: true; mode: "verified" | "dev_bypass" }
  | { ok: false; reason: "missing_token" | "rejected" | "configuration" };

type TurnstileApiResponse = {
  success?: boolean;
  "error-codes"?: string[];
};

export async function verifyTurnstileToken(
  token: string | null | undefined,
  remoteIp?: string | null,
): Promise<TurnstileDecision> {
  const env = readLeadCaptureEnv();
  const configured = hasTurnstileConfig(env);

  if (!configured) {
    if (isProductionRuntime()) {
      logConfigWarning("turnstile_missing_in_production");
      return { ok: false, reason: "configuration" };
    }
    logConfigWarning("turnstile_bypassed_in_non_production");
    return { ok: true, mode: "dev_bypass" };
  }

  if (!token) {
    return { ok: false, reason: "missing_token" };
  }

  try {
    const body = new URLSearchParams();
    body.set("secret", env.turnstileSecretKey!);
    body.set("response", token);
    if (remoteIp) body.set("remoteip", remoteIp);

    const response = await fetch(
      "https://challenges.cloudflare.com/turnstile/v0/siteverify",
      {
        method: "POST",
        headers: {
          "content-type": "application/x-www-form-urlencoded",
        },
        body,
        cache: "no-store",
      },
    );

    if (!response.ok) {
      console.warn(
        `[atria:leads] turnstile_verify_http status=${response.status}`,
      );
      return { ok: false, reason: "rejected" };
    }

    const payload = (await response.json()) as TurnstileApiResponse;
    if (!payload.success) {
      console.warn("[atria:leads] turnstile_verify_failed");
      return { ok: false, reason: "rejected" };
    }

    return { ok: true, mode: "verified" };
  } catch {
    console.warn("[atria:leads] turnstile_verify_exception");
    return { ok: false, reason: "rejected" };
  }
}

export function getPublicTurnstileSiteKey(): string | null {
  return readLeadCaptureEnv().turnstileSiteKey;
}
