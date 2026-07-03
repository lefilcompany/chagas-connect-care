import { createClient, type SupabaseClient } from "npm:@supabase/supabase-js@2";
import { createHandler, type HandlerDeps, type TemplateRow, type UserContext } from "./handler.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const WHATSAPP_TOKEN = Deno.env.get("WHATSAPP_TOKEN") ?? "";
const ENV_WABA_FALLBACK = Deno.env.get("WHATSAPP_WABA_ID") ?? "";
const RAW_VER = Deno.env.get("WHATSAPP_GRAPH_VERSION") ?? "v25.0";
const GRAPH = /^v\d+\.\d+$/.test(RAW_VER) ? RAW_VER : "v25.0";

const admin: SupabaseClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

async function loadUser(jwt: string): Promise<UserContext | null> {
  const authClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: `Bearer ${jwt}` } },
  });
  const { data, error } = await authClient.auth.getClaims(jwt);
  if (error || !data?.claims?.sub) return null;
  const userId = data.claims.sub as string;
  const { data: roles } = await admin
    .from("user_roles")
    .select("role")
    .eq("user_id", userId);
  const set = new Set((roles ?? []).map((r) => (r as { role: string }).role));
  const { data: profile } = await admin
    .from("profiles")
    .select("institution")
    .eq("id", userId)
    .maybeSingle();
  return {
    userId,
    isSuperadmin: set.has("superadmin"),
    isAdmin: set.has("admin"),
    institution: (profile as { institution?: string } | null)?.institution ?? null,
  };
}

async function loadTemplate(id: string): Promise<TemplateRow | null> {
  const { data } = await admin.from("message_templates").select("*").eq("id", id).maybeSingle();
  return (data as TemplateRow | null) ?? null;
}

async function loadWabaFor(_institution: string) {
  // institution_whatsapp_settings does not (yet) hold a per-institution WABA
  // id — fall back to the platform-wide WHATSAPP_WABA_ID env until that column
  // is introduced. Keeping the signature stable so the handler is unchanged.
  const wabaId = ENV_WABA_FALLBACK;
  return wabaId ? { wabaId } : null;
}

async function findByIdempotencyKey(key: string) {
  const { data } = await admin
    .from("message_templates")
    .select("id, meta_template_id, meta_status, meta_submitted_at")
    .eq("meta_idempotency_key", key)
    .maybeSingle();
  return (data as {
    id: string;
    meta_template_id: string | null;
    meta_status: string | null;
    meta_submitted_at: string | null;
  } | null) ?? null;
}

async function persistSubmission(id: string, patch: Record<string, unknown>) {
  await admin.from("message_templates").update(patch).eq("id", id);
}
async function persistError(id: string, patch: Record<string, unknown>) {
  await admin.from("message_templates").update(patch).eq("id", id);
}

async function callMeta(wabaId: string, payload: unknown) {
  const res = await fetch(`https://graph.facebook.com/${GRAPH}/${wabaId}/message_templates`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${WHATSAPP_TOKEN}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });
  const body = await res.json().catch(() => ({}));
  return { ok: res.ok, status: res.status, body };
}

const deps: HandlerDeps = {
  loadUser,
  loadTemplate,
  loadWabaFor,
  findByIdempotencyKey,
  persistSubmission,
  persistError,
  callMeta,
  now: () => new Date(),
};

Deno.serve(createHandler(deps));
