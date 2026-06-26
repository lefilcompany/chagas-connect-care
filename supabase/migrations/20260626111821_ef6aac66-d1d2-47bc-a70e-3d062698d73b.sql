
-- 1) message_templates: Meta-aligned columns
ALTER TABLE public.message_templates
  ADD COLUMN IF NOT EXISTS meta_template_id text,
  ADD COLUMN IF NOT EXISTS meta_category text,
  ADD COLUMN IF NOT EXISTS meta_definition jsonb,
  ADD COLUMN IF NOT EXISTS meta_header_type text,
  ADD COLUMN IF NOT EXISTS meta_header_text text,
  ADD COLUMN IF NOT EXISTS meta_header_parameter_order jsonb,
  ADD COLUMN IF NOT EXISTS meta_body_parameter_order jsonb,
  ADD COLUMN IF NOT EXISTS meta_footer_text text,
  ADD COLUMN IF NOT EXISTS meta_buttons jsonb,
  ADD COLUMN IF NOT EXISTS meta_carousel_cards jsonb,
  ADD COLUMN IF NOT EXISTS meta_authentication_config jsonb,
  ADD COLUMN IF NOT EXISTS meta_rejection_reason text,
  ADD COLUMN IF NOT EXISTS meta_last_synced_at timestamptz;

CREATE INDEX IF NOT EXISTS message_templates_meta_template_id_idx
  ON public.message_templates(meta_template_id);
CREATE INDEX IF NOT EXISTS message_templates_meta_category_idx
  ON public.message_templates(meta_category);

-- 2) messages: content-type / media / interaction fields
ALTER TABLE public.messages
  ADD COLUMN IF NOT EXISTS message_content_type text,
  ADD COLUMN IF NOT EXISTS media_asset_id uuid,
  ADD COLUMN IF NOT EXISTS media_mime_type text,
  ADD COLUMN IF NOT EXISTS media_filename text,
  ADD COLUMN IF NOT EXISTS reaction_emoji text,
  ADD COLUMN IF NOT EXISTS location_data jsonb;

-- 3) whatsapp_media_assets
CREATE TABLE IF NOT EXISTS public.whatsapp_media_assets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  institution text NOT NULL,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  storage_bucket text,
  storage_path text,
  meta_media_id text,
  media_type text NOT NULL,
  mime_type text NOT NULL,
  filename text,
  size_bytes bigint,
  sha256 text,
  status text NOT NULL DEFAULT 'pending',
  direction text NOT NULL DEFAULT 'outbound',
  expires_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.whatsapp_media_assets TO authenticated;
GRANT ALL ON public.whatsapp_media_assets TO service_role;

ALTER TABLE public.whatsapp_media_assets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "media_assets_select_same_institution"
  ON public.whatsapp_media_assets FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin'::app_role)
    OR institution = public.get_user_institution(auth.uid())
  );

CREATE POLICY "media_assets_insert_same_institution"
  ON public.whatsapp_media_assets FOR INSERT TO authenticated
  WITH CHECK (
    institution = public.get_user_institution(auth.uid())
    AND institution IS NOT NULL AND institution <> ''
  );

CREATE POLICY "media_assets_update_same_institution"
  ON public.whatsapp_media_assets FOR UPDATE TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin'::app_role)
    OR institution = public.get_user_institution(auth.uid())
  )
  WITH CHECK (
    public.has_role(auth.uid(), 'admin'::app_role)
    OR institution = public.get_user_institution(auth.uid())
  );

CREATE POLICY "media_assets_delete_admin_only"
  ON public.whatsapp_media_assets FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role));

CREATE INDEX IF NOT EXISTS whatsapp_media_assets_institution_idx
  ON public.whatsapp_media_assets(institution);
CREATE INDEX IF NOT EXISTS whatsapp_media_assets_meta_media_id_idx
  ON public.whatsapp_media_assets(meta_media_id);
CREATE INDEX IF NOT EXISTS whatsapp_media_assets_sha256_idx
  ON public.whatsapp_media_assets(sha256);

DROP TRIGGER IF EXISTS set_whatsapp_media_assets_updated_at ON public.whatsapp_media_assets;
CREATE TRIGGER set_whatsapp_media_assets_updated_at
  BEFORE UPDATE ON public.whatsapp_media_assets
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 4) Storage policies (bucket already created via tool)
CREATE POLICY "whatsapp_media_authenticated_read_same_institution"
  ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'whatsapp-media'
    AND (
      public.has_role(auth.uid(), 'admin'::app_role)
      OR (storage.foldername(name))[1] = public.get_user_institution(auth.uid())
    )
  );

CREATE POLICY "whatsapp_media_service_role_all"
  ON storage.objects FOR ALL TO service_role
  USING (bucket_id = 'whatsapp-media')
  WITH CHECK (bucket_id = 'whatsapp-media');

-- 5) Helper to mark expired media
CREATE OR REPLACE FUNCTION public.mark_expired_whatsapp_media()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  updated_count integer;
BEGIN
  UPDATE public.whatsapp_media_assets
     SET status = 'expired', updated_at = now()
   WHERE expires_at IS NOT NULL
     AND expires_at < now()
     AND status NOT IN ('expired', 'failed');
  GET DIAGNOSTICS updated_count = ROW_COUNT;
  RETURN updated_count;
END;
$$;
