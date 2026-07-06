begin;

create or replace function public.is_superadmin(_user_id uuid default auth.uid())
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.user_roles
    where user_id = _user_id
      and role = 'superadmin'::public.app_role
  );
$$;

revoke all on function public.is_superadmin(uuid) from public;
grant execute on function public.is_superadmin(uuid) to authenticated, service_role;

do $$
declare
  policy_record record;
  target_table text;
begin
  foreach target_table in array array[
    'institution_whatsapp_settings',
    'whatsapp_channels',
    'whatsapp_integration_health',
    'whatsapp_admin_audit_log'
  ]
  loop
    for policy_record in
      select policyname from pg_policies
      where schemaname = 'public' and tablename = target_table
    loop
      execute format('drop policy if exists %I on public.%I', policy_record.policyname, target_table);
    end loop;
    execute format('alter table public.%I enable row level security', target_table);
  end loop;
end;
$$;

create policy institution_whatsapp_settings_superadmin_select
on public.institution_whatsapp_settings for select to authenticated
using (public.is_superadmin(auth.uid()));

create policy institution_whatsapp_settings_superadmin_insert
on public.institution_whatsapp_settings for insert to authenticated
with check (public.is_superadmin(auth.uid()));

create policy institution_whatsapp_settings_superadmin_update
on public.institution_whatsapp_settings for update to authenticated
using (public.is_superadmin(auth.uid()))
with check (public.is_superadmin(auth.uid()));

create policy whatsapp_channels_superadmin_select
on public.whatsapp_channels for select to authenticated
using (public.is_superadmin(auth.uid()));

create policy whatsapp_integration_health_superadmin_select
on public.whatsapp_integration_health for select to authenticated
using (public.is_superadmin(auth.uid()));

create policy whatsapp_admin_audit_log_superadmin_select
on public.whatsapp_admin_audit_log for select to authenticated
using (public.is_superadmin(auth.uid()));

drop policy if exists profiles_superadmin_select on public.profiles;
create policy profiles_superadmin_select
on public.profiles for select to authenticated
using (public.is_superadmin(auth.uid()));

drop policy if exists messages_superadmin_select on public.messages;
create policy messages_superadmin_select
on public.messages for select to authenticated
using (public.is_superadmin(auth.uid()));

drop policy if exists message_templates_superadmin_select on public.message_templates;
create policy message_templates_superadmin_select
on public.message_templates for select to authenticated
using (public.is_superadmin(auth.uid()));

create or replace function public.guard_superadmin_role_changes()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  request_role text := current_setting('request.jwt.claim.role', true);
  touches_superadmin boolean := false;
begin
  if request_role = 'service_role' then
    if tg_op = 'DELETE' then return old; end if;
    return new;
  end if;

  if tg_op = 'INSERT' then
    touches_superadmin := new.role = 'superadmin'::public.app_role;
  elsif tg_op = 'UPDATE' then
    touches_superadmin := old.role = 'superadmin'::public.app_role or new.role = 'superadmin'::public.app_role;
  elsif tg_op = 'DELETE' then
    touches_superadmin := old.role = 'superadmin'::public.app_role;
  end if;

  if touches_superadmin and not public.is_superadmin(auth.uid()) then
    raise exception 'Only a superadmin can assign, change, or remove the superadmin role'
      using errcode = '42501';
  end if;

  if tg_op = 'DELETE' then return old; end if;
  return new;
end;
$$;

revoke all on function public.guard_superadmin_role_changes() from public;
drop trigger if exists guard_superadmin_role_changes on public.user_roles;
create trigger guard_superadmin_role_changes
before insert or update or delete on public.user_roles
for each row execute function public.guard_superadmin_role_changes();

commit;
