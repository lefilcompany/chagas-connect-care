import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { ToolContext } from "@lovable.dev/mcp-js";

/**
 * Build a Supabase client for the current MCP caller.
 *
 * We forward the raw OAuth bearer token as the `Authorization` header so that
 * every read/write executes under the caller's `auth.uid()` — the same RLS
 * policies used by the app apply to the MCP surface, including scoping by
 * institution and role (`has_role`, `get_user_institution`).
 */
export function supabaseForUser(ctx: ToolContext): SupabaseClient {
  const url = process.env.SUPABASE_URL!;
  const anon = process.env.SUPABASE_PUBLISHABLE_KEY ?? process.env.SUPABASE_ANON_KEY!;
  return createClient(url, anon, {
    global: { headers: { Authorization: `Bearer ${ctx.getToken()}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export function requireAuth(ctx: ToolContext) {
  if (!ctx.isAuthenticated()) {
    return {
      ok: false as const,
      response: {
        content: [{ type: "text" as const, text: "Não autenticado." }],
        isError: true,
      },
    };
  }
  return { ok: true as const };
}