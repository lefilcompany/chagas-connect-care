import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

function json(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

type Body = {
  identity_id: string;
  intended_role: "paciente" | "familiar" | "cuidador";
  patient_id?: string | null;
  public_base_url: string; // e.g. https://app.example.com
  template_id?: string | null; // utility template to use when window is closed
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json(405, { error: "Method not allowed" });

  const authHeader = req.headers.get("Authorization") ?? "";
  if (!authHeader.startsWith("Bearer ")) return json(401, { error: "Unauthorized" });

  const authClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data: claims, error: authErr } = await authClient.auth.getClaims(
    authHeader.replace("Bearer ", ""),
  );
  if (authErr || !claims?.claims) return json(401, { error: "Unauthorized" });
  const userId = claims.claims.sub as string;

  let payload: Body;
  try { payload = await req.json(); } catch { return json(400, { error: "Invalid JSON" }); }

  if (!payload?.identity_id || !payload?.intended_role || !payload?.public_base_url) {
    return json(400, { error: "identity_id, intended_role e public_base_url são obrigatórios" });
  }
  if (!["paciente", "familiar", "cuidador"].includes(payload.intended_role)) {
    return json(400, { error: "intended_role inválido" });
  }

  const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  // Identity must belong to caller's institution (uses RLS-scoped client).
  const { data: identity, error: identityErr } = await authClient
    .from("whatsapp_identities")
    .select("id, institution, phone_e164, wa_id")
    .eq("id", payload.identity_id)
    .maybeSingle();
  if (identityErr || !identity) return json(403, { error: "Identidade não encontrada ou sem acesso" });

  const institution = (identity as any).institution as string;

  // Window status
  const { data: conv } = await admin
    .from("whatsapp_conversations")
    .select("service_window_expires_at")
    .eq("identity_id", payload.identity_id)
    .maybeSingle();
  const windowOpen =
    !!(conv as any)?.service_window_expires_at &&
    new Date((conv as any).service_window_expires_at).getTime() > Date.now();

  // Create invite
  const { data: invite, error: invErr } = await admin
    .from("onboarding_invites")
    .insert({
      institution,
      wa_id: (identity as any).wa_id,
      phone: (identity as any).phone_e164,
      intended_role: payload.intended_role,
      patient_id: payload.patient_id ?? null,
      created_by: userId,
    } as any)
    .select("id, token")
    .maybeSingle();
  if (invErr || !invite) return json(500, { error: "Falha ao criar convite" });

  const base = payload.public_base_url.replace(/\/+$/, "");
  const url = `${base}/cadastro/${(invite as any).token}`;

  // Insert outbound message and dispatch via send-whatsapp
  const labelByRole: Record<string, string> = {
    paciente: "Vamos finalizar seu cadastro",
    familiar: "Cadastro de familiar",
    cuidador: "Cadastro de cuidador",
  };
  const bodyText = `Olá! Para receber acompanhamento da nossa equipe, finalize seu cadastro pelo link seguro: ${url}`;

  let messageId: string | null = null;
  let mode: "interactive_cta_url" | "template_utility" = "interactive_cta_url";

  if (windowOpen) {
    const templateVariables = {
      __interactive: {
        type: "cta_url",
        body: bodyText,
        display_text: "Fazer cadastro",
        url,
      },
    };
    const { data: inserted } = await admin.from("messages").insert({
      patient_id: null,
      identity_id: payload.identity_id,
      institution,
      channel: "whatsapp",
      body: bodyText,
      direction: "outbound",
      status: "queued",
      queued_at: new Date().toISOString(),
      message_type: "onboarding_invite",
      created_by: userId,
      template_variables: templateVariables,
    } as any).select("id").maybeSingle();
    messageId = (inserted as any)?.id ?? null;
    mode = "interactive_cta_url";
  } else {
    // Window closed → require a pre-approved UTILITY template provided by the caller.
    if (!payload.template_id) {
      await admin.from("onboarding_invites").update({ status: "revoked" }).eq("id", (invite as any).id);
      return json(400, {
        error_code: "TEMPLATE_REQUIRED_OUTSIDE_WINDOW",
        error:
          "Janela de 24h fechada. Informe um Template Meta de UTILIDADE aprovado para enviar o convite.",
      });
    }
    const { data: tpl } = await admin
      .from("message_templates")
      .select("id, meta_category, meta_status, name")
      .eq("id", payload.template_id)
      .maybeSingle();
    if (!tpl || (tpl as any).meta_category !== "UTILITY" || (tpl as any).meta_status !== "approved") {
      await admin.from("onboarding_invites").update({ status: "revoked" }).eq("id", (invite as any).id);
      return json(400, {
        error_code: "TEMPLATE_NOT_UTILITY_APPROVED",
        error: "O template informado precisa ser de categoria UTILITY e estar aprovado pela Meta.",
      });
    }
    const { data: inserted } = await admin.from("messages").insert({
      patient_id: null,
      identity_id: payload.identity_id,
      institution,
      channel: "whatsapp",
      body: bodyText,
      direction: "outbound",
      status: "queued",
      queued_at: new Date().toISOString(),
      message_type: "onboarding_invite",
      template_id: (tpl as any).id,
      template_name: (tpl as any).name,
      template_variables: {
        // expose token to the template URL button; ordering already enforced by send-whatsapp
        __buttons: { "0": { type: "url", url_param: url } },
      },
      created_by: userId,
    } as any).select("id").maybeSingle();
    messageId = (inserted as any)?.id ?? null;
    mode = "template_utility";
  }

  if (!messageId) return json(500, { error: "Falha ao registrar mensagem" });

  // Dispatch through send-whatsapp using caller JWT so RLS allows the lookup.
  try {
    const resp = await fetch(`${SUPABASE_URL}/functions/v1/send-whatsapp`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: authHeader,
        apikey: SUPABASE_ANON_KEY,
      },
      body: JSON.stringify({ message_id: messageId }),
    });
    const sendResult = await resp.json().catch(() => ({}));
    return json(200, {
      ok: sendResult?.ok !== false,
      mode,
      invite_id: (invite as any).id,
      token: (invite as any).token,
      url,
      message_id: messageId,
      send_result: sendResult,
      label: labelByRole[payload.intended_role],
    });
  } catch (e) {
    return json(200, {
      ok: false,
      mode,
      invite_id: (invite as any).id,
      token: (invite as any).token,
      url,
      message_id: messageId,
      error: e instanceof Error ? e.message : "Falha ao enviar",
    });
  }
});