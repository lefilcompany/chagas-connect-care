import { supabase } from "@/integrations/supabase/client";
import { friendlyWhatsAppError, type QueueAndSendResult } from "@/lib/whatsapp";

/**
 * Phase 6 — Free-form interactive messages (button / list / cta_url).
 * Only deliverable while the 24h service window is OPEN. Validation is
 * mirrored server-side in `send-whatsapp`; this module catches issues
 * early so the UI can show inline form errors before queueing.
 */

export type InteractiveHeader =
  | { type: "text"; text: string }
  | { type: "image" | "video" | "document"; media_asset_id: string };

export type InteractiveButton = { id: string; title: string };
export type InteractiveListRow = { id: string; title: string; description?: string };
export type InteractiveListSection = { title?: string; rows: InteractiveListRow[] };

export type InteractiveButtonMessage = {
  type: "button";
  header?: InteractiveHeader;
  body: string;
  footer?: string;
  buttons: InteractiveButton[];
};

export type InteractiveListMessage = {
  type: "list";
  header?: InteractiveHeader;
  body: string;
  footer?: string;
  button_text: string;
  sections: InteractiveListSection[];
};

export type InteractiveCtaUrlMessage = {
  type: "cta_url";
  header?: InteractiveHeader;
  body: string;
  footer?: string;
  display_text: string;
  url: string;
};

export type InteractiveMessage =
  | InteractiveButtonMessage
  | InteractiveListMessage
  | InteractiveCtaUrlMessage;

/** Returns the first validation error, or null when the payload is valid. */
export function validateInteractive(msg: InteractiveMessage): string | null {
  const body = (msg.body ?? "").trim();
  if (!body) return "O corpo da mensagem é obrigatório.";
  if (body.length > 1024) return "O corpo da mensagem excede 1024 caracteres.";
  if (msg.footer && msg.footer.length > 60) return "Rodapé excede 60 caracteres.";
  if (msg.header?.type === "text") {
    const t = msg.header.text.trim();
    if (!t || t.length > 60) return "Cabeçalho de texto deve ter 1–60 caracteres.";
  }

  if (msg.type === "button") {
    if (!msg.buttons.length || msg.buttons.length > 3) {
      return "Inclua entre 1 e 3 botões.";
    }
    const ids = new Set<string>();
    for (const b of msg.buttons) {
      const id = (b.id ?? "").trim();
      const title = (b.title ?? "").trim();
      if (!id || id.length > 256) return "Cada botão precisa de um id (até 256 caracteres).";
      if (!title || title.length > 20) return "Cada botão precisa de um título de 1–20 caracteres.";
      if (ids.has(id)) return `Botão com id duplicado: "${id}".`;
      ids.add(id);
    }
    return null;
  }

  if (msg.type === "list") {
    const bt = (msg.button_text ?? "").trim();
    if (!bt || bt.length > 20) return "Texto do botão da lista deve ter 1–20 caracteres.";
    if (!msg.sections.length || msg.sections.length > 10) return "Lista exige 1–10 seções.";
    let total = 0;
    const ids = new Set<string>();
    for (const s of msg.sections) {
      if (s.title && s.title.length > 24) return "Título de seção excede 24 caracteres.";
      if (!s.rows.length) return "Cada seção precisa de pelo menos uma linha.";
      for (const r of s.rows) {
        const id = (r.id ?? "").trim();
        const title = (r.title ?? "").trim();
        if (!id || id.length > 200) return "Cada linha precisa de id (até 200 caracteres).";
        if (!title || title.length > 24) return "Título da linha deve ter 1–24 caracteres.";
        if (r.description && r.description.length > 72) return "Descrição da linha excede 72 caracteres.";
        if (ids.has(id)) return `Linha com id duplicado: "${id}".`;
        ids.add(id);
        total++;
      }
    }
    if (total > 10) return "A lista aceita no máximo 10 linhas no total.";
    return null;
  }

  if (msg.type === "cta_url") {
    const d = (msg.display_text ?? "").trim();
    if (!d || d.length > 20) return "Texto do botão CTA deve ter 1–20 caracteres.";
    try {
      const u = new URL(msg.url);
      if (u.protocol !== "https:") return "URL do CTA precisa usar HTTPS.";
    } catch {
      return "URL do CTA é inválida.";
    }
    return null;
  }

  return "Tipo de mensagem interativa não suportado.";
}

/** Serializes the interactive message in the shape expected by send-whatsapp. */
export function toEdgePayload(msg: InteractiveMessage): Record<string, unknown> {
  const base: Record<string, unknown> = {
    type: msg.type,
    body: msg.body,
    ...(msg.footer ? { footer: msg.footer } : {}),
    ...(msg.header ? { header: msg.header } : {}),
  };
  if (msg.type === "button") return { ...base, buttons: msg.buttons };
  if (msg.type === "list") return { ...base, button_text: msg.button_text, sections: msg.sections };
  return { ...base, display_text: msg.display_text, url: msg.url };
}

/**
 * Queues a free-form interactive message and dispatches it through
 * `send-whatsapp`. The 24h service window is enforced server-side; closed
 * windows surface as `SERVICE_WINDOW_CLOSED` via `friendlyWhatsAppError`.
 */
export async function queueAndSendInteractive(input: {
  patient_id: string;
  contact_id?: string | null;
  interactive: InteractiveMessage;
  fallback_body?: string;
  message_type?: string;
  created_by?: string | null;
  media_asset_id?: string | null;
  media_filename?: string | null;
}): Promise<QueueAndSendResult> {
  const validation = validateInteractive(input.interactive);
  if (validation) return { message_id: null, ok: false, error: validation };

  const nowIso = new Date().toISOString();
  const { data: inserted, error: insertError } = await supabase
    .from("messages")
    .insert({
      patient_id: input.patient_id,
      contact_id: input.contact_id ?? null,
      channel: "whatsapp",
      body: input.fallback_body ?? input.interactive.body,
      direction: "outbound",
      status: "queued",
      queued_at: nowIso,
      message_type: input.message_type ?? "interactive",
      created_by: input.created_by ?? null,
      template_variables: { __interactive: toEdgePayload(input.interactive) } as any,
      media_asset_id: input.media_asset_id ?? null,
      media_filename: input.media_filename ?? null,
    } as any)
    .select("id")
    .maybeSingle();

  if (insertError || !inserted?.id) {
    return { message_id: null, ok: false, error: insertError?.message ?? "Falha ao registrar mensagem" };
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
    const payload = data as { ok?: boolean; external_message_id?: string | null };
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