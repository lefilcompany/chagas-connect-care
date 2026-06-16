
-- 1. profiles: add WITH CHECK preventing self-change of institution (already enforced by trigger, but defence-in-depth)
DROP POLICY IF EXISTS "Users update own profile" ON public.profiles;
CREATE POLICY "Users update own profile" ON public.profiles
FOR UPDATE TO authenticated
USING (id = auth.uid())
WITH CHECK (id = auth.uid() AND institution = public.get_user_institution(auth.uid()));

-- 2. patients update policy → TO authenticated
DROP POLICY IF EXISTS "Update patients in institution" ON public.patients;
CREATE POLICY "Update patients in institution" ON public.patients
FOR UPDATE TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role) OR (institution = get_user_institution(auth.uid())) OR (owner_id = auth.uid()))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR (((institution = get_user_institution(auth.uid())) OR (institution = ''::text)) AND ((owner_id = auth.uid()) OR (institution = get_user_institution(auth.uid())))));

-- 3. audience_segments
DROP POLICY IF EXISTS "Segments update in institution" ON public.audience_segments;
CREATE POLICY "Segments update in institution" ON public.audience_segments
FOR UPDATE TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role) OR (institution = get_user_institution(auth.uid())) OR (owner_id = auth.uid()))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR (((institution = get_user_institution(auth.uid())) OR (institution = ''::text)) AND ((owner_id = auth.uid()) OR (institution = get_user_institution(auth.uid())))));

-- 4. message_batches
DROP POLICY IF EXISTS "Batches update in institution" ON public.message_batches;
CREATE POLICY "Batches update in institution" ON public.message_batches
FOR UPDATE TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role) OR (institution = get_user_institution(auth.uid())) OR (created_by = auth.uid()))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR (((institution = get_user_institution(auth.uid())) OR (institution = ''::text)) AND ((created_by = auth.uid()) OR (institution = get_user_institution(auth.uid())))));

-- 5. message_templates
DROP POLICY IF EXISTS "Templates update in institution" ON public.message_templates;
CREATE POLICY "Templates update in institution" ON public.message_templates
FOR UPDATE TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role) OR ((is_default = false) AND ((institution = get_user_institution(auth.uid())) OR (created_by = auth.uid()))))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR ((is_default = false) AND ((institution = get_user_institution(auth.uid())) OR (institution = ''::text)) AND ((created_by = auth.uid()) OR (institution = get_user_institution(auth.uid())))));
