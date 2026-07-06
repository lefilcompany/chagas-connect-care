import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const WHATSAPP_TOKEN = Deno.env.get("WHATSAPP_TOKEN") ?? "";
const WHATSAPP_WABA_ID = Deno.env.get("WHATSAPP_WABA_ID") ?? "";
const WHATSAPP_PHONE_NUMBER_ID = Deno.env.get("WHATSAPP_PHONE_NUMBER_ID") ?? "";
const WHATSAPP_APP_SECRET = Deno.env.get("WHATSAPP_APP_SECRET") ?? "";
const WHATSAPP_VERIFY_TOKEN = Deno.env.get("WHATSAPP_VERIFY_TOKEN") ?? "";
const META_APP_ID = Deno.env.get("META_APP_ID") ?? "";
const RAW_VER = Deno.env.get("WHATSAPP_GRAPH_VERSION") ?? "v25.0";
const GRAPH = /^v\d+\.\d+$/.test(RAW_VER) ? RAW_VER : "v25.0";

type State =
  | "configurado"
  | "aguardando_evento"
  | "sem_eventos_recentes"
  | "nao_configurado"
  | "conflito"
  | "desconhecido";

function json(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST" && req.method !== "GET") {
    return json(405, { error: "Method not allowed" });
  }

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
    .from("user_roles").select("role").eq("user_id", userId).eq("role", "superadmin").maybeSingle();
  if (!roleRow) return json(403, { error: "Forbidden" });

  // Optional institution override from body; defaults to the caller's profile institution.
  let bodyJson: any = {};
  try { bodyJson = req.method === "POST" ? await req.json() : {}; } catch { bodyJson = {}; }
  const institutionParam = typeof bodyJson?.institution === "string" ? bodyJson.institution.trim() : "";
  const { data: prof } = await admin
    .from("profiles").select("institution").eq("id", userId).maybeSingle();
  const institution = institutionParam || (prof as any)?.institution || "";

  const checks: Array<{ id: string; label: string; state: State; detail?: string }> = [];
  const flag = (id: string, label: string, present: boolean) =>
    checks.push({ id, label, state: present ? "configurado" : "nao_configurado" });

  flag("whatsapp_token", "Token de acesso da Meta", !!WHATSAPP_TOKEN);
  flag("whatsapp_app_secret", "App Secret (validação de webhook)", !!WHATSAPP_APP_SECRET);
  flag("whatsapp_verify_token", "Verify Token", !!WHATSAPP_VERIFY_TOKEN);
  flag("whatsapp_phone_number_id", "Phone Number ID padrão", !!WHATSAPP_PHONE_NUMBER_ID);
  flag("whatsapp_waba_id", "WhatsApp Business Account ID", !!WHATSAPP_WABA_ID);

  // WABA reachability (no values leaked, only success/failure).
  let wabaState: State = "desconhecido";
  let wabaDetail: string | undefined;
  if (WHATSAPP_TOKEN && WHATSAPP_WABA_ID) {
    try {
      const res = await fetch(
        `https://graph.facebook.com/${GRAPH}/${WHATSAPP_WABA_ID}?fields=id,name`,
        { headers: { Authorization: `Bearer ${WHATSAPP_TOKEN}` } },
      );
      wabaState = res.ok ? "configurado" : "nao_configurado";
      if (!res.ok) wabaDetail = `Status ${res.status}`;
    } catch {
      wabaState = "desconhecido";
    }
  }
  checks.push({ id: "waba_reachable", label: "Acesso à conta WABA", state: wabaState, detail: wabaDetail });

  // Phone number reachability.
  let phoneState: State = "desconhecido";
  if (WHATSAPP_TOKEN && WHATSAPP_PHONE_NUMBER_ID) {
    try {
      const res = await fetch(
        `https://graph.facebook.com/${GRAPH}/${WHATSAPP_PHONE_NUMBER_ID}?fields=id,verified_name,quality_rating`,
        { headers: { Authorization: `Bearer ${WHATSAPP_TOKEN}` } },
      );
      phoneState = res.ok ? "configurado" : "nao_configurado";
    } catch {
      phoneState = "desconhecido";
    }
  }
  checks.push({ id: "phone_reachable", label: "Acesso ao número de WhatsApp", state: phoneState });

  // Channel binding for this admin's institution.
  let channelState: State = "desconhecido";
  let channelDetail: string | undefined;
  let webhookState: State = "desconhecido";
  let webhookDetail: string | undefined;
  try {
    if (!institution) {
      channelState = "desconhecido";
      channelDetail = "Instituição do usuário não definida.";
    } else {
      const { data: rows } = await admin
        .from("whatsapp_channels")
        .select("id, phone_number_id, status, last_webhook_at")
        .eq("institution", institution);
      const list = (rows ?? []) as Array<any>;
      const active = list.filter((r) => r.status === "active");
      if (active.length === 0) {
        channelState = "nao_configurado";
        channelDetail = "Canal do WhatsApp ainda não foi vinculado à instituição.";
        webhookState = "nao_configurado";
        webhookDetail = "Canal não configurado.";
      } else if (active.length > 1) {
        channelState = "conflito";
        channelDetail = "Mais de um canal ativo vinculado à instituição.";
        webhookState = "conflito";
      } else {
        const ch = active[0];
        if (!ch.phone_number_id) {
          channelState = "nao_configurado";
          channelDetail = "Canal sem Phone Number ID configurado.";
          webhookState = "nao_configurado";
        } else if (
          WHATSAPP_PHONE_NUMBER_ID && ch.phone_number_id !== WHATSAPP_PHONE_NUMBER_ID
        ) {
          channelState = "conflito";
          channelDetail = "Canal vinculado a um número diferente do ambiente atual.";
          webhookState = "conflito";
        } else {
          channelState = "configurado";
          const ts = ch.last_webhook_at;
          if (!ts) {
            webhookState = "aguardando_evento";
            webhookDetail = "Canal configurado. Envie uma mensagem real ao número para confirmar.";
          } else {
            const ageMs = Date.now() - new Date(ts).getTime();
            const days = ageMs / 86400000;
            if (days < 7) {
              webhookState = "configurado";
              webhookDetail = `Último evento há ${humanizeAge(ageMs)}.`;
            } else {
              webhookState = "sem_eventos_recentes";
              webhookDetail = "Canal configurado, mas sem eventos recentes.";
            }
          }
        }
      }
    }
  } catch {
    channelState = "desconhecido";
    webhookState = "desconhecido";
  }
  checks.push({ id: "channel_binding", label: "Canal vinculado à instituição", state: channelState, detail: channelDetail });
  checks.push({ id: "webhook_recent", label: "Webhook recebendo eventos", state: webhookState, detail: webhookDetail });

  // Subscribed app on the WABA.
  let subState: State = "desconhecido";
  let subDetail: string | undefined;
  if (WHATSAPP_TOKEN && WHATSAPP_WABA_ID) {
    try {
      const res = await fetch(
        `https://graph.facebook.com/${GRAPH}/${WHATSAPP_WABA_ID}/subscribed_apps`,
        { headers: { Authorization: `Bearer ${WHATSAPP_TOKEN}` } },
      );
      if (res.ok) {
        const body = await res.json().catch(() => ({}));
        const apps = Array.isArray(body?.data) ? body.data : [];
        if (apps.length === 0) {
          subState = "nao_configurado";
          subDetail = "Nenhum aplicativo inscrito na WABA.";
        } else if (META_APP_ID) {
          const match = apps.some((a: any) => String(a?.whatsapp_business_api_data?.id ?? a?.id ?? "") === META_APP_ID);
          subState = match ? "configurado" : "conflito";
          if (!match) subDetail = "Aplicativo inscrito não corresponde ao META_APP_ID.";
        } else {
          subState = "configurado";
        }
      } else {
        subState = "desconhecido";
      }
    } catch {
      subState = "desconhecido";
    }
  }
  checks.push({ id: "subscribed_app", label: "Aplicativo inscrito na WABA", state: subState, detail: subDetail });

  return json(200, { ok: true, checks });
});

function humanizeAge(ms: number): string {
  const m = Math.floor(ms / 60000);
  if (m < 1) return "menos de 1 minuto";
  if (m < 60) return `${m} minuto${m > 1 ? "s" : ""}`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h} hora${h > 1 ? "s" : ""}`;
  const d = Math.floor(h / 24);
  return `${d} dia${d > 1 ? "s" : ""}`;
}