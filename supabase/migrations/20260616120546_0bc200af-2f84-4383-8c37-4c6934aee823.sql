
-- ===== Remove "institution = ''" loophole on INSERT/UPDATE for tenant tables =====

-- patients
DROP POLICY IF EXISTS "Insert patients" ON public.patients;
CREATE POLICY "Insert patients" ON public.patients
FOR INSERT TO authenticated
WITH CHECK (
  has_role(auth.uid(), 'admin'::app_role)
  OR (
    institution = get_user_institution(auth.uid())
    AND get_user_institution(auth.uid()) <> ''
    AND (owner_id = auth.uid() OR owner_id IS NULL)
  )
);

DROP POLICY IF EXISTS "Update patients in institution" ON public.patients;
CREATE POLICY "Update patients in institution" ON public.patients
FOR UPDATE TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role) OR (institution = get_user_institution(auth.uid()) AND institution <> '') OR (owner_id = auth.uid()))
WITH CHECK (
  has_role(auth.uid(), 'admin'::app_role)
  OR (
    institution = get_user_institution(auth.uid())
    AND get_user_institution(auth.uid()) <> ''
    AND (owner_id = auth.uid() OR owner_id IS NULL OR institution = get_user_institution(auth.uid()))
  )
);

-- audience_segments
DROP POLICY IF EXISTS "Segments insert" ON public.audience_segments;
CREATE POLICY "Segments insert" ON public.audience_segments
FOR INSERT TO authenticated
WITH CHECK (
  has_role(auth.uid(), 'admin'::app_role)
  OR (
    institution = get_user_institution(auth.uid())
    AND get_user_institution(auth.uid()) <> ''
    AND (owner_id = auth.uid() OR owner_id IS NULL)
  )
);

DROP POLICY IF EXISTS "Segments update in institution" ON public.audience_segments;
CREATE POLICY "Segments update in institution" ON public.audience_segments
FOR UPDATE TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role) OR (institution = get_user_institution(auth.uid()) AND institution <> '') OR (owner_id = auth.uid()))
WITH CHECK (
  has_role(auth.uid(), 'admin'::app_role)
  OR (
    institution = get_user_institution(auth.uid())
    AND get_user_institution(auth.uid()) <> ''
  )
);

-- message_batches
DROP POLICY IF EXISTS "Batches insert" ON public.message_batches;
CREATE POLICY "Batches insert" ON public.message_batches
FOR INSERT TO authenticated
WITH CHECK (
  has_role(auth.uid(), 'admin'::app_role)
  OR (
    institution = get_user_institution(auth.uid())
    AND get_user_institution(auth.uid()) <> ''
    AND (created_by = auth.uid() OR created_by IS NULL)
  )
);

DROP POLICY IF EXISTS "Batches update in institution" ON public.message_batches;
CREATE POLICY "Batches update in institution" ON public.message_batches
FOR UPDATE TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role) OR (institution = get_user_institution(auth.uid()) AND institution <> '') OR (created_by = auth.uid()))
WITH CHECK (
  has_role(auth.uid(), 'admin'::app_role)
  OR (
    institution = get_user_institution(auth.uid())
    AND get_user_institution(auth.uid()) <> ''
  )
);

-- message_templates
DROP POLICY IF EXISTS "Templates insert" ON public.message_templates;
CREATE POLICY "Templates insert" ON public.message_templates
FOR INSERT TO authenticated
WITH CHECK (
  has_role(auth.uid(), 'admin'::app_role)
  OR (
    is_default = false
    AND institution = get_user_institution(auth.uid())
    AND get_user_institution(auth.uid()) <> ''
    AND (created_by = auth.uid() OR created_by IS NULL)
  )
);

DROP POLICY IF EXISTS "Templates update in institution" ON public.message_templates;
CREATE POLICY "Templates update in institution" ON public.message_templates
FOR UPDATE TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role) OR ((is_default = false) AND ((institution = get_user_institution(auth.uid()) AND institution <> '') OR (created_by = auth.uid()))))
WITH CHECK (
  has_role(auth.uid(), 'admin'::app_role)
  OR (
    is_default = false
    AND institution = get_user_institution(auth.uid())
    AND get_user_institution(auth.uid()) <> ''
  )
);

-- ===== Restrict Realtime channel subscriptions to authenticated users only =====
-- Without this, anonymous JWTs could subscribe to broadcast/presence channels.
-- Combined with table RLS, postgres_changes streams remain filtered per-row.
ALTER TABLE realtime.messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated can read realtime messages" ON realtime.messages;
CREATE POLICY "Authenticated can read realtime messages" ON realtime.messages
FOR SELECT TO authenticated
USING (true);

DROP POLICY IF EXISTS "Authenticated can write realtime messages" ON realtime.messages;
CREATE POLICY "Authenticated can write realtime messages" ON realtime.messages
FOR INSERT TO authenticated
WITH CHECK (true);
