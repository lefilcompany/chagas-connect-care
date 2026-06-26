
-- Updated-at helper
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$ LANGUAGE plpgsql SET search_path = public;

-- 1. messages: identity_id, institution; patient_id nullable
ALTER TABLE public.messages ADD COLUMN IF NOT EXISTS identity_id uuid REFERENCES public.whatsapp_identities(id) ON DELETE SET NULL;
ALTER TABLE public.messages ADD COLUMN IF NOT EXISTS institution text;
ALTER TABLE public.messages ALTER COLUMN patient_id DROP NOT NULL;
CREATE INDEX IF NOT EXISTS idx_messages_identity ON public.messages(identity_id);
CREATE INDEX IF NOT EXISTS idx_messages_institution_sent ON public.messages(institution, sent_at DESC);

UPDATE public.messages m SET institution = p.institution
FROM public.patients p
WHERE m.institution IS NULL AND m.patient_id = p.id;

-- 2. quick_replies
CREATE TABLE IF NOT EXISTS public.quick_replies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  institution text NOT NULL,
  label text NOT NULL,
  body text NOT NULL,
  category text NOT NULL DEFAULT 'geral',
  is_active boolean NOT NULL DEFAULT true,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.quick_replies TO authenticated;
GRANT ALL ON public.quick_replies TO service_role;
ALTER TABLE public.quick_replies ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "quick_replies_select_same_institution" ON public.quick_replies;
CREATE POLICY "quick_replies_select_same_institution" ON public.quick_replies
FOR SELECT TO authenticated
USING (institution = public.get_user_institution(auth.uid()));

DROP POLICY IF EXISTS "quick_replies_modify_same_institution" ON public.quick_replies;
CREATE POLICY "quick_replies_modify_same_institution" ON public.quick_replies
FOR ALL TO authenticated
USING (institution = public.get_user_institution(auth.uid()))
WITH CHECK (institution = public.get_user_institution(auth.uid()));

CREATE INDEX IF NOT EXISTS idx_quick_replies_inst_active ON public.quick_replies(institution, is_active);

DROP TRIGGER IF EXISTS trg_quick_replies_updated_at ON public.quick_replies;
CREATE TRIGGER trg_quick_replies_updated_at BEFORE UPDATE ON public.quick_replies
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 3. onboarding_invites
CREATE TABLE IF NOT EXISTS public.onboarding_invites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  token uuid NOT NULL UNIQUE DEFAULT gen_random_uuid(),
  institution text NOT NULL,
  wa_id text,
  phone text,
  intended_role text NOT NULL CHECK (intended_role IN ('paciente','familiar','cuidador')),
  patient_id uuid REFERENCES public.patients(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','completed','expired','revoked')),
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '7 days'),
  completed_at timestamptz,
  completed_payload jsonb,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.onboarding_invites TO authenticated;
GRANT ALL ON public.onboarding_invites TO service_role;
ALTER TABLE public.onboarding_invites ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "onboarding_invites_select_same_inst" ON public.onboarding_invites;
CREATE POLICY "onboarding_invites_select_same_inst" ON public.onboarding_invites
FOR SELECT TO authenticated
USING (institution = public.get_user_institution(auth.uid()));

DROP POLICY IF EXISTS "onboarding_invites_modify_same_inst" ON public.onboarding_invites;
CREATE POLICY "onboarding_invites_modify_same_inst" ON public.onboarding_invites
FOR ALL TO authenticated
USING (institution = public.get_user_institution(auth.uid()))
WITH CHECK (institution = public.get_user_institution(auth.uid()));

CREATE INDEX IF NOT EXISTS idx_onb_invites_status ON public.onboarding_invites(status, expires_at);
CREATE INDEX IF NOT EXISTS idx_onb_invites_inst ON public.onboarding_invites(institution);

DROP TRIGGER IF EXISTS trg_onb_invites_updated_at ON public.onboarding_invites;
CREATE TRIGGER trg_onb_invites_updated_at BEFORE UPDATE ON public.onboarding_invites
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 4. Realtime for whatsapp_conversations
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'whatsapp_conversations'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.whatsapp_conversations;
  END IF;
END $$;
ALTER TABLE public.whatsapp_conversations REPLICA IDENTITY FULL;
