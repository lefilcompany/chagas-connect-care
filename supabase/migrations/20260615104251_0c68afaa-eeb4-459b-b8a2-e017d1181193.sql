CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
begin
  -- SECURITY: never trust client-supplied institution from raw_user_meta_data.
  -- Institution must be assigned by an administrator after signup.
  insert into public.profiles (id, full_name, role_label, institution, professional_registry)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', ''),
    coalesce(new.raw_user_meta_data->>'role_label', ''),
    '',
    coalesce(new.raw_user_meta_data->>'professional_registry', '')
  );
  insert into public.user_roles (user_id, role) values (new.id, 'equipe');
  return new;
end;
$function$;