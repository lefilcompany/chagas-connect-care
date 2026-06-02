import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

const WHATSAPP_TOKEN = Deno.env.get("WHATSAPP_TOKEN") ?? "";
const WHATSAPP_PHONE_NUMBER_ID = Deno.env.get("WHATSAPP_PHONE_NUMBER_ID") ?? "";
const WHATSAPP_TEST_MODE = (Deno.env.get("WHATSAPP_TEST_MODE") ?? "").toLowerCase() === "true";
const WHATSAPP_TEST_TEMPLATE_NAME = Deno.env.get("WHATSAPP_TEST_TEMPLATE_NAME") ?? "hello_world";
const WHATSAPP_TEST_TEMPLATE_LANGUAGE = Deno.env.get("WHATSAPP_TEST_TEMPLATE_LANGUAGE") ?? "en_US";
const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY") ?? "";

const META_API = `https://graph.facebook.com/v21.0/${WHATSAPP_PHONE_NUMBER_ID}/messages`;

function json(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function normalizeBRPhone(input: string): string | null {
  const digits = (input ?? "").replace(/\D/g, "");
  if (!digits) return null;
  let p = digits;
  if (!p.startsWith("55")) p = "55" + p;
  if (p.length < 12 || p.length > 13) return null;
  return p;
}

/**
 * Validates required env + recipient phone. Never returns the token itself.
 * Returns { ok: true, to } on success or { ok: false, code, error } on failure.
 */
function validateWhatsAppConfig(rawPhone: string):
  | { ok: true; to: string }
  | { ok: false; code: "MISSING_TOKEN" | "MISSING_PHONE_ID" | "INVALID_RECIPIENT"; error: string } {
  if (!WHATSAPP_TOKEN) {
    return { ok: false, code: "MISSING_TOKEN", error: "WHATSAPP_TOKEN não configurado no servidor." };
  }
  if (!WHATSAPP_PHONE_NUMBER_ID) {
    return { ok: false, code: "MISSING_PHONE_ID", error: "WHATSAPP_PHONE_NUMBER_ID não configurado no servidor." };
  }
  const to = normalizeBRPhone(rawPhone);
  if (!to) {
    return {
      ok: false,
      code: "INVALID_RECIPIENT",
      error: `Telefone destinatário inválido: "${rawPhone}". Esperado 55 + DDD + número.`,
    };
  }
  return { ok: true, to };
}

type SendBody = { message_id?: string };

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json(405, { error: "Method not allowed" });

  // Auth: require valid JWT from app
  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) return json(401, { error: "Unauthorized" });
  const authClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: authHeader } },
  });
  const token = authHeader.replace("Bearer ", "");
  const { data: claims, error: authErr } = await authClient.auth.getClaims(token);
  if (authErr || !claims?.claims) return json(401, { error: "Unauthorized" });

  let body: SendBody;
  try {
    body = await req.json();
  } catch {
    return json(400, { error: "Invalid JSON" });
  }
  if (!body.message_id || typeof body.message_id !== "string") {
    return json(400, { error: "message_id is required" });
  }

  const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  // Fetch the message
  const { data: msg, error: msgErr } = await admin
    .from("messages")
    .select("id, patient_id, contact_id, channel, body, status, template_id, template_variables, send_attempts")
    .eq("id", body.message_id)
    .maybeSingle();

  if (msgErr || !msg) return json(404, { error: "Message not found" });
  if (msg.channel !== "whatsapp") {
    return json(400, { error: "Message channel is not whatsapp" });
  }

  // Resolve destination
  let toRaw = "";
  if (msg.contact_id) {
    const { data: c } = await admin
      .from("contacts")
      .select("phone")
      .eq("id", msg.contact_id)
      .maybeSingle();
    toRaw = c?.phone ?? "";
  } else {
    const { data: p } = await admin
      .from("patients")
      .select("phone")
      .eq("id", msg.patient_id)
      .maybeSingle();
    toRaw = p?.phone ?? "";
  }

  const cfg = validateWhatsAppConfig(toRaw);
  if (!cfg.ok) {
    await admin
      .from("messages")
      .update({
        status: "failed",
        failed_at: new Date().toISOString(),
        last_error: cfg.error,
        send_attempts: ((msg as any).send_attempts ?? 0) + 1,
      })
      .eq("id", msg.id);
    return json(200, {
      ok: false,
      error: cfg.error,
      error_code: cfg.code,
      test_mode: WHATSAPP_TEST_MODE,
      phone_original: toRaw,
      phone_normalized: null,
    });
  }
  const to = cfg.to;

  // Increment attempts upfront
  await admin
    .from("messages")
    .update({ send_attempts: ((msg as any).send_attempts ?? 0) + 1 })
    .eq("id", msg.id);

  // Build payload: prefer Meta template when message references an approved one
  let metaPayload: Record<string, unknown> = {
    messaging_product: "whatsapp",
    to,
    type: "text",
    text: { body: msg.body, preview_url: false },
  };

  if ((msg as any).template_id) {
    const { data: tpl } = await admin
      .from("message_templates")
      .select("template_kind, meta_template_name, meta_language, meta_status")
      .eq("id", (msg as any).template_id)
      .maybeSingle();
    if (
      tpl &&
      tpl.template_kind === "meta" &&
      tpl.meta_status === "approved" &&
      tpl.meta_template_name
    ) {
      const vars = ((msg as any).template_variables ?? {}) as Record<string, string>;
      const params = Object.values(vars).map((v) => ({ type: "text", text: String(v ?? "") }));
      metaPayload = {
        messaging_product: "whatsapp",
        to,
        type: "template",
        template: {
          name: tpl.meta_template_name,
          language: { code: tpl.meta_language || "pt_BR" },
          ...(params.length
            ? { components: [{ type: "body", parameters: params }] }
            : {}),
        },
      };
    }
  }

  // Call Meta Cloud API
  let metaRes: Response;
  try {
    metaRes = await fetch(META_API, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${WHATSAPP_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(metaPayload),
    });
  } catch (e) {
    const errMsg = e instanceof Error ? e.message : String(e);
    await admin
      .from("messages")
      .update({
        status: "failed",
        failed_at: new Date().toISOString(),
        last_error: `Network error: ${errMsg}`,
      })
      .eq("id", msg.id);
    return json(200, { ok: false, error: errMsg });
  }

  const metaJson = await metaRes.json().catch(() => ({}));

  if (!metaRes.ok) {
    const metaErr = (metaJson as any)?.error ?? {};
    const errText: string =
      metaErr.message ??
      metaErr.error_user_msg ??
      `Meta API error (${metaRes.status})`;
    // Persist full Meta error JSON for diagnostics
    const fullErr = JSON.stringify({
      http_status: metaRes.status,
      message: metaErr.message ?? null,
      type: metaErr.type ?? null,
      code: metaErr.code ?? null,
      error_subcode: metaErr.error_subcode ?? null,
      fbtrace_id: metaErr.fbtrace_id ?? null,
      raw: metaJson,
    });
    await admin
      .from("messages")
      .update({
        status: "failed",
        failed_at: new Date().toISOString(),
        last_error: fullErr.slice(0, 4000),
      })
      .eq("id", msg.id);
    return json(200, {
      ok: false,
      error: String(errText),
      error_code: "META_API_ERROR",
      meta_error: {
        message: metaErr.message ?? null,
        type: metaErr.type ?? null,
        code: metaErr.code ?? null,
        error_subcode: metaErr.error_subcode ?? null,
        fbtrace_id: metaErr.fbtrace_id ?? null,
        http_status: metaRes.status,
      },
      test_mode: WHATSAPP_TEST_MODE,
      phone_original: toRaw,
      phone_normalized: to,
    });
  }

  const externalId: string | undefined = metaJson?.messages?.[0]?.id;
  const nowIso = new Date().toISOString();

  const { error: updErr } = await admin
    .from("messages")
    .update({
      status: "sent",
      sent_at: nowIso,
      external_message_id: externalId ?? null,
      provider: "meta_whatsapp_cloud",
      last_error: null,
    })
    .eq("id", msg.id);

  if (updErr) {
    return json(500, { ok: false, error: updErr.message });
  }

  return json(200, { ok: true, external_message_id: externalId ?? null });
});