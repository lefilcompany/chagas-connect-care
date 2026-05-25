GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.can_access_patient(uuid, uuid) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.get_user_institution(uuid) TO authenticated, anon;