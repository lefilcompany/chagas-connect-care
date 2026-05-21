
-- Enum for roles
create type public.app_role as enum ('admin', 'equipe');

-- Enum for patient stage
create type public.patient_stage as enum ('diagnostico', 'agudo', 'cronico');

-- Enum for channel
create type public.message_channel as enum ('whatsapp', 'sms');

-- Profiles
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null default '',
  role_label text not null default '',
  institution text not null default '',
  professional_registry text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.profiles enable row level security;

-- User roles
create table public.user_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  role app_role not null,
  created_at timestamptz not null default now(),
  unique (user_id, role)
);
alter table public.user_roles enable row level security;

-- has_role function (security definer to avoid recursion)
create or replace function public.has_role(_user_id uuid, _role app_role)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.user_roles where user_id = _user_id and role = _role
  )
$$;

-- get_institution helper
create or replace function public.get_user_institution(_user_id uuid)
returns text
language sql
stable
security definer
set search_path = public
as $$
  select institution from public.profiles where id = _user_id
$$;

-- Trigger: create profile + default role on signup
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, full_name, role_label, institution, professional_registry)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', ''),
    coalesce(new.raw_user_meta_data->>'role_label', ''),
    coalesce(new.raw_user_meta_data->>'institution', ''),
    coalesce(new.raw_user_meta_data->>'professional_registry', '')
  );
  insert into public.user_roles (user_id, role) values (new.id, 'equipe');
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- updated_at trigger
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end;
$$;

create trigger profiles_updated before update on public.profiles
  for each row execute function public.set_updated_at();

