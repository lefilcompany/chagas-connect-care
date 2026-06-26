import { createClient } from "npm:@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const VERIFY_TOKEN = Deno.env.get("WHATSAPP_VERIFY_TOKEN") ?? "";
const APP_SECRET = Deno.env.get("WHATSAPP_APP_SECRET") ?? "";

function hexToBytes(hex: string): Uint8Array {
  const clean = hex.replace(/^sha256=/, "").trim();
  if (clean.length % 2 !== 0) return new Uint8Array();
  const out = new Uint8Array(clean.length / 2);
  for (let i = 0; i < out.length; i++) {
    out[i] = parseInt(clean.substr(i * 2, 2), 16);
  }
  return out;
}

function timingSafeEqual(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length || a.length === 0) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a[i] ^ b[i];
  return diff === 0;
}

async function verifyMetaSignature(rawBody: string, signatureHeader: string): Promise<boolean> {
  if (!APP_SECRET || !signatureHeader) return false;
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(APP_SECRET),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = new Uint8Array(
    await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(rawBody)),
  );
  const received = hexToBytes(signatureHeader);
  return timingSafeEqual(sig, received);
}

function normalizeBR(p: string): string {
  const digits = (p ?? "").replace(/\D/g, "");
  if (!digits) return "";
  return digits.startsWith("55") ? digits : "55" + digits;
}

/** Resolve a WhatsApp identity by exact wa_id then exact E.164 phone. */
async function findIdentity(
  admin: ReturnType<typeof createClient>,
  wa_id: string,
  phone_e164: string,
) {
  if (wa_id) {
    const { data } = await admin
      .from("whatsapp_identities")
      .select("id, institution, patient_id, contact_id")
      .eq("wa_id", wa_id)
      .maybeSingle();
    if (data) return data as any;
  }
  if (phone_e164) {
    const { data } = await admin
      .from("whatsapp_identities")
      .select("id, institution, patient_id, contact_id")
      .eq("phone_e164", phone_e164)
      .maybeSingle();
    if (data) return data as any;
  }
  return null;
}

const OPT_OUT_KEYWORDS = ["PARAR", "SAIR", "CANCELAR", "NAO QUERO", "NÃO QUERO", "REMOVER", "STOP"];
function isOptOutText(t: string): boolean {
  const norm = (t ?? "").trim().toUpperCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  return OPT_OUT_KEYWORDS.some((k) => norm === k.normalize("NFD").replace(/[\u0300-\u036f]/g, ""));
}

/** Extract a likely OTP code from inbound text: contiguous digits 4–8 long. */
function extractOtpCandidate(text: string): string | null {
  if (!text) return null;
  const digitsOnly = text.replace(/\D/g, "");
  if (digitsOnly.length >= 4 && digitsOnly.length <= 8) return digitsOnly;
  const m = text.match(/\b(\d{4,8})\b/);
  return m ? m[1] : null;
}

async function hashOtp(institution: string, code: string): Promise<string> {
  const buf = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(`${institution}:${code}`),
  );
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

/**
 * Tries to verify an inbound text as an OTP code for the given identity.
 * Updates the matching pending whatsapp_otp_codes row to "verified" / "failed".
 */
