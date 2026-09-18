-- ==============================================================================
-- IN MOTION DANCE ACADEMY - MIGRACIÓN 002: CONCURRENCIA, ASISTENCIA Y PAGOS IDEMPOTENTES
-- Orden de ejecución: 2 de 2
-- Descripción:
--   1. RPC public.get_or_create_session:
--      - Exige sesión autenticada.
--      - Autoriza exclusivamente a admin o maestro asignado (classes.teacher_id).
--      - Valida correspondencia de fecha con día de clase y estado no cerrado.
--      - search_path seguro (public, pg_temp).
--   2. RPC public.sync_session_attendances y set_attendance:
--      - Validación estricta en servidor de inscripción, fecha y permisos de maestro.
--      - Sincronización atómica transaccional de listas completas (marcar y desmarcar).
--      - Soporta listas vacías para desmarcar el ámbito consultado sin fallos parciales.
--   3. RPC public.register_payment_idempotent:
--      - Validación de período (YYYY-MM) e importe positivo en servidor.
--      - Detección estricta de conflicto si se reutiliza clave de idempotencia con datos alterados.
--   4. RPC public.create_student_transactional:
--      - Creación transaccional de perfil, carné y membresía con precio explícito (sin deducciones por texto).
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 1. APERTURA CONCURRENTE Y SEGURA DE SESIONES DE CLASE
-- ------------------------------------------------------------------------------
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
  -- 1. Exigir sesión autenticada
  if auth.uid() is null then
    raise exception 'No autenticado: se requiere sesión iniciada para abrir sesiones de clase.'
      using errcode = '28000';
  end if;

  -- 2. Validar existencia de la clase
  select id, teacher_id, weekday into v_class
  from public.classes
  where id = p_class_id;

  if v_class.id is null then
    raise exception 'Clase no encontrada: %', p_class_id
      using errcode = 'P0002';
  end if;

  -- 3. Validar permisos: solo administración o el maestro asignado por teacher_id
  if not (public.is_admin() or v_class.teacher_id = public.current_profile_id()) then
    raise exception 'Permiso denegado: solo el maestro asignado o administración pueden abrir sesiones de esta clase.'
      using errcode = '42501';
  end if;

  -- 4. Validar fecha respecto al día de la semana de la clase (0=Domingo, 6=Sábado)
  v_dow := extract(dow from p_session_date)::smallint;
  if v_class.weekday <> v_dow then
    raise exception 'Fecha no válida: la clase % está programada para el día % y se intentó abrir en día %.',
      p_class_id, v_class.weekday, v_dow
      using errcode = '22023';
  end if;

  -- 5. Insertar o recuperar atómicamente evitando errores de concurrencia
  insert into public.class_sessions (class_id, session_date, opened_by)
  values (p_class_id, p_session_date, public.current_profile_id())
  on conflict (class_id, session_date) do update
    set opened_at = class_sessions.opened_at
  returning id into v_session_id;

  -- 6. Verificar que la sesión no esté cerrada
  if exists (select 1 from public.class_sessions where id = v_session_id and closed_at is not null) then
    raise exception 'La sesión de clase para la fecha % ya está cerrada.' using errcode = '22000';
  end if;

  return v_session_id;
end;
$$;

revoke all on function public.get_or_create_session(text, date) from public, anon;
grant execute on function public.get_or_create_session(text, date) to authenticated;

-- ------------------------------------------------------------------------------
-- 2. GESTIÓN ATÓMICA DE ASISTENCIA (BATCH TRANSACCIONAL)
-- Sincroniza la lista completa de una sesión en una sola transacción.
-- Si p_present_student_ids está vacío, desmarca todos los alumnos del ámbito.
-- ------------------------------------------------------------------------------
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
  -- 1. Obtener o crear sesión validando permisos y fecha
  v_session_id := public.get_or_create_session(p_class_id, p_session_date);

  -- 2. Convertir método seguro
  if p_method = 'qr_scan' then
    v_method := 'qr_scan'::attendance_method;
  else
    v_method := 'manual_list'::attendance_method;
  end if;

  -- 3. Validar que TODOS los alumnos marcados estén activamente inscritos en esta clase
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

  -- 4. Transacción atómica: Marcar alumnos presentes
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

  -- 5. Transacción atómica: Desmarcar físicamente alumnos del ámbito no presentes
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

-- Registro individual para escaneo QR
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
    -- Validar inscripción activa
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

