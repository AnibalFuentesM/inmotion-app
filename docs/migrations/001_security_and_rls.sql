-- ==============================================================================
-- IN MOTION DANCE ACADEMY - MIGRACIÓN 001: SEGURIDAD Y PERMISOS RLS
-- Orden de ejecución: 1 de 2
-- Descripción:
--   1. Elimina explícitamente las 16 políticas permisivas anteriores (USING true / WITH CHECK true).
--   2. Agrega columnas requeridas (level y notes en profiles; period e idempotency_key en payments).
--   3. Establece restricciones de unicidad e idempotencia para pagos (unique student_id, period).
--   4. Implementa funciones con SECURITY DEFINER y search_path seguro para roles, contexto
--      y relaciones, eliminando recursión RLS entre profiles y enrollments.
--   5. Elimina completamente autorizaciones por coincidencia de texto (teacher_name).
--      Usa exclusivamente teacher_id vinculado a auth.uid().
--   6. Protege perfiles de maestros en profiles_select_self (retira or role = 'teacher').
--   7. Implementa triggers para evitar auto-asignación o escalada de privilegios.
--   8. Implementa trigger para validación estricta de inscripción en asistencia.
--   9. Configura políticas RLS granulares por rol: Alumno, Tutor, Maestro y Administración.
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 1. ELIMINACIÓN DE POLÍTICAS PERMISIVAS ANTERIORES
-- ------------------------------------------------------------------------------
drop policy if exists "Lectura pública de clases" on public.classes;
drop policy if exists "Lectura pública de perfiles" on public.profiles;
drop policy if exists "Lectura pública de carnés" on public.cards;
drop policy if exists "Lectura pública de inscripciones" on public.enrollments;
drop policy if exists "Lectura pública de sesiones" on public.class_sessions;
drop policy if exists "Lectura pública de asistencias" on public.attendances;
drop policy if exists "Lectura pública de membresías" on public.memberships;
drop policy if exists "Lectura pública de pagos" on public.payments;

drop policy if exists "Gestión de perfiles" on public.profiles;
drop policy if exists "Gestión de carnés" on public.cards;
drop policy if exists "Gestión de inscripciones" on public.enrollments;
drop policy if exists "Gestión de membresías" on public.memberships;
drop policy if exists "Gestión de clases" on public.classes;
drop policy if exists "Gestión de sesiones de clase" on public.class_sessions;
drop policy if exists "Gestión de asistencias" on public.attendances;
drop policy if exists "Gestión de pagos" on public.payments;

-- Limpieza de políticas anteriores si ya existían
drop policy if exists "classes_select_public" on public.classes;
drop policy if exists "classes_admin_all" on public.classes;
drop policy if exists "profiles_admin_all" on public.profiles;
drop policy if exists "profiles_select_self" on public.profiles;
drop policy if exists "profiles_select_guardian" on public.profiles;
drop policy if exists "profiles_select_teacher" on public.profiles;
drop policy if exists "profiles_update_self" on public.profiles;
drop policy if exists "profiles_insert_self" on public.profiles;
drop policy if exists "cards_admin_all" on public.cards;
drop policy if exists "cards_select_student" on public.cards;
drop policy if exists "cards_select_guardian" on public.cards;
drop policy if exists "cards_select_teacher" on public.cards;
drop policy if exists "enrollments_admin_all" on public.enrollments;
drop policy if exists "enrollments_select_student" on public.enrollments;
drop policy if exists "enrollments_select_guardian" on public.enrollments;
drop policy if exists "enrollments_select_teacher" on public.enrollments;
drop policy if exists "class_sessions_admin_all" on public.class_sessions;
drop policy if exists "class_sessions_teacher_manage" on public.class_sessions;
drop policy if exists "class_sessions_select_student" on public.class_sessions;
drop policy if exists "class_sessions_select_guardian" on public.class_sessions;
drop policy if exists "attendances_admin_all" on public.attendances;
drop policy if exists "attendances_teacher_manage" on public.attendances;
drop policy if exists "attendances_select_student" on public.attendances;
drop policy if exists "attendances_select_guardian" on public.attendances;
drop policy if exists "memberships_admin_all" on public.memberships;
drop policy if exists "memberships_select_student" on public.memberships;
drop policy if exists "memberships_select_guardian" on public.memberships;
drop policy if exists "payments_admin_all" on public.payments;
drop policy if exists "payments_select_student" on public.payments;
drop policy if exists "payments_select_guardian" on public.payments;

