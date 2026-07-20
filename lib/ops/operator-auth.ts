/**
 * Server-side operator authorization for /operacao.
 * Prefer Supabase Auth session + email allow-list.
 * Access is denied by default when auth is not configured.
 */
import { createClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import {
  getRuntimeMode,
  hasOperatorAuthConfig,
  readOperatorAuthEnv,
  type OperatorAuthEnv,
} from "@/lib/security/env";

export type OperatorSession = {
  userId: string;
  email: string;
};

export type OperatorAuthResult =
  | { ok: true; operator: OperatorSession }
  | {
      ok: false;
      reason:
        | "not_configured"
        | "unauthenticated"
        | "forbidden"
        | "unavailable";
      message: string;
    };

export type OperatorAuthDependencies = {
  env?: OperatorAuthEnv;
  /** Injected access token (tests). */
  accessToken?: string | null;
  /** Injected user resolver (tests). */
  resolveUser?: (
    accessToken: string,
    env: OperatorAuthEnv,
  ) => Promise<{ id: string; email: string | null } | null>;
};

const AUTH_MESSAGES = {
  not_configured:
    "Acesso operacional bloqueado. Autenticação de operador ainda não está configurada.",
  unauthenticated: "É necessário autenticar-se como operador para continuar.",
  forbidden: "Esta conta não está autorizada a acessar a área operacional.",
  unavailable: "Não foi possível validar a sessão operacional.",
} as const;

function readCookieToken(
  jar: Awaited<ReturnType<typeof cookies>>,
): string | null {
  const candidates = [
    jar.get("sb-access-token")?.value,
    jar.get("supabase-access-token")?.value,
  ];

  for (const cookie of jar.getAll()) {
    if (
      cookie.name.includes("auth-token") ||
      cookie.name.endsWith("-access-token")
    ) {
      // Supabase SSR often stores a JSON array/string in chunked cookies.
      const raw = cookie.value?.trim();
      if (!raw) continue;
      if (raw.startsWith("eyJ")) {
        candidates.unshift(raw);
        continue;
      }
      try {
        const parsed = JSON.parse(raw) as unknown;
        if (Array.isArray(parsed) && typeof parsed[0] === "string") {
          candidates.unshift(parsed[0]);
        } else if (
          parsed &&
          typeof parsed === "object" &&
          "access_token" in parsed &&
          typeof (parsed as { access_token: unknown }).access_token === "string"
        ) {
          candidates.unshift((parsed as { access_token: string }).access_token);
        }
      } catch {
        // ignore non-JSON cookie payloads
      }
    }
  }

  return candidates.find((value) => Boolean(value && value.length > 20)) ?? null;
}

async function defaultResolveUser(
  accessToken: string,
  env: OperatorAuthEnv,
): Promise<{ id: string; email: string | null } | null> {
  if (!env.supabaseUrl || !env.supabaseAnonKey) return null;
  const client = createClient(env.supabaseUrl, env.supabaseAnonKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
  const { data, error } = await client.auth.getUser(accessToken);
  if (error || !data.user) return null;
  return {
    id: data.user.id,
    email: data.user.email ?? null,
  };
}

export function isEmailAllowlisted(
  email: string | null | undefined,
  allowlist: string[],
): boolean {
  if (!email) return false;
  const normalized = email.trim().toLowerCase();
  return allowlist.includes(normalized);
}

/**
 * Validates operator access. Always re-run inside Server Actions.
 */
export async function requireOperator(
  deps: OperatorAuthDependencies = {},
): Promise<OperatorAuthResult> {
  const env = deps.env ?? readOperatorAuthEnv();

  if (!hasOperatorAuthConfig(env)) {
    return {
      ok: false,
      reason: "not_configured",
      message: AUTH_MESSAGES.not_configured,
    };
  }

  let accessToken = deps.accessToken ?? null;
  if (accessToken === null && deps.accessToken === undefined) {
    try {
      const jar = await cookies();
      accessToken = readCookieToken(jar);
    } catch {
      accessToken = null;
    }
  }

  if (!accessToken) {
    return {
      ok: false,
      reason: "unauthenticated",
      message: AUTH_MESSAGES.unauthenticated,
    };
  }

  const resolveUser = deps.resolveUser ?? defaultResolveUser;
  let user: { id: string; email: string | null } | null;
  try {
    user = await resolveUser(accessToken, env);
  } catch {
    return {
      ok: false,
      reason: "unavailable",
      message: AUTH_MESSAGES.unavailable,
    };
  }

  if (!user) {
    return {
      ok: false,
      reason: "unauthenticated",
      message: AUTH_MESSAGES.unauthenticated,
    };
  }

  if (!isEmailAllowlisted(user.email, env.operatorEmails)) {
    return {
      ok: false,
      reason: "forbidden",
      message: AUTH_MESSAGES.forbidden,
    };
  }

  return {
    ok: true,
    operator: {
      userId: user.id,
      email: user.email!.trim().toLowerCase(),
    },
  };
}

/**
 * Development/test fixture operator — never available in production builds.
 * Used only when OPERATIONS_REVIEW_FIXTURES=1 to capture local review screenshots.
 */
export function canUseReviewFixtures(): boolean {
  if (getRuntimeMode() === "production") return false;
  return process.env.OPERATIONS_REVIEW_FIXTURES === "1";
}

export function reviewFixtureOperator(): OperatorSession {
  return {
    userId: "review-fixture-operator",
    email: "ops-review@atria.local",
  };
}
