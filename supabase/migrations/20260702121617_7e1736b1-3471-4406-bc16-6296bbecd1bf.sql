-- Idempotency at the DB level for webhook events.
--
-- Alguns ambientes históricos possuem whatsapp_template_events, enquanto a
-- sequência completa de migrations do repositório não cria essa tabela em um
-- banco vazio. A constraint só pode ser aplicada quando a relação e a coluna
-- realmente existem.
DO $$
BEGIN
  IF to_regclass('public.whatsapp_template_events') IS NOT NULL
     AND EXISTS (
       SELECT 1
       FROM information_schema.columns
       WHERE table_schema = 'public'
         AND table_name = 'whatsapp_template_events'
         AND column_name = 'payload_hash'
     )
     AND NOT EXISTS (
       SELECT 1
       FROM pg_constraint
       WHERE conname = 'whatsapp_template_events_hash_unique'
         AND conrelid = 'public.whatsapp_template_events'::regclass
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
