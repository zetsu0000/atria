import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import {
  readLeadCaptureEnv,
  type LeadCaptureEnv,
} from "@/lib/security/env";

export function createServiceClient(
  env: LeadCaptureEnv = readLeadCaptureEnv(),
): SupabaseClient | null {
  if (!env.supabaseUrl || !env.supabaseServiceRoleKey) return null;
  return createClient(env.supabaseUrl, env.supabaseServiceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}
