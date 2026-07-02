import { createClient, type SupabaseClient } from "npm:@supabase/supabase-js@2";
import {
  createHandler,
  type HandlerDeps,
  type MediaFormat,
  type TemplateRow,
  type UserContext,
} from "./handler.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const WHATSAPP_TOKEN = Deno.env.get("WHATSAPP_TOKEN") ?? "";
const META_APP_ID = Deno.env.get("META_APP_ID") ?? "";
const RAW_VER = Deno.env.get("WHATSAPP_GRAPH_VERSION") ?? "v25.0";
const GRAPH = /^v\d+\.\d+$/.test(RAW_VER) ? RAW_VER : "v25.0";

const admin: SupabaseClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

async function loadUser(jwt: string): Promise<UserContext | null> {
  const authClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: `Bearer ${jwt}` } },
  });
  const { data, error } = await authClient.auth.getClaims(jwt);
  if (error || !data?.claims?.sub) return null;
  const userId = data.claims.sub as string;
  const { data: roles } = await admin.from("user_roles").select("role").eq("user_id", userId);
  const set = new Set((roles ?? []).map((r) => (r as { role: string }).role));
  const { data: profile } = await admin
    .from("profiles").select("institution").eq("id", userId).maybeSingle();
  return {
    userId,
    isSuperadmin: set.has("superadmin"),
    isAdmin: set.has("admin"),
    institution: (profile as { institution?: string } | null)?.institution ?? null,
  };
}

async function loadTemplate(id: string): Promise<TemplateRow | null> {
  const { data } = await admin
    .from("message_templates")
    .select("id, institution, meta_status")
    .eq("id", id)
    .maybeSingle();
  return (data as TemplateRow | null) ?? null;
}

async function createUploadSession(input: {
  fileName: string;
  fileSize: number;
  mimeType: string;
}) {
  if (!META_APP_ID) return { ok: false, status: 500, body: { error: { message: "META_APP_ID não configurado" } } };
  const url = new URL(`https://graph.facebook.com/${GRAPH}/${META_APP_ID}/uploads`);
  url.searchParams.set("file_name", input.fileName);
  url.searchParams.set("file_length", String(input.fileSize));
  url.searchParams.set("file_type", input.mimeType);
  const res = await fetch(url.toString(), {
    method: "POST",
    headers: { Authorization: `Bearer ${WHATSAPP_TOKEN}` },
  });
  const body = await res.json().catch(() => ({}));
  const id = (body as { id?: string }).id;
  const sessionId = typeof id === "string" ? id.replace(/^upload:/, "") : undefined;
  return { ok: res.ok && !!sessionId, status: res.status, sessionId, body };
}

async function uploadBytes(input: {
  sessionId: string;
  mimeType: string;
  bytes: Uint8Array;
}) {
  const id = input.sessionId.startsWith("upload:") ? input.sessionId : `upload:${input.sessionId}`;
  const res = await fetch(`https://graph.facebook.com/${GRAPH}/${id}`, {
    method: "POST",
    headers: {
      Authorization: `OAuth ${WHATSAPP_TOKEN}`,
      file_offset: "0",
      "Content-Type": input.mimeType,
    },
    body: input.bytes,
  });
  const body = await res.json().catch(() => ({}));
  const handle = (body as { h?: string }).h;
  return { ok: res.ok && !!handle, status: res.status, handle, body };
}

async function persistMedia(input: {
  local_template_id: string;
  institution: string;
  format: MediaFormat;
  mime_type: string;
  file_size: number;
  file_name: string | null;
  header_handle: string;
  uploaded_by: string;
}) {
  const { data, error } = await admin
    .from("whatsapp_template_header_media")
    .insert(input as never)
    .select("id, header_handle, format")
    .single();
  if (error) throw error;
  return data as { id: string; header_handle: string; format: MediaFormat };
}

async function updateTemplateHeader(input: {
  templateId: string;
  format: MediaFormat;
  handle: string;
  mediaId: string;
}) {
  const typeMap = { IMAGE: "image", VIDEO: "video", DOCUMENT: "document" } as const;
  await admin
    .from("message_templates")
    .update({
      meta_header_type: typeMap[input.format],
      meta_header_format: input.format,
      meta_header_handle: input.handle,
      meta_header_media_id: input.mediaId,
    })
    .eq("id", input.templateId);
}

const deps: HandlerDeps = {
  loadUser,
  loadTemplate,
  createUploadSession,
  uploadBytes,
  persistMedia,
  updateTemplateHeader,
};

Deno.serve(createHandler(deps));