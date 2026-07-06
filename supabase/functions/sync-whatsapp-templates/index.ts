import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { runSync, LocalTemplateRow, CallerContext } from "./handler.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const WHATSAPP_TOKEN = Deno.env.get("WHATSAPP_TOKEN") ?? "";
const FALLBACK_WABA = Deno.env.get("WHATSAPP_WABA_ID") ?? "";
const RAW_VER = Deno.env.get("WHATSAPP_GRAPH_VERSION") ?? "v25.0";
const GRAPH_VERSION = /^v\d+\.\d+$/.test(RAW_VER) ? RAW_VER : "v25.0";

const TEMPLATE_SELECT = [
  "id", "institution", "meta_template_id", "meta_template_name",
  "meta_language", "meta_waba_id", "meta_status", "meta_footer_text",
  "body_patient", "body_contact", "body_segment", "meta_body_parameter_order",
].join(", ");

function json(status: number, body: unknown, correlationId?: string) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json",
      ...(correlationId ? { "x-correlation-id": correlationId } : {}),
    },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json(405, { error: "Method not allowed" });

  const correlationId = req.headers.get("x-correlation-id")?.trim() || crypto.randomUUID();
  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) return json(401, { error: "Unauthorized", correlation_id: correlationId }, correlationId);

  const authClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: authHeader } },
  });
  const token = authHeader.replace("Bearer ", "");
  const { data: claims, error: authErr } = await authClient.auth.getClaims(token);
  if (authErr || !claims?.claims) return json(401, { error: "Unauthorized", correlation_id: correlationId }, correlationId);

  const userId = claims.claims.sub as string;
  const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
  const { data: roleRow } = await admin.from("user_roles").select("role")
    .eq("user_id", userId).eq("role", "superadmin").maybeSingle();
  if (!roleRow) return json(403, { error: "Forbidden", correlation_id: correlationId }, correlationId);

  let body: { institution?: string; local_template_id?: string } = {};
  try { body = await req.json(); } catch { body = {}; }
  const institution = typeof body.institution === "string" ? body.institution.trim() : "";
  if (!institution && !body.local_template_id) {
    return json(400, { ok: false, error: "INSTITUTION_REQUIRED", correlation_id: correlationId }, correlationId);
  }
  if (!WHATSAPP_TOKEN) return json(500, { ok: false, error: "WHATSAPP_TOKEN_MISSING", correlation_id: correlationId }, correlationId);

  const caller: CallerContext = { userId, role: "superadmin", institution: null };
  const result = await runSync({
    graphVersion: GRAPH_VERSION,
    fallbackWaba: FALLBACK_WABA || null,
    now: () => new Date(),
    fetchPage: async (url: string) => {
      try {
        const res = await fetch(url, { headers: { Authorization: `Bearer ${WHATSAPP_TOKEN}` } });
        const responseBody = await res.json().catch(() => ({}));
        if (!res.ok) return { ok: false, status: res.status, data: [], nextUrl: null, errorMessage: responseBody?.error?.message ?? "Meta sync failed" };
        return { ok: true, status: 200, data: Array.isArray(responseBody?.data) ? responseBody.data : [], nextUrl: responseBody?.paging?.next ?? null };
      } catch (error) {
        return { ok: false, status: 502, data: [], nextUrl: null, errorMessage: error instanceof Error ? error.message : String(error) };
      }
    },
    resolveWabaForInstitution: async (scope: string) => {
      const { data } = await admin.from("institution_whatsapp_settings").select("waba_id").eq("institution", scope).maybeSingle();
      return (data as any)?.waba_id ?? null;
    },
    loadTemplateById: async (id: string) => {
      const { data } = await admin.from("message_templates").select(TEMPLATE_SELECT).eq("id", id).maybeSingle();
      return (data as LocalTemplateRow | null) ?? null;
    },
    findLocalRow: async (scope: string, item: any) => {
      if (item?.id) {
        const { data } = await admin.from("message_templates").select(TEMPLATE_SELECT)
          .eq("template_kind", "meta").eq("institution", scope).eq("meta_template_id", String(item.id)).maybeSingle();
        if (data) return data as LocalTemplateRow;
      }
      const { data } = await admin.from("message_templates").select(TEMPLATE_SELECT)
        .eq("template_kind", "meta").eq("institution", scope)
        .eq("meta_template_name", item?.name).eq("meta_language", item?.language ?? "pt_BR").maybeSingle();
      return (data as LocalTemplateRow | null) ?? null;
    },
    updateTemplate: async (id: string, patch: Record<string, unknown>) => {
      await admin.from("message_templates").update(patch).eq("id", id);
    },
  }, caller, { institution: institution || undefined, local_template_id: body.local_template_id });

  await admin.from("whatsapp_admin_audit_log").insert({
    user_id: userId,
    actor_role: "superadmin",
    institution: institution || null,
    entity: "message_templates",
    entity_id: body.local_template_id ?? null,
    action: "templates.sync",
    result: result.ok ? "success" : "failure",
    error_code: result.ok ? null : result.error,
    correlation_id: correlationId,
    after_state: result.ok ? { matched: result.matched, updated: result.updated, pages: result.pages } : null,
  });

  if (!result.ok) return json(result.status, { ok: false, error: result.error, correlation_id: correlationId }, correlationId);
  return json(200, { ...result, correlation_id: correlationId }, correlationId);
});
