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

const RAW_WHATSAPP_GRAPH_VERSION = Deno.env.get("WHATSAPP_GRAPH_VERSION") ?? "v25.0";
const WHATSAPP_GRAPH_VERSION = /^v\d+\.\d+$/.test(RAW_WHATSAPP_GRAPH_VERSION)
  ? RAW_WHATSAPP_GRAPH_VERSION
  : "v25.0";

const META_API = `https://graph.facebook.com/${WHATSAPP_GRAPH_VERSION}/${WHATSAPP_PHONE_NUMBER_ID}/messages`;

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

  // Authorization: fetch through the caller's RLS-scoped client to ensure
  // the user has access to this message (same institution / owner).
  const { data: authorized, error: authzErr } = await authClient
    .from("messages")
    .select("id")
    .eq("id", body.message_id)
    .maybeSingle();
  if (authzErr || !authorized) {
    return json(403, { error: "Forbidden" });
  }

  // Fetch the message with admin client for full field access
  const { data: msg, error: msgErr } = await admin
    .from("messages")
    .select("id, patient_id, contact_id, channel, body, status, template_id, template_variables, send_attempts")
    .eq("id", body.message_id)
    .maybeSingle();

  if (msgErr || !msg) return json(404, { error: "Message not found" });
  if (msg.channel !== "whatsapp") {
    return json(400, { error: "Message channel is not whatsapp" });
  }

  // Resolve destination + institution + authorization scope
  let toRaw = "";
  let institution = "";
  let contactAuthStatus: string | null = null;
  let contactAuthScope: string[] = [];
  if (msg.contact_id) {
    const { data: c } = await admin
      .from("contacts")
      .select("phone, authorization_status, authorization_scope, patient_id")
      .eq("id", msg.contact_id)
      .maybeSingle();
    toRaw = c?.phone ?? "";
    contactAuthStatus = (c as any)?.authorization_status ?? null;
    contactAuthScope = ((c as any)?.authorization_scope as string[] | null) ?? [];
    const { data: p } = await admin
      .from("patients")
      .select("institution")
      .eq("id", msg.patient_id)
      .maybeSingle();
    institution = (p as any)?.institution ?? "";
  } else {
    const { data: p } = await admin
      .from("patients")
      .select("phone, institution")
      .eq("id", msg.patient_id)
      .maybeSingle();
    toRaw = p?.phone ?? "";
    institution = (p as any)?.institution ?? "";
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

  // Upsert WhatsApp identity (E.164) for this recipient
  let identityId: string | null = null;
  let optInStatus: string = "pending";
  if (institution) {
    const idPayload: Record<string, unknown> = {
      institution,
      phone_e164: to,
      recipient_type: msg.contact_id ? "contact" : "patient",
    };
    if (msg.contact_id) idPayload.contact_id = msg.contact_id;
    else idPayload.patient_id = msg.patient_id;
    const { data: existing } = await admin
      .from("whatsapp_identities")
      .select("id, opt_in_status")
      .eq("institution", institution)
      .eq("phone_e164", to)
      .maybeSingle();
    if (existing) {
      identityId = (existing as any).id;
      optInStatus = (existing as any).opt_in_status ?? "pending";
    } else {
      const { data: inserted } = await admin
        .from("whatsapp_identities")
        .insert(idPayload as any)
        .select("id, opt_in_status")
        .maybeSingle();
      identityId = (inserted as any)?.id ?? null;
      optInStatus = (inserted as any)?.opt_in_status ?? "pending";
    }
  }

  // Determine if we will send a Meta template (allowed to open conversation)
  let willSendTemplate = false;
  let tplRow: any = null;
  if (!WHATSAPP_TEST_MODE && (msg as any).template_id) {
    const { data: tpl } = await admin
      .from("message_templates")
      .select("template_kind, meta_template_name, meta_language, meta_status, meta_parameter_order")
      .eq("id", (msg as any).template_id)
      .maybeSingle();
    tplRow = tpl;
    if (tpl && tpl.template_kind === "meta") {
      if (tpl.meta_status !== "approved") {
        await admin.from("messages").update({
          status: "failed", failed_at: new Date().toISOString(),
          last_error: "Template não aprovado pela Meta",
        }).eq("id", msg.id);
        return json(200, { ok: false, error_code: "TEMPLATE_NOT_APPROVED", error: "Este template não está aprovado pela Meta." });
      }
      if (!tpl.meta_template_name) {
        await admin.from("messages").update({
          status: "failed", failed_at: new Date().toISOString(),
          last_error: "Template sem nome configurado",
        }).eq("id", msg.id);
        return json(200, { ok: false, error_code: "TEMPLATE_NAME_MISSING", error: "Template sem nome configurado." });
      }
      willSendTemplate = true;
    }
  }

  // Opt-in / opt-out gate (applies to both modes)
  if (optInStatus === "opted_out" || optInStatus === "revoked") {
    await admin.from("messages").update({
      status: "failed", failed_at: new Date().toISOString(),
      last_error: "Destinatário sem consentimento ativo (opt-out)",
    }).eq("id", msg.id);
    return json(200, { ok: false, error_code: "WHATSAPP_OPT_OUT_ACTIVE", error: "Destinatário desativou o consentimento para WhatsApp." });
  }

  // Service-window enforcement for non-template messages
  if (!willSendTemplate && !WHATSAPP_TEST_MODE) {
    let windowOpen = false;
    if (identityId) {
      const { data: conv } = await admin
        .from("whatsapp_conversations")
        .select("service_window_expires_at")
        .eq("identity_id", identityId)
        .maybeSingle();
      const exp = (conv as any)?.service_window_expires_at as string | null | undefined;
      windowOpen = !!(exp && new Date(exp).getTime() > Date.now());
    }
    if (!windowOpen) {
      await admin.from("messages").update({
        status: "failed", failed_at: new Date().toISOString(),
        last_error: "Janela de atendimento de 24h encerrada",
      }).eq("id", msg.id);
      return json(200, {
        ok: false,
        error_code: "SERVICE_WINDOW_CLOSED",
        error: "A janela de atendimento de 24 horas está encerrada. Selecione um Template Meta aprovado.",
      });
    }
  }

  // Contact authorization (only for messages addressed to a contact)
  if (msg.contact_id && contactAuthStatus && contactAuthStatus === "revoked") {
    await admin.from("messages").update({
      status: "failed", failed_at: new Date().toISOString(),
      last_error: "Contato sem autorização ativa",
    }).eq("id", msg.id);
    return json(200, { ok: false, error_code: "PURPOSE_NOT_AUTHORIZED", error: "Este contato não está autorizado a receber mensagens." });
  }

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
  let sendKind: "text" | "template" = "text";
  let usedTemplateName: string | null = null;
  let usedTemplateLanguage: string | null = null;

  // Test mode: always send the configured test template (e.g. hello_world)
  if (WHATSAPP_TEST_MODE) {
    sendKind = "template";
    usedTemplateName = WHATSAPP_TEST_TEMPLATE_NAME;
    usedTemplateLanguage = WHATSAPP_TEST_TEMPLATE_LANGUAGE;
    metaPayload = {
      messaging_product: "whatsapp",
      to,
      type: "template",
      template: {
        name: WHATSAPP_TEST_TEMPLATE_NAME,
        language: { code: WHATSAPP_TEST_TEMPLATE_LANGUAGE },
      },
    };
  }

  if (willSendTemplate && tplRow) {
    const vars = ((msg as any).template_variables ?? {}) as Record<string, string>;
    const order = Array.isArray(tplRow.meta_parameter_order)
      ? (tplRow.meta_parameter_order as string[])
      : [];
    // Detect placeholders that should never reach the Meta API
    const placeholderRe = /\{[a-zA-Z0-9_]+\}/;
    let params: { type: "text"; text: string }[] = [];
    if (order.length > 0) {
      const missing: string[] = [];
      for (const k of order) {
        const v = vars[k];
        if (v == null || String(v).trim() === "" || placeholderRe.test(String(v))) {
          missing.push(k);
          continue;
        }
        params.push({ type: "text", text: String(v) });
      }
      if (missing.length > 0) {
        await admin.from("messages").update({
          status: "failed", failed_at: new Date().toISOString(),
          last_error: `Variáveis ausentes/ inválidas: ${missing.join(", ")}`,
        }).eq("id", msg.id);
        return json(200, {
          ok: false,
          error_code: "TEMPLATE_PARAMETER_MISSING",
          error: `Preencha as variáveis obrigatórias do template: ${missing.join(", ")}.`,
        });
      }
    } else {
      // Fallback to legacy behavior when ordering is not configured.
      params = Object.values(vars).map((v) => ({ type: "text", text: String(v ?? "") }));
    }
    sendKind = "template";
    usedTemplateName = tplRow.meta_template_name;
    usedTemplateLanguage = tplRow.meta_language || "pt_BR";
    metaPayload = {
      messaging_product: "whatsapp",
      to,
      type: "template",
      template: {
        name: tplRow.meta_template_name,
        language: { code: tplRow.meta_language || "pt_BR" },
        ...(params.length
          ? { components: [{ type: "body", parameters: params }] }
          : {}),
      },
    };
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
      send_kind: sendKind,
      template_name: usedTemplateName,
      template_language: usedTemplateLanguage,
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

  // Update conversation last_outbound_at
  if (identityId && institution) {
    await admin.from("whatsapp_conversations").upsert({
      identity_id: identityId,
      institution,
      patient_id: msg.patient_id ?? null,
      contact_id: msg.contact_id ?? null,
      last_outbound_at: nowIso,
      last_message_at: nowIso,
      status: "active",
    } as any, { onConflict: "identity_id" });
  }

  return json(200, {
    ok: true,
    external_message_id: externalId ?? null,
    test_mode: WHATSAPP_TEST_MODE,
    phone_original: toRaw,
    phone_normalized: to,
    send_kind: sendKind,
    template_name: usedTemplateName,
    template_language: usedTemplateLanguage,
  });
});