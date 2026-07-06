import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

const url = Deno.env.get("SUPABASE_URL") ?? "";
const anon = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
const service = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

const respond = (status: number, body: unknown, correlationId?: string) => new Response(
  JSON.stringify(body),
  { status, headers: { ...corsHeaders, "Content-Type": "application/json", ...(correlationId ? { "x-correlation-id": correlationId } : {}) } },
);

type Check = { id: string; label: string; state: string; detail?: string };

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return respond(405, { error: "Method not allowed" });

  const correlationId = req.headers.get("x-correlation-id")?.trim() || crypto.randomUUID();
  const authorization = req.headers.get("Authorization");
  if (!authorization?.startsWith("Bearer ")) return respond(401, { error: "Unauthorized", correlation_id: correlationId }, correlationId);

  const authClient = createClient(url, anon, { global: { headers: { Authorization: authorization } } });
  const { data: claims, error: authError } = await authClient.auth.getClaims(authorization.slice(7));
  const userId = claims?.claims?.sub as string | undefined;
  if (authError || !userId) return respond(401, { error: "Unauthorized", correlation_id: correlationId }, correlationId);

  const admin = createClient(url, service);
  const { data: role } = await admin.from("user_roles").select("role").eq("user_id", userId).eq("role", "superadmin").maybeSingle();
  if (!role) return respond(403, { error: "Forbidden", correlation_id: correlationId }, correlationId);

  let institution = "";
  try {
    const body = await req.json();
    institution = typeof body?.institution === "string" ? body.institution.trim() : "";
  } catch { institution = ""; }
  if (!institution) return respond(400, { error: "INSTITUTION_REQUIRED", correlation_id: correlationId }, correlationId);

  const checks: Check[] = [
    { id: "token", label: "Token de acesso da Meta", state: Deno.env.get("WHATSAPP_TOKEN") ? "configurado" : "nao_configurado" },
    { id: "app_secret", label: "App Secret", state: Deno.env.get("WHATSAPP_APP_SECRET") ? "configurado" : "nao_configurado" },
    { id: "verify_token", label: "Verify Token", state: Deno.env.get("WHATSAPP_VERIFY_TOKEN") ? "configurado" : "nao_configurado" },
    { id: "waba", label: "WhatsApp Business Account", state: Deno.env.get("WHATSAPP_WABA_ID") ? "configurado" : "nao_configurado" },
    { id: "phone", label: "Phone Number ID", state: Deno.env.get("WHATSAPP_PHONE_NUMBER_ID") ? "configurado" : "nao_configurado" },
  ];

  const { data: channels, error: channelError } = await admin.from("whatsapp_channels")
    .select("id,status,phone_number_id,last_webhook_at,last_synced_at")
    .eq("institution", institution);

  if (channelError) {
    checks.push({ id: "channel_binding", label: "Canal vinculado à instituição", state: "desconhecido" });
  } else {
    const active = (channels ?? []).filter((item) => item.status === "active" || item.status === "connected");
    const channel = active[0];
    checks.push({
      id: "channel_binding",
      label: "Canal vinculado à instituição",
      state: active.length === 1 && channel?.phone_number_id ? "configurado" : active.length > 1 ? "conflito" : "nao_configurado",
      detail: active.length > 1 ? "Mais de um canal ativo encontrado." : undefined,
    });
    checks.push({
      id: "webhook_recent",
      label: "Webhook recebendo eventos",
      state: channel?.last_webhook_at ? "configurado" : channel ? "aguardando_evento" : "nao_configurado",
      detail: channel?.last_webhook_at ? `Último evento: ${new Date(channel.last_webhook_at).toISOString()}` : undefined,
    });
  }

  await admin.from("whatsapp_admin_audit_log").insert({
    user_id: userId,
    actor_role: "superadmin",
    institution,
    entity: "whatsapp_integration",
    action: "diagnostics.run",
    result: "success",
    correlation_id: correlationId,
    after_state: { configured: checks.filter((item) => item.state === "configurado").length, total: checks.length },
  });

  return respond(200, { ok: true, checks, correlation_id: correlationId }, correlationId);
});
