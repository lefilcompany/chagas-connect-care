
-- message_templates
CREATE TABLE public.message_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text NOT NULL DEFAULT '',
  category text NOT NULL DEFAULT 'geral',
  body text NOT NULL,
  variables jsonb NOT NULL DEFAULT '[]'::jsonb,
  targeting_mode text NOT NULL DEFAULT 'all',
  audience_types text[] NOT NULL DEFAULT '{}',
  segment_id uuid,
  filters jsonb NOT NULL DEFAULT '{}'::jsonb,
  channel text NOT NULL DEFAULT 'whatsapp',
  template_kind text NOT NULL DEFAULT 'internal',
  meta_template_name text,
  meta_template_id text,
  meta_language text NOT NULL DEFAULT 'pt_BR',
  meta_category text,
  meta_status text NOT NULL DEFAULT 'not_submitted',
  institution text NOT NULL DEFAULT '',
  created_by uuid,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.message_templates TO authenticated;
GRANT ALL ON public.message_templates TO service_role;

ALTER TABLE public.message_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Templates view in institution"
ON public.message_templates FOR SELECT TO authenticated
USING (
  has_role(auth.uid(), 'admin'::app_role)
  OR institution = get_user_institution(auth.uid())
  OR created_by = auth.uid()
);

CREATE POLICY "Templates insert"
ON public.message_templates FOR INSERT TO authenticated
WITH CHECK (
  auth.uid() IS NOT NULL
  AND created_by = auth.uid()
  AND (institution = get_user_institution(auth.uid()) OR institution = '')
);

CREATE POLICY "Templates update in institution"
ON public.message_templates FOR UPDATE TO authenticated
USING (
  has_role(auth.uid(), 'admin'::app_role)
  OR institution = get_user_institution(auth.uid())
  OR created_by = auth.uid()
);

CREATE POLICY "Templates delete owner or admin"
ON public.message_templates FOR DELETE TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role) OR created_by = auth.uid());

CREATE TRIGGER message_templates_updated_at
BEFORE UPDATE ON public.message_templates
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- message_batches
CREATE TABLE public.message_batches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id uuid,
  content_id uuid,
  name text NOT NULL DEFAULT '',
  body text NOT NULL DEFAULT '',
  targeting_mode text NOT NULL DEFAULT 'all',
  audience_types text[] NOT NULL DEFAULT '{}',
  segment_id uuid,
  filters jsonb NOT NULL DEFAULT '{}'::jsonb,
  channel text NOT NULL DEFAULT 'whatsapp',
  total_recipients integer NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'draft',
  institution text NOT NULL DEFAULT '',
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  started_at timestamptz,
  finished_at timestamptz,
  last_error text
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.message_batches TO authenticated;
GRANT ALL ON public.message_batches TO service_role;

ALTER TABLE public.message_batches ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Batches view in institution"
ON public.message_batches FOR SELECT TO authenticated
USING (
  has_role(auth.uid(), 'admin'::app_role)
  OR institution = get_user_institution(auth.uid())
  OR created_by = auth.uid()
);

CREATE POLICY "Batches insert"
ON public.message_batches FOR INSERT TO authenticated
WITH CHECK (
  auth.uid() IS NOT NULL
  AND created_by = auth.uid()
  AND (institution = get_user_institution(auth.uid()) OR institution = '')
);

CREATE POLICY "Batches update in institution"
ON public.message_batches FOR UPDATE TO authenticated
USING (
  has_role(auth.uid(), 'admin'::app_role)
  OR institution = get_user_institution(auth.uid())
  OR created_by = auth.uid()
);

CREATE POLICY "Batches delete owner or admin"
ON public.message_batches FOR DELETE TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role) OR created_by = auth.uid());

-- messages additions
ALTER TABLE public.messages
  ADD COLUMN IF NOT EXISTS template_id uuid,
  ADD COLUMN IF NOT EXISTS batch_id uuid;

CREATE INDEX IF NOT EXISTS messages_template_id_idx ON public.messages(template_id);
CREATE INDEX IF NOT EXISTS messages_batch_id_idx ON public.messages(batch_id);
