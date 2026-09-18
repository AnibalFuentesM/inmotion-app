-- ==============================================================================
-- IN MOTION DANCE ACADEMY - SUPABASE SCHEMA (PostgreSQL)
-- Modelo de datos oficial según las reglas operativas de In Motion
-- ==============================================================================

-- 1. EXTENSIONES Y TIPOS
create extension if not exists "uuid-ossp";

do $$ begin
  create type user_role as enum ('student', 'teacher', 'admin', 'guardian');
exception when duplicate_object then null; end $$;

do $$ begin
  create type attendance_status as enum ('presente', 'sin_registro');
exception when duplicate_object then null; end $$;

do $$ begin
  create type attendance_method as enum ('qr_scan', 'manual_list');
exception when duplicate_object then null; end $$;

do $$ begin
  create type enrollment_status as enum ('active', 'paused', 'cancelled');
exception when duplicate_object then null; end $$;

do $$ begin
  create type membership_status as enum ('active', 'past_due', 'cancelled');
exception when duplicate_object then null; end $$;

-- ------------------------------------------------------------------------------
-- 2. TABLA: profiles (Usuarios del sistema vinculados a auth.users)
-- ------------------------------------------------------------------------------
create table if not exists public.profiles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  role user_role not null default 'student',
  first_name text not null,
  last_name text not null,
  email text,
  phone text,
  level text,
  notes text,
  guardian_id uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ------------------------------------------------------------------------------
-- 3. TABLA: cards (Carné permanente y QR estático del alumno)
-- Regla: Carné estático permanente desacoplado del estado de pago
-- ------------------------------------------------------------------------------
create table if not exists public.cards (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.profiles(id) on delete cascade unique,
  card_number text not null unique,
  qr_code text not null unique,
  is_active boolean not null default true,
  issued_at timestamptz not null default now()
);

-- ------------------------------------------------------------------------------
-- 4. TABLA: classes (Disciplinas y horarios de la academia)
-- Regla: Un solo salón físico ('Salón')
-- ------------------------------------------------------------------------------
create table if not exists public.classes (
  id text primary key,
  name text not null,
  level text,
  room text not null default 'Salón',
  teacher_id uuid references public.profiles(id) on delete set null,
  teacher_name text,
  weekday smallint not null check (weekday between 0 and 6),
  time text not null,
  capacity integer not null default 20,
  created_at timestamptz not null default now()
);

-- ------------------------------------------------------------------------------
-- 5. TABLA: enrollments (Inscripción de alumnos en disciplinas específicas)
-- Previene registros cruzados entre clases
-- ------------------------------------------------------------------------------
create table if not exists public.enrollments (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.profiles(id) on delete cascade,
  class_id text not null references public.classes(id) on delete cascade,
  status enrollment_status not null default 'active',
  enrolled_at timestamptz not null default now(),
  unique (student_id, class_id)
);

-- ------------------------------------------------------------------------------
-- 6. TABLA: class_sessions (Sesión abierta en el dispositivo de la academia)
-- Regla: El contexto vive en el dispositivo del salón, no en el QR
-- ------------------------------------------------------------------------------
create table if not exists public.class_sessions (
  id uuid primary key default gen_random_uuid(),
  class_id text not null references public.classes(id) on delete cascade,
  session_date date not null default current_date,
  opened_by uuid references public.profiles(id) on delete set null,
  opened_at timestamptz not null default now(),
  closed_at timestamptz,
  unique (class_id, session_date)
);

-- ------------------------------------------------------------------------------
-- 7. TABLA: attendances (Registro minimalista de asistencia)
-- Regla: Solo 'presente' o 'sin_registro'. Sin tardanzas ni tolerancias.
-- ------------------------------------------------------------------------------
create table if not exists public.attendances (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.class_sessions(id) on delete cascade,
  student_id uuid not null references public.profiles(id) on delete cascade,
  status attendance_status not null default 'presente',
  method attendance_method not null default 'qr_scan',
  recorded_by uuid references public.profiles(id) on delete set null,
  recorded_at timestamptz not null default now(),
  unique (session_id, student_id)
);

