export type RuntimeMode = "development" | "production" | "test";

export function getRuntimeMode(): RuntimeMode {
  if (process.env.NODE_ENV === "test") return "test";
  if (process.env.NODE_ENV === "production") return "production";
  return "development";
}

export function isProductionRuntime(): boolean {
  return getRuntimeMode() === "production";
}

function readOptional(name: string): string | null {
  const value = process.env[name]?.trim();
  return value ? value : null;
}

export type LeadCaptureEnv = {
  supabaseUrl: string | null;
  supabaseServiceRoleKey: string | null;
  resendApiKey: string | null;
  leadNotificationEmail: string | null;
  leadFromEmail: string | null;
  turnstileSiteKey: string | null;
  turnstileSecretKey: string | null;
  leadHashSecret: string | null;
  siteUrl: string | null;
};

export function readLeadCaptureEnv(): LeadCaptureEnv {
  return {
    supabaseUrl: readOptional("SUPABASE_URL"),
    supabaseServiceRoleKey: readOptional("SUPABASE_SERVICE_ROLE_KEY"),
    resendApiKey: readOptional("RESEND_API_KEY"),
    leadNotificationEmail: readOptional("LEAD_NOTIFICATION_EMAIL"),
    leadFromEmail: readOptional("LEAD_FROM_EMAIL"),
    turnstileSiteKey: readOptional("NEXT_PUBLIC_TURNSTILE_SITE_KEY"),
    turnstileSecretKey: readOptional("TURNSTILE_SECRET_KEY"),
    leadHashSecret: readOptional("LEAD_HASH_SECRET"),
    siteUrl: readOptional("NEXT_PUBLIC_SITE_URL"),
  };
}

export function hasPersistenceConfig(env: LeadCaptureEnv = readLeadCaptureEnv()): boolean {
  return Boolean(env.supabaseUrl && env.supabaseServiceRoleKey && env.leadHashSecret);
}

export function hasNotificationConfig(env: LeadCaptureEnv = readLeadCaptureEnv()): boolean {
  return Boolean(
    env.resendApiKey && env.leadNotificationEmail && env.leadFromEmail,
  );
}

export function hasTurnstileConfig(env: LeadCaptureEnv = readLeadCaptureEnv()): boolean {
  return Boolean(env.turnstileSiteKey && env.turnstileSecretKey);
}

export function logConfigWarning(code: string): void {
  console.warn(`[atria:leads] configuration_warning code=${code}`);
}

export type OperatorAuthEnv = {
  supabaseUrl: string | null;
  /** Anon key used only to validate user JWTs server-side. Never use service role in the browser. */
  supabaseAnonKey: string | null;
  /** Comma-separated allow-list of operator emails (lowercase match). */
  operatorEmails: string[];
};

export function readOperatorAuthEnv(): OperatorAuthEnv {
  const emailsRaw = readOptional("OPERATIONS_OPERATOR_EMAILS");
  const operatorEmails = emailsRaw
    ? emailsRaw
        .split(",")
        .map((email) => email.trim().toLowerCase())
        .filter(Boolean)
    : [];

  return {
    supabaseUrl: readOptional("SUPABASE_URL"),
    supabaseAnonKey:
      readOptional("SUPABASE_ANON_KEY") ??
      readOptional("NEXT_PUBLIC_SUPABASE_ANON_KEY"),
    operatorEmails,
  };
}

export function hasOperatorAuthConfig(
  env: OperatorAuthEnv = readOperatorAuthEnv(),
): boolean {
  return Boolean(
    env.supabaseUrl && env.supabaseAnonKey && env.operatorEmails.length > 0,
  );
}
