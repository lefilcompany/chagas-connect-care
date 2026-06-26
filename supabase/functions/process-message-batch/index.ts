import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

const CONCURRENCY = 3;

function json(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
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

  let body: { batch_id?: string };
  try {
    body = await req.json();
  } catch {
    return json(400, { error: "Invalid JSON" });
  }
  if (!body.batch_id || typeof body.batch_id !== "string") {
    return json(400, { error: "batch_id is required" });
  }

  const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  // Authorization: verify the caller can access this batch via RLS
  const { data: authorized, error: authzErr } = await authClient
    .from("message_batches")
    .select("id")
    .eq("id", body.batch_id)
    .maybeSingle();
  if (authzErr || !authorized) {
    return json(403, { error: "Forbidden" });
  }

  const { data: batch, error: batchErr } = await admin
    .from("message_batches")
    .select("id, status")
    .eq("id", body.batch_id)
    .maybeSingle();
  if (batchErr || !batch) return json(404, { error: "Batch not found" });

  // Mark processing
  await admin
    .from("message_batches")
    .update({ status: "processing", started_at: new Date().toISOString() })
    .eq("id", batch.id);

  const { data: queued, error: qErr } = await admin
    .from("messages")
    .select("id")
    .eq("batch_id", batch.id)
    .eq("status", "queued");

  if (qErr) {
    await admin
      .from("message_batches")
      .update({
        status: "failed",
        finished_at: new Date().toISOString(),
        last_error: qErr.message,
      })
      .eq("id", batch.id);
    return json(500, { ok: false, error: qErr.message });
  }

  const ids = (queued ?? []).map((m) => m.id as string);
  const sendUrl = `${SUPABASE_URL}/functions/v1/send-whatsapp`;

  let ok = 0;
  let failed = 0;
  let skipped = 0;
  const errorCodeCounts: Record<string, number> = {};
  let lastError: string | null = null;
  let idx = 0;

  async function worker() {
    while (idx < ids.length) {
      const myIdx = idx++;
      const id = ids[myIdx];
      try {
        const res = await fetch(sendUrl, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            // Forward the caller's JWT so send-whatsapp's auth check passes
            Authorization: authHeader as string,
          },
          body: JSON.stringify({ message_id: id }),
        });
        const data = await res.json().catch(() => ({}));
        if (res.ok && data?.ok !== false) {
          ok++;
        } else {
          failed++;
          const code = (data as any)?.error_code;
          if (code) errorCodeCounts[code] = (errorCodeCounts[code] ?? 0) + 1;
          if (
            code === "SERVICE_WINDOW_CLOSED" ||
            code === "WHATSAPP_OPT_OUT_ACTIVE" ||
            code === "PURPOSE_NOT_AUTHORIZED" ||
            code === "TEMPLATE_NOT_APPROVED" ||
            code === "TEMPLATE_NAME_MISSING"
          ) {
            skipped++;
          }
          lastError = data?.error ?? `HTTP ${res.status}`;
        }
      } catch (e) {
        failed++;
        lastError = e instanceof Error ? e.message : String(e);
      }
    }
  }

  const workers = Array.from(
    { length: Math.min(CONCURRENCY, Math.max(ids.length, 1)) },
    () => worker(),
  );
  await Promise.all(workers);

  const finalStatus = failed === 0 ? "sent" : ok === 0 ? "failed" : "partial_failed";
  await admin
    .from("message_batches")
    .update({
      status: finalStatus,
      finished_at: new Date().toISOString(),
      last_error: failed > 0 ? lastError : null,
    })
    .eq("id", batch.id);

  return json(200, {
    ok: failed === 0,
    ok_count: ok,
    failed_count: failed,
    skipped_count: skipped,
    error_codes: errorCodeCounts,
  });
});
