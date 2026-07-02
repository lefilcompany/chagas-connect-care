// HTTP handler for POST /functions/v1/upload-whatsapp-template-media.
// Split from index.ts so it can be exercised as a plain Request -> Response
// function in Deno tests, without spinning up Deno.serve, Meta or Supabase.

import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

export interface UserContext {
  userId: string;
  isSuperadmin: boolean;
  isAdmin: boolean;
  institution: string | null;
}

export interface TemplateRow {
  id: string;
  institution: string;
  meta_status: string | null;
}

export type MediaFormat = "IMAGE" | "VIDEO" | "DOCUMENT";

export interface HeaderMediaRecord {
  id: string;
  header_handle: string;
  format: MediaFormat;
}

export interface HandlerDeps {
  loadUser(jwt: string): Promise<UserContext | null>;
  loadTemplate(id: string): Promise<TemplateRow | null>;
  createUploadSession(input: {
    fileName: string;
    fileSize: number;
    mimeType: string;
  }): Promise<{ ok: boolean; status: number; sessionId?: string; body?: unknown }>;
  uploadBytes(input: {
    sessionId: string;
    mimeType: string;
    bytes: Uint8Array;
  }): Promise<{ ok: boolean; status: number; handle?: string; body?: unknown }>;
  persistMedia(input: {
    local_template_id: string;
    institution: string;
    format: MediaFormat;
    mime_type: string;
    file_size: number;
    file_name: string | null;
    header_handle: string;
    uploaded_by: string;
  }): Promise<HeaderMediaRecord>;
  updateTemplateHeader(input: {
    templateId: string;
    format: MediaFormat;
    handle: string;
    mediaId: string;
  }): Promise<void>;
}

export interface LimitsByFormat {
  IMAGE: number;
  VIDEO: number;
  DOCUMENT: number;
}

export const DEFAULT_LIMITS: LimitsByFormat = {
  IMAGE: 5 * 1024 * 1024,
  VIDEO: 16 * 1024 * 1024,
  DOCUMENT: 100 * 1024 * 1024,
};

const MIME_TO_FORMAT: Record<string, MediaFormat> = {
  "image/jpeg": "IMAGE",
  "image/png": "IMAGE",
  "video/mp4": "VIDEO",
  "video/3gpp": "VIDEO",
  "application/pdf": "DOCUMENT",
};

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function sanitizeMetaError(body: unknown): { message: string; safe: Record<string, unknown> } {
  const err = (body as { error?: Record<string, unknown> } | null)?.error ?? {};
  const message = String(
    (err.error_user_msg as string | undefined) ??
      (err.message as string | undefined) ??
      "A Meta rejeitou o envio da amostra.",
  );
  return { message, safe: { message, code: err.code ?? null, type: err.type ?? null } };
}

export function createHandler(deps: HandlerDeps, limits: LimitsByFormat = DEFAULT_LIMITS) {
  return async function handler(req: Request): Promise<Response> {
    if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
    if (req.method !== "POST") return json(405, { ok: false, error_code: "METHOD_NOT_ALLOWED" });

    const auth = req.headers.get("Authorization");
    if (!auth?.startsWith("Bearer ")) return json(401, { ok: false, error_code: "UNAUTHORIZED" });
    const jwt = auth.slice("Bearer ".length);
    const user = await deps.loadUser(jwt);
    if (!user) return json(401, { ok: false, error_code: "UNAUTHORIZED" });
    if (!user.isSuperadmin && !user.isAdmin) {
      return json(403, { ok: false, error_code: "FORBIDDEN" });
    }

    let form: FormData;
    try {
      form = await req.formData();
    } catch {
      return json(400, { ok: false, error_code: "INVALID_FORM_DATA" });
    }

    const localTemplateId = String(form.get("local_template_id") ?? "");
    if (!localTemplateId) {
      return json(400, { ok: false, error_code: "LOCAL_TEMPLATE_ID_REQUIRED" });
    }

    const file = form.get("file") as (File | Blob | string | null);
    if (!(file instanceof Blob)) {
      return json(400, { ok: false, error_code: "MISSING_FILE" });
    }

    const mime = (file as File).type || "application/octet-stream";
    const format = MIME_TO_FORMAT[mime];
    if (!format) {
      return json(400, { ok: false, error_code: "INVALID_MIME", error: `MIME não suportado: ${mime}` });
    }

    const size = file.size;
    if (size > limits[format]) {
      return json(400, {
        ok: false,
        error_code: "FILE_TOO_LARGE",
        error: `Arquivo excede o limite de ${limits[format]} bytes para ${format}.`,
      });
    }

    const tpl = await deps.loadTemplate(localTemplateId);
    if (!tpl) return json(404, { ok: false, error_code: "TEMPLATE_NOT_FOUND" });
    if (!user.isSuperadmin && tpl.institution !== user.institution) {
      return json(403, { ok: false, error_code: "FORBIDDEN" });
    }
    if (tpl.meta_status && tpl.meta_status !== "not_submitted" && tpl.meta_status !== "error") {
      return json(409, { ok: false, error_code: "ALREADY_SUBMITTED", meta_status: tpl.meta_status });
    }

    const fileName = (file as File).name || `sample.${format.toLowerCase()}`;

    const session = await deps.createUploadSession({
      fileName,
      fileSize: size,
      mimeType: mime,
    });
    if (!session.ok || !session.sessionId) {
      const sanitized = sanitizeMetaError(session.body);
      return json(502, {
        ok: false,
        error_code: "UPLOAD_SESSION_FAILED",
        error: sanitized.message,
        meta_error: sanitized.safe,
      });
    }

    const bytes = new Uint8Array(await file.arrayBuffer());
    const uploaded = await deps.uploadBytes({
      sessionId: session.sessionId,
      mimeType: mime,
      bytes,
    });
    if (!uploaded.ok || !uploaded.handle) {
      const sanitized = sanitizeMetaError(uploaded.body);
      return json(502, {
        ok: false,
        error_code: "UPLOAD_BYTES_FAILED",
        error: sanitized.message,
        meta_error: sanitized.safe,
      });
    }

    const record = await deps.persistMedia({
      local_template_id: tpl.id,
      institution: tpl.institution,
      format,
      mime_type: mime,
      file_size: size,
      file_name: fileName,
      header_handle: uploaded.handle,
      uploaded_by: user.userId,
    });

    await deps.updateTemplateHeader({
      templateId: tpl.id,
      format,
      handle: uploaded.handle,
      mediaId: record.id,
    });

    return json(200, {
      ok: true,
      format,
      header_handle: uploaded.handle,
      media_id: record.id,
    });
  };
}