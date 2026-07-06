import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

const url = Deno.env.get("SUPABASE_URL") ?? "";
const anon = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
const service = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const wabaId = Deno.env.get("WHATSAPP_WABA_ID") ?? "";
const phoneNumberId = Deno.env.get("WHATSAPP_PHONE_NUMBER_ID") ?? "";

const respond = (status: number, body: unknown, correlationId?: string) => new Response(
  JSON.stringify(body),
  { status, headers: { ...corsHeaders, "Content-Type": "application/json", ...(correlationId ? { "x-correlation-id": correlationId } : {}) } },
);

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

  const fail = async (status: number, error: string) => {
    await admin.from("whatsapp_admin_audit_log").insert({
      user_id: userId, actor_role: "superadmin", institution: institution || null,
      entity: "whatsapp_channels", action: "channel.repair", result: "failure",
      error_code: error, correlation_id: correlationId,
    });
    return respond(status, { ok: false, error, correlation_id: correlationId }, correlationId);
  };

  if (!institution) return await fail(400, "INSTITUTION_REQUIRED");
  if (!wabaId || !phoneNumberId) return await fail(503, "WHATSAPP_SERVER_CONFIGURATION_INCOMPLETE");

  const { data: conflict } = await admin.from("whatsapp_channels")
    .select("id,institution").eq("phone_number_id", phoneNumberId).maybeSingle();
  if (conflict && conflict.institution !== institution) return await fail(409, "PHONE_ALREADY_BOUND_TO_ANOTHER_INSTITUTION");

  const { data: rows, error: loadError } = await admin.from("whatsapp_channels")
    .select("id,status").eq("institution", institution);
  if (loadError) return await fail(500, "CHANNEL_LOAD_FAILED");

  const target = (rows ?? []).find((row) => row.status === "active" || row.status === "connected") ?? rows?.[0] ?? null;
  const now = new Date().toISOString();
  const values = { waba_id: wabaId, phone_number_id: phoneNumberId, status: "active", last_synced_at: now, updated_at: now };

  let channelId: string | null = null;
  if (target) {
    const { data, error } = await admin.from("whatsapp_channels").update(values).eq("id", target.id).select("id").maybeSingle();
    if (error) return await fail(500, "CHANNEL_UPDATE_FAILED");
    channelId = data?.id ?? target.id;
  } else {
    const { data, error } = await admin.from("whatsapp_channels").insert({ institution, mode: "shared", ...values }).select("id").maybeSingle();
    if (error) return await fail(500, "CHANNEL_CREATE_FAILED");
    channelId = data?.id ?? null;
  }

  await admin.from("whatsapp_admin_audit_log").insert({
    user_id: userId, actor_role: "superadmin", institution, entity: "whatsapp_channels",
    entity_id: channelId, action: "channel.repair", result: "success",
    correlation_id: correlationId, after_state: { status: "active", has_waba: true, has_phone_number: true },
  });

  return respond(200, { ok: true, correlation_id: correlationId, channel: { id: channelId, institution, configured: true, status: "active" } }, correlationId);
});
