
CREATE TABLE IF NOT EXISTS public.whatsapp_channels (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  institution text NOT NULL,
  phone_number_id text,
  waba_id text,
  display_phone_number text,
  display_name text,
  mode text NOT NULL DEFAULT 'shared',
  quality_rating text,
  status text NOT NULL DEFAULT 'unknown',
  last_webhook_at timestamptz,
  last_synced_at timestamptz,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT whatsapp_channels_mode_check CHECK (mode IN ('shared','dedicated')),
  CONSTRAINT whatsapp_channels_unique UNIQUE (institution, phone_number_id)
);

CREATE INDEX IF NOT EXISTS whatsapp_channels_phone_number_id_idx
  ON public.whatsapp_channels (phone_number_id);
CREATE INDEX IF NOT EXISTS whatsapp_channels_institution_idx
  ON public.whatsapp_channels (institution);

GRANT SELECT ON public.whatsapp_channels TO authenticated;
GRANT ALL ON public.whatsapp_channels TO service_role;

ALTER TABLE public.whatsapp_channels ENABLE ROW LEVEL SECURITY;

CREATE POLICY "whatsapp_channels select same institution or admin"
  ON public.whatsapp_channels FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin'::app_role)
    OR institution = public.get_user_institution(auth.uid())
  );

CREATE POLICY "whatsapp_channels insert admin only"
  ON public.whatsapp_channels FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "whatsapp_channels update admin only"
  ON public.whatsapp_channels FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "whatsapp_channels delete admin only"
  ON public.whatsapp_channels FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role));

DROP TRIGGER IF EXISTS whatsapp_channels_set_updated_at ON public.whatsapp_channels;
CREATE TRIGGER whatsapp_channels_set_updated_at
  BEFORE UPDATE ON public.whatsapp_channels
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Backfill: one 'shared' channel per known institution, without storing tokens.
INSERT INTO public.whatsapp_channels (institution, mode, status, notes)
SELECT DISTINCT institution, 'shared', 'unknown',
  'Canal compartilhado criado automaticamente. Configure phone_number_id/waba_id em Configurações > WhatsApp.'
FROM (
  SELECT institution FROM public.profiles WHERE institution IS NOT NULL AND institution <> ''
  UNION
  SELECT institution FROM public.patients WHERE institution IS NOT NULL AND institution <> ''
) AS s
ON CONFLICT (institution, phone_number_id) DO NOTHING;
