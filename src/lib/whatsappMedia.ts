import { supabase } from "@/integrations/supabase/client";

export type UploadedMediaAsset = {
  media_asset_id: string;
  meta_media_id: string;
  media_type: "image" | "video" | "document" | "audio" | "sticker";
  mime_type: string;
  size_bytes: number;
  expires_at: string;
  reused: boolean;
};

export type UploadMediaResult =
  | { ok: true; asset: UploadedMediaAsset }
  | { ok: false; error: string; error_code?: string };

/**
 * Uploads a file through the `upload-whatsapp-media` edge function.
 * The token never leaves the backend. Returns the persisted asset metadata
 * (including the Meta `media_id`) that the UI can later attach to a message
 * via `messages.media_asset_id`.
 */
export async function uploadWhatsAppMedia(file: File): Promise<UploadMediaResult> {
  const form = new FormData();
  form.append("file", file);
  try {
    const { data, error } = await supabase.functions.invoke("upload-whatsapp-media", {
      body: form,
    });
    if (error) return { ok: false, error: error.message };
    const payload = data as
      | { ok: true } & UploadedMediaAsset
      | { ok: false; error?: string; error_code?: string };
    if (!payload || payload.ok === false) {
      return {
        ok: false,
        error: (payload as any)?.error ?? "Falha no upload",
        error_code: (payload as any)?.error_code,
      };
    }
    return {
      ok: true,
      asset: {
        media_asset_id: payload.media_asset_id,
        meta_media_id: payload.meta_media_id,
        media_type: payload.media_type,
        mime_type: payload.mime_type,
        size_bytes: payload.size_bytes,
        expires_at: payload.expires_at,
        reused: !!payload.reused,
      },
    };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}