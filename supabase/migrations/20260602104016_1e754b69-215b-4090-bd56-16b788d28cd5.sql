
-- 1. Restrict CRM sync log reads to admins
DROP POLICY IF EXISTS "CRM log read" ON public.crm_sync_log;
CREATE POLICY "CRM log admin read" ON public.crm_sync_log
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS "CRM log insert" ON public.crm_sync_log;
CREATE POLICY "CRM log admin insert" ON public.crm_sync_log
  FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

-- 2. Restrict patients INSERT to user's institution
DROP POLICY IF EXISTS "Insert patients" ON public.patients;
CREATE POLICY "Insert patients" ON public.patients
  FOR INSERT TO authenticated
  WITH CHECK (
    auth.uid() IS NOT NULL
    AND owner_id = auth.uid()
    AND (
      institution = public.get_user_institution(auth.uid())
      OR institution = ''
    )
  );

-- 3. Restrict audience_segments INSERT to user's institution + owner
DROP POLICY IF EXISTS "Segments insert" ON public.audience_segments;
CREATE POLICY "Segments insert" ON public.audience_segments
  FOR INSERT TO authenticated
  WITH CHECK (
    auth.uid() IS NOT NULL
    AND owner_id = auth.uid()
    AND (
      institution = public.get_user_institution(auth.uid())
      OR institution = ''
    )
  );

-- 4. Remove broad content_library insert policy (admin-only via existing ALL policy)
DROP POLICY IF EXISTS "Content authenticated insert" ON public.content_library;
