import { createClient } from "npm:@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const VERIFY_TOKEN = Deno.env.get("WHATSAPP_VERIFY_TOKEN") ?? "";

function normalizeBR(p: string): string {
  const digits = (p ?? "").replace(/\D/g, "");
  if (!digits) return "";
  return digits.startsWith("55") ? digits : "55" + digits;
}

async function findPatientByPhone(admin: ReturnType<typeof createClient>, phone: string) {
  const normalized = normalizeBR(phone);
  if (!normalized) return null;
  const candidates = new Set<string>([normalized]);
  if (normalized.startsWith("55")) candidates.add(normalized.slice(2));

  for (const cand of candidates) {
    const { data } = await admin
      .from("patients")
      .select("id")
      .ilike("phone", `%${cand.slice(-8)}%`)
      .limit(1);
    if (data && data.length > 0) return data[0].id as string;
  }
  return null;
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

  let payload: any;
  try {
    payload = await req.json();
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

          const patch: Record<string, unknown> = {};
          if (status === "delivered") {
            patch.status = "delivered";
            patch.delivered_at = new Date().toISOString();
          } else if (status === "read") {
            patch.status = "read";
            patch.read_at = new Date().toISOString();
          } else if (status === "failed") {
            patch.status = "failed";
            patch.failed_at = new Date().toISOString();
            patch.last_error =
              st?.errors?.[0]?.title ?? st?.errors?.[0]?.message ?? "Falha na entrega";
          } else if (status === "sent") {
            patch.status = "sent";
          }
          if (Object.keys(patch).length > 0) {
            await admin.from("messages").update(patch).eq("external_message_id", extId);
          }
        }

        // Inbound messages
        const messages: any[] = Array.isArray(value?.messages) ? value.messages : [];
        for (const m of messages) {
          const from: string = m?.from ?? "";
          const text: string = m?.text?.body ?? m?.button?.text ?? "";
          const extId: string | undefined = m?.id;
          if (!from) continue;

          const patientId = await findPatientByPhone(admin, from);
          if (!patientId) {
            console.log("whatsapp-webhook: inbound from unknown phone", from);
            continue;
          }

          await admin.from("messages").insert({
            patient_id: patientId,
            channel: "whatsapp",
            direction: "inbound",
            body: text || "[mensagem sem texto]",
            status: "received",
            external_message_id: extId ?? null,
            provider: "meta_whatsapp_cloud",
            sent_at: new Date().toISOString(),
          });
        }
      }
    }
  } catch (e) {
    console.error("whatsapp-webhook error:", e);
  }

  return new Response("ok", { status: 200 });
});