-- ------------------------------------------------------------------------------
-- 8. TABLA: memberships (Planes y estado de membresía)
-- Regla: Manejo administrativo de cuotas y fechas de corte
-- ------------------------------------------------------------------------------
create table if not exists public.memberships (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.profiles(id) on delete cascade,
  plan_name text not null,
  price numeric(10,2) not null,
  status membership_status not null default 'active',
  start_date date not null default current_date,
  end_date date not null default (current_date + interval '1 month'),
  created_at timestamptz not null default now()
);

-- ------------------------------------------------------------------------------
-- 9. TABLA: payments (Registro de pagos y mensualidades)
-- ------------------------------------------------------------------------------
create table if not exists public.payments (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.profiles(id) on delete cascade,
  membership_id uuid references public.memberships(id) on delete set null,
  period text not null,
  amount numeric(10,2) not null,
  payment_method text not null default 'transferencia',
  receipt_number text,
  notes text,
  idempotency_key text unique,
  recorded_by uuid references public.profiles(id) on delete set null,
  recorded_at timestamptz not null default now(),
  constraint payments_student_period_unique unique (student_id, period)
);

-- ------------------------------------------------------------------------------
-- 10. FUNCIONES AUXILIARES DE ROL Y CONTEXTO (SECURITY DEFINER)
-- ------------------------------------------------------------------------------
create or replace function public.current_profile_id()
returns uuid
language sql
security definer
set search_path = public
stable
as $$
  select id from public.profiles where user_id = auth.uid() limit 1;
$$;

create or replace function public.current_user_role()
returns public.user_role
language sql
security definer
set search_path = public
stable
as $$
  select role from public.profiles where user_id = auth.uid() limit 1;
$$;

create or replace function public.is_admin()
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select coalesce(public.current_user_role() = 'admin', false);
$$;

create or replace function public.is_teacher()
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select coalesce(public.current_user_role() = 'teacher', false);
$$;

create or replace function public.is_guardian()
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select coalesce(public.current_user_role() = 'guardian', false);
$$;

create or replace function public.is_student()
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select coalesce(public.current_user_role() = 'student', false);
$$;

-- ------------------------------------------------------------------------------
-- 11. TRIGGERS DE SEGURIDAD Y CONTROL DE PRIVILEGIOS
-- ------------------------------------------------------------------------------
create or replace function public.protect_profile_role()
returns trigger
language plpgsql
security definer
as $$
begin
  if not public.is_admin() then
    if new.role is distinct from old.role then
      raise exception 'Permiso denegado: no se puede alterar el rol de usuario.';
    end if;
    if new.user_id is distinct from old.user_id then
      raise exception 'Permiso denegado: no se puede reasignar el usuario vinculado.';
    end if;
    if new.guardian_id is distinct from old.guardian_id then
      raise exception 'Permiso denegado: no se puede modificar el tutor vinculado.';
    end if;
  end if;
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_protect_profile_role on public.profiles;
create trigger trg_protect_profile_role
  before update on public.profiles
  for each row
  execute function public.protect_profile_role();

create or replace function public.check_profile_creation()
returns trigger
language plpgsql
security definer
as $$
begin
  if not public.is_admin() then
    if new.user_id is distinct from auth.uid() or new.role <> 'student' then
      raise exception 'Permiso denegado: solo administración puede asignar roles especiales.';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_check_profile_creation on public.profiles;
create trigger trg_check_profile_creation
  before insert on public.profiles
  for each row
  execute function public.check_profile_creation();

create or replace function public.validate_attendance_record()
returns trigger
language plpgsql
security definer
as $$
declare
  v_class_id text;
  v_teacher_id uuid;
  v_teacher_name text;
  v_is_enrolled boolean;
