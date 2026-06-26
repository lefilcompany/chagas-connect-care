
-- =========================================================================
-- WhatsApp evolution: identities, conversations, opt-in, idempotency,
-- interactive replies, parameter order, window helper.
-- All new tables are institution-scoped via RLS using existing helpers.
-- =========================================================================

-- ---------- whatsapp_identities ------------------------------------------
CREATE TABLE IF NOT EXISTS public.whatsapp_identities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  institution text NOT NULL,
  patient_id uuid REFERENCES public.patients(id) ON DELETE CASCADE,
  contact_id uuid REFERENCES public.contacts(id) ON DELETE CASCADE,
  recipient_type text NOT NULL DEFAULT 'patient'
    CHECK (recipient_type IN ('patient','contact')),
  phone_e164 text NOT NULL,
  wa_id text,
  display_name text,
  is_active boolean NOT NULL DEFAULT true,
  opt_in_status text NOT NULL DEFAULT 'pending'
    CHECK (opt_in_status IN ('pending','opted_in','opted_out','revoked')),
  opt_in_at timestamptz,
  opt_in_source text,
  opt_in_notice_version text,
  allowed_purposes text[] NOT NULL DEFAULT '{}',
  opt_out_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT whatsapp_identities_owner_check
    CHECK ((patient_id IS NOT NULL) OR (contact_id IS NOT NULL))
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.whatsapp_identities TO authenticated;
GRANT ALL ON public.whatsapp_identities TO service_role;

CREATE UNIQUE INDEX IF NOT EXISTS whatsapp_identities_inst_wa_uniq
  ON public.whatsapp_identities (institution, wa_id) WHERE wa_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS whatsapp_identities_inst_phone_uniq
  ON public.whatsapp_identities (institution, phone_e164);
CREATE UNIQUE INDEX IF NOT EXISTS whatsapp_identities_global_wa_uniq
  ON public.whatsapp_identities (wa_id) WHERE wa_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS whatsapp_identities_global_phone_uniq
  ON public.whatsapp_identities (phone_e164);
CREATE INDEX IF NOT EXISTS whatsapp_identities_patient_idx
  ON public.whatsapp_identities (patient_id);
CREATE INDEX IF NOT EXISTS whatsapp_identities_contact_idx
  ON public.whatsapp_identities (contact_id);

ALTER TABLE public.whatsapp_identities ENABLE ROW LEVEL SECURITY;

CREATE POLICY "WA identities select in institution"
  ON public.whatsapp_identities FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin'::app_role)
    OR (institution = public.get_user_institution(auth.uid()) AND institution <> '')
  );
CREATE POLICY "WA identities insert in institution"
  ON public.whatsapp_identities FOR INSERT TO authenticated
  WITH CHECK (
    public.has_role(auth.uid(), 'admin'::app_role)
    OR (institution = public.get_user_institution(auth.uid()) AND institution <> '')
  );
CREATE POLICY "WA identities update in institution"
  ON public.whatsapp_identities FOR UPDATE TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin'::app_role)
    OR (institution = public.get_user_institution(auth.uid()) AND institution <> '')
  )
  WITH CHECK (
    public.has_role(auth.uid(), 'admin'::app_role)
    OR (institution = public.get_user_institution(auth.uid()) AND institution <> '')
  );
CREATE POLICY "WA identities delete in institution"
  ON public.whatsapp_identities FOR DELETE TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin'::app_role)
    OR (institution = public.get_user_institution(auth.uid()) AND institution <> '')
  );

CREATE TRIGGER whatsapp_identities_updated_at
  BEFORE UPDATE ON public.whatsapp_identities
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ---------- whatsapp_conversations ---------------------------------------
CREATE TABLE IF NOT EXISTS public.whatsapp_conversations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  institution text NOT NULL,
  identity_id uuid NOT NULL REFERENCES public.whatsapp_identities(id) ON DELETE CASCADE,
  patient_id uuid REFERENCES public.patients(id) ON DELETE SET NULL,
  contact_id uuid REFERENCES public.contacts(id) ON DELETE SET NULL,
  last_inbound_at timestamptz,
  service_window_expires_at timestamptz,
  last_outbound_at timestamptz,
  last_message_at timestamptz,
  status text NOT NULL DEFAULT 'idle',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.whatsapp_conversations TO authenticated;
GRANT ALL ON public.whatsapp_conversations TO service_role;

