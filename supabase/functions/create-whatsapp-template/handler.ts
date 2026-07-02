// HTTP handler for POST /functions/v1/create-whatsapp-template.
// Split from index.ts so it can be exercised as a plain Request -> Response
// function in Deno tests, without spinning up Deno.serve or the Supabase SDK.

import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import {
  buildMetaTemplateCreationPayload,
  sha256Hex,
  stableStringify,
  type MetaCategory,
  type MetaCreationPayload,
} from "../_shared/metaTemplatePayload.ts";

export interface UserContext {
  userId: string;
  isSuperadmin: boolean;
  isAdmin: boolean;
  institution: string | null;
}

export interface TemplateRow {
  id: string;
  institution: string;
  template_kind: string | null;
  meta_status: string | null;
  meta_template_name: string | null;
  meta_language: string | null;
  meta_category: MetaCategory | null;
  body: string | null;
  meta_header_type: string | null;
  meta_header_text: string | null;
  meta_footer_text: string | null;
  meta_buttons: unknown;
  meta_variable_examples: Record<string, string> | null;
  meta_version: number | null;
  meta_idempotency_key: string | null;
  meta_template_id: string | null;
  meta_submitted_at: string | null;
  meta_waba_id: string | null;
}

export interface MetaResponse {
  ok: boolean;
  status: number;
  body: unknown;
}

export interface SubmissionRecord {
  id: string;
  meta_template_id: string | null;
  meta_status: string | null;
  meta_submitted_at: string | null;
}

export interface HandlerDeps {
  loadUser(jwt: string): Promise<UserContext | null>;
  loadTemplate(id: string): Promise<TemplateRow | null>;
  loadWabaFor(institution: string): Promise<{ wabaId: string } | null>;
  findByIdempotencyKey(key: string): Promise<SubmissionRecord | null>;
  persistSubmission(id: string, patch: Record<string, unknown>): Promise<void>;
  persistError(id: string, patch: Record<string, unknown>): Promise<void>;
  callMeta(wabaId: string, payload: MetaCreationPayload): Promise<MetaResponse>;
  now(): Date;
}

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

const META_STATUS_MAP: Record<string, string> = {
  APPROVED: "approved",
  REJECTED: "rejected",
  PENDING: "submitted",
  IN_APPEAL: "submitted",
  PAUSED: "paused",
  DISABLED: "disabled",
};

function sanitizeMetaError(body: unknown): { message: string; safe: Record<string, unknown> } {
  const err = (body as { error?: Record<string, unknown> } | null)?.error ?? {};
  const message = String(
    (err.error_user_msg as string | undefined) ??
      (err.message as string | undefined) ??
      "Meta rejeitou o template.",
  );
  return { message, safe: { message, code: err.code ?? null, type: err.type ?? null } };
}

