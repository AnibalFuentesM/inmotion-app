-- ==============================================================================
-- IN MOTION DANCE ACADEMY - SUPABASE OFFICIAL CONSOLIDATED SCHEMA (PostgreSQL)
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
-- 10. FUNCIONES AUXILIARES DE ROL Y RELACIONES (SECURITY DEFINER)
-- Impiden ciclos de recursión infinita en RLS y aíslan search_path
-- ------------------------------------------------------------------------------
create or replace function public.current_profile_id()
returns uuid
language sql
security definer
set search_path = public, pg_temp
stable
as $$
  select id from public.profiles where user_id = auth.uid() limit 1;
$$;

create or replace function public.current_user_role()
returns public.user_role
language sql
security definer
set search_path = public, pg_temp
stable
as $$
  select role from public.profiles where user_id = auth.uid() limit 1;
$$;

create or replace function public.is_admin()
returns boolean
language sql
security definer
set search_path = public, pg_temp
stable
as $$
  select coalesce(public.current_user_role() = 'admin', false);
$$;

create or replace function public.is_teacher()
returns boolean
language sql
security definer
set search_path = public, pg_temp
stable
as $$
  select coalesce(public.current_user_role() = 'teacher', false);
$$;

create or replace function public.is_guardian()
returns boolean
language sql
security definer
set search_path = public, pg_temp
stable
as $$
  select coalesce(public.current_user_role() = 'guardian', false);
$$;

create or replace function public.is_student()
returns boolean
language sql
security definer
set search_path = public, pg_temp
stable
as $$
  select coalesce(public.current_user_role() = 'student', false);
$$;

create or replace function public.teacher_has_student(p_teacher_profile_id uuid, p_student_profile_id uuid)
returns boolean
language sql
security definer
set search_path = public, pg_temp
stable
as $$
  select exists (
    select 1
    from public.enrollments e
    join public.classes c on c.id = e.class_id
    where e.student_id = p_student_profile_id
      and c.teacher_id = p_teacher_profile_id
      and e.status = 'active'
  );
$$;

create or replace function public.guardian_has_student(p_guardian_profile_id uuid, p_student_profile_id uuid)
returns boolean
language sql
security definer
set search_path = public, pg_temp
stable
as $$
  select exists (
    select 1
    from public.profiles p
    where p.id = p_student_profile_id
      and p.guardian_id = p_guardian_profile_id
  );
$$;

create or replace function public.teacher_has_class(p_teacher_profile_id uuid, p_class_id text)
returns boolean
language sql
security definer
set search_path = public, pg_temp
stable
as $$
  select exists (
    select 1
    from public.classes c
    where c.id = p_class_id
      and c.teacher_id = p_teacher_profile_id
  );
$$;

revoke all on function public.current_profile_id() from public, anon;
grant execute on function public.current_profile_id() to authenticated;

revoke all on function public.current_user_role() from public, anon;
grant execute on function public.current_user_role() to authenticated;

revoke all on function public.is_admin() from public, anon;
grant execute on function public.is_admin() to authenticated;

revoke all on function public.is_teacher() from public, anon;
grant execute on function public.is_teacher() to authenticated;

revoke all on function public.is_guardian() from public, anon;
grant execute on function public.is_guardian() to authenticated;

revoke all on function public.is_student() from public, anon;
grant execute on function public.is_student() to authenticated;

revoke all on function public.teacher_has_student(uuid, uuid) from public, anon;
grant execute on function public.teacher_has_student(uuid, uuid) to authenticated;

revoke all on function public.guardian_has_student(uuid, uuid) from public, anon;
grant execute on function public.guardian_has_student(uuid, uuid) to authenticated;

revoke all on function public.teacher_has_class(uuid, text) from public, anon;
grant execute on function public.teacher_has_class(uuid, text) to authenticated;

