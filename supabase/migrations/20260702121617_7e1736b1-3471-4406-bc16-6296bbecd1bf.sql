-- Idempotency at the DB level for webhook events
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'whatsapp_template_events_hash_unique'
  ) THEN
    ALTER TABLE public.whatsapp_template_events
      ADD CONSTRAINT whatsapp_template_events_hash_unique UNIQUE (payload_hash);
  END IF;
END $$;

-- Realtime for message_templates detail page
ALTER TABLE public.message_templates REPLICA IDENTITY FULL;
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'message_templates'
  ) THEN
    EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE public.message_templates';
  END IF;
END $$;