async function tryVerifyOtp(
  admin: ReturnType<typeof createClient>,
  identity: { id: string; institution: string },
  text: string,
): Promise<void> {
  const candidate = extractOtpCandidate(text);
  if (!candidate) return;
  const nowIso = new Date().toISOString();

  const { data: pendings } = await admin
    .from("whatsapp_otp_codes")
    .select("id, code_hash, code_length, attempts, max_attempts, expires_at, status")
    .eq("identity_id", identity.id)
    .eq("status", "pending")
    .order("issued_at", { ascending: false })
    .limit(5);
  const rows = Array.isArray(pendings) ? (pendings as any[]) : [];
  for (const row of rows) {
    if (row.expires_at && new Date(row.expires_at).getTime() < Date.now()) {
      await admin.from("whatsapp_otp_codes")
        .update({ status: "expired", updated_at: nowIso })
        .eq("id", row.id);
      continue;
    }
    if ((row.attempts ?? 0) >= (row.max_attempts ?? 5)) {
      await admin.from("whatsapp_otp_codes")
        .update({ status: "failed", updated_at: nowIso })
        .eq("id", row.id);
      continue;
    }
    const trimmed = candidate.slice(-Number(row.code_length ?? 6));
    const hash = await hashOtp(identity.institution, trimmed);
    if (hash === row.code_hash) {
      await admin.from("whatsapp_otp_codes").update({
        status: "verified",
        verified_at: nowIso,
        attempts: (row.attempts ?? 0) + 1,
        updated_at: nowIso,
      }).eq("id", row.id);
      return;
    }
    await admin.from("whatsapp_otp_codes").update({
      attempts: (row.attempts ?? 0) + 1,
      updated_at: nowIso,
    }).eq("id", row.id);
  }
}

// queued < sent < delivered < read; failed never overwrites a later success.
const STATUS_RANK: Record<string, number> = {
  queued: 0, sent: 1, delivered: 2, read: 3,
};
function shouldApplyStatus(current: string | null | undefined, next: string): boolean {
  if (next === "failed") {
    // Only apply failed if we haven't already reached sent or beyond.
    const cur = STATUS_RANK[current ?? "queued"] ?? 0;
    return cur <= 0;
  }
  const cur = STATUS_RANK[current ?? "queued"] ?? -1;
  const nxt = STATUS_RANK[next] ?? -1;
  return nxt > cur;
}

