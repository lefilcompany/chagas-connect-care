import { withEdgeHandler, jsonOk, jsonError } from "../_shared/http.ts";
import { requireAuth } from "../_shared/auth.ts";
import { resolveChannel, graphUrl } from "../_shared/resolve-channel.ts";

const BUCKET = "whatsapp-media";

// Meta-recommended limits (bytes)
const LIMITS = {
  image: 5 * 1024 * 1024,
  video: 16 * 1024 * 1024,
  document: 100 * 1024 * 1024,
  audio: 16 * 1024 * 1024,
  sticker: 100 * 1024,
} as const;

const ALLOWED_MIMES: Record<keyof typeof LIMITS, string[]> = {
  image: ["image/jpeg", "image/png"],
  video: ["video/mp4", "video/3gpp"],
  document: [
    "application/pdf",
    "application/vnd.ms-powerpoint",
    "application/msword",
    "application/vnd.ms-excel",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    "text/plain",
  ],
  audio: ["audio/aac", "audio/mp4", "audio/mpeg", "audio/amr", "audio/ogg"],
  sticker: ["image/webp"],
};

const FORBIDDEN_EXTENSIONS = [
  "exe", "bat", "cmd", "com", "scr", "ps1", "sh", "js", "jar", "msi", "dll", "vbs", "apk",
];

function mediaKindFromMime(mime: string): keyof typeof LIMITS | null {
  for (const [kind, list] of Object.entries(ALLOWED_MIMES) as Array<[keyof typeof LIMITS, string[]]>) {
    if (list.includes(mime)) return kind;
  }
  return null;
}

