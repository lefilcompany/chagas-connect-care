// Pure builder for outbound Meta template messages. Never performs I/O.
// Given a SYNCHRONIZED (`meta_status === "approved"`) template row and the
// runtime inputs, returns the exact JSON body to POST to
// `graph.facebook.com/{GRAPH_VERSION}/{PHONE_NUMBER_ID}/messages`.
//
// Media headers use the REAL Meta media id (`{ id }`), never `header_handle`
// (that is a creation-only artifact). Positional body parameters follow the
// order defined in `meta_body_parameter_order` — the legacy
// `meta_parameter_order` column is intentionally ignored.

export type ApprovedTemplateInput = {
  template: {
    meta_template_name: string | null;
    meta_language: string | null;
    meta_status: string | null;
    meta_has_local_differences?: boolean | null;
    meta_definition: { components?: unknown[] } | null;
    meta_header_type?: string | null;
    meta_body_parameter_order?: unknown;
    institution?: string | null;
  };
  to: string;
  variables: Record<string, string>;
  header?: { format: "image" | "video" | "document"; media_id: string; filename?: string | null };
};

export type ApprovedTemplateResult =
  | { ok: true; payload: Record<string, unknown> }
  | { ok: false; errorCode: string; error: string };

const PLACEHOLDER_RE = /\{[a-zA-Z0-9_]+\}/;
const POSITIONAL_RE = /\{\{\s*\d+\s*\}\}/;

function findBodyText(def: { components?: unknown[] } | null): string {
  const comps = Array.isArray(def?.components) ? (def!.components as any[]) : [];
  const body = comps.find((c) => String(c?.type ?? "").toUpperCase() === "BODY");
  return String(body?.text ?? "");
}

export function buildApprovedTemplateMessage(
  input: ApprovedTemplateInput,
): ApprovedTemplateResult {
  const t = input.template;

  if (t.meta_status !== "approved") {
    return { ok: false, errorCode: "TEMPLATE_NOT_APPROVED", error: "Este template não está aprovado pela Meta." };
  }
  // Note: `meta_has_local_differences` is informational (local editor body/footer
  // may differ from the approved Meta version). Sending always uses
  // `meta_definition` (the approved version), so we don't block on it here.
  if (!t.meta_definition || !Array.isArray((t.meta_definition as any).components)) {
    return { ok: false, errorCode: "TEMPLATE_DEFINITION_MISSING", error: "Definição sincronizada da Meta ausente para este template." };
  }
  if (!t.meta_template_name) {
    return { ok: false, errorCode: "TEMPLATE_NAME_MISSING", error: "Nome do template Meta ausente." };
  }
  if (!t.meta_language) {
    return { ok: false, errorCode: "TEMPLATE_LANGUAGE_MISSING", error: "Idioma do template Meta ausente." };
  }

  const components: Record<string, unknown>[] = [];

  // ---- Header (media only; text headers ride on the approved definition) --
  const headerType = t.meta_header_type ? String(t.meta_header_type).toLowerCase() : null;
  if (headerType === "image" || headerType === "video" || headerType === "document") {
    const h = input.header;
    if (!h || !h.media_id || h.format !== headerType) {
      return { ok: false, errorCode: "MEDIA_NOT_UPLOADED", error: "A mídia do cabeçalho ainda não foi enviada para a Meta." };
    }
    const mediaObj: Record<string, unknown> = { id: h.media_id };
    if (headerType === "document" && h.filename) mediaObj.filename = h.filename;
    components.push({
      type: "header",
      parameters: [{ type: headerType, [headerType]: mediaObj }],
    });
  }

  // ---- Body positional parameters ----------------------------------------
  const bodyText = findBodyText(t.meta_definition);
  const needsPositional = POSITIONAL_RE.test(bodyText);
  const order = Array.isArray(t.meta_body_parameter_order)
    ? (t.meta_body_parameter_order as string[])
    : [];

  if (needsPositional && order.length === 0) {
    return {
      ok: false,
      errorCode: "TEMPLATE_PARAMETER_ORDER_MISSING",
      error: "Este template tem variáveis posicionais ({{1}}, {{2}}, ...) mas a ordem semântica ainda não foi configurada.",
    };
  }
  if (needsPositional) {
    const missing: string[] = [];
    const params: { type: "text"; text: string }[] = [];
    for (const key of order) {
      const raw = input.variables?.[key];
      const value = raw == null ? "" : String(raw).trim();
      if (value === "" || PLACEHOLDER_RE.test(value)) {
        missing.push(key);
        continue;
      }
      params.push({ type: "text", text: value });
    }
    if (missing.length > 0) {
      return {
        ok: false,
        errorCode: "TEMPLATE_PARAMETER_MISSING",
        error: `Preencha as variáveis obrigatórias do template: ${missing.join(", ")}.`,
      };
    }
    components.push({ type: "body", parameters: params });
  }

  return {
    ok: true,
    payload: {
      messaging_product: "whatsapp",
      recipient_type: "individual",
      to: input.to,
      type: "template",
      template: {
        name: t.meta_template_name,
        language: { code: t.meta_language },
        components,
      },
    },
  };
}