
-- =========================================================
-- Fase 1: Fundação do banco para Central Superadmin WhatsApp
-- =========================================================

-- 1) Colunas adicionais em message_templates
ALTER TABLE public.message_templates
  ADD COLUMN IF NOT EXISTS meta_status_raw text,
  ADD COLUMN IF NOT EXISTS meta_sync_pending boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS meta_last_webhook_at timestamptz,
  ADD COLUMN IF NOT EXISTS meta_waba_id text,
  ADD COLUMN IF NOT EXISTS meta_quality_score jsonb,
  ADD COLUMN IF NOT EXISTS meta_variable_examples jsonb;

-- 2) Migração segura de meta_parameter_order -> meta_body_parameter_order
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='message_templates'
      AND column_name='meta_parameter_order'
  ) THEN
    UPDATE public.message_templates
       SET meta_body_parameter_order = meta_parameter_order
     WHERE meta_body_parameter_order IS NULL
       AND meta_parameter_order IS NOT NULL;
  END IF;
END $$;

-- 3) Constraint de formato de parâmetros
ALTER TABLE public.message_templates
  DROP CONSTRAINT IF EXISTS message_templates_meta_parameter_format_chk;
ALTER TABLE public.message_templates
  ADD CONSTRAINT message_templates_meta_parameter_format_chk
  CHECK (
    meta_parameter_format IS NULL
    OR meta_parameter_format IN ('POSITIONAL','NAMED')
  );

-- 4) Índices únicos parciais para evitar colisões
CREATE UNIQUE INDEX IF NOT EXISTS ux_message_templates_meta_scope
  ON public.message_templates (institution, meta_template_name, meta_language)
  WHERE template_kind = 'meta';

CREATE UNIQUE INDEX IF NOT EXISTS ux_message_templates_meta_waba_name_language
  ON public.message_templates (meta_waba_id, meta_template_name, meta_language)
  WHERE template_kind = 'meta' AND meta_waba_id IS NOT NULL;

-- 5) Tabela de submissões para idempotência
CREATE TABLE IF NOT EXISTS public.whatsapp_template_submissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  local_template_id uuid NOT NULL REFERENCES public.message_templates(id) ON DELETE CASCADE,
  institution text NOT NULL,
  idempotency_key text NOT NULL UNIQUE,
  status text NOT NULL CHECK (status IN ('processing','succeeded','failed')),
  request_payload jsonb,
  response_payload jsonb,
  meta_template_id text,
  error_code text,
  error_payload jsonb,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz
);

GRANT SELECT ON public.whatsapp_template_submissions TO authenticated;
GRANT ALL ON public.whatsapp_template_submissions TO service_role;

ALTER TABLE public.whatsapp_template_submissions ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS ix_wts_local_template
  ON public.whatsapp_template_submissions (local_template_id);
CREATE INDEX IF NOT EXISTS ix_wts_institution
  ON public.whatsapp_template_submissions (institution);
CREATE INDEX IF NOT EXISTS ix_wts_status
  ON public.whatsapp_template_submissions (status);

DROP POLICY IF EXISTS "wts superadmin read" ON public.whatsapp_template_submissions;
CREATE POLICY "wts superadmin read"
  ON public.whatsapp_template_submissions
  FOR SELECT TO authenticated
  USING (public.is_superadmin(auth.uid()));

DROP POLICY IF EXISTS "wts admin read own institution" ON public.whatsapp_template_submissions;
CREATE POLICY "wts admin read own institution"
  ON public.whatsapp_template_submissions
  FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin'::app_role)
    AND institution = public.get_user_institution(auth.uid())
  );

CREATE TRIGGER trg_wts_updated_at
  BEFORE UPDATE ON public.whatsapp_template_submissions
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 6) Políticas de superadmin em tabelas administrativas
DROP POLICY IF EXISTS "superadmin manage message_templates" ON public.message_templates;
CREATE POLICY "superadmin manage message_templates"
  ON public.message_templates
  FOR ALL TO authenticated
  USING (public.is_superadmin(auth.uid()))
  WITH CHECK (public.is_superadmin(auth.uid()));

DROP POLICY IF EXISTS "superadmin manage whatsapp_channels" ON public.whatsapp_channels;
CREATE POLICY "superadmin manage whatsapp_channels"
  ON public.whatsapp_channels
  FOR ALL TO authenticated
  USING (public.is_superadmin(auth.uid()))
  WITH CHECK (public.is_superadmin(auth.uid()));

DROP POLICY IF EXISTS "superadmin manage institution_whatsapp_settings" ON public.institution_whatsapp_settings;
CREATE POLICY "superadmin manage institution_whatsapp_settings"
  ON public.institution_whatsapp_settings
  FOR ALL TO authenticated
  USING (public.is_superadmin(auth.uid()))
  WITH CHECK (public.is_superadmin(auth.uid()));

DROP POLICY IF EXISTS "superadmin read audit log" ON public.whatsapp_admin_audit_log;
CREATE POLICY "superadmin read audit log"
  ON public.whatsapp_admin_audit_log
  FOR SELECT TO authenticated
  USING (public.is_superadmin(auth.uid()));
