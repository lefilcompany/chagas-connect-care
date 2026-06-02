import { supabase } from "@/integrations/supabase/client";
import { renderTemplate } from "@/lib/templates";
import type { Recipient } from "@/lib/segments";

export type QueueAndSendInput = {
  patient_id: string;
  contact_id?: string | null;
  body: string;
  channel?: "whatsapp" | "sms";
  message_type?: string;
  created_by?: string | null;
  template_id?: string | null;
  template_name?: string | null;
  template_variables?: Record<string, string> | null;
  batch_id?: string | null;
};

export type QueueAndSendResult = {
  message_id: string | null;
  ok: boolean;
  error?: string;
  external_message_id?: string | null;
};

/**
 * Inserts a message in `queued` state then invokes the `send-whatsapp` edge
 * function. The edge function flips status to `sent` (or `failed`) and stores
 * the Meta external_message_id. Returns the full outcome for UI toasts.
 */
export async function queueAndSend(input: QueueAndSendInput): Promise<QueueAndSendResult> {
  const channel = input.channel ?? "whatsapp";
  const nowIso = new Date().toISOString();

  const { data: inserted, error: insertError } = await supabase
    .from("messages")
    .insert({
      patient_id: input.patient_id,
      contact_id: input.contact_id ?? null,
      channel,
      body: input.body,
      direction: "outbound",
      status: "queued",
      queued_at: nowIso,
      message_type: input.message_type ?? "manual",
      created_by: input.created_by ?? null,
      template_id: input.template_id ?? null,
      template_name: input.template_name ?? null,
      template_variables: input.template_variables ?? {},
      batch_id: input.batch_id ?? null,
    } as any)
    .select("id")
    .maybeSingle();

  if (insertError || !inserted?.id) {
    return { message_id: null, ok: false, error: insertError?.message ?? "Falha ao registrar mensagem" };
  }

  // SMS not yet integrated — leave as queued for now.
  if (channel !== "whatsapp") {
    return { message_id: inserted.id, ok: true };
  }

  try {
    const { data, error } = await supabase.functions.invoke("send-whatsapp", {
      body: { message_id: inserted.id },
    });
    if (error) {
      return {
        message_id: inserted.id,
        ok: false,
        error: (data as any)?.error ?? error.message,
      };
    }
    const payload = data as { ok?: boolean; error?: string; external_message_id?: string | null };
    if (payload?.ok === false) {
      return { message_id: inserted.id, ok: false, error: payload.error ?? "Falha no envio" };
    }
    return {
      message_id: inserted.id,
      ok: true,
      external_message_id: payload?.external_message_id ?? null,
    };
  } catch (e) {
    return {
      message_id: inserted.id,
      ok: false,
      error: e instanceof Error ? e.message : "Erro ao invocar envio",
    };
  }
}

/**
 * Triggers `send-whatsapp` for a list of already-queued message IDs with a
 * small concurrency pool to avoid hammering the API or the browser.
 */
export async function sendBatch(
  messageIds: string[],
  concurrency = 3,
): Promise<{ ok: number; failed: number; errors: string[] }> {
  let ok = 0;
  let failed = 0;
  const errors: string[] = [];
  let idx = 0;

  async function worker() {
    while (idx < messageIds.length) {
      const myIdx = idx++;
      const id = messageIds[myIdx];
      try {
        const { data, error } = await supabase.functions.invoke("send-whatsapp", {
          body: { message_id: id },
        });
        const payload = data as { ok?: boolean; error?: string } | null;
        if (error || payload?.ok === false) {
          failed++;
          const msg = payload?.error ?? error?.message ?? "Falha no envio";
          if (errors.length < 3) errors.push(msg);
        } else {
          ok++;
        }
      } catch (e) {
        failed++;
        if (errors.length < 3) errors.push(e instanceof Error ? e.message : String(e));
      }
    }
  }

  const workers = Array.from({ length: Math.min(concurrency, messageIds.length) }, () => worker());
  await Promise.all(workers);
  return { ok, failed, errors };
}