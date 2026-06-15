
DROP POLICY IF EXISTS "Update patients in institution" ON public.patients;
CREATE POLICY "Update patients in institution" ON public.patients
FOR UPDATE
USING (has_role(auth.uid(), 'admin'::app_role) OR (institution = get_user_institution(auth.uid())) OR (owner_id = auth.uid()))
WITH CHECK (
  has_role(auth.uid(), 'admin'::app_role)
  OR (
    ((institution = get_user_institution(auth.uid())) OR (institution = ''))
    AND (owner_id = auth.uid() OR institution = get_user_institution(auth.uid()))
  )
);

DROP POLICY IF EXISTS "Segments update in institution" ON public.audience_segments;
CREATE POLICY "Segments update in institution" ON public.audience_segments
FOR UPDATE
USING (has_role(auth.uid(), 'admin'::app_role) OR (institution = get_user_institution(auth.uid())) OR (owner_id = auth.uid()))
WITH CHECK (
  has_role(auth.uid(), 'admin'::app_role)
  OR (
    ((institution = get_user_institution(auth.uid())) OR (institution = ''))
    AND (owner_id = auth.uid() OR institution = get_user_institution(auth.uid()))
  )
);

DROP POLICY IF EXISTS "Batches update in institution" ON public.message_batches;
CREATE POLICY "Batches update in institution" ON public.message_batches
FOR UPDATE
USING (has_role(auth.uid(), 'admin'::app_role) OR (institution = get_user_institution(auth.uid())) OR (created_by = auth.uid()))
WITH CHECK (
  has_role(auth.uid(), 'admin'::app_role)
  OR (
    ((institution = get_user_institution(auth.uid())) OR (institution = ''))
    AND (created_by = auth.uid() OR institution = get_user_institution(auth.uid()))
  )
);

DROP POLICY IF EXISTS "Templates update in institution" ON public.message_templates;
CREATE POLICY "Templates update in institution" ON public.message_templates
FOR UPDATE
USING (has_role(auth.uid(), 'admin'::app_role) OR ((is_default = false) AND ((institution = get_user_institution(auth.uid())) OR (created_by = auth.uid()))))
WITH CHECK (
  has_role(auth.uid(), 'admin'::app_role)
  OR (
    (is_default = false)
    AND ((institution = get_user_institution(auth.uid())) OR (institution = ''))
    AND (created_by = auth.uid() OR institution = get_user_institution(auth.uid()))
  )
);
