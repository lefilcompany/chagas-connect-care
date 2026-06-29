
-- 1) Índices em whatsapp_channels
CREATE UNIQUE INDEX IF NOT EXISTS whatsapp_channels_phone_number_id_unique
  ON public.whatsapp_channels (phone_number_id)
  WHERE phone_number_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS whatsapp_channels_institution_idx
  ON public.whatsapp_channels (institution);

-- 2) Coluna para teste interno
ALTER TABLE public.whatsapp_channels
  ADD COLUMN IF NOT EXISTS last_internal_test_at timestamptz;

-- 3) Tabela de auditoria do webhook
CREATE TABLE IF NOT EXISTS public.whatsapp_webhook_activity (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  channel_id uuid NULL REFERENCES public.whatsapp_channels(id) ON DELETE SET NULL,
  institution text NULL,
  phone_number_id text NULL,
  event_type text NOT NULL,
  source text NOT NULL DEFAULT 'meta',
  received_at timestamptz NOT NULL DEFAULT now(),
  processed boolean NOT NULL DEFAULT false,
  error_code text NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS whatsapp_webhook_activity_institution_idx
  ON public.whatsapp_webhook_activity (institution, received_at DESC);
CREATE INDEX IF NOT EXISTS whatsapp_webhook_activity_channel_idx
  ON public.whatsapp_webhook_activity (channel_id, received_at DESC);

GRANT SELECT ON public.whatsapp_webhook_activity TO authenticated;
GRANT ALL ON public.whatsapp_webhook_activity TO service_role;

ALTER TABLE public.whatsapp_webhook_activity ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "wha_activity_admin_select" ON public.whatsapp_webhook_activity;
CREATE POLICY "wha_activity_admin_select"
  ON public.whatsapp_webhook_activity
  FOR SELECT
  TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin'::app_role)
    AND institution = public.get_user_institution(auth.uid())
  );
