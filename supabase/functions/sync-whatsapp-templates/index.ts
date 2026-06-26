import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const WHATSAPP_TOKEN = Deno.env.get("WHATSAPP_TOKEN") ?? "";
const WHATSAPP_WABA_ID = Deno.env.get("WHATSAPP_WABA_ID") ?? "";
const RAW_VER = Deno.env.get("WHATSAPP_GRAPH_VERSION") ?? "v25.0";
const WHATSAPP_GRAPH_VERSION = /^v\d+\.\d+$/.test(RAW_VER) ? RAW_VER : "v25.0";

function json(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

const STATUS_MAP: Record<string, string> = {
  APPROVED: "approved",
  REJECTED: "rejected",
  PENDING: "submitted",
  IN_APPEAL: "submitted",
  PAUSED: "paused",
  DISABLED: "disabled",
  PENDING_DELETION: "disabled",
  DELETED: "disabled",
};

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

  // Require admin role for sync.
  const { data: roleRow } = await admin
    .from("user_roles").select("role").eq("user_id", userId).eq("role", "admin").maybeSingle();
  if (!roleRow) return json(403, { error: "Forbidden" });

  if (!WHATSAPP_TOKEN || !WHATSAPP_WABA_ID) {
    return json(500, { error: "WHATSAPP_TOKEN or WHATSAPP_WABA_ID missing" });
  }

  const url = `https://graph.facebook.com/${WHATSAPP_GRAPH_VERSION}/${WHATSAPP_WABA_ID}/message_templates?fields=name,language,status,category,id,rejected_reason&limit=200`;
  let res: Response;
  try {
    res = await fetch(url, { headers: { Authorization: `Bearer ${WHATSAPP_TOKEN}` } });
  } catch (e) {
    return json(502, { ok: false, error: e instanceof Error ? e.message : String(e) });
  }
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    return json(200, { ok: false, error: (body as any)?.error?.message ?? "Meta sync failed" });
  }

  const items: any[] = Array.isArray((body as any)?.data) ? (body as any).data : [];
  const nowIso = new Date().toISOString();
  let updated = 0;
  let created = 0;

  for (const t of items) {
    const status = STATUS_MAP[String(t?.status ?? "").toUpperCase()] ?? "submitted";
    const patch = {
      meta_template_id: t?.id ?? null,
      meta_language: t?.language ?? "pt_BR",
      meta_category: t?.category ?? null,
      meta_status: status,
      rejection_reason: t?.rejected_reason ?? null,
      last_synced_at: nowIso,
    };
    const { data: existing } = await admin
      .from("message_templates")
      .select("id")
      .eq("template_kind", "meta")
      .eq("meta_template_name", t?.name)
      .maybeSingle();
    if (existing) {
      await admin.from("message_templates").update(patch).eq("id", (existing as any).id);
      updated++;
    } else {
      created++; // counter only — we never auto-create local objectives.
    }
  }

  return json(200, { ok: true, count: items.length, updated, unmapped: created });
});