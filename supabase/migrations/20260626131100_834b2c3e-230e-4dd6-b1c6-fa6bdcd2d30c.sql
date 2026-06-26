
-- =====================================================================
-- 1. institution_whatsapp_settings
-- =====================================================================
CREATE TABLE IF NOT EXISTS public.institution_whatsapp_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  institution text NOT NULL UNIQUE,
  brand_name text,
  signature_mode text NOT NULL DEFAULT 'powered_by',
  custom_signature_text text,
  application_display_name text,
  append_signature_to_text boolean NOT NULL DEFAULT true,
  use_native_interactive_footer boolean NOT NULL DEFAULT true,
  use_as_template_footer_default boolean NOT NULL DEFAULT true,
  default_template_footer_text text,
  signature_enabled boolean NOT NULL DEFAULT true,
  created_by uuid,
  updated_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT institution_whatsapp_settings_mode_chk
    CHECK (signature_mode IN ('none','institution_name','powered_by','custom')),
  CONSTRAINT institution_whatsapp_settings_custom_not_empty_chk
    CHECK (signature_mode <> 'custom'
           OR (custom_signature_text IS NOT NULL AND length(btrim(custom_signature_text)) > 0)),
  CONSTRAINT institution_whatsapp_settings_default_footer_len_chk
    CHECK (default_template_footer_text IS NULL OR length(default_template_footer_text) <= 60)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.institution_whatsapp_settings TO authenticated;
GRANT ALL ON public.institution_whatsapp_settings TO service_role;

ALTER TABLE public.institution_whatsapp_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "iws_select_own_institution_or_admin"
  ON public.institution_whatsapp_settings
  FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin'::app_role)
    OR institution = public.get_user_institution(auth.uid())
  );

CREATE POLICY "iws_insert_admin_same_institution"
  ON public.institution_whatsapp_settings
  FOR INSERT TO authenticated
  WITH CHECK (
    public.has_role(auth.uid(), 'admin'::app_role)
    AND institution IS NOT NULL
    AND institution <> ''
    AND (
      public.get_user_institution(auth.uid()) = institution
      OR public.get_user_institution(auth.uid()) IS NULL
      OR public.get_user_institution(auth.uid()) = ''
    )
  );

CREATE POLICY "iws_update_admin_same_institution"
  ON public.institution_whatsapp_settings
  FOR UPDATE TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin'::app_role)
    AND (
      public.get_user_institution(auth.uid()) = institution
      OR public.get_user_institution(auth.uid()) = ''
      OR public.get_user_institution(auth.uid()) IS NULL
    )
  )
  WITH CHECK (
    public.has_role(auth.uid(), 'admin'::app_role)
    AND (
      public.get_user_institution(auth.uid()) = institution
      OR public.get_user_institution(auth.uid()) = ''
      OR public.get_user_institution(auth.uid()) IS NULL
    )
  );

CREATE POLICY "iws_delete_admin"
  ON public.institution_whatsapp_settings
  FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role));

DROP TRIGGER IF EXISTS trg_iws_set_updated_at ON public.institution_whatsapp_settings;
CREATE TRIGGER trg_iws_set_updated_at
  BEFORE UPDATE ON public.institution_whatsapp_settings
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE INDEX IF NOT EXISTS iws_institution_idx
  ON public.institution_whatsapp_settings(institution);

-- =====================================================================
-- 2. messages: audit columns for branding/footer resolution
-- =====================================================================
ALTER TABLE public.messages
  ADD COLUMN IF NOT EXISTS resolved_footer_text text,
  ADD COLUMN IF NOT EXISTS footer_delivery_mode text,
  ADD COLUMN IF NOT EXISTS rendered_body text,
  ADD COLUMN IF NOT EXISTS branding_settings_snapshot jsonb;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'messages_footer_delivery_mode_chk'
  ) THEN
    ALTER TABLE public.messages
      ADD CONSTRAINT messages_footer_delivery_mode_chk
      CHECK (footer_delivery_mode IS NULL OR footer_delivery_mode IN (
        'none','body_signature','interactive_footer','meta_template_footer'
      ));
  END IF;
END $$;

-- =====================================================================
-- 3. message_templates: footer source + versioning metadata
-- =====================================================================
ALTER TABLE public.message_templates
  ADD COLUMN IF NOT EXISTS meta_footer_source text,
  ADD COLUMN IF NOT EXISTS meta_has_local_differences boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS meta_version integer,
  ADD COLUMN IF NOT EXISTS meta_parent_template_id uuid REFERENCES public.message_templates(id) ON DELETE SET NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'message_templates_meta_footer_source_chk'
  ) THEN
    ALTER TABLE public.message_templates
      ADD CONSTRAINT message_templates_meta_footer_source_chk
      CHECK (meta_footer_source IS NULL OR meta_footer_source IN (
        'meta_synced','institution_default','custom','none'
      ));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS message_templates_parent_idx
  ON public.message_templates(meta_parent_template_id);

-- =====================================================================
-- 4. Backfill default settings for every existing institution
-- =====================================================================
INSERT INTO public.institution_whatsapp_settings (
  institution, brand_name, signature_mode, application_display_name,
  append_signature_to_text, use_native_interactive_footer,
  use_as_template_footer_default, signature_enabled
)
SELECT DISTINCT inst, inst, 'powered_by', 'Chagas Digital Care',
       true, true, true, true
FROM (
  SELECT institution AS inst FROM public.profiles WHERE institution IS NOT NULL AND institution <> ''
  UNION
  SELECT institution AS inst FROM public.patients WHERE institution IS NOT NULL AND institution <> ''
) s
WHERE inst IS NOT NULL AND inst <> ''
ON CONFLICT (institution) DO NOTHING;
