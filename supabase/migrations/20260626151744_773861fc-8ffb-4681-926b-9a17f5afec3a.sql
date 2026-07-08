-- Backfill pending whatsapp_unmatched_events for phone 558192701573 (Emanuel Rodrigues, Instituição Teste)
--
-- Esta migration também precisa ser segura quando o banco é reconstruído do
-- zero. O paciente referenciado é dado operacional e pode não existir em um
-- ambiente novo. Nesse caso, nenhuma identidade ou vínculo deve ser criado e o
-- evento permanece pendente para resolução posterior.

-- 1. Create identity only when the referenced patient exists in the institution.
INSERT INTO public.whatsapp_identities (
  institution,
  phone_e164,
  wa_id,
  recipient_type,
  opt_in_status,
  patient_id,
  is_active
)
SELECT
  p.institution,
  '558192701573',
  '558192701573',
  'patient',
  'opted_in',
  p.id,
  true
FROM public.patients p
WHERE p.id = '6043d793-2892-4c4a-87d5-ded68d217714'::uuid
  AND p.institution = 'Instituição Teste'
  AND NOT EXISTS (
    SELECT 1
    FROM public.whatsapp_identities wi
    WHERE wi.institution = p.institution
      AND wi.phone_e164 = '558192701573'
  );

-- 2. Insert inbound messages from unmatched events only when identity exists.
WITH ident AS (
  SELECT id, institution, patient_id
    FROM public.whatsapp_identities
   WHERE institution = 'Instituição Teste'
     AND phone_e164 = '558192701573'
   LIMIT 1
)
INSERT INTO public.messages (
  patient_id,
  identity_id,
  institution,
  channel,
  direction,
  body,
  status,
  external_message_id,
  provider,
  sent_at,
  raw_message_type
)
SELECT
  ident.patient_id,
  ident.id,
  ident.institution,
  'whatsapp',
  'inbound',
  '[mensagem sem texto]',
  'received',
  u.external_message_id,
  'meta_whatsapp_cloud',
  u.received_at,
  'text'
FROM public.whatsapp_unmatched_events u
CROSS JOIN ident
WHERE u.phone_e164 = '558192701573'
  AND u.status = 'pending'
  AND NOT EXISTS (
    SELECT 1
    FROM public.messages m
    WHERE m.external_message_id = u.external_message_id
      AND m.direction = 'inbound'
  );

-- 3. Open / refresh the service window only when identity exists.
INSERT INTO public.whatsapp_conversations (
  identity_id,
  institution,
  patient_id,
  last_inbound_at,
  last_message_at,
  service_window_expires_at,
  status
)
SELECT
  id,
  institution,
  patient_id,
  now(),
  now(),
  now() + interval '24 hours',
  'active'
FROM public.whatsapp_identities
WHERE institution = 'Instituição Teste'
  AND phone_e164 = '558192701573'
ON CONFLICT (identity_id) DO UPDATE
   SET last_inbound_at = EXCLUDED.last_inbound_at,
       last_message_at = EXCLUDED.last_message_at,
       service_window_expires_at = EXCLUDED.service_window_expires_at,
       status = 'active';

-- 4. Mark events as linked only when a valid identity was created/found.
WITH ident AS (
  SELECT id
  FROM public.whatsapp_identities
  WHERE institution = 'Instituição Teste'
    AND phone_e164 = '558192701573'
  LIMIT 1
)
UPDATE public.whatsapp_unmatched_events u
   SET status = 'linked',
       institution = 'Instituição Teste',
       linked_identity_id = ident.id,
       updated_at = now()
  FROM ident
 WHERE u.phone_e164 = '558192701573'
   AND u.status = 'pending';

-- 5. Also link the older orphan inbound message (institution 'lefil', no identity) so the inbox shows it.
-- Skipped: belongs to a different institution and patient (Samuel Muniz | LeFil).
