
CREATE TABLE public.audience_segments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text NOT NULL DEFAULT '',
  audience_types text[] NOT NULL DEFAULT '{}',
  filters jsonb NOT NULL DEFAULT '{}'::jsonb,
  owner_id uuid,
  institution text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.audience_segments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Segments view in institution"
  ON public.audience_segments FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin')
    OR institution = public.get_user_institution(auth.uid())
    OR owner_id = auth.uid()
  );

CREATE POLICY "Segments insert"
  ON public.audience_segments FOR INSERT TO authenticated
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Segments update in institution"
  ON public.audience_segments FOR UPDATE TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin')
    OR institution = public.get_user_institution(auth.uid())
    OR owner_id = auth.uid()
  );

CREATE POLICY "Segments delete owner or admin"
  ON public.audience_segments FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR owner_id = auth.uid());

CREATE TRIGGER audience_segments_updated_at
  BEFORE UPDATE ON public.audience_segments
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
