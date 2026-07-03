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

function json(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json(405, { error: "Method not allowed" });

  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) return json(401, { error: "Unauthorized" });

  const authClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: authHeader } },
  });
  const token = authHeader.replace("Bearer ", "");
  const { data: claims, error: authErr } = await authClient.auth.getClaims(token);
  if (authErr || !claims?.claims) return json(401, { error: "Unauthorized" });

  const userId = claims.claims.sub as string;
  const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  const { data: roles } = await admin
    .from("user_roles").select("role").eq("user_id", userId);
  const roleSet = new Set((roles ?? []).map((r: any) => r.role));
  const role: CallerContext["role"] = roleSet.has("superadmin")
    ? "superadmin"
    : roleSet.has("admin") ? "admin" : "other";
  if (role === "other") return json(403, { error: "Forbidden" });

  const { data: profile } = await admin
    .from("profiles").select("institution").eq("id", userId).maybeSingle();
  const institution = (profile as any)?.institution ?? null;

  if (!WHATSAPP_TOKEN) return json(500, { error: "WHATSAPP_TOKEN missing" });

  let body: any = {};
  try { body = await req.json(); } catch { body = {}; }

  const caller: CallerContext = { userId, role, institution };

  const result = await runSync({
    graphVersion: GRAPH_VERSION,
    fallbackWaba: FALLBACK_WABA || null,
    now: () => new Date(),
    fetchPage: async (url: string) => {
      try {
        const res = await fetch(url, { headers: { Authorization: `Bearer ${WHATSAPP_TOKEN}` } });
        const body = await res.json().catch(() => ({}));
        if (!res.ok) {
          return {
            ok: false, status: res.status, data: [], nextUrl: null,
            errorMessage: (body as any)?.error?.message ?? "Meta sync failed",
          };
        }
        return {
          ok: true, status: 200,
          data: Array.isArray((body as any)?.data) ? (body as any).data : [],
          nextUrl: (body as any)?.paging?.next ?? null,
        };
      } catch (e) {
        return {
          ok: false, status: 502, data: [], nextUrl: null,
          errorMessage: e instanceof Error ? e.message : String(e),
        };
      }
    },
    resolveWabaForInstitution: async (inst: string) => {
      const { data } = await admin
        .from("institution_whatsapp_settings")
        .select("waba_id").eq("institution", inst).maybeSingle();
      return (data as any)?.waba_id ?? null;
    },
    loadTemplateById: async (id: string) => {
      const { data } = await admin
        .from("message_templates").select(TEMPLATE_SELECT).eq("id", id).maybeSingle();
      return (data as LocalTemplateRow | null) ?? null;
    },
    findLocalRow: async (inst: string, item: any) => {
      let q = admin.from("message_templates").select(TEMPLATE_SELECT)
        .eq("template_kind", "meta").eq("institution", inst);
      if (item?.id) {
        const { data } = await q.eq("meta_template_id", String(item.id)).maybeSingle();
        if (data) return data as LocalTemplateRow;
      }
      const { data } = await admin
        .from("message_templates").select(TEMPLATE_SELECT)
        .eq("template_kind", "meta").eq("institution", inst)
        .eq("meta_template_name", item?.name)
        .eq("meta_language", item?.language ?? "pt_BR")
        .maybeSingle();
      return (data as LocalTemplateRow | null) ?? null;
    },
    updateTemplate: async (id: string, patch: Record<string, unknown>) => {
      await admin.from("message_templates").update(patch).eq("id", id);
    },
  }, caller, body ?? {});

  if (!result.ok) return json(result.status, { ok: false, error: result.error });
  return json(200, result);
});