export function createHandler(deps: HandlerDeps) {
  return async function handler(req: Request): Promise<Response> {
    if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
    if (req.method !== "POST") return json(405, { ok: false, error_code: "METHOD_NOT_ALLOWED" });

    const auth = req.headers.get("Authorization");
    if (!auth?.startsWith("Bearer ")) {
      return json(401, { ok: false, error_code: "UNAUTHORIZED" });
    }
    const jwt = auth.slice("Bearer ".length);
    const user = await deps.loadUser(jwt);
    if (!user) return json(401, { ok: false, error_code: "UNAUTHORIZED" });
    if (!user.isSuperadmin && !user.isAdmin) {
      return json(403, { ok: false, error_code: "FORBIDDEN" });
    }

    let body: Record<string, unknown>;
    try {
      body = (await req.json()) as Record<string, unknown>;
    } catch {
      return json(400, { ok: false, error_code: "INVALID_JSON" });
    }
    const localTemplateId = typeof body.local_template_id === "string" ? body.local_template_id : "";
    if (!localTemplateId) {
      return json(400, {
        ok: false,
        error_code: "LOCAL_TEMPLATE_ID_REQUIRED",
        error: "local_template_id é obrigatório",
      });
    }

    const tpl = await deps.loadTemplate(localTemplateId);
    if (!tpl) return json(404, { ok: false, error_code: "TEMPLATE_NOT_FOUND" });

    if (!user.isSuperadmin && tpl.institution !== user.institution) {
      return json(403, { ok: false, error_code: "FORBIDDEN" });
    }

    const buildResult = buildMetaTemplateCreationPayload({
      name: tpl.meta_template_name ?? "",
      language: tpl.meta_language ?? "pt_BR",
      category: (tpl.meta_category as MetaCategory) ?? "UTILITY",
      body: tpl.body ?? "",
      header: {
        type: (tpl.meta_header_type as "text" | "none" | null) === "text" ? "text" : "none",
        text: tpl.meta_header_text ?? "",
      },
      footer: tpl.meta_footer_text ?? "",
      buttons: (Array.isArray(tpl.meta_buttons) ? tpl.meta_buttons : []) as never,
      variableExamples: tpl.meta_variable_examples ?? {},
    });
    if (!buildResult.ok) {
      return json(400, {
        ok: false,
        error_code: "TEMPLATE_INVALID",
        errors: buildResult.errors,
      });
    }

    const waba = await deps.loadWabaFor(tpl.institution);
    if (!waba?.wabaId) {
      return json(400, { ok: false, error_code: "WABA_NOT_CONFIGURED" });
    }

    const idempotencyKey = await sha256Hex(
      stableStringify({
        institution: tpl.institution,
        waba_id: waba.wabaId,
        local_template_id: tpl.id,
        payload: buildResult.payload,
      }),
    );

    // Idempotency: if the exact same payload has already been persisted, replay it.
    const existing = await deps.findByIdempotencyKey(idempotencyKey);
    if (existing) {
      return json(200, {
        ok: true,
        deduplicated: true,
        meta_template_id: existing.meta_template_id,
        meta_status: existing.meta_status ?? "submitted",
        submitted_at: existing.meta_submitted_at,
      });
    }

    // Already-submitted guard (different payload, same template).
    if (tpl.meta_status && tpl.meta_status !== "not_submitted" && tpl.meta_status !== "error") {
      return json(409, {
        ok: false,
        error_code: "ALREADY_SUBMITTED",
        meta_status: tpl.meta_status,
      });
    }

    let metaResp: MetaResponse;
    try {
      metaResp = await deps.callMeta(waba.wabaId, buildResult.payload);
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      return json(502, { ok: false, error_code: "META_ERROR", error: message });
    }

    if (!metaResp.ok) {
      const sanitized = sanitizeMetaError(metaResp.body);
      await deps.persistError(tpl.id, {
        meta_status: "error",
        meta_rejection_info: sanitized.safe,
        meta_last_synced_at: deps.now().toISOString(),
      });
      return json(502, {
        ok: false,
        error_code: "META_ERROR",
        error: sanitized.message,
        meta_error: sanitized.safe,
      });
    }

    const metaBody = (metaResp.body ?? {}) as { id?: string; status?: string };
    const metaStatus =
      META_STATUS_MAP[String(metaBody.status ?? "").toUpperCase()] ?? "submitted";
    const submittedAt = deps.now().toISOString();

    await deps.persistSubmission(tpl.id, {
      meta_template_id: metaBody.id ?? null,
      meta_template_name: buildResult.payload.name,
      meta_language: buildResult.payload.language,
      meta_category: buildResult.payload.category,
      meta_status: metaStatus,
      meta_submitted_at: submittedAt,
      meta_submitted_by: user.userId,
      meta_waba_id: waba.wabaId,
      meta_idempotency_key: idempotencyKey,
      meta_creation_payload: buildResult.payload,
      meta_variable_examples: tpl.meta_variable_examples ?? {},
      meta_definition: metaBody,
      meta_footer_text: tpl.meta_footer_text ?? null,
      meta_footer_source: tpl.meta_footer_text ? "custom" : "institution_default",
      meta_version: (tpl.meta_version ?? 1),
      meta_last_synced_at: submittedAt,
    });

    return json(200, {
      ok: true,
      meta_template_id: metaBody.id ?? null,
      meta_status: metaStatus,
      submitted_at: submittedAt,
    });
  };
}
