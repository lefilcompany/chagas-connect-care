-- Store raw inbound payload so unmatched events can be reprocessed with full content.
ALTER TABLE public.whatsapp_unmatched_events
  ADD COLUMN IF NOT EXISTS payload jsonb;

-- Backfill the two recently-reprocessed "Olá" inbound messages whose text was lost
-- because the previous unmatched_events row didn't keep the raw payload.
UPDATE public.messages
SET body = 'Olá'
WHERE direction = 'inbound'
  AND raw_message_type = 'text'
  AND body = '💬 Mensagem recebida (sem texto)'
  AND external_message_id IN (
    'wamid.HBgMNTU4MTkyNzAxNTczFQIAEhgWM0VCMDc0MDdDMTlCNDVGNEFFOEJFMgA=',
    'wamid.HBgMNTU4MTkyNzAxNTczFQIAEhgWM0VCMEUxMURGRjE4NUE4QjA1ODM3RAA='
  );