
-- user_roles: prevent institution admins from granting/removing superadmin
DROP POLICY IF EXISTS "Admins manage roles" ON public.user_roles;
CREATE POLICY "Admins manage non-superadmin roles"
  ON public.user_roles FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role) AND role <> 'superadmin'::app_role)
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role) AND role <> 'superadmin'::app_role);

-- whatsapp_channels: remove admin write policies; superadmin-only writes remain
DROP POLICY IF EXISTS "whatsapp_channels insert admin only" ON public.whatsapp_channels;
DROP POLICY IF EXISTS "whatsapp_channels update admin only" ON public.whatsapp_channels;
DROP POLICY IF EXISTS "whatsapp_channels delete admin only" ON public.whatsapp_channels;

-- institution_whatsapp_settings: remove admin write policies; superadmin-only writes remain
DROP POLICY IF EXISTS "iws_insert_admin_same_institution" ON public.institution_whatsapp_settings;
DROP POLICY IF EXISTS "iws_update_admin_same_institution" ON public.institution_whatsapp_settings;
DROP POLICY IF EXISTS "iws_delete_admin" ON public.institution_whatsapp_settings;
