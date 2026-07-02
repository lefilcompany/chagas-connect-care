
DROP POLICY IF EXISTS "Templates insert" ON public.message_templates;
CREATE POLICY "Templates insert admin only" ON public.message_templates
FOR INSERT TO authenticated
WITH CHECK (
  public.has_role(auth.uid(), 'admin'::app_role)
  AND is_default = false
  AND institution = public.get_user_institution(auth.uid())
  AND public.get_user_institution(auth.uid()) <> ''
  AND (created_by = auth.uid() OR created_by IS NULL)
);

DROP POLICY IF EXISTS "Templates update in institution" ON public.message_templates;
DROP POLICY IF EXISTS "Templates update admin only" ON public.message_templates;
CREATE POLICY "Templates update admin only" ON public.message_templates
FOR UPDATE TO authenticated
USING (
  public.has_role(auth.uid(), 'admin'::app_role)
  AND is_default = false
  AND institution = public.get_user_institution(auth.uid())
  AND public.get_user_institution(auth.uid()) <> ''
)
WITH CHECK (
  public.has_role(auth.uid(), 'admin'::app_role)
  AND is_default = false
  AND institution = public.get_user_institution(auth.uid())
  AND public.get_user_institution(auth.uid()) <> ''
);
