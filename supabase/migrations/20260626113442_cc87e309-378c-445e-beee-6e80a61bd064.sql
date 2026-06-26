
CREATE TABLE IF NOT EXISTS public.whatsapp_otp_codes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  institution text NOT NULL,
  identity_id uuid REFERENCES public.whatsapp_identities(id) ON DELETE CASCADE,
  patient_id uuid REFERENCES public.patients(id) ON DELETE CASCADE,
  contact_id uuid REFERENCES public.contacts(id) ON DELETE CASCADE,
  message_id uuid REFERENCES public.messages(id) ON DELETE SET NULL,
  template_id uuid REFERENCES public.message_templates(id) ON DELETE SET NULL,
  purpose text NOT NULL DEFAULT 'authentication',
  code_hash text NOT NULL,
  code_length int NOT NULL DEFAULT 6,
  otp_type text NOT NULL DEFAULT 'copy_code',
  status text NOT NULL DEFAULT 'pending',
  attempts int NOT NULL DEFAULT 0,
  max_attempts int NOT NULL DEFAULT 5,
  issued_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '10 minutes'),
  verified_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_otp_identity_status ON public.whatsapp_otp_codes(identity_id, status);
CREATE INDEX IF NOT EXISTS idx_otp_institution_status ON public.whatsapp_otp_codes(institution, status);
CREATE INDEX IF NOT EXISTS idx_otp_expires_at ON public.whatsapp_otp_codes(expires_at);

GRANT SELECT ON public.whatsapp_otp_codes TO authenticated;
GRANT ALL ON public.whatsapp_otp_codes TO service_role;

ALTER TABLE public.whatsapp_otp_codes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "otp_codes_select_by_institution"
ON public.whatsapp_otp_codes FOR SELECT TO authenticated
USING (
  public.has_role(auth.uid(), 'admin')
  OR institution = public.get_user_institution(auth.uid())
);

CREATE TRIGGER trg_otp_codes_updated_at
BEFORE UPDATE ON public.whatsapp_otp_codes
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