Deno.serve(async (req) => {
  const url = new URL(req.url);

  // Meta handshake
  if (req.method === "GET") {
    const mode = url.searchParams.get("hub.mode");
    const token = url.searchParams.get("hub.verify_token");
    const challenge = url.searchParams.get("hub.challenge");
    if (mode === "subscribe" && token && token === VERIFY_TOKEN) {
      return new Response(challenge ?? "", { status: 200 });
    }
    return new Response("Forbidden", { status: 403 });
  }

  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  // Read raw body for signature verification
  const rawBody = await req.text();

  // Fail closed: WHATSAPP_APP_SECRET must be configured to verify Meta payloads
  if (!APP_SECRET) {
    console.error("whatsapp-webhook: WHATSAPP_APP_SECRET not configured; rejecting POST");
    return new Response("Server misconfigured", { status: 503 });
  }

  const sigHeader = req.headers.get("x-hub-signature-256") ?? "";
  const valid = await verifyMetaSignature(rawBody, sigHeader);
  if (!valid) {
    return new Response("Forbidden", { status: 403 });
  }

  let payload: any;
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return new Response("ok", { status: 200 });
  }

  const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  try {
    const entries: any[] = Array.isArray(payload?.entry) ? payload.entry : [];
    for (const entry of entries) {
      const changes: any[] = Array.isArray(entry?.changes) ? entry.changes : [];
      for (const change of changes) {
        const value = change?.value ?? {};

        // Status updates
        const statuses: any[] = Array.isArray(value?.statuses) ? value.statuses : [];
        for (const st of statuses) {
          const extId: string | undefined = st?.id;
          const status: string | undefined = st?.status;
          if (!extId || !status) continue;

          // Look up current state to enforce monotonic status priority.
          const { data: cur } = await admin
            .from("messages")
            .select("id, status")
            .eq("external_message_id", extId)
            .maybeSingle();
          if (!cur) continue;
          if (!shouldApplyStatus((cur as any).status, status)) continue;

          const patch: Record<string, unknown> = { status };
          if (status === "delivered") patch.delivered_at = new Date().toISOString();
          else if (status === "read") patch.read_at = new Date().toISOString();
          else if (status === "failed") {
            patch.failed_at = new Date().toISOString();
            patch.last_error =
              st?.errors?.[0]?.title ?? st?.errors?.[0]?.message ?? "Falha na entrega";
          }
          await admin.from("messages").update(patch).eq("id", (cur as any).id);
        }

        // Inbound messages
        const messages: any[] = Array.isArray(value?.messages) ? value.messages : [];
        for (const m of messages) {
          const from: string = m?.from ?? "";
          const extId: string | undefined = m?.id;
          if (!from) continue;

          const rawType: string = m?.type ?? "text";
          const text: string =
            m?.text?.body ??
            m?.button?.text ??
            m?.interactive?.button_reply?.title ??
            m?.interactive?.list_reply?.title ??
            "";
          const interactionId: string | null =
            m?.button?.payload ??
            m?.interactive?.button_reply?.id ??
            m?.interactive?.list_reply?.id ??
            null;
          const interactionTitle: string | null =
            m?.interactive?.button_reply?.title ??
            m?.interactive?.list_reply?.title ??
            m?.button?.text ??
            null;
          const interactionType: string | null = m?.interactive?.type ?? (m?.button ? "button" : null);

          const phone_e164 = normalizeBR(from);
          const identity = await findIdentity(admin, from, phone_e164);

          if (!identity) {
            // Triage: register the unmatched event (no clinical content).
            await admin.from("whatsapp_unmatched_events").insert({
              external_message_id: extId ?? null,
              wa_id: from,
              phone_e164,
              event_type: "inbound",
            } as any);
            continue;
          }

          // Idempotency: skip if we already stored this inbound id.
          if (extId) {
            const { data: existing } = await admin
              .from("messages")
              .select("id")
              .eq("external_message_id", extId)
              .eq("direction", "inbound")
              .maybeSingle();
            if (existing) continue;
          }

          // Resolve patient_id: use the identity's patient_id or, for contact
          // identities, fall back to the contact's owning patient.
          let patientId: string | null = identity.patient_id ?? null;
          if (!patientId && identity.contact_id) {
            const { data: c } = await admin
              .from("contacts").select("patient_id").eq("id", identity.contact_id).maybeSingle();
            patientId = (c as any)?.patient_id ?? null;
          }
          if (!patientId) continue;

          const nowIso = new Date().toISOString();

          await admin.from("messages").insert({
            patient_id: patientId,
            contact_id: identity.contact_id ?? null,
            channel: "whatsapp",
            direction: "inbound",
            body: text || "[mensagem sem texto]",
            status: "received",
            external_message_id: extId ?? null,
            provider: "meta_whatsapp_cloud",
            sent_at: nowIso,
            interaction_type: interactionType,
            interaction_id: interactionId,
            interaction_title: interactionTitle,
            raw_message_type: rawType,
          } as any);

          // Open/renew service window (24h).
          const expiry = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
          await admin.from("whatsapp_conversations").upsert({
            identity_id: identity.id,
            institution: identity.institution,
            patient_id: patientId,
            contact_id: identity.contact_id ?? null,
            last_inbound_at: nowIso,
            last_message_at: nowIso,
            service_window_expires_at: expiry,
            status: "active",
          } as any, { onConflict: "identity_id" });

          // OTP verification attempt (Phase 5). Runs on every inbound text.
          if (text) {
            try {
              await tryVerifyOtp(admin, identity, text);
            } catch (e) {
              console.error("otp verification error:", e);
            }
          }

          // Opt-out keywords → revoke and cancel queued outbound to this identity.
          if (text && isOptOutText(text)) {
            await admin
              .from("whatsapp_identities")
              .update({ opt_in_status: "opted_out", opt_out_at: nowIso, is_active: false })
              .eq("id", identity.id);
            // Cancel queued messages addressed to this patient/contact.
            const q = admin.from("messages").update({
              status: "failed",
              failed_at: nowIso,
              last_error: "Cancelado por opt-out do destinatário",
            }).eq("status", "queued");
            if (identity.contact_id) await q.eq("contact_id", identity.contact_id);
            else await q.eq("patient_id", patientId).is("contact_id", null);
          }
        }
      }
    }
  } catch (e) {
    console.error("whatsapp-webhook error:", e);
  }

  return new Response("ok", { status: 200 });
});