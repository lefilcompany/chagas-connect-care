import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

const WHATSAPP_TOKEN = Deno.env.get("WHATSAPP_TOKEN") ?? "";
const WHATSAPP_PHONE_NUMBER_ID = Deno.env.get("WHATSAPP_PHONE_NUMBER_ID") ?? "";
const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY") ?? "";

const RAW_GRAPH_VERSION = Deno.env.get("WHATSAPP_GRAPH_VERSION") ?? "v25.0";
const GRAPH_VERSION = /^v\d+\.\d+$/.test(RAW_GRAPH_VERSION) ? RAW_GRAPH_VERSION : "v25.0";

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

function json(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

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

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json(405, { error: "Method not allowed" });

  if (!WHATSAPP_TOKEN || !WHATSAPP_PHONE_NUMBER_ID) {
    return json(500, {
      ok: false,
      error_code: "MISSING_TOKEN",
      error: "Credenciais do WhatsApp não configuradas no servidor.",
    });
  }

  // Auth
  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) return json(401, { error: "Unauthorized" });
  const authClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: authHeader } },
  });
  const token = authHeader.replace("Bearer ", "");
  const { data: claims, error: authErr } = await authClient.auth.getClaims(token);
  if (authErr || !claims?.claims?.sub) return json(401, { error: "Unauthorized" });
  const userId = claims.claims.sub as string;

  const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  // Resolve institution from profile
  const { data: prof } = await admin
    .from("profiles")
    .select("institution")
    .eq("id", userId)
    .maybeSingle();
  const institution = (prof as any)?.institution ?? "";
  if (!institution) {
    return json(403, { ok: false, error: "Usuário sem instituição vinculada." });
  }

  // Parse multipart
  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return json(400, { ok: false, error: "Esperado multipart/form-data com campo 'file'." });
  }
  const file = form.get("file");
  if (!(file instanceof File)) {
    return json(400, { ok: false, error: "Campo 'file' ausente." });
  }

  const mime = file.type || "application/octet-stream";
  const kind = mediaKindFromMime(mime);
  if (!kind) {
    return json(400, {
      ok: false,
      error_code: "MEDIA_MIME_NOT_ALLOWED",
      error: `Tipo de arquivo não permitido: ${mime}`,
    });
  }
  if (hasForbiddenExtension(file.name)) {
    return json(400, {
      ok: false,
      error_code: "MEDIA_MIME_NOT_ALLOWED",
      error: "Extensão de arquivo bloqueada por segurança.",
    });
  }
  const size = file.size;
  if (size > LIMITS[kind]) {
    return json(400, {
      ok: false,
      error_code: "MEDIA_TOO_LARGE",
      error: `Arquivo excede o limite de ${Math.round(LIMITS[kind] / 1024 / 1024)}MB para ${kind}.`,
    });
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
    return json(200, {
      ok: true,
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
    return json(500, {
      ok: false,
      error_code: "MEDIA_UPLOAD_FAILED",
      error: `Falha ao salvar arquivo: ${storeErr.message}`,
    });
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
    return json(500, {
      ok: false,
      error_code: "MEDIA_UPLOAD_FAILED",
      error: `Falha ao registrar asset: ${assetErr?.message ?? "desconhecido"}`,
    });
  }

  // Upload to Meta: POST /{phone_id}/media (multipart with `messaging_product`)
  const metaForm = new FormData();
  metaForm.append("messaging_product", "whatsapp");
  metaForm.append("type", mime);
  metaForm.append("file", new Blob([bytes], { type: mime }), file.name || `${kind}.bin`);

  const metaRes = await fetch(
    `https://graph.facebook.com/${GRAPH_VERSION}/${WHATSAPP_PHONE_NUMBER_ID}/media`,
    {
      method: "POST",
      headers: { Authorization: `Bearer ${WHATSAPP_TOKEN}` },
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
    return json(200, {
      ok: false,
      error_code: "MEDIA_UPLOAD_FAILED",
      error: errMsg,
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

  return json(200, {
    ok: true,
    media_asset_id: (asset as any).id,
    meta_media_id: mediaId,
    media_type: kind,
    mime_type: mime,
    size_bytes: size,
    expires_at: expiresAt,
    reused: false,
  });
});