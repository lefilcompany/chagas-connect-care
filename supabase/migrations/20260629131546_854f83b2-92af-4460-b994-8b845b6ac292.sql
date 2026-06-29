
ALTER TABLE public.whatsapp_identities
  DROP CONSTRAINT IF EXISTS whatsapp_identities_owner_check;
ALTER TABLE public.whatsapp_identities
  ADD CONSTRAINT whatsapp_identities_owner_check
  CHECK (
    patient_id IS NOT NULL
    OR contact_id IS NOT NULL
    OR recipient_type = 'unknown'
  );

WITH unmatched AS (
  SELECT DISTINCT wa_id, phone_e164
  FROM public.whatsapp_unmatched_events
  WHERE status = 'pending' AND wa_id IS NOT NULL AND created_at > '2026-06-29'
)
INSERT INTO public.whatsapp_identities (institution, wa_id, phone_e164, recipient_type, opt_in_status)
SELECT 'Instituição Teste', u.wa_id, u.phone_e164, 'unknown', 'pending'
FROM unmatched u
WHERE NOT EXISTS (SELECT 1 FROM public.whatsapp_identities i WHERE i.wa_id = u.wa_id)
ON CONFLICT DO NOTHING;

INSERT INTO public.messages (
  identity_id, institution, channel, direction, body, status,
  external_message_id, provider, sent_at, raw_message_type
)
SELECT i.id, i.institution, 'whatsapp', 'inbound',
  COALESCE(NULLIF(e.payload->'text'->>'body', ''), '[mensagem sem texto]'),
  'received', e.external_message_id, 'meta_whatsapp_cloud', e.received_at,
  COALESCE(e.payload->>'type', 'text')
FROM public.whatsapp_unmatched_events e
JOIN public.whatsapp_identities i ON i.wa_id = e.wa_id
WHERE e.status = 'pending' AND e.created_at > '2026-06-29'
  AND NOT EXISTS (
    SELECT 1 FROM public.messages m
    WHERE m.external_message_id = e.external_message_id AND m.direction = 'inbound'
  );

INSERT INTO public.whatsapp_conversations (identity_id, institution, last_inbound_at, last_message_at, service_window_expires_at, status)
SELECT i.id, i.institution, now(), now(), now() + interval '24 hours', 'active'
FROM public.whatsapp_identities i
WHERE i.recipient_type = 'unknown' AND i.created_at > '2026-06-29'
ON CONFLICT (identity_id) DO UPDATE
SET last_inbound_at = EXCLUDED.last_inbound_at,
    last_message_at = EXCLUDED.last_message_at,
    service_window_expires_at = EXCLUDED.service_window_expires_at,
    status = 'active';

UPDATE public.whatsapp_unmatched_events e
SET status = 'linked', linked_identity_id = i.id, institution = i.institution, updated_at = now()
FROM public.whatsapp_identities i
WHERE i.wa_id = e.wa_id AND e.status = 'pending' AND e.created_at > '2026-06-29';
