ALTER TABLE public.messages
  ADD COLUMN IF NOT EXISTS external_message_id text,
  ADD COLUMN IF NOT EXISTS provider text DEFAULT 'meta_whatsapp_cloud',
  ADD COLUMN IF NOT EXISTS message_type text DEFAULT 'manual',
  ADD COLUMN IF NOT EXISTS template_name text,
  ADD COLUMN IF NOT EXISTS template_variables jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS queued_at timestamptz,
  ADD COLUMN IF NOT EXISTS delivered_at timestamptz,
  ADD COLUMN IF NOT EXISTS read_at timestamptz,
  ADD COLUMN IF NOT EXISTS failed_at timestamptz,
  ADD COLUMN IF NOT EXISTS last_error text,
  ADD COLUMN IF NOT EXISTS send_attempts integer NOT NULL DEFAULT 0;

CREATE INDEX IF NOT EXISTS messages_external_message_id_idx
  ON public.messages (external_message_id);