-- ------------------------------------------------------------------------------
-- 11. TRIGGERS DE SEGURIDAD Y CONTROL DE PRIVILEGIOS
-- ------------------------------------------------------------------------------
create or replace function public.protect_profile_role()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
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
set search_path = public, pg_temp
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
set search_path = public, pg_temp
as $$
declare
  v_class_id text;
  v_teacher_id uuid;
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
    select teacher_id into v_teacher_id
    from public.classes
    where id = v_class_id;

    if v_teacher_id is distinct from public.current_profile_id() then
      raise exception 'Permiso denegado: solo el maestro asignado a la clase o administración pueden registrar asistencia.';
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
create policy "profiles_select_self" on public.profiles for select using (user_id = auth.uid());
create policy "profiles_select_guardian" on public.profiles for select using (
  public.guardian_has_student(public.current_profile_id(), id)
);
create policy "profiles_select_teacher" on public.profiles for select using (
  public.is_teacher() and public.teacher_has_student(public.current_profile_id(), id)
);
create policy "profiles_update_self" on public.profiles for update using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "profiles_insert_self" on public.profiles for insert with check (user_id = auth.uid());

-- TABLA: cards
create policy "cards_admin_all" on public.cards for all using (public.is_admin()) with check (public.is_admin());
create policy "cards_select_student" on public.cards for select using (student_id = public.current_profile_id());
create policy "cards_select_guardian" on public.cards for select using (
  public.guardian_has_student(public.current_profile_id(), student_id)
);
create policy "cards_select_teacher" on public.cards for select using (
  public.is_teacher() and public.teacher_has_student(public.current_profile_id(), student_id)
);

-- TABLA: enrollments
create policy "enrollments_admin_all" on public.enrollments for all using (public.is_admin()) with check (public.is_admin());
create policy "enrollments_select_student" on public.enrollments for select using (student_id = public.current_profile_id());
create policy "enrollments_select_guardian" on public.enrollments for select using (
  public.guardian_has_student(public.current_profile_id(), student_id)
);
create policy "enrollments_select_teacher" on public.enrollments for select using (
  public.is_teacher() and public.teacher_has_class(public.current_profile_id(), class_id)
);

-- TABLA: class_sessions
create policy "class_sessions_admin_all" on public.class_sessions for all using (public.is_admin()) with check (public.is_admin());
create policy "class_sessions_teacher_manage" on public.class_sessions for all using (
  public.is_teacher() and public.teacher_has_class(public.current_profile_id(), class_id)
) with check (
  public.is_teacher() and public.teacher_has_class(public.current_profile_id(), class_id)
);
create policy "class_sessions_select_student" on public.class_sessions for select using (
  exists (
    select 1 from public.enrollments e
    where e.class_id = class_sessions.class_id
      and e.student_id = public.current_profile_id()
      and e.status = 'active'
  )
);
create policy "class_sessions_select_guardian" on public.class_sessions for select using (
  exists (
    select 1 from public.enrollments e
    where e.class_id = class_sessions.class_id
      and public.guardian_has_student(public.current_profile_id(), e.student_id)
      and e.status = 'active'
  )
);

-- TABLA: attendances
create policy "attendances_admin_all" on public.attendances for all using (public.is_admin()) with check (public.is_admin());
create policy "attendances_teacher_manage" on public.attendances for all using (
  public.is_teacher() and exists (
    select 1 from public.class_sessions s
    where s.id = attendances.session_id
      and public.teacher_has_class(public.current_profile_id(), s.class_id)
  )
) with check (
  public.is_teacher() and exists (
    select 1 from public.class_sessions s
    where s.id = attendances.session_id
      and public.teacher_has_class(public.current_profile_id(), s.class_id)
  )
);
create policy "attendances_select_student" on public.attendances for select using (student_id = public.current_profile_id());
create policy "attendances_select_guardian" on public.attendances for select using (
  public.guardian_has_student(public.current_profile_id(), student_id)
);

-- TABLA: memberships
create policy "memberships_admin_all" on public.memberships for all using (public.is_admin()) with check (public.is_admin());
create policy "memberships_select_student" on public.memberships for select using (student_id = public.current_profile_id());
create policy "memberships_select_guardian" on public.memberships for select using (
  public.guardian_has_student(public.current_profile_id(), student_id)
);

