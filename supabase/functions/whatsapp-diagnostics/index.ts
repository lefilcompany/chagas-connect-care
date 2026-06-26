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
const RAW_VER = Deno.env.get("WHATSAPP_GRAPH_VERSION") ?? "v25.0";
const GRAPH = /^v\d+\.\d+$/.test(RAW_VER) ? RAW_VER : "v25.0";

type State = "configurado" | "nao_configurado" | "desconhecido";

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
    .from("user_roles").select("role").eq("user_id", userId).eq("role", "admin").maybeSingle();
  if (!roleRow) return json(403, { error: "Forbidden" });

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

  // Recent webhook activity (any channel).
  let webhookState: State = "desconhecido";
  try {
    const { data } = await admin
      .from("whatsapp_channels")
      .select("last_webhook_at")
      .order("last_webhook_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    const ts = (data as any)?.last_webhook_at;
    if (!ts) webhookState = "nao_configurado";
    else {
      const ageMin = (Date.now() - new Date(ts).getTime()) / 60000;
      webhookState = ageMin < 60 * 24 * 7 ? "configurado" : "desconhecido";
    }
  } catch {
    webhookState = "desconhecido";
  }
  checks.push({ id: "webhook_recent", label: "Webhook recebendo eventos", state: webhookState });

  return json(200, { ok: true, checks });
});