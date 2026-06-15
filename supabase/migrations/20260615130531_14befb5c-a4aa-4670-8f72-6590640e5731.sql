
CREATE TABLE public.content_folders (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  institution text NOT NULL,
  slug text NOT NULL,
  label text NOT NULL,
  description text NOT NULL DEFAULT '',
  icon text NOT NULL DEFAULT 'FolderOpen',
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (institution, slug)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.content_folders TO authenticated;
GRANT ALL ON public.content_folders TO service_role;

ALTER TABLE public.content_folders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can view folders in their institution"
ON public.content_folders FOR SELECT TO authenticated
USING (institution = public.get_user_institution(auth.uid()) OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Members can create folders in their institution"
ON public.content_folders FOR INSERT TO authenticated
WITH CHECK (institution = public.get_user_institution(auth.uid()) OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Members can update folders in their institution"
ON public.content_folders FOR UPDATE TO authenticated
USING (institution = public.get_user_institution(auth.uid()) OR public.has_role(auth.uid(), 'admin'))
WITH CHECK (institution = public.get_user_institution(auth.uid()) OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Members can delete folders in their institution"
ON public.content_folders FOR DELETE TO authenticated
USING (institution = public.get_user_institution(auth.uid()) OR public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER content_folders_set_updated_at
BEFORE UPDATE ON public.content_folders
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
