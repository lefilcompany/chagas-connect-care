
revoke execute on function public.has_role(uuid, app_role) from public, anon, authenticated;
revoke execute on function public.get_user_institution(uuid) from public, anon, authenticated;
revoke execute on function public.can_access_patient(uuid, uuid) from public, anon, authenticated;
revoke execute on function public.handle_new_user() from public, anon, authenticated;
