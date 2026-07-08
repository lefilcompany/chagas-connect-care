-- Idempotency at the DB level for webhook events.
--
-- Alguns ambientes históricos possuem whatsapp_template_events, enquanto a
-- sequência completa de migrations do repositório não cria essa tabela em um
-- banco vazio. A constraint só pode ser aplicada quando a relação e a coluna
-- realmente existem. Não use ::regclass aqui: esse cast resolve a relação antes
-- da avaliação do IF e falha justamente quando a tabela é opcional.
DO $$
BEGIN
  IF EXISTS (
       SELECT 1
       FROM pg_class c
       JOIN pg_namespace n ON n.oid = c.relnamespace
       JOIN pg_attribute a ON a.attrelid = c.oid
       WHERE n.nspname = 'public'
         AND c.relname = 'whatsapp_template_events'
         AND c.relkind IN ('r', 'p')
         AND a.attname = 'payload_hash'
         AND a.attnum > 0
         AND NOT a.attisdropped
     )
     AND NOT EXISTS (
       SELECT 1
       FROM pg_constraint con
       JOIN pg_class c ON c.oid = con.conrelid
       JOIN pg_namespace n ON n.oid = c.relnamespace
       WHERE con.conname = 'whatsapp_template_events_hash_unique'
         AND n.nspname = 'public'
         AND c.relname = 'whatsapp_template_events'
     ) THEN
    EXECUTE '
      ALTER TABLE public.whatsapp_template_events
      ADD CONSTRAINT whatsapp_template_events_hash_unique UNIQUE (payload_hash)
    ';
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