-- TABLA: payments
create policy "payments_admin_all" on public.payments for all using (public.is_admin()) with check (public.is_admin());
create policy "payments_select_student" on public.payments for select using (student_id = public.current_profile_id());
create policy "payments_select_guardian" on public.payments for select using (
  public.guardian_has_student(public.current_profile_id(), student_id)
);

-- ------------------------------------------------------------------------------
-- 13. PROCEDIMIENTOS ALMACENADOS (RPC) TRANSACCIONALES Y HARDENED
-- ------------------------------------------------------------------------------

-- RPC: get_or_create_session
create or replace function public.get_or_create_session(
  p_class_id text,
  p_session_date date default current_date
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_class record;
  v_session_id uuid;
  v_dow smallint;
begin
  if auth.uid() is null then
    raise exception 'No autenticado: se requiere sesión iniciada para abrir sesiones de clase.'
      using errcode = '28000';
  end if;

  select id, teacher_id, weekday into v_class
  from public.classes
  where id = p_class_id;

  if v_class.id is null then
    raise exception 'Clase no encontrada: %', p_class_id
      using errcode = 'P0002';
  end if;

  if not (public.is_admin() or v_class.teacher_id = public.current_profile_id()) then
    raise exception 'Permiso denegado: solo el maestro asignado o administración pueden abrir sesiones de esta clase.'
      using errcode = '42501';
  end if;

  v_dow := extract(dow from p_session_date)::smallint;
  if v_class.weekday <> v_dow then
    raise exception 'Fecha no válida: la clase % está programada para el día % y se intentó abrir en día %.',
      p_class_id, v_class.weekday, v_dow
      using errcode = '22023';
  end if;

  insert into public.class_sessions (class_id, session_date, opened_by)
  values (p_class_id, p_session_date, public.current_profile_id())
  on conflict (class_id, session_date) do update
    set opened_at = class_sessions.opened_at
  returning id into v_session_id;

  if exists (select 1 from public.class_sessions where id = v_session_id and closed_at is not null) then
    raise exception 'La sesión de clase para la fecha % ya está cerrada.' using errcode = '22000';
  end if;

  return v_session_id;
end;
$$;

revoke all on function public.get_or_create_session(text, date) from public, anon;
grant execute on function public.get_or_create_session(text, date) to authenticated;

-- RPC: sync_session_attendances
create or replace function public.sync_session_attendances(
  p_class_id text,
  p_session_date date,
  p_present_student_ids uuid[],
  p_scope_student_ids uuid[],
  p_method text default 'manual_list'
)
returns table (
  action text,
  session_id uuid,
  confirmed_present integer,
  confirmed_unmarked integer
)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_session_id uuid;
  v_method attendance_method;
  v_invalid_count integer;
  v_unmarked_count integer := 0;
  v_present_count integer := 0;
  v_student_id uuid;
begin
  v_session_id := public.get_or_create_session(p_class_id, p_session_date);

  if p_method = 'qr_scan' then
    v_method := 'qr_scan'::attendance_method;
  else
    v_method := 'manual_list'::attendance_method;
  end if;

  if array_length(p_present_student_ids, 1) > 0 then
    select count(*) into v_invalid_count
    from unnest(p_present_student_ids) as s(id)
    where not exists (
      select 1 from public.enrollments e
      where e.student_id = s.id
        and e.class_id = p_class_id
        and e.status = 'active'
    );

    if v_invalid_count > 0 then
      raise exception 'Validación de servidor fallida: % alumno(s) no tienen inscripción activa en esta clase.', v_invalid_count
        using errcode = '23503';
    end if;
  end if;

  if array_length(p_present_student_ids, 1) > 0 then
    foreach v_student_id in array p_present_student_ids loop
      insert into public.attendances (session_id, student_id, status, method, recorded_by, recorded_at)
      values (v_session_id, v_student_id, 'presente'::attendance_status, v_method, public.current_profile_id(), now())
      on conflict (session_id, student_id) do update
        set status = 'presente'::attendance_status,
            method = excluded.method,
            recorded_at = now();
      v_present_count := v_present_count + 1;
    end loop;
  end if;

  if array_length(p_scope_student_ids, 1) > 0 then
    with deleted as (
      delete from public.attendances
      where session_id = v_session_id
        and student_id = any(p_scope_student_ids)
        and (p_present_student_ids is null or not (student_id = any(p_present_student_ids)))
      returning student_id
    )
    select count(*) into v_unmarked_count from deleted;
  end if;

  return query select 'synced'::text, v_session_id, v_present_count, v_unmarked_count;
end;
$$;

revoke all on function public.sync_session_attendances(text, date, uuid[], uuid[], text) from public, anon;
grant execute on function public.sync_session_attendances(text, date, uuid[], uuid[], text) to authenticated;

-- RPC: set_attendance
create or replace function public.set_attendance(
  p_class_id text,
  p_session_date date,
  p_student_id uuid,
  p_present boolean,
  p_method text default 'qr_scan'
)
returns table (
  action text,
  session_id uuid,
  student_id uuid,
  status text
)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_session_id uuid;
  v_method attendance_method;
  v_is_enrolled boolean;
begin
  v_session_id := public.get_or_create_session(p_class_id, p_session_date);

  if p_method = 'manual' or p_method = 'manual_list' then
    v_method := 'manual_list'::attendance_method;
  else
    v_method := 'qr_scan'::attendance_method;
  end if;

  if p_present then
    select exists (
      select 1 from public.enrollments
      where student_id = p_student_id
        and class_id = p_class_id
        and status = 'active'
    ) into v_is_enrolled;

    if not v_is_enrolled then
      raise exception 'Inscripción no válida: el alumno no está inscrito activamente en esta clase.'
        using errcode = '23503';
    end if;

    insert into public.attendances (session_id, student_id, status, method, recorded_by, recorded_at)
    values (v_session_id, p_student_id, 'presente'::attendance_status, v_method, public.current_profile_id(), now())
    on conflict (session_id, student_id) do update
      set status = 'presente'::attendance_status,
          method = excluded.method,
          recorded_at = now();

    return query select 'marked'::text, v_session_id, p_student_id, 'presente'::text;
  else
    delete from public.attendances
    where session_id = v_session_id
      and student_id = p_student_id;

    return query select 'unmarked'::text, v_session_id, p_student_id, 'sin_registro'::text;
  end if;
end;
$$;

revoke all on function public.set_attendance(text, date, uuid, boolean, text) from public, anon;
grant execute on function public.set_attendance(text, date, uuid, boolean, text) to authenticated;

-- RPC: register_payment_idempotent
create or replace function public.register_payment_idempotent(
  p_student_id uuid,
  p_period text,
  p_amount numeric,
  p_payment_method text default 'transferencia',
  p_receipt_number text default null,
  p_notes text default null,
  p_idempotency_key text default null
)
returns table (
  id uuid,
  student_id uuid,
  period text,
  amount numeric,
  payment_method text,
  receipt_number text,
  is_duplicate boolean
)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_existing record;
  v_new_id uuid;
begin
  if auth.uid() is null then
    raise exception 'No autenticado: se requiere inicio de sesión.' using errcode = '28000';
  end if;
  if not public.is_admin() then
    raise exception 'Permiso denegado: solo administración puede registrar pagos.' using errcode = '42501';
  end if;

  if p_period !~ '^\d{4}-(0[1-9]|1[0-2])$' then
    raise exception 'Período no válido (debe ser formato AAAA-MM): %', p_period using errcode = '22007';
  end if;

  if p_amount is null or p_amount <= 0 then
    raise exception 'El monto del pago debe ser mayor que cero.' using errcode = '22003';
  end if;

  if not exists (select 1 from public.profiles where id = p_student_id) then
    raise exception 'Alumno no encontrado: %', p_student_id using errcode = 'P0002';
  end if;

  if p_idempotency_key is not null then
    select p.id, p.student_id, p.period, p.amount, p.payment_method, p.receipt_number
    into v_existing
    from public.payments p
    where p.idempotency_key = p_idempotency_key
    limit 1;

    if v_existing.id is not null then
      if v_existing.student_id = p_student_id
         and v_existing.period = p_period
         and v_existing.amount = p_amount then
        return query select
          v_existing.id,
          v_existing.student_id,
          v_existing.period,
          v_existing.amount,
          v_existing.payment_method,
          v_existing.receipt_number,
          true;
        return;
      else
        raise exception 'Conflicto de idempotencia: la clave % ya fue utilizada con datos de pago distintos.',
          p_idempotency_key using errcode = '23505';
      end if;
    end if;
  end if;

  select p.id, p.student_id, p.period, p.amount, p.payment_method, p.receipt_number
  into v_existing
  from public.payments p
  where p.student_id = p_student_id and p.period = p_period
  limit 1;

  if v_existing.id is not null then
    if v_existing.amount = p_amount then
      return query select
        v_existing.id,
        v_existing.student_id,
        v_existing.period,
        v_existing.amount,
        v_existing.payment_method,
        v_existing.receipt_number,
        true;
      return;
    else
      raise exception 'Conflicto: ya existe un pago registrado para este alumno en el período % con importe Q %.',
        p_period, v_existing.amount using errcode = '23505';
    end if;
  end if;

  insert into public.payments (
    student_id,
    period,
    amount,
    payment_method,
    receipt_number,
    notes,
    idempotency_key,
    recorded_by,
    recorded_at
  )
  values (
    p_student_id,
    p_period,
    p_amount,
    coalesce(p_payment_method, 'transferencia'),
    p_receipt_number,
    p_notes,
    p_idempotency_key,
    public.current_profile_id(),
    now()
  )
  returning public.payments.id into v_new_id;

  return query select
    v_new_id,
    p_student_id,
    p_period,
    p_amount,
    p_payment_method,
    p_receipt_number,
    false;
end;
$$;

revoke all on function public.register_payment_idempotent(uuid, text, numeric, text, text, text, text) from public, anon;
grant execute on function public.register_payment_idempotent(uuid, text, numeric, text, text, text, text) to authenticated;

-- RPC: create_student_transactional
create or replace function public.create_student_transactional(
  p_card_number text,
  p_first_name text,
  p_last_name text,
  p_phone text default null,
  p_level text default null,
  p_notes text default null,
  p_plan_name text default null,
  p_plan_price numeric default null
)
returns table (
  profile_id uuid,
  card_id uuid,
  card_number text,
  membership_id uuid
)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_profile_id uuid;
  v_card_id uuid;
  v_membership_id uuid := null;
begin
  if auth.uid() is null then
    raise exception 'No autenticado: se requiere inicio de sesión.' using errcode = '28000';
  end if;
  if not public.is_admin() then
    raise exception 'Permiso denegado: solo administración puede registrar nuevos alumnos.' using errcode = '42501';
  end if;

  if exists (select 1 from public.cards where card_number = p_card_number) then
    raise exception 'El número de carné % ya está asignado.', p_card_number using errcode = '23505';
  end if;

  insert into public.profiles (role, first_name, last_name, phone, level, notes)
  values ('student'::public.user_role, p_first_name, coalesce(p_last_name, ''), p_phone, p_level, p_notes)
  returning id into v_profile_id;

  insert into public.cards (student_id, card_number, qr_code, is_active)
  values (v_profile_id, p_card_number, p_card_number, true)
  returning id into v_card_id;

  if p_plan_name is not null then
    if p_plan_price is null or p_plan_price <= 0 then
      raise exception 'El precio del plan debe ser explícito y mayor que cero.' using errcode = '22003';
    end if;

    insert into public.memberships (student_id, plan_name, price, status)
    values (v_profile_id, p_plan_name, p_plan_price, 'past_due'::public.membership_status)
    returning id into v_membership_id;
  end if;

  return query select v_profile_id, v_card_id, p_card_number, v_membership_id;
end;
$$;

revoke all on function public.create_student_transactional(text, text, text, text, text, text, text, numeric) from public, anon;
grant execute on function public.create_student_transactional(text, text, text, text, text, text, text, numeric) to authenticated;

-- ------------------------------------------------------------------------------
-- 14. DATOS SEMILLA (Seed Data)
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