begin
  select class_id into v_class_id
  from public.class_sessions
  where id = new.session_id;

  if v_class_id is null then
    raise exception 'La sesión de clase especificada no existe.';
  end if;

  select exists (
    select 1 from public.enrollments
    where student_id = new.student_id
      and class_id = v_class_id
      and status = 'active'
  ) into v_is_enrolled;

  if not v_is_enrolled then
    raise exception 'Inscripción no válida: el alumno no está inscrito activamente en esta clase.';
  end if;

  if not public.is_admin() then
    select teacher_id, teacher_name into v_teacher_id, v_teacher_name
    from public.classes
    where id = v_class_id;

    if v_teacher_id is distinct from public.current_profile_id()
       and v_teacher_name is distinct from (
         select first_name || ' ' || last_name from public.profiles where id = public.current_profile_id()
       ) then
      raise exception 'Permiso denegado: solo el maestro de la clase o administración pueden registrar asistencia.';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_validate_attendance_record on public.attendances;
create trigger trg_validate_attendance_record
  before insert or update on public.attendances
  for each row
  execute function public.validate_attendance_record();

-- ------------------------------------------------------------------------------
-- 12. ROW LEVEL SECURITY (RLS)
-- ------------------------------------------------------------------------------
alter table public.profiles enable row level security;
alter table public.cards enable row level security;
alter table public.classes enable row level security;
alter table public.enrollments enable row level security;
alter table public.class_sessions enable row level security;
alter table public.attendances enable row level security;
alter table public.memberships enable row level security;
alter table public.payments enable row level security;

-- TABLA: classes
create policy "classes_select_public" on public.classes for select using (true);
create policy "classes_admin_all" on public.classes for all using (public.is_admin()) with check (public.is_admin());

-- TABLA: profiles
create policy "profiles_admin_all" on public.profiles for all using (public.is_admin()) with check (public.is_admin());
create policy "profiles_select_self" on public.profiles for select using (user_id = auth.uid() or role = 'teacher');
create policy "profiles_select_guardian" on public.profiles for select using (guardian_id = public.current_profile_id());
create policy "profiles_select_teacher" on public.profiles for select using (
  public.is_teacher() and exists (
    select 1 from public.enrollments e
    join public.classes c on c.id = e.class_id
    where e.student_id = profiles.id
      and (c.teacher_id = public.current_profile_id() or c.teacher_name = (
        select first_name || ' ' || last_name from public.profiles where id = public.current_profile_id()
      ))
  )
);
create policy "profiles_update_self" on public.profiles for update using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "profiles_insert_self" on public.profiles for insert with check (user_id = auth.uid());

-- TABLA: cards
create policy "cards_admin_all" on public.cards for all using (public.is_admin()) with check (public.is_admin());
create policy "cards_select_student" on public.cards for select using (student_id = public.current_profile_id());
create policy "cards_select_guardian" on public.cards for select using (
  exists (select 1 from public.profiles p where p.id = cards.student_id and p.guardian_id = public.current_profile_id())
);
create policy "cards_select_teacher" on public.cards for select using (
  public.is_teacher() and exists (
    select 1 from public.enrollments e
    join public.classes c on c.id = e.class_id
    where e.student_id = cards.student_id
      and (c.teacher_id = public.current_profile_id() or c.teacher_name = (
        select first_name || ' ' || last_name from public.profiles where id = public.current_profile_id()
      ))
  )
);

-- TABLA: enrollments
create policy "enrollments_admin_all" on public.enrollments for all using (public.is_admin()) with check (public.is_admin());
create policy "enrollments_select_student" on public.enrollments for select using (student_id = public.current_profile_id());
create policy "enrollments_select_guardian" on public.enrollments for select using (
  exists (select 1 from public.profiles p where p.id = enrollments.student_id and p.guardian_id = public.current_profile_id())
);
create policy "enrollments_select_teacher" on public.enrollments for select using (
  public.is_teacher() and exists (
    select 1 from public.classes c
    where c.id = enrollments.class_id
      and (c.teacher_id = public.current_profile_id() or c.teacher_name = (
        select first_name || ' ' || last_name from public.profiles where id = public.current_profile_id()
      ))
  )
);

