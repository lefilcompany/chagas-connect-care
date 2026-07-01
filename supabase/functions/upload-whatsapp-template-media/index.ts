// Resumable Upload API (Meta) para amostras de cabeçalho em templates.
// Retorna um `handle` (h) que deve ser usado em example.header_handle na
// criação/edição do template — nunca como Media ID de envio.
import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const WHATSAPP_TOKEN = Deno.env.get("WHATSAPP_TOKEN") ?? "";
const WHATSAPP_APP_ID = Deno.env.get("META_APP_ID") ?? Deno.env.get("WHATSAPP_APP_ID") ?? "";
const RAW_VER = Deno.env.get("WHATSAPP_GRAPH_VERSION") ?? "v25.0";
const GRAPH = /^v\d+\.\d+$/.test(RAW_VER) ? RAW_VER : "v25.0";

const LIMITS = {
  image: 5 * 1024 * 1024,
  video: 16 * 1024 * 1024,
  document: 100 * 1024 * 1024,
} as const;
const MIME_TO_FORMAT: Record<string, "IMAGE" | "VIDEO" | "DOCUMENT"> = {
  "image/jpeg": "IMAGE",
  "image/png": "IMAGE",
  "video/mp4": "VIDEO",
  "video/3gpp": "VIDEO",
  "application/pdf": "DOCUMENT",
};

function json(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json(405, { ok: false, error: "Method not allowed" });

  if (!WHATSAPP_TOKEN || !WHATSAPP_APP_ID) {
    return json(500, {
      ok: false,
      error_code: "MISSING_CREDENTIALS",
      error: "WHATSAPP_TOKEN ou META_APP_ID ausente no servidor.",
    });
  }

  // Auth: superadmin OR institution admin.
  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) return json(401, { ok: false, error: "Unauthorized" });
  const authClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: authHeader } },
  });
  const token = authHeader.replace("Bearer ", "");
  const { data: claims, error: authErr } = await authClient.auth.getClaims(token);
  if (authErr || !claims?.claims?.sub) return json(401, { ok: false, error: "Unauthorized" });
  const userId = claims.claims.sub as string;

  const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
  const { data: roles } = await admin
    .from("user_roles")
    .select("role")
    .eq("user_id", userId);
  const roleSet = new Set(((roles as any[]) ?? []).map((r) => r.role));
  if (!roleSet.has("superadmin") && !roleSet.has("admin")) {
    return json(403, { ok: false, error: "Forbidden" });
  }

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
  const format = MIME_TO_FORMAT[mime];
  if (!format) {
    return json(400, {
      ok: false,
      error_code: "MEDIA_MIME_NOT_ALLOWED",
      error: `Tipo não permitido para cabeçalho de template: ${mime}`,
    });
  }
  const kindKey = format.toLowerCase() as keyof typeof LIMITS;
  if (file.size > LIMITS[kindKey]) {
    return json(400, {
      ok: false,
      error_code: "MEDIA_TOO_LARGE",
      error: `Arquivo excede o limite de ${Math.round(LIMITS[kindKey] / 1024 / 1024)}MB para ${format}.`,
    });
  }

  const bytes = new Uint8Array(await file.arrayBuffer());

  // Etapa 1: iniciar sessão.
  const startUrl = new URL(`https://graph.facebook.com/${GRAPH}/${WHATSAPP_APP_ID}/uploads`);
  startUrl.searchParams.set("file_length", String(bytes.byteLength));
  startUrl.searchParams.set("file_type", mime);
  startUrl.searchParams.set("file_name", file.name || `header.${kindKey}`);
  const startRes = await fetch(startUrl.toString(), {
    method: "POST",
    headers: { Authorization: `Bearer ${WHATSAPP_TOKEN}` },
  });
  const startBody: any = await startRes.json().catch(() => ({}));
  if (!startRes.ok || !startBody?.id) {
    return json(200, {
      ok: false,
      error_code: "RESUMABLE_START_FAILED",
      error: startBody?.error?.message ?? "Falha ao iniciar upload resumable",
      meta_error: startBody?.error ?? null,
    });
  }
  const sessionId: string = String(startBody.id);

  // Etapa 2: enviar bytes.
  const uploadRes = await fetch(`https://graph.facebook.com/${GRAPH}/${sessionId}`, {
    method: "POST",
    headers: {
      Authorization: `OAuth ${WHATSAPP_TOKEN}`,
      file_offset: "0",
      "Content-Type": mime,
    },
    body: bytes,
  });
  const uploadBody: any = await uploadRes.json().catch(() => ({}));
  if (!uploadRes.ok || !uploadBody?.h) {
    return json(200, {
      ok: false,
      error_code: "RESUMABLE_UPLOAD_FAILED",
      error: uploadBody?.error?.message ?? "Falha ao enviar bytes ao upload session",
      meta_error: uploadBody?.error ?? null,
    });
  }

  return json(200, {
    ok: true,
    handle: String(uploadBody.h),
    format,
    mime,
    size: bytes.byteLength,
    session_id: sessionId,
  });
});