-- ------------------------------------------------------------------------------
-- 3. REGISTRO IDEMPOTENTE DE PAGOS CON VALIDACIÓN Y DETECCIÓN DE CONFLICTO
-- ------------------------------------------------------------------------------
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
  v_expected_price numeric;
begin
  -- 1. Exigir autenticación y rol de administración
  if auth.uid() is null then
    raise exception 'No autenticado: se requiere inicio de sesión.' using errcode = '28000';
  end if;
  if not public.is_admin() then
    raise exception 'Permiso denegado: solo administración puede registrar pagos.' using errcode = '42501';
  end if;

  -- 2. Validar período (formato YYYY-MM)
  if p_period !~ '^\d{4}-(0[1-9]|1[0-2])$' then
    raise exception 'Período no válido (debe ser formato AAAA-MM): %', p_period using errcode = '22007';
  end if;

  -- 3. Validar importe positivo
  if p_amount is null or p_amount <= 0 then
    raise exception 'El monto del pago debe ser mayor que cero.' using errcode = '22003';
  end if;

  -- 4. Validar existencia del alumno
  if not exists (select 1 from public.profiles where id = p_student_id) then
    raise exception 'Alumno no encontrado: %', p_student_id using errcode = 'P0002';
  end if;

  -- 5. Validar cuota vigente en servidor según membresía (sin inventar cuotas si falta información)
  select m.price into v_expected_price
  from public.memberships m
  where m.student_id = p_student_id
    and m.status in ('active', 'past_due')
  order by m.created_at desc
  limit 1;

  if v_expected_price is null then
    raise exception 'No se encontró una cuota o plan vigente para el alumno %.', p_student_id
      using errcode = '22000';
  end if;

  if p_amount < v_expected_price then
    raise exception 'El monto Q % no cubre la cuota requerida de Q % para este alumno.',
      p_amount, v_expected_price
      using errcode = '22003';
  end if;

  -- 6. Detección previa de conflicto por idempotency_key reutilizada
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

  -- 7. Detección previa de pago existente para el mismo alumno y período
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

  -- 8. Inserción atómica con resolución de concurrencia simultánea
  begin
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

    -- Actualizar membresía del alumno a active si estaba past_due (el carné sigue desacoplado e independiente)
    update public.memberships
    set status = 'active'
    where student_id = p_student_id
      and status = 'past_due';

    return query select
      v_new_id,
      p_student_id,
      p_period,
      p_amount,
      p_payment_method,
      p_receipt_number,
      false;
    return;
  exception when unique_violation then
    -- Ante inserciones exactamente simultáneas que colisionan con constraints de unicidad
    select p.id, p.student_id, p.period, p.amount, p.payment_method, p.receipt_number
    into v_existing
    from public.payments p
    where (p_idempotency_key is not null and p.idempotency_key = p_idempotency_key)
       or (p.student_id = p_student_id and p.period = p_period)
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
        raise exception 'Conflicto de concurrencia: el pago ya fue registrado con datos diferentes.'
          using errcode = '23505';
      end if;
    end if;
    raise;
  end;
end;
$$;

revoke all on function public.register_payment_idempotent(uuid, text, numeric, text, text, text, text) from public, anon;
grant execute on function public.register_payment_idempotent(uuid, text, numeric, text, text, text, text) to authenticated;

-- ------------------------------------------------------------------------------
-- 4. ALTA TRANSACCIONAL DE ALUMNOS (SIN DEDUCCIONES POR TEXTO)
-- ------------------------------------------------------------------------------
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
  -- 1. Exigir rol de administración
  if auth.uid() is null then
    raise exception 'No autenticado: se requiere inicio de sesión.' using errcode = '28000';
  end if;
  if not public.is_admin() then
    raise exception 'Permiso denegado: solo administración puede registrar nuevos alumnos.' using errcode = '42501';
  end if;

  -- 2. Validar carné no duplicado
  if exists (select 1 from public.cards where card_number = p_card_number) then
    raise exception 'El número de carné % ya está asignado.', p_card_number using errcode = '23505';
  end if;

  -- 3. Crear Perfil
  insert into public.profiles (role, first_name, last_name, phone, level, notes)
  values ('student'::public.user_role, p_first_name, coalesce(p_last_name, ''), p_phone, p_level, p_notes)
  returning id into v_profile_id;

  -- 4. Crear Carné estático permanente
  insert into public.cards (student_id, card_number, qr_code, is_active)
  values (v_profile_id, p_card_number, p_card_number, true)
  returning id into v_card_id;

  -- 5. Crear Membresía inicial con precio explícito si se especificó plan
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