async function sha256Hex(bytes: Uint8Array): Promise<string> {
  const hash = await crypto.subtle.digest("SHA-256", bytes.buffer as ArrayBuffer);
  return Array.from(new Uint8Array(hash)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

function hasForbiddenExtension(filename: string | null): boolean {
  if (!filename) return false;
  const parts = filename.toLowerCase().split(".").filter(Boolean);
  // Reject double extensions ending in a forbidden one (e.g. report.pdf.exe)
  return parts.slice(-2).some((ext) => FORBIDDEN_EXTENSIONS.includes(ext));
}

Deno.serve(withEdgeHandler(async (req) => {
  if (req.method !== "POST") {
    return jsonError(405, "INVALID_INPUT", "Method not allowed");
  }

  const ctx = await requireAuth(req);
  if (ctx instanceof Response) return ctx;
  const userId = ctx.userId;
  const admin = ctx.serviceClient;
  const institution = ctx.institution ?? "";
  if (!institution) {
    return jsonError(403, "INSTITUTION_REQUIRED", "Usuário sem instituição vinculada.");
  }

  const channel = await resolveChannel(admin, institution);
  if (channel instanceof Response) return channel;

  // Parse multipart
  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return jsonError(400, "INVALID_INPUT", "Esperado multipart/form-data com campo 'file'.");
  }
  const file = form.get("file");
  if (!(file instanceof File)) {
    return jsonError(400, "INVALID_INPUT", "Campo 'file' ausente.");
  }

  const mime = file.type || "application/octet-stream";
  const kind = mediaKindFromMime(mime);
  if (!kind) {
    return jsonError(400, "MEDIA_MIME_NOT_ALLOWED", `Tipo de arquivo não permitido: ${mime}`);
  }
  if (hasForbiddenExtension(file.name)) {
    return jsonError(400, "MEDIA_MIME_NOT_ALLOWED", "Extensão de arquivo bloqueada por segurança.");
  }
  const size = file.size;
  if (size > LIMITS[kind]) {
    return jsonError(
      400,
      "MEDIA_TOO_LARGE",
      `Arquivo excede o limite de ${Math.round(LIMITS[kind] / 1024 / 1024)}MB para ${kind}.`,
    );
  }

  const bytes = new Uint8Array(await file.arrayBuffer());
  const sha = await sha256Hex(bytes);

  // Deduplicate by sha within the institution
  const { data: existing } = await admin
    .from("whatsapp_media_assets")
    .select("id, meta_media_id, status, storage_path, storage_bucket")
    .eq("institution", institution)
    .eq("sha256", sha)
    .eq("status", "uploaded")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (existing && (existing as any).meta_media_id) {
    return jsonOk({
      media_asset_id: (existing as any).id,
      meta_media_id: (existing as any).meta_media_id,
      reused: true,
    });
  }

  // Persist to private bucket: {institution_slug}/{yyyy}/{mm}/{sha}-{name}
  const now = new Date();
  const slugify = (s: string) =>
    s
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-zA-Z0-9._-]+/g, "_")
      .replace(/^_+|_+$/g, "")
      .slice(0, 60) || "institution";
  const institutionSlug = slugify(institution);
  const safeName = slugify(file.name || `${kind}.bin`).slice(0, 80);
  const storagePath = `${institutionSlug}/${now.getUTCFullYear()}/${String(
    now.getUTCMonth() + 1,
  ).padStart(2, "0")}/${sha.slice(0, 16)}-${safeName}`;

  const { error: storeErr } = await admin.storage
    .from(BUCKET)
    .upload(storagePath, bytes, { contentType: mime, upsert: true });
  if (storeErr) {
    return jsonError(500, "MEDIA_UPLOAD_FAILED", `Falha ao salvar arquivo: ${storeErr.message}`);
  }

  // Insert asset row (status pending) before Meta upload
  const { data: asset, error: assetErr } = await admin
    .from("whatsapp_media_assets")
    .insert({
      institution,
      created_by: userId,
      storage_bucket: BUCKET,
      storage_path: storagePath,
      media_type: kind,
      mime_type: mime,
      filename: file.name || null,
      size_bytes: size,
      sha256: sha,
      status: "pending",
      direction: "outbound",
    } as any)
    .select("id")
    .maybeSingle();
  if (assetErr || !asset?.id) {
    return jsonError(
      500,
      "MEDIA_UPLOAD_FAILED",
      `Falha ao registrar asset: ${assetErr?.message ?? "desconhecido"}`,
    );
  }

  // Upload to Meta: POST /{phone_id}/media (multipart with `messaging_product`)
  const metaForm = new FormData();
  metaForm.append("messaging_product", "whatsapp");
  metaForm.append("type", mime);
  metaForm.append("file", new Blob([bytes], { type: mime }), file.name || `${kind}.bin`);

  const metaRes = await fetch(
    graphUrl(`${channel.phoneNumberId}/media`),
    {
      method: "POST",
      headers: { Authorization: `Bearer ${channel.token}` },
      body: metaForm,
    },
  );
  const metaJson = await metaRes.json().catch(() => ({}));
  if (!metaRes.ok || !(metaJson as any)?.id) {
    await admin
      .from("whatsapp_media_assets")
      .update({
        status: "failed",
      } as any)
      .eq("id", (asset as any).id);
    const errMsg =
      (metaJson as any)?.error?.message ?? `Meta API error (${metaRes.status})`;
    return jsonError(200, "MEDIA_UPLOAD_FAILED", errMsg, {
      meta_error: (metaJson as any)?.error ?? null,
    });
  }

  const mediaId = String((metaJson as any).id);
  // Meta media IDs expire ~30 days after upload
  const expiresAt = new Date(Date.now() + 25 * 24 * 60 * 60 * 1000).toISOString();

  await admin
    .from("whatsapp_media_assets")
    .update({
      meta_media_id: mediaId,
      status: "uploaded",
      expires_at: expiresAt,
    } as any)
    .eq("id", (asset as any).id);

  return jsonOk({
    media_asset_id: (asset as any).id,
    meta_media_id: mediaId,
    media_type: kind,
    mime_type: mime,
    size_bytes: size,
    expires_at: expiresAt,
    reused: false,
  });
}));