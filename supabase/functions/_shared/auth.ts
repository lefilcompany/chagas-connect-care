// Shared auth helpers for WhatsApp / Superadmin edge functions.
//
// Every function that acts on behalf of a signed-in user MUST go through
// `requireAuth` (or `requireSuperadmin`) so we validate the JWT with the
// user-scoped Supabase client, then load their profile + role using the
// service-role client for RLS-safe reads.

import { createClient, type SupabaseClient } from "npm:@supabase/supabase-js@2";
import { jsonError } from "./http.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

export type AppRole = "admin" | "equipe" | "superadmin";

export interface AuthContext {
  userId: string;
  email: string | null;
  institution: string | null;
  roles: AppRole[];
  isSuperadmin: boolean;
  isAdmin: boolean;
  /** JWT-scoped client — respects RLS. */
  userClient: SupabaseClient;
  /** Service-role client — bypasses RLS. Use with care. */
  serviceClient: SupabaseClient;
  accessToken: string;
}

export function serviceClient(): SupabaseClient {
  return createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export function userClientFromRequest(req: Request): { client: SupabaseClient; token: string } | null {
  const authHeader = req.headers.get("Authorization") ?? "";
  const token = authHeader.replace(/^Bearer\s+/i, "").trim();
  if (!token) return null;
  const client = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return { client, token };
}

/**
 * Validates the caller's JWT and loads their institution + roles.
 * Returns a Response (401/500) on failure and an AuthContext on success.
 */
export async function requireAuth(req: Request): Promise<AuthContext | Response> {
  const pair = userClientFromRequest(req);
  if (!pair) {
    return jsonError(401, "UNAUTHENTICATED", "Missing bearer token.");
  }
  const { client: userClient, token } = pair;
  const { data: userData, error: userErr } = await userClient.auth.getUser();
  if (userErr || !userData?.user) {
    return jsonError(401, "UNAUTHENTICATED", "Invalid or expired session.");
  }
  const svc = serviceClient();
  const userId = userData.user.id;

  const [profileRes, rolesRes] = await Promise.all([
    svc.from("profiles").select("institution").eq("id", userId).maybeSingle(),
    svc.from("user_roles").select("role").eq("user_id", userId),
  ]);

  const roles = ((rolesRes.data ?? []) as { role: AppRole }[]).map((r) => r.role);
  const institution = (profileRes.data?.institution ?? null) as string | null;

  return {
    userId,
    email: userData.user.email ?? null,
    institution: institution && institution.length > 0 ? institution : null,
    roles,
    isSuperadmin: roles.includes("superadmin"),
    isAdmin: roles.includes("admin") || roles.includes("superadmin"),
    userClient,
    serviceClient: svc,
    accessToken: token,
  };
}

/**
 * Convenience: require a signed-in superadmin. Returns 403 otherwise.
 */
export async function requireSuperadmin(req: Request): Promise<AuthContext | Response> {
  const ctx = await requireAuth(req);
  if (ctx instanceof Response) return ctx;
  if (!ctx.isSuperadmin) {
    return jsonError(403, "SUPERADMIN_REQUIRED", "Requires superadmin role.");
  }
  return ctx;
}

/**
 * Require the caller to belong to a specific institution (or be a superadmin).
 */
export function assertInstitutionAccess(
  ctx: AuthContext,
  institution: string | null,
): Response | null {
  if (ctx.isSuperadmin) return null;
  if (!institution) {
    return jsonError(400, "INSTITUTION_REQUIRED", "Institution is required.");
  }
  if (ctx.institution !== institution) {
    return jsonError(403, "INSTITUTION_MISMATCH", "Cross-institution access denied.");
  }
  return null;
}