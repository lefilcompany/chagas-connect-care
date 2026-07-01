
-- Helper: is superadmin
CREATE OR REPLACE FUNCTION public.is_superadmin(_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS(SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = 'superadmin'::app_role)
$$;
REVOKE EXECUTE ON FUNCTION public.is_superadmin(uuid) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.is_superadmin(uuid) TO authenticated, service_role;

-- message_templates: new columns
ALTER TABLE public.message_templates
  ADD COLUMN IF NOT EXISTS meta_parameter_format text,
  ADD COLUMN IF NOT EXISTS meta_creation_payload jsonb,
  ADD COLUMN IF NOT EXISTS meta_rejection_info jsonb,
  ADD COLUMN IF NOT EXISTS meta_idempotency_key text,
  ADD COLUMN IF NOT EXISTS meta_submitted_at timestamptz,
  ADD COLUMN IF NOT EXISTS meta_submitted_by uuid,
  ADD COLUMN IF NOT EXISTS meta_header_handle text;

-- Backfill: legacy meta_parameter_order -> meta_body_parameter_order
UPDATE public.message_templates
   SET meta_body_parameter_order = meta_parameter_order
 WHERE meta_body_parameter_order IS NULL
   AND meta_parameter_order IS NOT NULL;

-- Unique meta template per (institution, name, language)
CREATE UNIQUE INDEX IF NOT EXISTS ux_message_templates_meta_scope
  ON public.message_templates (institution, meta_template_name, meta_language)
  WHERE template_kind = 'meta' AND meta_template_name IS NOT NULL;

-- Idempotency key unique
CREATE UNIQUE INDEX IF NOT EXISTS ux_message_templates_idempotency
  ON public.message_templates (meta_idempotency_key)
  WHERE meta_idempotency_key IS NOT NULL;

-- whatsapp_integration_health
CREATE TABLE IF NOT EXISTS public.whatsapp_integration_health (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  scope text NOT NULL,
  check_key text NOT NULL,
  status text NOT NULL,
  detail jsonb,
  correlation_id text,
  checked_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (scope, check_key)
);
GRANT SELECT ON public.whatsapp_integration_health TO authenticated;
GRANT ALL ON public.whatsapp_integration_health TO service_role;
ALTER TABLE public.whatsapp_integration_health ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Superadmin reads integration health" ON public.whatsapp_integration_health
  FOR SELECT TO authenticated USING (public.is_superadmin(auth.uid()));
CREATE TRIGGER trg_health_updated_at BEFORE UPDATE ON public.whatsapp_integration_health
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- whatsapp_admin_audit_log
CREATE TABLE IF NOT EXISTS public.whatsapp_admin_audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid,
  actor_role text,
  institution text,
  entity text NOT NULL,
  entity_id text,
  action text NOT NULL,
  before_state jsonb,
  after_state jsonb,
  result text,
  error_code text,
  correlation_id text,
  ip inet,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.whatsapp_admin_audit_log TO authenticated;
GRANT ALL ON public.whatsapp_admin_audit_log TO service_role;
ALTER TABLE public.whatsapp_admin_audit_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Superadmin reads all audit" ON public.whatsapp_admin_audit_log
  FOR SELECT TO authenticated USING (public.is_superadmin(auth.uid()));
CREATE POLICY "Institution admin reads own audit" ON public.whatsapp_admin_audit_log
  FOR SELECT TO authenticated USING (
    public.has_role(auth.uid(), 'admin'::app_role)
    AND institution = public.get_user_institution(auth.uid())
  );
CREATE INDEX IF NOT EXISTS idx_audit_created_at ON public.whatsapp_admin_audit_log (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_entity ON public.whatsapp_admin_audit_log (entity, entity_id);

-- whatsapp_template_events (idempotency for template webhook)
CREATE TABLE IF NOT EXISTS public.whatsapp_template_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  meta_template_id text,
  event text NOT NULL,
  entry_timestamp bigint,
  payload_hash text NOT NULL,
  payload jsonb,
  processed_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (meta_template_id, event, entry_timestamp, payload_hash)
);
GRANT SELECT ON public.whatsapp_template_events TO authenticated;
GRANT ALL ON public.whatsapp_template_events TO service_role;
ALTER TABLE public.whatsapp_template_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Superadmin reads template events" ON public.whatsapp_template_events
  FOR SELECT TO authenticated USING (public.is_superadmin(auth.uid()));

-- Extend RLS on existing sensitive tables so superadmin has global access
CREATE POLICY "Superadmin full access on message_templates" ON public.message_templates
  FOR ALL TO authenticated
  USING (public.is_superadmin(auth.uid()))
  WITH CHECK (public.is_superadmin(auth.uid()));

CREATE POLICY "Superadmin full access on whatsapp_channels" ON public.whatsapp_channels
  FOR ALL TO authenticated
  USING (public.is_superadmin(auth.uid()))
  WITH CHECK (public.is_superadmin(auth.uid()));

CREATE POLICY "Superadmin full access on institution_whatsapp_settings" ON public.institution_whatsapp_settings
  FOR ALL TO authenticated
  USING (public.is_superadmin(auth.uid()))
  WITH CHECK (public.is_superadmin(auth.uid()));

CREATE POLICY "Superadmin manages roles" ON public.user_roles
  FOR ALL TO authenticated
  USING (public.is_superadmin(auth.uid()))
  WITH CHECK (public.is_superadmin(auth.uid()));
