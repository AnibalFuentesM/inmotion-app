-- ==============================================================================
-- IN MOTION DANCE ACADEMY - MIGRACIÓN 002: CONCURRENCIA, ASISTENCIA Y PAGOS IDEMPOTENTES
-- Orden de ejecución: 2 de 2
-- Descripción:
--   1. RPC public.get_or_create_session: Resuelve colisiones concurrentes al abrir sesiones de clase.
--   2. RPC public.set_attendance: Maneja marcación y desmarcación atómica de asistencia.
--   3. RPC public.register_payment_idempotent: Registro seguro e idempotente de pagos por período.
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 1. RESOLUCIÓN DE CONCURRENCIA EN SESIONES DE CLASE
-- Evita el error de llave duplicada (unique class_id, session_date) cuando
-- maestro y recepción o múltiples pestañas abren la sesión al mismo tiempo.
-- ------------------------------------------------------------------------------
create or replace function public.get_or_create_session(
  p_class_id text,
  p_session_date date default current_date
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_session_id uuid;
begin
  -- Intenta insertar la sesión; si ya existe, obtiene la existente de forma atómica
  insert into public.class_sessions (class_id, session_date, opened_by)
  values (p_class_id, p_session_date, public.current_profile_id())
  on conflict (class_id, session_date) do update
    set opened_at = class_sessions.opened_at -- No altera datos, solo fuerza RETURNING
  returning id into v_session_id;

  return v_session_id;
end;
$$;

grant execute on function public.get_or_create_session(text, date) to authenticated;

-- ------------------------------------------------------------------------------
-- 2. GESTIÓN ATÓMICA DE ASISTENCIA (MARCAR Y DESMARCAR)
-- Sincroniza tanto la adición como el retiro de marcas de asistencia.
-- Si p_present es false, elimina el registro para que no reaparezca tras recargar.
-- ------------------------------------------------------------------------------
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
set search_path = public
as $$
declare
  v_session_id uuid;
  v_method attendance_method;
begin
  -- 1. Obtener o crear la sesión de forma atómica
  v_session_id := public.get_or_create_session(p_class_id, p_session_date);

  -- 2. Convertir método seguro
  if p_method = 'manual_list' or p_method = 'manual' then
    v_method := 'manual_list'::attendance_method;
  else
    v_method := 'qr_scan'::attendance_method;
  end if;

  if p_present then
    -- Marcar presente (idempotente vía ON CONFLICT)
    insert into public.attendances (session_id, student_id, status, method, recorded_by, recorded_at)
    values (v_session_id, p_student_id, 'presente'::attendance_status, v_method, public.current_profile_id(), now())
    on conflict (session_id, student_id) do update
      set status = 'presente'::attendance_status,
          method = excluded.method,
          recorded_at = now();

    return query select 'marked'::text, v_session_id, p_student_id, 'presente'::text;
  else
    -- Desmarcar / retirar asistencia: se elimina el registro físico
    delete from public.attendances
    where session_id = v_session_id
      and student_id = p_student_id;

    return query select 'unmarked'::text, v_session_id, p_student_id, 'sin_registro'::text;
  end if;
end;
$$;

grant execute on function public.set_attendance(text, date, uuid, boolean, text) to authenticated;

-- ------------------------------------------------------------------------------
-- 3. REGISTRO IDEMPOTENTE DE PAGOS
-- Garantiza que reintentos de red no dupliquen pagos para el mismo alumno y período.
-- Retorna el registro existente o recién creado con estado de confirmación.
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
set search_path = public
as $$
declare
  v_existing record;
  v_new_id uuid;
begin
  -- Solo administradores pueden registrar pagos
  if not public.is_admin() then
    raise exception 'Permiso denegado: solo administración puede registrar pagos.';
  end if;

  -- 1. Verificar si ya existe pago para ese período o clave de idempotencia
  select p.id, p.student_id, p.period, p.amount, p.payment_method, p.receipt_number
  into v_existing
  from public.payments p
  where (p.student_id = p_student_id and p.period = p_period)
     or (p_idempotency_key is not null and p.idempotency_key = p_idempotency_key)
  limit 1;

  if v_existing.id is not null then
    -- Ya existía: se retorna el registro existente con bandera is_duplicate = true
    return query select
      v_existing.id,
      v_existing.student_id,
      v_existing.period,
      v_existing.amount,
      v_existing.payment_method,
      v_existing.receipt_number,
      true;
    return;
  end if;

  -- 2. Insertar nuevo pago
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

grant execute on function public.register_payment_idempotent(uuid, text, numeric, text, text, text, text) to authenticated;
