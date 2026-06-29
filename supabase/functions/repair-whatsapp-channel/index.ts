import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const WHATSAPP_TOKEN = Deno.env.get("WHATSAPP_TOKEN") ?? "";
const WHATSAPP_WABA_ID = Deno.env.get("WHATSAPP_WABA_ID") ?? "";
const WHATSAPP_PHONE_NUMBER_ID = Deno.env.get("WHATSAPP_PHONE_NUMBER_ID") ?? "";
const RAW_VER = Deno.env.get("WHATSAPP_GRAPH_VERSION") ?? "v25.0";
const GRAPH = /^v\d+\.\d+$/.test(RAW_VER) ? RAW_VER : "v25.0";

function json(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function maskPhone(p: string | null | undefined): string | null {
  if (!p) return null;
  const s = String(p);
  if (s.length < 4) return s;
  return s.slice(0, Math.max(0, s.length - 4)).replace(/\d/g, "*") + s.slice(-4);
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

  const { data: prof } = await admin
    .from("profiles").select("institution").eq("id", userId).maybeSingle();
  const institution: string = (prof as any)?.institution ?? "";
  if (!institution) return json(400, { ok: false, error: "Instituição do usuário não definida." });

  if (!WHATSAPP_PHONE_NUMBER_ID || !WHATSAPP_WABA_ID || !WHATSAPP_TOKEN) {
    return json(503, { ok: false, error: "Credenciais do WhatsApp não estão completamente configuradas no servidor." });
  }

  // Validate WABA + phone number reachability before persisting anything.
  let displayPhone: string | null = null;
  let displayName: string | null = null;
  let quality: string | null = null;
  let phoneIdFromMeta: string = WHATSAPP_PHONE_NUMBER_ID;
  try {
    const wabaRes = await fetch(
      `https://graph.facebook.com/${GRAPH}/${WHATSAPP_WABA_ID}?fields=id,name`,
      { headers: { Authorization: `Bearer ${WHATSAPP_TOKEN}` } },
    );
    if (!wabaRes.ok) {
      return json(502, { ok: false, error: "Falha ao validar a WABA na Meta." });
    }
    const phoneRes = await fetch(
      `https://graph.facebook.com/${GRAPH}/${WHATSAPP_PHONE_NUMBER_ID}?fields=id,display_phone_number,verified_name,quality_rating`,
      { headers: { Authorization: `Bearer ${WHATSAPP_TOKEN}` } },
    );
    if (!phoneRes.ok) {
      return json(502, { ok: false, error: "Falha ao validar o número de WhatsApp na Meta." });
    }
    const phoneBody = await phoneRes.json().catch(() => ({}));
    phoneIdFromMeta = String(phoneBody?.id ?? WHATSAPP_PHONE_NUMBER_ID);
    displayPhone = phoneBody?.display_phone_number ?? null;
    displayName = phoneBody?.verified_name ?? null;
    quality = phoneBody?.quality_rating ?? null;
  } catch {
    return json(502, { ok: false, error: "Erro ao consultar a Meta." });
  }

  // Refuse to clobber another institution's binding.
  const { data: existingByPhone } = await admin
    .from("whatsapp_channels")
    .select("id, institution")
    .eq("phone_number_id", phoneIdFromMeta)
    .maybeSingle();
  if (existingByPhone && (existingByPhone as any).institution !== institution) {
    return json(409, {
      ok: false,
      error: "Outro canal já está vinculado a este número de WhatsApp.",
      conflict: true,
    });
  }

  // Pick the channel row to update for this institution (active first).
  const { data: instRows } = await admin
    .from("whatsapp_channels")
    .select("id, status")
    .eq("institution", institution);
  const list = (instRows ?? []) as Array<any>;
  const target =
    list.find((r) => r.status === "active") ??
    list[0] ??
    null;

  const nowIso = new Date().toISOString();
  const payload: Record<string, unknown> = {
    waba_id: WHATSAPP_WABA_ID,
    phone_number_id: phoneIdFromMeta,
    display_phone_number: displayPhone,
    display_name: displayName,
    quality_rating: quality,
    status: "active",
    last_synced_at: nowIso,
    updated_at: nowIso,
  };

  let channelId: string | null = null;
  if (target) {
    const { data: upd, error } = await admin
      .from("whatsapp_channels")
      .update(payload)
      .eq("id", target.id)
      .select("id")
      .maybeSingle();
    if (error) return json(500, { ok: false, error: "Falha ao atualizar o canal." });
    channelId = (upd as any)?.id ?? target.id;
  } else {
    const { data: ins, error } = await admin
      .from("whatsapp_channels")
      .insert({ institution, mode: "shared", ...payload })
      .select("id")
      .maybeSingle();
    if (error) return json(500, { ok: false, error: "Falha ao criar o canal." });
    channelId = (ins as any)?.id ?? null;
  }

  return json(200, {
    ok: true,
    channel: {
      configured: true,
      institution,
      display_phone_number: maskPhone(displayPhone),
      status: "active",
      id: channelId,
    },
  });
});