
-- Tighten content_library SELECT: restrict to authenticated users only
DROP POLICY IF EXISTS "Content read" ON public.content_library;
CREATE POLICY "Content read authenticated"
  ON public.content_library FOR SELECT
  TO authenticated
  USING (auth.uid() IS NOT NULL);

-- Add institution-scoped write policies for whatsapp-media storage bucket
-- so defense-in-depth applies even if service_role code is misused.
CREATE POLICY "whatsapp_media_authenticated_insert_same_institution"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'whatsapp-media'
    AND (
      public.has_role(auth.uid(), 'admin'::app_role)
      OR (storage.foldername(name))[1] = public.get_user_institution(auth.uid())
    )
    AND public.get_user_institution(auth.uid()) IS NOT NULL
    AND public.get_user_institution(auth.uid()) <> ''
  );

CREATE POLICY "whatsapp_media_authenticated_update_same_institution"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'whatsapp-media'
    AND (
      public.has_role(auth.uid(), 'admin'::app_role)
      OR (storage.foldername(name))[1] = public.get_user_institution(auth.uid())
    )
    AND public.get_user_institution(auth.uid()) IS NOT NULL
    AND public.get_user_institution(auth.uid()) <> ''
  )
  WITH CHECK (
    bucket_id = 'whatsapp-media'
    AND (
      public.has_role(auth.uid(), 'admin'::app_role)
      OR (storage.foldername(name))[1] = public.get_user_institution(auth.uid())
    )
    AND public.get_user_institution(auth.uid()) IS NOT NULL
    AND public.get_user_institution(auth.uid()) <> ''
  );

CREATE POLICY "whatsapp_media_authenticated_delete_same_institution"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'whatsapp-media'
    AND (
      public.has_role(auth.uid(), 'admin'::app_role)
      OR (storage.foldername(name))[1] = public.get_user_institution(auth.uid())
    )
    AND public.get_user_institution(auth.uid()) IS NOT NULL
    AND public.get_user_institution(auth.uid()) <> ''
  );
