import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

function json(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type SubmitBody = {
  token: string;
  full_name: string;
  birth_date?: string | null;
  relation?: string | null;
  consent: boolean;
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
  const url = new URL(req.url);

  if (req.method === "GET") {
    const token = url.searchParams.get("token") ?? "";
    if (!UUID_RE.test(token)) return json(400, { error: "Token inválido" });
    const { data: invite } = await admin
      .from("onboarding_invites")
      .select("id, token, institution, intended_role, patient_id, status, expires_at")
      .eq("token", token)
      .maybeSingle();
    if (!invite) return json(404, { error: "Convite não encontrado" });
    if ((invite as any).status !== "pending") {
      return json(410, { error: "Convite indisponível", status: (invite as any).status });
    }
    if (new Date((invite as any).expires_at).getTime() < Date.now()) {
      await admin.from("onboarding_invites").update({ status: "expired" }).eq("id", (invite as any).id);
      return json(410, { error: "Convite expirado" });
    }
    let patientName: string | null = null;
    if ((invite as any).patient_id) {
      const { data: p } = await admin
        .from("patients").select("full_name").eq("id", (invite as any).patient_id).maybeSingle();
      patientName = (p as any)?.full_name ?? null;
    }
    return json(200, {
      ok: true,
      intended_role: (invite as any).intended_role,
      patient_id: (invite as any).patient_id,
      patient_name: patientName,
      institution: (invite as any).institution,
    });
  }

  if (req.method !== "POST") return json(405, { error: "Method not allowed" });

  let body: SubmitBody;
  try { body = await req.json(); } catch { return json(400, { error: "Invalid JSON" }); }
  if (!body?.token || !UUID_RE.test(body.token)) return json(400, { error: "Token inválido" });
  if (!body?.full_name || body.full_name.trim().length < 2) {
    return json(400, { error: "Informe seu nome completo" });
  }
  if (!body?.consent) return json(400, { error: "É necessário concordar com o uso dos dados" });

  const { data: invite } = await admin
    .from("onboarding_invites")
    .select("id, token, institution, intended_role, patient_id, status, expires_at, wa_id, phone")
    .eq("token", body.token)
    .maybeSingle();
  if (!invite) return json(404, { error: "Convite não encontrado" });
  if ((invite as any).status !== "pending") return json(410, { error: "Convite indisponível" });
  if (new Date((invite as any).expires_at).getTime() < Date.now()) {
    await admin.from("onboarding_invites").update({ status: "expired" }).eq("id", (invite as any).id);
    return json(410, { error: "Convite expirado" });
  }

  const institution = (invite as any).institution as string;
  const phone = (invite as any).phone as string | null;
  const waId = (invite as any).wa_id as string | null;
  const fullName = body.full_name.trim();
  const nowIso = new Date().toISOString();

  let patientId: string | null = (invite as any).patient_id ?? null;
  let contactId: string | null = null;

  if ((invite as any).intended_role === "paciente") {
    const { data: p, error: pErr } = await admin.from("patients").insert({
      full_name: fullName,
      phone: phone ?? "",
      institution,
      stage: "ativo",
      channel_pref: "whatsapp",
      email: "",
      cpf: "",
      address: "",
      city: "",
      state: "",
      status: "ativo",
      birth_date: body.birth_date ?? null,
    } as any).select("id").maybeSingle();
    if (pErr || !p) return json(500, { error: "Falha ao criar paciente" });
    patientId = (p as any).id;
  } else {
    if (!patientId) return json(400, { error: "Paciente vinculado não informado" });
    const { data: c, error: cErr } = await admin.from("contacts").insert({
      patient_id: patientId,
      full_name: fullName,
      relation: body.relation ?? (invite as any).intended_role,
      phone: phone ?? "",
      channel_pref: "whatsapp",
      receives_reminders: true,
      email: "",
      cpf: "",
      address: "",
      city: "",
      state: "",
      status: "ativo",
      authorization_status: "active",
      authorization_scope: ["lembretes", "educativo"],
      authorized_at: nowIso,
    } as any).select("id").maybeSingle();
    if (cErr || !c) return json(500, { error: "Falha ao criar contato" });
    contactId = (c as any).id;
  }

  // Link the whatsapp identity (if it exists) to the new patient/contact.
  if (phone) {
    const recipientType =
      (invite as any).intended_role === "paciente" ? "patient" : "contact";
    const identityPatch: Record<string, unknown> = {
      patient_id: recipientType === "patient" ? patientId : null,
      contact_id: recipientType === "contact" ? contactId : null,
      recipient_type: recipientType,
      opt_in_status: "opted_in",
      opt_in_at: nowIso,
      opt_in_source: "public_onboarding",
      display_name: fullName,
      is_active: true,
    };
    let q = admin.from("whatsapp_identities").update(identityPatch).eq("institution", institution);
    if (waId) q = q.eq("wa_id", waId);
    else q = q.eq("phone_e164", phone);
    await q;
  }

  await admin.from("onboarding_invites").update({
    status: "completed",
    completed_at: nowIso,
    completed_payload: {
      patient_id: patientId,
      contact_id: contactId,
      full_name: fullName,
      relation: body.relation ?? null,
      birth_date: body.birth_date ?? null,
    },
  } as any).eq("id", (invite as any).id);

  return json(200, { ok: true });
});