INSERT INTO public.messages (
  patient_id, identity_id, institution, contact_id, channel, direction,
  body, status, external_message_id, provider, sent_at, raw_message_type
)
SELECT
  i.patient_id, i.id, i.institution, i.contact_id, 'whatsapp', 'inbound',
  'Certo', 'received',
  'wamid.HBgMNTU4MTkyNzAxNTczFQIAEhgWM0VCMDU0MjcwQUY2M0VEQjgwRjlEMQA=',
  'meta_whatsapp_cloud', to_timestamp(1782487630), 'text'
FROM public.whatsapp_identities i
WHERE i.id = '3584c97a-3999-4d37-b19e-bb6206b6de2b'
ON CONFLICT DO NOTHING;

UPDATE public.whatsapp_unmatched_events
   SET status = 'linked', linked_identity_id = '3584c97a-3999-4d37-b19e-bb6206b6de2b',
       institution = 'Instituição Teste', updated_at = now()
 WHERE external_message_id = 'wamid.HBgMNTU4MTkyNzAxNTczFQIAEhgWM0VCMDU0MjcwQUY2M0VEQjgwRjlEMQA=';