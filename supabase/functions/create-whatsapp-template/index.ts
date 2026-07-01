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

async function sha256Hex(text: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

/**
 * Validates template components against Meta Cloud API constraints.
 * Returns an error code + human message on failure, or null when valid.
 */
function validateComponents(components: any[]): { code: string; error: string } | null {
  let bodyCount = 0;
  let headerCount = 0;
  let footerCount = 0;
  let buttonsCount = 0;
  for (const c of components) {
    const type = String(c?.type ?? "").toUpperCase();
    if (type === "BODY") {
      bodyCount++;
      const txt = String(c?.text ?? "");
      if (!txt) return { code: "BODY_EMPTY", error: "Corpo do template não pode ser vazio." };
      if (txt.length > 1024) return { code: "BODY_TOO_LONG", error: "Corpo excede 1024 caracteres." };
    } else if (type === "HEADER") {
      headerCount++;
      const fmt = String(c?.format ?? "TEXT").toUpperCase();
      if (fmt === "TEXT" && String(c?.text ?? "").length > 60) {
        return { code: "HEADER_TOO_LONG", error: "Cabeçalho de texto excede 60 caracteres." };
      }
    } else if (type === "FOOTER") {
      footerCount++;
      if (String(c?.text ?? "").length > 60) {
        return { code: "FOOTER_TOO_LONG", error: "Rodapé excede 60 caracteres." };
      }
    } else if (type === "BUTTONS") {
      buttonsCount++;
      const btns = Array.isArray(c?.buttons) ? c.buttons : [];
      if (btns.length === 0 || btns.length > 10) {
        return { code: "BUTTONS_INVALID_COUNT", error: "Templates aceitam de 1 a 10 botões." };
      }
      for (const b of btns) {
        const bt = String(b?.type ?? "").toUpperCase();
        if (bt === "URL") {
          const u = String(b?.url ?? "");
          if (!/^https:\/\//i.test(u)) {
            return { code: "BUTTON_URL_INVALID", error: `Botão URL deve começar com https://: ${u}` };
          }
        } else if (bt === "PHONE_NUMBER") {
          if (!/^\+?\d{6,}$/.test(String(b?.phone_number ?? ""))) {
            return { code: "BUTTON_PHONE_INVALID", error: "Botão de telefone inválido." };
          }
        } else if (bt === "COPY_CODE") {
          const ex = b?.example;
          if (!Array.isArray(ex) || ex.length === 0 || !String(ex[0] ?? "").trim()) {
            return { code: "BUTTON_COPY_CODE_EXAMPLE_MISSING", error: "Botão COPY_CODE requer example." };
          }
        } else if (bt !== "QUICK_REPLY") {
          return { code: "BUTTON_TYPE_UNSUPPORTED", error: `Tipo de botão não suportado: ${bt}` };
        }
      }
    }
  }
  if (bodyCount !== 1) return { code: "BODY_REQUIRED", error: "Template precisa exatamente de 1 componente BODY." };
  if (headerCount > 1) return { code: "HEADER_DUPLICATE", error: "Somente um HEADER é permitido." };
  if (footerCount > 1) return { code: "FOOTER_DUPLICATE", error: "Somente um FOOTER é permitido." };
  if (buttonsCount > 1) return { code: "BUTTONS_DUPLICATE", error: "Somente um bloco BUTTONS é permitido." };
  return null;
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
  const { data: roleRows } = await admin
    .from("user_roles").select("role").eq("user_id", userId).in("role", ["admin", "superadmin"]);
  if (!roleRows || roleRows.length === 0) return json(403, { error: "Forbidden" });

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
  const parameterFormat = String(payload?.parameter_format ?? "POSITIONAL").toUpperCase();

  if (!baseName) return json(400, { error: "name is required" });
  if (!components) return json(400, { error: "components is required" });
  if (!["POSITIONAL", "NAMED"].includes(parameterFormat)) {
    return json(400, { error_code: "PARAMETER_FORMAT_INVALID", error: "parameter_format deve ser POSITIONAL ou NAMED" });
  }

  const validationErr = validateComponents(components);
  if (validationErr) return json(400, { ok: false, ...validationErr });

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

  // ---- Idempotency: skip re-submission of identical payloads. ----------
  const creationPayload = { name: finalName, language, category, components, parameter_format: parameterFormat };
  const idempotencyKey = await sha256Hex(
    JSON.stringify({ inst: institution ?? "", local: localTemplateId ?? "", body: creationPayload }),
  );
  {
    const { data: dup } = await admin
      .from("message_templates")
      .select("id, meta_template_id, meta_status, meta_template_name, meta_language, meta_version")
      .eq("meta_idempotency_key", idempotencyKey)
      .not("meta_template_id", "is", null)
      .maybeSingle();
    if (dup) {
      return json(200, {
        ok: true,
        cached: true,
        name: (dup as any).meta_template_name,
        meta_template_id: (dup as any).meta_template_id,
        meta_status: (dup as any).meta_status,
        meta_version: (dup as any).meta_version,
      });
    }
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
        body: JSON.stringify(creationPayload),
      },
    );
  } catch (e) {
    return json(502, { ok: false, error_code: "NETWORK_ERROR", error: e instanceof Error ? e.message : String(e) });
  }
  const metaBody = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = (metaBody as any)?.error ?? {};
    return json(200, {
      ok: false,
      error_code: "META_TEMPLATE_CREATE_FAILED",
      error: err.message ?? "Meta template create failed",
      meta_error: {
        code: err.code ?? null,
        error_subcode: err.error_subcode ?? null,
        message: err.message ?? null,
        type: err.type ?? null,
        fbtrace_id: err.fbtrace_id ?? null,
        http_status: res.status,
      },
    });
  }

  const metaStatus = STATUS_MAP[String((metaBody as any)?.status ?? "").toUpperCase()] ?? "submitted";
  const metaTemplateId = (metaBody as any)?.id ?? null;

  // Extract footer for storage.
  const footerComp = components.find((c: any) => String(c?.type ?? "").toUpperCase() === "FOOTER");
  const footerText = footerComp?.text ?? null;
  const nowIso = new Date().toISOString();

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
      meta_idempotency_key: idempotencyKey,
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
      meta_idempotency_key: idempotencyKey,
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