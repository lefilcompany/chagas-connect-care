ALTER TABLE public.content_library
  ADD COLUMN IF NOT EXISTS targeting_mode text NOT NULL DEFAULT 'all',
  ADD COLUMN IF NOT EXISTS audience_types text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS segment_id uuid,
  ADD COLUMN IF NOT EXISTS filters jsonb NOT NULL DEFAULT '{}'::jsonb;