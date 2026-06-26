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
    .select("id, patient_id, contact_id, channel, body, status, template_id, template_variables, send_attempts, media_asset_id, media_filename")
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
      .select("template_kind, meta_category, meta_template_name, meta_language, meta_status, meta_parameter_order, meta_header_type, meta_header_text, meta_buttons, meta_authentication_config")
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
    // ---- AUTHENTICATION / OTP (Phase 5) ----------------------------------
    // Authentication templates have a strict shape:
    //   body parameter: the OTP code (single {{1}})
    //   button: OTP button (copy_code or one_tap), parameter = the same code
    // We generate the code server-side, persist a hash for later verification
    // by the webhook, then inject the code into the payload components.
    const isAuth =
      (tplRow as any).meta_category === "AUTHENTICATION" ||
      !!(tplRow as any).meta_authentication_config;
    if (isAuth) {
      const cfg = ((tplRow as any).meta_authentication_config ?? {}) as {
        otp_type?: "copy_code" | "one_tap";
        code_length?: number;
        ttl_minutes?: number;
      };
      const codeLen = Math.min(Math.max(Number(cfg.code_length ?? 6), 4), 8);
      const ttlMin = Math.min(Math.max(Number(cfg.ttl_minutes ?? 10), 1), 60);
      const otpType: "copy_code" | "one_tap" = cfg.otp_type === "one_tap" ? "one_tap" : "copy_code";
      // Numeric code with cryptographic randomness, zero-padded to code_length.
      const rnd = new Uint32Array(1);
      crypto.getRandomValues(rnd);
      const max = 10 ** codeLen;
      const code = String(rnd[0] % max).padStart(codeLen, "0");
      const codeHashBuf = await crypto.subtle.digest(
        "SHA-256",
        new TextEncoder().encode(`${institution}:${code}`),
      );
      const codeHash = Array.from(new Uint8Array(codeHashBuf))
        .map((b) => b.toString(16).padStart(2, "0")).join("");
      const expiresAt = new Date(Date.now() + ttlMin * 60 * 1000).toISOString();
      await admin.from("whatsapp_otp_codes").insert({
        institution,
        identity_id: identityId,
        patient_id: msg.patient_id ?? null,
        contact_id: msg.contact_id ?? null,
        message_id: msg.id,
        template_id: (msg as any).template_id,
        purpose: "authentication",
        code_hash: codeHash,
        code_length: codeLen,
        otp_type: otpType,
        status: "pending",
        expires_at: expiresAt,
      } as any);

      const components: Record<string, unknown>[] = [
        { type: "body", parameters: [{ type: "text", text: code }] },
        {
          type: "button",
          sub_type: otpType === "one_tap" ? "url" : "copy_code",
          index: "0",
          parameters: [{ type: "text", text: code }],
        },
      ];

      metaPayload = {
        messaging_product: "whatsapp",
        to,
        type: "template",
        template: {
          name: tplRow.meta_template_name,
          language: { code: tplRow.meta_language || "pt_BR" },
          components,
        },
      };
      sendKind = "template";
      usedTemplateName = tplRow.meta_template_name;
      usedTemplateLanguage = tplRow.meta_language || "pt_BR";
      // Skip the generic template build path below.
    } else {
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

    // Build optional header component when template declares a header type.
    const headerType: string | null = (tplRow as any).meta_header_type ?? null;
    let headerComponent: Record<string, unknown> | null = null;
    if (headerType === "text" && (tplRow as any).meta_header_text) {
      // header text variables (when present) are passed via template_variables.__header
      const headerText = ((msg as any).template_variables?.__header_text as string | undefined) ?? null;
      if (headerText) {
        headerComponent = {
          type: "header",
          parameters: [{ type: "text", text: headerText }],
        };
      }
    } else if (
      headerType === "image" || headerType === "video" || headerType === "document"
    ) {
      const assetId = (msg as any).media_asset_id as string | null;
      if (assetId) {
        const { data: asset } = await admin
          .from("whatsapp_media_assets")
          .select("meta_media_id, status, filename, mime_type")
          .eq("id", assetId)
          .maybeSingle();
        const mediaId = (asset as any)?.meta_media_id as string | null;
        if (!mediaId || (asset as any)?.status !== "uploaded") {
          await admin.from("messages").update({
            status: "failed", failed_at: new Date().toISOString(),
            last_error: "Mídia do cabeçalho não está disponível na Meta",
          }).eq("id", msg.id);
          return json(200, {
            ok: false,
            error_code: "MEDIA_NOT_UPLOADED",
            error: "A mídia do cabeçalho ainda não foi enviada para a Meta.",
          });
        }
        const mediaObj: Record<string, unknown> = { id: mediaId };
        if (headerType === "document") {
          const filename = (msg as any).media_filename || (asset as any)?.filename;
          if (filename) mediaObj.filename = filename;
        }
        headerComponent = {
          type: "header",
          parameters: [{ type: headerType, [headerType]: mediaObj }],
        };
      }
    }

    const components: Record<string, unknown>[] = [];
    if (headerComponent) components.push(headerComponent);
    if (params.length) components.push({ type: "body", parameters: params });

    // ---- Buttons (Phase 4) -----------------------------------------------
    // Definitions stored on the template; runtime values come from
    // template_variables.__buttons as Array<{ index, sub_type, payload?, url_param?, copy_code? }>.
    type BtnDef =
      | { type: "QUICK_REPLY"; text?: string }
      | { type: "URL"; text?: string; url: string }
      | { type: "PHONE_NUMBER"; text?: string; phone_number: string }
      | { type: "COPY_CODE"; text?: string };
    type BtnInput = {
      index: number;
      sub_type: "quick_reply" | "url" | "copy_code";
      payload?: string;
      url_param?: string;
      copy_code?: string;
    };
    const btnDefsRaw = (tplRow as any).meta_buttons;
    const btnDefs: BtnDef[] = Array.isArray(btnDefsRaw) ? (btnDefsRaw as BtnDef[]) : [];
    const btnInputsRaw = ((msg as any).template_variables as Record<string, unknown> | null)?.__buttons;
    const btnInputs: BtnInput[] = Array.isArray(btnInputsRaw) ? (btnInputsRaw as BtnInput[]) : [];

    if (btnInputs.length > 0) {
      // URL allowlist via env. Empty or "*" disables hostname restriction
      // (HTTPS scheme is still enforced for URL buttons).
      const allowEnv = (Deno.env.get("WHATSAPP_URL_ALLOWLIST") ?? "").trim();
      const allowAll = allowEnv === "" || allowEnv === "*";
      const allowList = allowAll
        ? []
        : allowEnv.split(",").map((s) => s.trim().toLowerCase()).filter(Boolean);

      const failMessage = async (code: string, errorMsg: string) => {
        await admin.from("messages").update({
          status: "failed",
          failed_at: new Date().toISOString(),
          last_error: errorMsg,
        }).eq("id", msg.id);
        return json(200, { ok: false, error_code: code, error: errorMsg });
      };

      for (const inp of btnInputs) {
        if (typeof inp?.index !== "number" || inp.index < 0 || inp.index >= btnDefs.length) {
          return await failMessage(
            "BUTTON_INDEX_OUT_OF_RANGE",
            `Botão de índice ${inp?.index} não existe no template.`,
          );
        }
        const def = btnDefs[inp.index];
        if (def.type === "QUICK_REPLY") {
          if (inp.sub_type !== "quick_reply" || !inp.payload || inp.payload.length === 0) {
            return await failMessage(
              "TEMPLATE_PARAMETER_MISSING",
              `Payload do botão "${def.text ?? inp.index}" ausente.`,
            );
          }
          if (inp.payload.length > 256) {
            return await failMessage(
              "TEMPLATE_PARAMETER_MISSING",
              `Payload do botão "${def.text ?? inp.index}" excede 256 caracteres.`,
            );
          }
        } else if (def.type === "URL") {
          if (inp.sub_type !== "url" || !inp.url_param) {
            return await failMessage(
              "TEMPLATE_PARAMETER_MISSING",
              `Parâmetro de URL do botão "${def.text ?? inp.index}" ausente.`,
            );
          }
          let parsed: URL | null = null;
          try {
            parsed = new URL((def.url ?? "").replace("{{1}}", inp.url_param));
          } catch {
            parsed = null;
          }
          if (!parsed) {
            return await failMessage(
              "URL_DOMAIN_NOT_ALLOWED",
              `URL inválida no botão "${def.text ?? inp.index}".`,
            );
          }
          if (parsed.protocol !== "https:") {
            return await failMessage(
              "URL_DOMAIN_NOT_ALLOWED",
              `URLs de botão precisam usar HTTPS (recebido: ${parsed.protocol}).`,
            );
          }
          if (!allowAll) {
            const host = parsed.hostname.toLowerCase();
            const allowed = allowList.some((d) => host === d || host.endsWith("." + d));
            if (!allowed) {
              return await failMessage(
                "URL_DOMAIN_NOT_ALLOWED",
                `Domínio "${host}" não está na allowlist configurada (WHATSAPP_URL_ALLOWLIST).`,
              );
            }
          }
        } else if (def.type === "COPY_CODE") {
          if (inp.sub_type !== "copy_code" || !inp.copy_code) {
            return await failMessage(
              "TEMPLATE_PARAMETER_MISSING",
              `Código do botão "Copiar" ausente.`,
            );
          }
          if (inp.copy_code.length > 15) {
            return await failMessage(
              "TEMPLATE_PARAMETER_MISSING",
              `Código do botão "Copiar" excede 15 caracteres.`,
            );
          }
        } else if (def.type === "PHONE_NUMBER") {
          // Static button — runtime params are not supported by Meta.
          // We accept the entry silently and emit no component.
          continue;
        }
      }

      for (const inp of btnInputs) {
        const def = btnDefs[inp.index];
        if (def.type === "QUICK_REPLY") {
          components.push({
            type: "button",
            sub_type: "quick_reply",
            index: String(inp.index),
            parameters: [{ type: "payload", payload: inp.payload }],
          });
        } else if (def.type === "URL") {
          components.push({
            type: "button",
            sub_type: "url",
            index: String(inp.index),
            parameters: [{ type: "text", text: inp.url_param }],
          });
        } else if (def.type === "COPY_CODE") {
          components.push({
            type: "button",
            sub_type: "copy_code",
            index: String(inp.index),
            parameters: [{ type: "coupon_code", coupon_code: inp.copy_code }],
          });
        }
        // PHONE_NUMBER: no runtime component
      }
    }

    metaPayload = {
      messaging_product: "whatsapp",
      to,
      type: "template",
      template: {
        name: tplRow.meta_template_name,
        language: { code: tplRow.meta_language || "pt_BR" },
        ...(components.length ? { components } : {}),
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