-- TABLA: class_sessions
create policy "class_sessions_admin_all" on public.class_sessions for all using (public.is_admin()) with check (public.is_admin());
create policy "class_sessions_teacher_manage" on public.class_sessions for all using (
  public.is_teacher() and exists (
    select 1 from public.classes c
    where c.id = class_sessions.class_id
      and (c.teacher_id = public.current_profile_id() or c.teacher_name = (
        select first_name || ' ' || last_name from public.profiles where id = public.current_profile_id()
      ))
  )
) with check (
  public.is_teacher() and exists (
    select 1 from public.classes c
    where c.id = class_sessions.class_id
      and (c.teacher_id = public.current_profile_id() or c.teacher_name = (
        select first_name || ' ' || last_name from public.profiles where id = public.current_profile_id()
      ))
  )
);
create policy "class_sessions_select_student" on public.class_sessions for select using (
  exists (select 1 from public.enrollments e where e.class_id = class_sessions.class_id and e.student_id = public.current_profile_id())
);
create policy "class_sessions_select_guardian" on public.class_sessions for select using (
  exists (select 1 from public.enrollments e join public.profiles p on p.id = e.student_id where e.class_id = class_sessions.class_id and p.guardian_id = public.current_profile_id())
);

-- TABLA: attendances
create policy "attendances_admin_all" on public.attendances for all using (public.is_admin()) with check (public.is_admin());
create policy "attendances_teacher_manage" on public.attendances for all using (
  public.is_teacher() and exists (
    select 1 from public.class_sessions s
    join public.classes c on c.id = s.class_id
    where s.id = attendances.session_id
      and (c.teacher_id = public.current_profile_id() or c.teacher_name = (
        select first_name || ' ' || last_name from public.profiles where id = public.current_profile_id()
      ))
  )
) with check (
  public.is_teacher() and exists (
    select 1 from public.class_sessions s
    join public.classes c on c.id = s.class_id
    where s.id = attendances.session_id
      and (c.teacher_id = public.current_profile_id() or c.teacher_name = (
        select first_name || ' ' || last_name from public.profiles where id = public.current_profile_id()
      ))
  )
);
create policy "attendances_select_student" on public.attendances for select using (student_id = public.current_profile_id());
create policy "attendances_select_guardian" on public.attendances for select using (
  exists (select 1 from public.profiles p where p.id = attendances.student_id and p.guardian_id = public.current_profile_id())
);

-- TABLA: memberships
create policy "memberships_admin_all" on public.memberships for all using (public.is_admin()) with check (public.is_admin());
create policy "memberships_select_student" on public.memberships for select using (student_id = public.current_profile_id());
create policy "memberships_select_guardian" on public.memberships for select using (
  exists (select 1 from public.profiles p where p.id = memberships.student_id and p.guardian_id = public.current_profile_id())
);

-- TABLA: payments
create policy "payments_admin_all" on public.payments for all using (public.is_admin()) with check (public.is_admin());
create policy "payments_select_student" on public.payments for select using (student_id = public.current_profile_id());
create policy "payments_select_guardian" on public.payments for select using (
  exists (select 1 from public.profiles p where p.id = payments.student_id and p.guardian_id = public.current_profile_id())
);

-- ------------------------------------------------------------------------------
-- 13. DATOS SEMILLA (Seed Data)
-- Clases iniciales del cronograma demo de In Motion
-- ------------------------------------------------------------------------------
insert into public.classes (id, name, level, room, teacher_name, weekday, time, capacity)
values
  ('bachata-inter', 'Bachata Intermedio', 'Nivel intermedio', 'Salón', 'Alex Aquino', 3, '6:00 PM', 18),
  ('salsa-basico', 'Salsa Principiantes', 'Nivel inicial', 'Salón', 'Luis Ramírez', 3, '7:15 PM', 20),
  ('kpop-teens', 'K-Pop Teens', '12 a 17 años', 'Salón', 'Majo Borrayo', 4, '5:00 PM', 18),
  ('latino', 'Baile Latino', 'Todos los niveles', 'Salón', 'Alex Aquino', 4, '7:00 PM', 20),
  ('latino-kids', 'Baile Latino Kids', '7 a 11 años', 'Salón', 'Sofía Castillo', 6, '10:00 AM', 12),
  ('salsa-casino', 'Salsa Casino', 'Nivel avanzado', 'Salón', 'Leo Méndez', 6, '11:30 AM', 14)
on conflict (id) do nothing;