-- ------------------------------------------------------------------------------
-- 2. MODIFICACIONES DE ESQUEMA (CAMPOS FALTANTES Y RESTRICCIONES)
-- ------------------------------------------------------------------------------

-- En profiles: nivel de baile y notas administrativas
alter table public.profiles
  add column if not exists level text,
  add column if not exists notes text;

-- En payments: período al que corresponde el pago y clave de idempotencia
alter table public.payments
  add column if not exists period text,
  add column if not exists idempotency_key text;

-- Constraint de unicidad e idempotencia: un solo pago registrado por alumno y período
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'payments_student_period_unique'
  ) then
    alter table public.payments
      add constraint payments_student_period_unique unique (student_id, period);
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'payments_idempotency_key_unique'
  ) then
    alter table public.payments
      add constraint payments_idempotency_key_unique unique (idempotency_key);
  end if;
end $$;

-- ------------------------------------------------------------------------------
-- 3. FUNCIONES AUXILIARES DE ROL Y RELACIONES (SECURITY DEFINER)
-- Impiden recursión infinita en las políticas de profiles y enrollments
-- y aíslan el search_path para evitar inyección.
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

-- Funciones de relación que eliminan ciclos RLS:
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

-- Revocar permisos de anon y público sobre funciones auxiliares
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
-- 4. CONTROL DE PRIVILEGIOS: PREVENIR AUTO-ASIGNACIÓN Y ESCALADA DE ROLES
-- ------------------------------------------------------------------------------
create or replace function public.protect_profile_role()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if not public.is_admin() then
    -- Usuario común no puede alterar su rol
    if new.role is distinct from old.role then
      raise exception 'Permiso denegado: no se puede alterar el rol de usuario.';
    end if;
    -- Usuario común no puede reasignar user_id
    if new.user_id is distinct from old.user_id then
      raise exception 'Permiso denegado: no se puede reasignar el usuario vinculado.';
    end if;
    -- Usuario común no puede modificar guardian_id de terceros
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
    -- Usuarios sin rol admin solo pueden crear su propio perfil con rol 'student'
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

-- ------------------------------------------------------------------------------
-- 5. VALIDACIÓN DE ASISTENCIA EN SERVIDOR
-- Valida que el alumno esté efectivamente inscrito y que quien registra sea
-- exclusivamente el maestro asignado mediante teacher_id o administración.
-- Cero autorización por coincidencia de teacher_name.
-- ------------------------------------------------------------------------------
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
  -- 1. Obtener la clase vinculada a la sesión
  select class_id into v_class_id
  from public.class_sessions
  where id = new.session_id;

  if v_class_id is null then
    raise exception 'La sesión de clase especificada no existe.';
  end if;

  -- 2. Validar que el alumno tenga inscripción activa en la disciplina
  select exists (
    select 1 from public.enrollments
    where student_id = new.student_id
      and class_id = v_class_id
      and status = 'active'
  ) into v_is_enrolled;

  if not v_is_enrolled then
    raise exception 'Inscripción no válida: el alumno no está inscrito activamente en esta clase.';
  end if;

  -- 3. Validar permisos de quien registra (si no es admin) usando únicamente teacher_id
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
-- 6. POLÍTICAS ROW LEVEL SECURITY (RLS) RESTRICTIVAS Y GRANULARES
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
-- Regla: El catálogo y horarios son públicos para consulta; gestión solo admin.
create policy "classes_select_public" on public.classes
  for select using (true);

create policy "classes_admin_all" on public.classes
  for all using (public.is_admin()) with check (public.is_admin());

-- TABLA: profiles
-- Regla: Alumno consulta solo su propio perfil (user_id = auth.uid()).
--        Retirado "or role = 'teacher'" para proteger datos privados de maestros.
--        Tutor consulta los suyos e hijos vinculados.
--        Maestro consulta alumnos inscritos en sus clases (vía teacher_has_student).
--        Admin gestiona todo.
create policy "profiles_admin_all" on public.profiles
  for all using (public.is_admin()) with check (public.is_admin());

create policy "profiles_select_self" on public.profiles
  for select using (
    user_id = auth.uid()
  );

create policy "profiles_select_guardian" on public.profiles
  for select using (
    public.guardian_has_student(public.current_profile_id(), id)
  );

