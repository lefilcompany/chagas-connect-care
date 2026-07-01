import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const WHATSAPP_TOKEN = Deno.env.get("WHATSAPP_TOKEN") ?? "";
const WHATSAPP_WABA_ID = Deno.env.get("WHATSAPP_WABA_ID") ?? "";
const RAW_VER = Deno.env.get("WHATSAPP_GRAPH_VERSION") ?? "v25.0";
const GRAPH = /^v\d+\.\d+$/.test(RAW_VER) ? RAW_VER : "v25.0";

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
};

function sanitizeName(n: string): string {
  return (n ?? "").toLowerCase().replace(/[^a-z0-9_]/g, "_").slice(0, 512);
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
  const { data: roleRow } = await admin
    .from("user_roles").select("role").eq("user_id", userId).eq("role", "admin").maybeSingle();
  if (!roleRow) return json(403, { error: "Forbidden" });

  if (!WHATSAPP_TOKEN || !WHATSAPP_WABA_ID) {
    return json(500, { error: "WHATSAPP_TOKEN or WHATSAPP_WABA_ID missing" });
  }

  let payload: any;
  try { payload = await req.json(); } catch { return json(400, { error: "Invalid JSON" }); }

  const baseName = sanitizeName(payload?.name ?? "");
  const language = String(payload?.language ?? "pt_BR");
  const category = String(payload?.category ?? "UTILITY").toUpperCase();
  const components = Array.isArray(payload?.components) ? payload.components : null;
  const parentTemplateId: string | null = payload?.parent_template_id ?? null;
  const localTemplateId: string | null = payload?.local_template_id ?? null;
  const institution: string | null = payload?.institution ?? null;

  if (!baseName) return json(400, { error: "name is required" });
  if (!components) return json(400, { error: "components is required" });

  // Footer length validation (Meta limit: 60 chars).
  for (const c of components) {
    if (String(c?.type ?? "").toUpperCase() === "FOOTER" && (c?.text?.length ?? 0) > 60) {
      return json(400, { error: "FOOTER_TOO_LONG", detail: "Footer must be <= 60 characters" });
    }
  }

  // If creating a new version, compute name_vN+1.
  let finalName = baseName;
  let metaVersion = 1;
  if (parentTemplateId) {
    const { data: parent } = await admin
      .from("message_templates")
      .select("meta_template_name, meta_version")
      .eq("id", parentTemplateId)
      .maybeSingle();
    const parentName = (parent as any)?.meta_template_name ?? baseName;
    metaVersion = ((parent as any)?.meta_version ?? 1) + 1;
    const base = parentName.replace(/_v\d+$/, "");
    finalName = sanitizeName(`${base}_v${metaVersion}`);
  }

  // Submit to Meta.
  let res: Response;
  try {
    res = await fetch(
      `https://graph.facebook.com/${GRAPH}/${WHATSAPP_WABA_ID}/message_templates`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${WHATSAPP_TOKEN}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name: finalName,
          language,
          category,
          components,
          parameter_format: String(payload?.parameter_format ?? "POSITIONAL").toUpperCase(),
        }),
      },
    );
  } catch (e) {
    return json(502, { ok: false, error: e instanceof Error ? e.message : String(e) });
  }
  const metaBody = await res.json().catch(() => ({}));
  if (!res.ok) {
    return json(200, {
      ok: false,
      error: (metaBody as any)?.error?.message ?? "Meta template create failed",
      meta: metaBody,
    });
  }

  const metaStatus = STATUS_MAP[String((metaBody as any)?.status ?? "").toUpperCase()] ?? "submitted";
  const metaTemplateId = (metaBody as any)?.id ?? null;

  // Extract footer for storage.
  const footerComp = components.find((c: any) => String(c?.type ?? "").toUpperCase() === "FOOTER");
  const footerText = footerComp?.text ?? null;
  const parameterFormat = String(payload?.parameter_format ?? "POSITIONAL").toUpperCase();
  const nowIso = new Date().toISOString();
  const creationPayload = { name: finalName, language, category, components, parameter_format: parameterFormat };

  // Update or insert local record.
  if (localTemplateId) {
    await admin.from("message_templates").update({
      meta_template_id: metaTemplateId,
      meta_template_name: finalName,
      meta_language: language,
      meta_category: category,
      meta_status: metaStatus,
      meta_footer_text: footerText,
      meta_footer_source: footerText ? "meta_synced" : null,
      meta_creation_payload: creationPayload,
      meta_parameter_format: parameterFormat,
      meta_submitted_at: nowIso,
      meta_submitted_by: userId,
      meta_version: metaVersion,
      meta_parent_template_id: parentTemplateId,
    }).eq("id", localTemplateId);
  } else if (institution) {
    await admin.from("message_templates").insert({
      institution,
      template_kind: "meta",
      meta_template_id: metaTemplateId,
      meta_template_name: finalName,
      meta_language: language,
      meta_category: category,
      meta_status: metaStatus,
      meta_footer_text: footerText,
      meta_footer_source: footerText ? "meta_synced" : null,
      meta_creation_payload: creationPayload,
      meta_parameter_format: parameterFormat,
      meta_submitted_at: nowIso,
      meta_submitted_by: userId,
      meta_version: metaVersion,
      meta_parent_template_id: parentTemplateId,
      name: finalName,
      objective: payload?.objective ?? "custom",
    } as any);
  }

  return json(200, {
    ok: true,
    name: finalName,
    meta_template_id: metaTemplateId,
    meta_status: metaStatus,
    meta_version: metaVersion,
  });
});