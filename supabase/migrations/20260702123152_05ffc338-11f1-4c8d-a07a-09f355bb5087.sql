
CREATE TABLE IF NOT EXISTS public.whatsapp_template_header_media (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  local_template_id uuid NOT NULL REFERENCES public.message_templates(id) ON DELETE CASCADE,
  institution text NOT NULL,
  format text NOT NULL CHECK (format IN ('IMAGE','VIDEO','DOCUMENT')),
  mime_type text NOT NULL,
  file_size bigint NOT NULL,
  file_name text,
  header_handle text NOT NULL,
  uploaded_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS whatsapp_template_header_media_local_idx
  ON public.whatsapp_template_header_media(local_template_id);

GRANT SELECT, INSERT, DELETE ON public.whatsapp_template_header_media TO authenticated;
GRANT ALL ON public.whatsapp_template_header_media TO service_role;

ALTER TABLE public.whatsapp_template_header_media ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Institution admins read header media"
  ON public.whatsapp_template_header_media
  FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin'::app_role)
    AND institution = public.get_user_institution(auth.uid())
  );

CREATE POLICY "Institution admins insert header media"
  ON public.whatsapp_template_header_media
  FOR INSERT TO authenticated
  WITH CHECK (
    public.has_role(auth.uid(), 'admin'::app_role)
    AND institution = public.get_user_institution(auth.uid())
    AND uploaded_by = auth.uid()
  );

CREATE POLICY "Institution admins delete header media"
  ON public.whatsapp_template_header_media
  FOR DELETE TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin'::app_role)
    AND institution = public.get_user_institution(auth.uid())
  );

ALTER TABLE public.message_templates
  ADD COLUMN IF NOT EXISTS meta_header_format text,
  ADD COLUMN IF NOT EXISTS meta_header_handle text,
  ADD COLUMN IF NOT EXISTS meta_header_media_id uuid REFERENCES public.whatsapp_template_header_media(id) ON DELETE SET NULL;
