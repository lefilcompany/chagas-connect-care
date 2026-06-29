
ALTER TABLE public.whatsapp_identities
  DROP CONSTRAINT IF EXISTS whatsapp_identities_recipient_type_check;
ALTER TABLE public.whatsapp_identities
  ADD CONSTRAINT whatsapp_identities_recipient_type_check
  CHECK (recipient_type = ANY (ARRAY['patient'::text, 'contact'::text, 'unknown'::text]));

ALTER TABLE public.whatsapp_identities
  DROP CONSTRAINT IF EXISTS whatsapp_identities_check;
ALTER TABLE public.whatsapp_identities
  ADD CONSTRAINT whatsapp_identities_link_or_unknown_check
  CHECK (
    patient_id IS NOT NULL
    OR contact_id IS NOT NULL
    OR recipient_type = 'unknown'
  );
