import { supabase } from "@/integrations/supabase/client";
import { renderTemplate } from "@/lib/templates";
import type { Recipient } from "@/lib/segments";

/**
 * Maps the structured error returned by the `send-whatsapp` edge function
 * into a user-friendly message in Portuguese. Always logs the technical
 * details to the console for debugging.
 */
export function friendlyWhatsAppError(payload: any): string {
  // Log full technical payload for devs
  // eslint-disable-next-line no-console
  console.error("[send-whatsapp] error payload:", payload);

  const code = payload?.error_code as string | undefined;
  const meta = payload?.meta_error as
    | { code?: number; error_subcode?: number; message?: string; type?: string }
    | undefined;
  const testMode = !!payload?.test_mode;
  const testHint = testMode
    ? " (modo de teste: confirme que o destinatário está autorizado em Testes de API da Meta)."
    : "";

  if (code === "MISSING_TOKEN") return "Token do WhatsApp não configurado. Avise o administrador.";
  if (code === "MISSING_PHONE_ID") return "Phone Number ID do WhatsApp não configurado.";
  if (code === "INVALID_RECIPIENT") return payload?.error ?? "Número do destinatário inválido.";

  if (code === "META_API_ERROR" && meta) {
    const mc = meta.code;
    const sc = meta.error_subcode;
    if (mc === 131005 || mc === 10 || mc === 200) {
      return `A Meta recusou o envio (acesso negado). Verifique token, Phone Number ID e número de teste autorizado${testHint}`;
    }
    if (mc === 131026) return "Não foi possível entregar: o destinatário não tem WhatsApp ativo.";
    if (mc === 131047)
      return "Janela de 24h expirada. Use um Template Meta aprovado para reiniciar a conversa.";
    if (mc === 131051 || sc === 2018001)
      return `Destinatário não autorizado a receber mensagens${testHint}`;
    if (mc === 132000 || mc === 132001 || mc === 132005)
      return "Erro no template: nome, idioma ou variáveis não conferem com o aprovado pela Meta.";
    if (mc === 100) return "Parâmetros inválidos enviados para a Meta. Revise o template e variáveis.";
    return `Meta recusou o envio: ${meta.message ?? "erro desconhecido"}${testHint}`;
  }

  return payload?.error ?? "Falha no envio";
}

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
        error: data ? friendlyWhatsAppError(data) : error.message,
      };
    }
    const payload = data as { ok?: boolean; error?: string; external_message_id?: string | null };
    if (payload?.ok === false) {
      return { message_id: inserted.id, ok: false, error: friendlyWhatsAppError(payload) };
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
          const msg = payload ? friendlyWhatsAppError(payload) : error?.message ?? "Falha no envio";
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

/**
 * Queues a message derived from a template, applying `{var}` substitutions.
 * Stores `template_id`, `template_name`, and `template_variables` on the row.
 */
export async function queueAndSendFromTemplate(input: {
  template: {
    id: string;
    body: string;
    template_kind: "internal" | "meta";
    meta_template_name?: string | null;
    channel?: "whatsapp" | "sms";
  };
  patient_id: string;
  contact_id?: string | null;
  variables: Record<string, string>;
  created_by?: string | null;
  recipient_name?: string | null;
}): Promise<QueueAndSendResult> {
  const recipientName = (input.recipient_name ?? "").trim();
  const mergedVars: Record<string, string> = { ...input.variables };
  if (recipientName) {
    if (!mergedVars.nome_destinatario) mergedVars.nome_destinatario = recipientName;
    if (!mergedVars.nome_paciente) mergedVars.nome_paciente = recipientName;
    if (!mergedVars.nome_contato) mergedVars.nome_contato = recipientName;
  }
  const body = renderTemplate(input.template.body, mergedVars);
  return queueAndSend({
    patient_id: input.patient_id,
    contact_id: input.contact_id ?? null,
    channel: input.template.channel ?? "whatsapp",
    body,
    created_by: input.created_by,
    message_type: "template",
    template_id: input.template.id,
    template_name:
      input.template.template_kind === "meta" ? input.template.meta_template_name ?? null : null,
    template_variables: mergedVars,
  });
}

export type CreateBatchInput = {
  name: string;
  body: string;
  recipients: Recipient[];
  template?: {
    id: string;
    body: string;
    template_kind: "internal" | "meta";
    meta_template_name?: string | null;
  } | null;
  variables?: Record<string, string>;
  message_type?: string;
  targeting_mode: string;
  audience_types: string[];
  segment_id?: string | null;
  filters?: Record<string, unknown>;
  institution?: string;
  created_by?: string | null;
};

export type CreateBatchResult = {
  batch_id: string | null;
  ok: boolean;
  error?: string;
  ok_count?: number;
  failed_count?: number;
};

/**
 * Creates a `message_batches` row + one `messages` row per recipient (queued),
 * then invokes `process-message-batch` to dispatch with controlled concurrency.
 */
export async function createBatch(input: CreateBatchInput): Promise<CreateBatchResult> {
  if (!input.recipients.length) {
    return { batch_id: null, ok: false, error: "Nenhum destinatário selecionado" };
  }

  const { data: batch, error: batchErr } = await supabase
    .from("message_batches")
    .insert({
      name: input.name,
      body: input.body,
      template_id: input.template?.id ?? null,
      targeting_mode: input.targeting_mode,
      audience_types: input.audience_types,
      segment_id: input.segment_id ?? null,
      filters: input.filters ?? {},
      channel: "whatsapp",
      total_recipients: input.recipients.length,
      status: "queued",
      institution: input.institution ?? "",
      created_by: input.created_by ?? null,
    } as any)
    .select("id")
    .maybeSingle();

  if (batchErr || !batch?.id) {
    return { batch_id: null, ok: false, error: batchErr?.message ?? "Falha ao criar lote" };
  }

  const nowIso = new Date().toISOString();
  const messageType = input.message_type ?? (input.template ? "campaign" : "campaign");
  const templateName =
    input.template?.template_kind === "meta" ? input.template?.meta_template_name ?? null : null;
  const vars = input.variables ?? {};

  const rows = input.recipients.map((r) => {
    const perVars: Record<string, string> = { ...vars };
    const rname = (r.name ?? "").trim();
    if (rname) {
      perVars.nome_destinatario = rname;
      // Backward compat: legacy placeholders use recipient name when unset
      if (!perVars.nome_paciente) perVars.nome_paciente = rname;
      if (!perVars.nome_contato) perVars.nome_contato = rname;
    }
    const sourceBody = input.template ? input.template.body : input.body;
    const body = renderTemplate(sourceBody, perVars);
    return {
      patient_id: r.patient_id,
      contact_id: r.contact_id ?? null,
      channel: "whatsapp",
      direction: "outbound",
      status: "queued",
      queued_at: nowIso,
      body,
      message_type: messageType,
      template_id: input.template?.id ?? null,
      template_name: templateName,
      template_variables: perVars,
      batch_id: batch.id,
      created_by: input.created_by ?? null,
    };
  });

  const { error: insErr } = await supabase.from("messages").insert(rows as any);
  if (insErr) {
    await supabase
      .from("message_batches")
      .update({ status: "failed", last_error: insErr.message, finished_at: new Date().toISOString() })
      .eq("id", batch.id);
    return { batch_id: batch.id, ok: false, error: insErr.message };
  }

  try {
    const { data, error } = await supabase.functions.invoke("process-message-batch", {
      body: { batch_id: batch.id },
    });
    if (error) {
      return { batch_id: batch.id, ok: false, error: error.message };
    }
    const payload = data as { ok?: boolean; ok_count?: number; failed_count?: number; error?: string };
    return {
      batch_id: batch.id,
      ok: payload?.ok !== false,
      ok_count: payload?.ok_count,
      failed_count: payload?.failed_count,
      error: payload?.error,
    };
  } catch (e) {
    return {
      batch_id: batch.id,
      ok: false,
      error: e instanceof Error ? e.message : "Erro ao invocar processamento",
    };
  }
}