
-- Block non-admins from changing profiles.institution
CREATE OR REPLACE FUNCTION public.prevent_institution_self_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.institution IS DISTINCT FROM OLD.institution
     AND NOT public.has_role(auth.uid(), 'admin'::app_role) THEN
    RAISE EXCEPTION 'Only administrators can change a profile institution';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS profiles_prevent_institution_self_change ON public.profiles;
CREATE TRIGGER profiles_prevent_institution_self_change
BEFORE UPDATE ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION public.prevent_institution_self_change();