create policy "profiles_select_teacher" on public.profiles
  for select using (
    public.is_teacher() and public.teacher_has_student(public.current_profile_id(), id)
  );

create policy "profiles_update_self" on public.profiles
  for update using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy "profiles_insert_self" on public.profiles
  for insert with check (user_id = auth.uid());

-- TABLA: cards
-- Regla: Alumno consulta su carné; Tutor los de sus hijos; Admin gestiona.
create policy "cards_admin_all" on public.cards
  for all using (public.is_admin()) with check (public.is_admin());

create policy "cards_select_student" on public.cards
  for select using (
    student_id = public.current_profile_id()
  );

create policy "cards_select_guardian" on public.cards
  for select using (
    public.guardian_has_student(public.current_profile_id(), student_id)
  );

create policy "cards_select_teacher" on public.cards
  for select using (
    public.is_teacher() and public.teacher_has_student(public.current_profile_id(), student_id)
  );

-- TABLA: enrollments
-- Regla: Alumno consulta sus inscripciones; Tutor las de sus hijos; Maestro las de sus clases; Admin gestiona.
create policy "enrollments_admin_all" on public.enrollments
  for all using (public.is_admin()) with check (public.is_admin());

create policy "enrollments_select_student" on public.enrollments
  for select using (
    student_id = public.current_profile_id()
  );

create policy "enrollments_select_guardian" on public.enrollments
  for select using (
    public.guardian_has_student(public.current_profile_id(), student_id)
  );

create policy "enrollments_select_teacher" on public.enrollments
  for select using (
    public.is_teacher() and public.teacher_has_class(public.current_profile_id(), class_id)
  );

-- TABLA: class_sessions
-- Regla: Admin gestiona; Maestro abre y consulta sesiones de sus clases; Alumnos y Tutores consultan.
create policy "class_sessions_admin_all" on public.class_sessions
  for all using (public.is_admin()) with check (public.is_admin());

create policy "class_sessions_teacher_manage" on public.class_sessions
  for all using (
    public.is_teacher() and public.teacher_has_class(public.current_profile_id(), class_id)
  ) with check (
    public.is_teacher() and public.teacher_has_class(public.current_profile_id(), class_id)
  );

create policy "class_sessions_select_student" on public.class_sessions
  for select using (
    exists (
      select 1 from public.enrollments e
      where e.class_id = class_sessions.class_id
        and e.student_id = public.current_profile_id()
        and e.status = 'active'
    )
  );

create policy "class_sessions_select_guardian" on public.class_sessions
  for select using (
    exists (
      select 1 from public.enrollments e
      where e.class_id = class_sessions.class_id
        and public.guardian_has_student(public.current_profile_id(), e.student_id)
        and e.status = 'active'
    )
  );

-- TABLA: attendances
-- Regla: Admin gestiona todo; Maestro gestiona asistencia de sus clases; Alumno y Tutor solo consultan.
create policy "attendances_admin_all" on public.attendances
  for all using (public.is_admin()) with check (public.is_admin());

create policy "attendances_teacher_manage" on public.attendances
  for all using (
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

create policy "attendances_select_student" on public.attendances
  for select using (
    student_id = public.current_profile_id()
  );

create policy "attendances_select_guardian" on public.attendances
  for select using (
    public.guardian_has_student(public.current_profile_id(), student_id)
  );

-- TABLA: memberships
-- Regla: Admin gestiona; Alumno y Tutor consultan las propias; Maestro no tiene acceso.
create policy "memberships_admin_all" on public.memberships
  for all using (public.is_admin()) with check (public.is_admin());

create policy "memberships_select_student" on public.memberships
  for select using (
    student_id = public.current_profile_id()
  );

create policy "memberships_select_guardian" on public.memberships
  for select using (
    public.guardian_has_student(public.current_profile_id(), student_id)
  );

-- TABLA: payments
-- Regla: Admin gestiona altas y consultas; Alumno y Tutor consultan las propias; Maestro NO tiene acceso.
create policy "payments_admin_all" on public.payments
  for all using (public.is_admin()) with check (public.is_admin());

create policy "payments_select_student" on public.payments
  for select using (
    student_id = public.current_profile_id()
  );

create policy "payments_select_guardian" on public.payments
  for select using (
    public.guardian_has_student(public.current_profile_id(), student_id)
  );