-- Patients
create table public.patients (
  id uuid primary key default gen_random_uuid(),
  full_name text not null,
  birth_date date,
  stage patient_stage not null default 'diagnostico',
  phone text not null default '',
  channel_pref message_channel not null default 'whatsapp',
  institution text not null default '',
  owner_id uuid references auth.users(id) on delete set null,
  notes text default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.patients enable row level security;
create trigger patients_updated before update on public.patients
  for each row execute function public.set_updated_at();

-- Contacts (família / cuidadores)
create table public.contacts (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references public.patients(id) on delete cascade,
  full_name text not null,
  relation text not null default 'familiar',
  phone text not null default '',
  channel_pref message_channel not null default 'whatsapp',
  receives_reminders boolean not null default true,
  created_at timestamptz not null default now()
);
alter table public.contacts enable row level security;

-- Medications
create table public.medications (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references public.patients(id) on delete cascade,
  name text not null,
  dose text not null default '',
  schedule text not null default '',
  start_date date,
  end_date date,
  created_at timestamptz not null default now()
);
alter table public.medications enable row level security;

-- Content library
create table public.content_library (
  id uuid primary key default gen_random_uuid(),
  category text not null default 'geral',
  title text not null,
  body text not null,
  audience text not null default 'ambos',
  created_at timestamptz not null default now()
);
alter table public.content_library enable row level security;

-- Messages
create table public.messages (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references public.patients(id) on delete cascade,
  contact_id uuid references public.contacts(id) on delete set null,
  channel message_channel not null default 'whatsapp',
  direction text not null default 'outbound',
  body text not null,
  status text not null default 'sent',
  scheduled_for timestamptz,
  sent_at timestamptz default now(),
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);
alter table public.messages enable row level security;

-- Adherence events
create table public.adherence_events (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references public.patients(id) on delete cascade,
  medication_id uuid references public.medications(id) on delete set null,
  event_type text not null default 'confirmado',
  occurred_at timestamptz not null default now(),
  source text not null default 'manual',
  created_at timestamptz not null default now()
);
alter table public.adherence_events enable row level security;

-- CRM sync log
create table public.crm_sync_log (
  id uuid primary key default gen_random_uuid(),
  crm_name text not null,
  payload jsonb not null default '{}'::jsonb,
  status text not null default 'success',
  created_at timestamptz not null default now()
);
alter table public.crm_sync_log enable row level security;

-- =====================
-- RLS POLICIES
-- =====================

-- profiles
create policy "Users view own profile" on public.profiles
  for select to authenticated using (id = auth.uid() or public.has_role(auth.uid(), 'admin'));
create policy "Users update own profile" on public.profiles
  for update to authenticated using (id = auth.uid());
create policy "Users insert own profile" on public.profiles
  for insert to authenticated with check (id = auth.uid());

-- user_roles
create policy "Users view own roles" on public.user_roles
  for select to authenticated using (user_id = auth.uid() or public.has_role(auth.uid(), 'admin'));
create policy "Admins manage roles" on public.user_roles
  for all to authenticated using (public.has_role(auth.uid(), 'admin'))
  with check (public.has_role(auth.uid(), 'admin'));

-- Helper: patient is in same institution as user (or admin)
create or replace function public.can_access_patient(_user_id uuid, _patient_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select public.has_role(_user_id, 'admin') or exists(
    select 1 from public.patients p
    where p.id = _patient_id
      and (p.institution = public.get_user_institution(_user_id) or p.owner_id = _user_id)
  )
$$;

-- patients
create policy "View patients in institution" on public.patients
  for select to authenticated using (
    public.has_role(auth.uid(), 'admin')
    or institution = public.get_user_institution(auth.uid())
    or owner_id = auth.uid()
  );
create policy "Insert patients" on public.patients
  for insert to authenticated with check (auth.uid() is not null);
create policy "Update patients in institution" on public.patients
  for update to authenticated using (
    public.has_role(auth.uid(), 'admin')
    or institution = public.get_user_institution(auth.uid())
    or owner_id = auth.uid()
  );
create policy "Delete patients (admin or owner)" on public.patients
  for delete to authenticated using (
    public.has_role(auth.uid(), 'admin') or owner_id = auth.uid()
  );

-- contacts / medications / messages / adherence_events: same access as patient
create policy "Contacts via patient" on public.contacts
  for all to authenticated using (public.can_access_patient(auth.uid(), patient_id))
  with check (public.can_access_patient(auth.uid(), patient_id));

create policy "Medications via patient" on public.medications
  for all to authenticated using (public.can_access_patient(auth.uid(), patient_id))
  with check (public.can_access_patient(auth.uid(), patient_id));

create policy "Messages via patient" on public.messages
  for all to authenticated using (public.can_access_patient(auth.uid(), patient_id))
  with check (public.can_access_patient(auth.uid(), patient_id));

create policy "Adherence via patient" on public.adherence_events
  for all to authenticated using (public.can_access_patient(auth.uid(), patient_id))
  with check (public.can_access_patient(auth.uid(), patient_id));

-- content_library: all authenticated can read; admins manage
create policy "Content read" on public.content_library
  for select to authenticated using (true);
create policy "Content admin manage" on public.content_library
  for all to authenticated using (public.has_role(auth.uid(), 'admin'))
  with check (public.has_role(auth.uid(), 'admin'));
create policy "Content authenticated insert" on public.content_library
  for insert to authenticated with check (auth.uid() is not null);

-- crm_sync_log: admin view, anyone authenticated insert
create policy "CRM log read" on public.crm_sync_log
  for select to authenticated using (true);
create policy "CRM log insert" on public.crm_sync_log
  for insert to authenticated with check (auth.uid() is not null);

-- Seed content library
insert into public.content_library (category, title, body, audience) values
  ('medicacao', 'Importância do benznidazol', 'Tomar a medicação no horário correto é essencial para o sucesso do tratamento da Doença de Chagas.', 'paciente'),
  ('alimentacao', 'Dieta cardioprotetora', 'Reduzir sal, gorduras saturadas e açúcar reduz o risco de arritmias em pacientes de Chagas.', 'ambos'),
  ('sono', 'Sono e coração', 'Manter rotina de sono regular ajuda no controle da função cardíaca.', 'paciente'),
  ('familia', 'Apoio da família', 'A presença da família no acompanhamento aumenta a adesão ao tratamento em até 40%.', 'familia');
