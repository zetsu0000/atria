/**
 * Server-only Supabase client for the operations/persistence-adapter layer.
 *
 * SECURITY: This module (and everything under lib/operations/supabase/*)
 * must never be imported from app/ client components or any file bundled to
 * the browser. It reads SUPABASE_SERVICE_ROLE_KEY, which bypasses RLS.
 * Consistent with lib/supabase/service-client.ts, this repo does not depend
 * on the `server-only` package; the boundary is enforced by convention and
 * by never importing lib/operations/supabase/* from app/ or components/.
 */
import { createServiceClient } from "@/lib/supabase/service-client";
import { hasPersistenceConfig, readLeadCaptureEnv, type LeadCaptureEnv } from "@/lib/security/env";

export function getOperationsServiceClient(env: LeadCaptureEnv = readLeadCaptureEnv()) {
  if (!hasPersistenceConfig(env)) return null;
  return createServiceClient(env);
}

export { hasPersistenceConfig, readLeadCaptureEnv };
export type { LeadCaptureEnv };