CREATE UNIQUE INDEX IF NOT EXISTS whatsapp_conversations_identity_uniq
  ON public.whatsapp_conversations (identity_id);
CREATE INDEX IF NOT EXISTS whatsapp_conversations_inst_idx
  ON public.whatsapp_conversations (institution);

ALTER TABLE public.whatsapp_conversations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "WA conversations select in institution"
  ON public.whatsapp_conversations FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin'::app_role)
    OR (institution = public.get_user_institution(auth.uid()) AND institution <> '')
  );
CREATE POLICY "WA conversations modify in institution"
  ON public.whatsapp_conversations FOR ALL TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin'::app_role)
    OR (institution = public.get_user_institution(auth.uid()) AND institution <> '')
  )
  WITH CHECK (
    public.has_role(auth.uid(), 'admin'::app_role)
    OR (institution = public.get_user_institution(auth.uid()) AND institution <> '')
  );

CREATE TRIGGER whatsapp_conversations_updated_at
  BEFORE UPDATE ON public.whatsapp_conversations
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ---------- whatsapp_unmatched_events ------------------------------------
CREATE TABLE IF NOT EXISTS public.whatsapp_unmatched_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  institution text,
  external_message_id text,
  wa_id text,
  phone_e164 text,
  event_type text NOT NULL DEFAULT 'inbound',
  received_at timestamptz NOT NULL DEFAULT now(),
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending','linked','ignored')),
  linked_identity_id uuid REFERENCES public.whatsapp_identities(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.whatsapp_unmatched_events TO authenticated;
GRANT ALL ON public.whatsapp_unmatched_events TO service_role;

CREATE INDEX IF NOT EXISTS whatsapp_unmatched_status_idx
  ON public.whatsapp_unmatched_events (status, received_at DESC);

ALTER TABLE public.whatsapp_unmatched_events ENABLE ROW LEVEL SECURITY;

-- Admins triage globally; institution users see only their own (or unassigned).
CREATE POLICY "WA unmatched select"
  ON public.whatsapp_unmatched_events FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin'::app_role)
    OR institution IS NULL
    OR (institution = public.get_user_institution(auth.uid()) AND institution <> '')
  );
CREATE POLICY "WA unmatched modify"
  ON public.whatsapp_unmatched_events FOR ALL TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin'::app_role)
    OR (institution = public.get_user_institution(auth.uid()) AND institution <> '')
  )
  WITH CHECK (
    public.has_role(auth.uid(), 'admin'::app_role)
    OR (institution = public.get_user_institution(auth.uid()) AND institution <> '')
  );

CREATE TRIGGER whatsapp_unmatched_updated_at
  BEFORE UPDATE ON public.whatsapp_unmatched_events
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ---------- contacts: authorization fields -------------------------------
ALTER TABLE public.contacts
  ADD COLUMN IF NOT EXISTS authorization_status text NOT NULL DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS authorization_scope text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS authorized_at timestamptz,
  ADD COLUMN IF NOT EXISTS authorized_by uuid,
  ADD COLUMN IF NOT EXISTS revoked_at timestamptz;

-- ---------- message_templates: parameter order, sync ----------------------
ALTER TABLE public.message_templates
  ADD COLUMN IF NOT EXISTS meta_parameter_order jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS rejection_reason text,
  ADD COLUMN IF NOT EXISTS last_synced_at timestamptz;

-- ---------- messages: interactive replies + idempotency ------------------
ALTER TABLE public.messages
  ADD COLUMN IF NOT EXISTS interaction_type text,
  ADD COLUMN IF NOT EXISTS interaction_id text,
  ADD COLUMN IF NOT EXISTS interaction_title text,
  ADD COLUMN IF NOT EXISTS raw_message_type text;

-- Idempotency: inbound external IDs must be unique. Outbound may share NULL
-- before Meta responds; once set we still want one row per ID.
CREATE UNIQUE INDEX IF NOT EXISTS messages_inbound_external_uniq
  ON public.messages (external_message_id)
  WHERE external_message_id IS NOT NULL AND direction = 'inbound';

-- ---------- helper: is the 24h service window open? ----------------------
CREATE OR REPLACE FUNCTION public.whatsapp_window_open(_identity_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    (SELECT service_window_expires_at > now()
       FROM public.whatsapp_conversations
      WHERE identity_id = _identity_id
      LIMIT 1),
    false
  );
$$;
