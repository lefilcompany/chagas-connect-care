// Journey enroll — inscreve pacientes em uma jornada publicada.
// Body: { journey_id: string, patient_ids: string[] } OU { journey_id, event, patient_id }
import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ANON = Deno.env.get("SUPABASE_ANON_KEY")!;

function j(status: number, body: unknown) {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return j(405, { error: "Method not allowed" });

  const authHeader = req.headers.get("Authorization") ?? "";
  if (!authHeader.startsWith("Bearer ")) return j(401, { error: "Unauthorized" });
  const authClient = createClient(SUPABASE_URL, ANON, { global: { headers: { Authorization: authHeader } } });
  const { data: claims, error: authErr } = await authClient.auth.getClaims(authHeader.replace("Bearer ", ""));
  if (authErr || !claims?.claims) return j(401, { error: "Unauthorized" });

  const body = await req.json().catch(() => ({}));
  const journey_id = String(body?.journey_id ?? "");
  const patient_ids: string[] = Array.isArray(body?.patient_ids)
    ? body.patient_ids.map(String)
    : body?.patient_id
    ? [String(body.patient_id)]
    : [];
  if (!journey_id || patient_ids.length === 0) return j(400, { error: "journey_id e patient_ids são obrigatórios" });

  const admin = createClient(SUPABASE_URL, SERVICE_ROLE);

  // Verifica acesso à jornada via RLS do caller
  const { data: journey, error: jErr } = await authClient
    .from("journeys")
    .select("id, status, institution, version")
    .eq("id", journey_id)
    .maybeSingle();
  if (jErr || !journey) return j(403, { error: "Jornada não encontrada ou sem acesso" });
  if (journey.status !== "ativa") return j(400, { error: "Jornada não está ativa" });

  // Carrega pacientes elegíveis (mesma instituição)
  const { data: patients } = await admin
    .from("patients")
    .select("id, phone, institution")
    .in("id", patient_ids)
    .eq("institution", journey.institution);
  const eligible = (patients ?? []).filter((p) => p.phone);

  // Descobre runs ativos existentes para dedupe
  const { data: existing } = await admin
    .from("journey_runs")
    .select("patient_id")
    .eq("journey_id", journey_id)
    .in("status", ["queued", "running", "waiting"]);
  const already = new Set((existing ?? []).map((r) => r.patient_id));

  const toInsert = eligible
    .filter((p) => !already.has(p.id))
    .map((p) => ({
      journey_id,
      journey_version: journey.version ?? 0,
      institution: journey.institution,
      patient_id: p.id,
      status: "queued",
      context: body?.event ? { trigger_event: body.event } : {},
    }));

  let inserted = 0;
  if (toInsert.length) {
    const { error: insErr, count } = await admin.from("journey_runs").insert(toInsert, { count: "exact" });
    if (insErr) return j(500, { error: insErr.message });
    inserted = count ?? toInsert.length;
  }

  return j(200, {
    ok: true,
    inserted,
    skipped_no_phone: (patients ?? []).length - eligible.length,
    skipped_dedupe: eligible.length - toInsert.length,
    invalid_patient_count: patient_ids.length - (patients ?? []).length,
  });
});