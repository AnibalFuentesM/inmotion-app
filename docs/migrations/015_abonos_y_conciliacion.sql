-- Migración 015: abonos a la mensualidad y conciliación de listados (26/11/2026).
-- Ejecutar después de 013 (usa student_can_attend). Se puede correr más de una vez.
-- No depende de la 014: funciona con ella o sin ella.
--
-- Lo pidió Mariano después de probar la app con Majo:
-- 1. Al registrar un pago se puede poner el monto que la persona pagó. Si es menor que
--    la cuota, queda como abono: el mes sigue pendiente con su saldo hasta que los abonos
--    sumen la cuota (decisión de Mariano, 26/11/2026). Nunca se acepta más que el saldo.
-- 2. Si el mes todavía no tiene mensualidad (no se ha usado «Abrir cobros»), el pago la
--    crea con el último plan del alumno y el precio de pass_plans, con vencimiento el día 5.
--    Si el alumno no tiene ningún plan cargado, se rechaza con un mensaje claro.
-- 3. La mensualidad ya no es «un pago por mes»: se quita la restricción única de
--    (alumno, mes, concepto) para la mensualidad y se mantiene para la inscripción.
--    La idempotencia sigue con payments.idempotency_key (única desde la 001): reintentar
--    el mismo abono o volver a cargar el mismo listado no lo duplica.
-- 4. class_roster: el maestro ve «al día» solo cuando lo abonado cubre la cuota.
--
-- Métodos nuevos en la app: «Débito automático» y «VisaLink» (payment_method es texto
-- libre, no hace falta tocar la tabla).

begin;

-- 1. Varias filas de mensualidad por mes; la inscripción sigue siendo una por mes ------------
alter table public.payments drop constraint if exists payments_student_period_unique;
alter table public.payments drop constraint if exists payments_student_period_concept_unique;
drop index if exists public.payments_student_period_concept_unique;
create unique index if not exists payments_extra_concept_unique
  on public.payments (student_id, period, concept)
  where concept <> 'mensualidad';
create index if not exists idx_payments_student_period
  on public.payments (student_id, period);

-- 2. Registrar un pago o abono de mensualidad ---------------------------------------------
-- Misma firma y mismo resultado que en 012: la app no cambia de llamada.
-- Devuelve el abono que se guardó (no el total del mes).
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
  notes text,
  recorded_at timestamptz,
  is_duplicate boolean
)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_existing record;
  v_effective_method text;
  v_membership_id uuid;
  v_price numeric;
  v_paid numeric;
  v_balance numeric;
  v_plan_name text;
  v_plan_price numeric;
  v_start date;
  v_new_id uuid;
  v_recorded_at timestamptz;
begin
  if auth.uid() is null then
    raise exception 'No autenticado: se requiere inicio de sesión.' using errcode = '28000';
  end if;
  if not public.is_admin() then
    raise exception 'Permiso denegado: solo administración puede registrar pagos.' using errcode = '42501';
  end if;
  if p_period is null or p_period !~ '^\d{4}-(0[1-9]|1[0-2])$' then
    raise exception 'Período no válido (debe ser formato AAAA-MM): %', p_period using errcode = '22023';
  end if;
  if p_amount is null or p_amount <= 0 then
    raise exception 'El monto del pago debe ser mayor que cero.' using errcode = '22023';
  end if;
  if round(p_amount, 2) <> p_amount then
    raise exception 'El monto puede tener como máximo dos decimales.' using errcode = '22023';
  end if;
  if not exists (select 1 from public.profiles pr where pr.id = p_student_id) then
    raise exception 'Alumno no encontrado.' using errcode = 'P0002';
  end if;

  v_effective_method := coalesce(nullif(trim(p_payment_method), ''), 'transferencia');
  v_start := to_date(p_period || '-01', 'YYYY-MM-DD');

  -- Reintento del mismo abono (misma clave): se devuelve el original si los datos coinciden.
  if p_idempotency_key is not null then
    select p.id, p.student_id, p.period, p.amount, p.payment_method, p.receipt_number, p.notes, p.recorded_at
    into v_existing
    from public.payments p
    where p.idempotency_key = p_idempotency_key
    limit 1;

    if v_existing.id is not null then
      if v_existing.student_id = p_student_id
         and v_existing.period = p_period
         and v_existing.amount = p_amount
         and v_existing.payment_method = v_effective_method
         and coalesce(v_existing.notes, '') = coalesce(p_notes, '')
         and (p_receipt_number is null or coalesce(v_existing.receipt_number, '') = p_receipt_number) then
        return query select v_existing.id, v_existing.student_id, v_existing.period, v_existing.amount,
          v_existing.payment_method, v_existing.receipt_number, v_existing.notes, v_existing.recorded_at, true;
        return;
      end if;
      raise exception 'Este pago ya se había registrado con otros datos (alumno, mes, monto o método). Revisa los pagos del alumno antes de volver a intentarlo.'
        using errcode = '22023';
    end if;
  end if;

  -- La mensualidad del mes, bloqueada para que dos abonos simultáneos no pasen la cuota.
  select m.id, m.price into v_membership_id, v_price
  from public.memberships m
  where m.student_id = p_student_id
    and (m.period = p_period or (m.period is null and to_char(m.start_date, 'YYYY-MM') = p_period))
    and m.status <> 'cancelled'
  order by m.created_at desc
  limit 1
  for update;

  -- Sin mensualidad del mes: se crea con el último plan del alumno (como «Abrir cobros»).
  if v_membership_id is null then
    perform pg_advisory_xact_lock(hashtext('inmotion-month:' || p_student_id::text || ':' || p_period));
    select m.id, m.price into v_membership_id, v_price
    from public.memberships m
    where m.student_id = p_student_id
      and (m.period = p_period or (m.period is null and to_char(m.start_date, 'YYYY-MM') = p_period))
      and m.status <> 'cancelled'
    order by m.created_at desc
    limit 1
    for update;
  end if;

  -- Con el mes bloqueado, otra llamada con la misma clave ya pudo terminar: se revisa otra vez.
  if p_idempotency_key is not null then
    select p.id, p.student_id, p.period, p.amount, p.payment_method, p.receipt_number, p.notes, p.recorded_at
    into v_existing
    from public.payments p
    where p.idempotency_key = p_idempotency_key
    limit 1;
    if v_existing.id is not null then
      if v_existing.student_id = p_student_id and v_existing.period = p_period and v_existing.amount = p_amount
         and v_existing.payment_method = v_effective_method and coalesce(v_existing.notes, '') = coalesce(p_notes, '')
         and (p_receipt_number is null or coalesce(v_existing.receipt_number, '') = p_receipt_number) then
        return query select v_existing.id, v_existing.student_id, v_existing.period, v_existing.amount,
          v_existing.payment_method, v_existing.receipt_number, v_existing.notes, v_existing.recorded_at, true;
        return;
      end if;
      raise exception 'Este pago ya se había registrado con otros datos (alumno, mes, monto o método). Revisa los pagos del alumno antes de volver a intentarlo.'
        using errcode = '22023';
    end if;
  end if;

  if v_membership_id is null then
    select m.plan_name, m.price into v_plan_name, v_plan_price
    from public.memberships m
    where m.student_id = p_student_id and m.status <> 'cancelled'
    order by (coalesce(m.period, to_char(m.start_date, 'YYYY-MM')) <= p_period) desc,
             coalesce(m.period, to_char(m.start_date, 'YYYY-MM')) desc,
             m.created_at desc
    limit 1;

    if v_plan_name is null then
      raise exception 'Este alumno no tiene plan cargado. Cárgalo en «Completar datos» antes de registrar su pago.'
        using errcode = '22023';
    end if;

    select pp.price into v_price from public.pass_plans pp where pp.plan_name = v_plan_name;
    v_price := coalesce(v_price, v_plan_price);

    insert into public.memberships (student_id, plan_name, price, status, start_date, end_date, period, due_date)
    values (p_student_id, v_plan_name, v_price, 'past_due', v_start,
            (v_start + interval '1 month' - interval '1 day')::date, p_period, v_start + 4)
    returning memberships.id into v_membership_id;
  end if;

  if v_price is null or v_price <= 0 then
    raise exception 'La mensualidad de este mes no tiene cuota definida. Revisa el plan del alumno en «Completar datos».'
      using errcode = '22023';
  end if;

  select coalesce(sum(p.amount), 0) into v_paid
  from public.payments p
  where p.student_id = p_student_id and p.period = p_period and p.concept = 'mensualidad';

  v_balance := v_price - v_paid;
  if v_balance <= 0 then
    raise exception 'La mensualidad de este mes ya está pagada completa.' using errcode = '22023';
  end if;
  if p_amount > v_balance then
    raise exception 'El saldo de este mes es Q %. Registra hasta ese monto; lo que sobre va en otro mes o en otro concepto.',
      to_char(v_balance, 'FM999999990.00') using errcode = '22023';
  end if;

  begin
    insert into public.payments (
      student_id, membership_id, period, amount, payment_method, receipt_number, notes,
      idempotency_key, recorded_by, recorded_at, concept
    )
    values (
      p_student_id, v_membership_id, p_period, p_amount, v_effective_method, p_receipt_number, p_notes,
      p_idempotency_key, public.current_profile_id(), now(), 'mensualidad'
    )
    returning payments.id, payments.recorded_at into v_new_id, v_recorded_at;
  exception when unique_violation then
    -- Dos envíos simultáneos con la misma clave para otro mes o alumno: se devuelve el original.
    select p.id, p.student_id, p.period, p.amount, p.payment_method, p.receipt_number, p.notes, p.recorded_at
    into v_existing
    from public.payments p
    where p.idempotency_key = p_idempotency_key
    limit 1;
    if v_existing.id is not null and v_existing.student_id = p_student_id and v_existing.period = p_period
       and v_existing.amount = p_amount and v_existing.payment_method = v_effective_method
       and coalesce(v_existing.notes, '') = coalesce(p_notes, '') then
      return query select v_existing.id, v_existing.student_id, v_existing.period, v_existing.amount,
        v_existing.payment_method, v_existing.receipt_number, v_existing.notes, v_existing.recorded_at, true;
      return;
    end if;
    raise exception 'Este pago ya se había registrado con otros datos (alumno, mes, monto o método). Revisa los pagos del alumno antes de volver a intentarlo.'
      using errcode = '22023';
  end;

  -- Con la cuota cubierta, la mensualidad deja de estar pendiente.
  if v_paid + p_amount >= v_price then
    update public.memberships m set status = 'active'
    where m.id = v_membership_id and m.status = 'past_due';
  end if;

  return query select v_new_id, p_student_id, p_period, p_amount, v_effective_method,
    p_receipt_number, p_notes, v_recorded_at, false;
end;
$$;

revoke all on function public.register_payment_idempotent(uuid, text, numeric, text, text, text, text) from public, anon;
grant execute on function public.register_payment_idempotent(uuid, text, numeric, text, text, text, text) to authenticated;

-- 3. Lista de clase: «al día» solo con la cuota cubierta --------------------------------------
-- Igual que en 013, salvo el cálculo de payment_status.
drop function if exists public.class_roster(text);
create or replace function public.class_roster(p_class_id text default null)
returns table (
  class_id text,
  student_id uuid,
  card_number text,
  first_name text,
  last_name text,
  plan_name text,
  enrolled boolean,
  payment_status text
)
language plpgsql
security definer
set search_path = public, pg_temp
stable
as $$
#variable_conflict use_column
declare
  v_today date := (now() at time zone 'America/Guatemala')::date;
  v_period text := to_char((now() at time zone 'America/Guatemala')::date, 'YYYY-MM');
begin
  if not (public.is_admin() or public.is_teacher()) then
    raise exception 'Permiso denegado: solo maestros y administración ven las listas de clase.'
      using errcode = '42501';
  end if;

  return query
  select c.id, p.id, cd.card_number, p.first_name, p.last_name, lp.plan_name,
    exists (
      select 1 from public.enrollments e
      where e.student_id = p.id and e.class_id = c.id and e.status = 'active'
    ),
    case
      when pd.total > 0 and (cm.id is null or pd.total >= coalesce(cm.price, 0)) then 'al_dia'
      when cm.id is null then 'sin_cobro'
      when cm.due_date is not null and cm.due_date < v_today then 'en_mora'
      else 'pendiente'
    end
  from public.classes c
  cross join public.profiles p
  join lateral (
    select k.card_number from public.cards k
    where k.student_id = p.id and k.is_active is not false
    order by k.card_number
    limit 1
  ) cd on true
  left join lateral (
    select m.plan_name from public.memberships m
    where m.student_id = p.id and m.status <> 'cancelled'
    order by m.start_date desc, m.created_at desc
    limit 1
  ) lp on true
  left join lateral (
    select m.id, m.due_date, m.price from public.memberships m
    where m.student_id = p.id and m.status <> 'cancelled'
      and (m.period = v_period or (m.period is null and to_char(m.start_date, 'YYYY-MM') = v_period))
    order by m.created_at desc
    limit 1
  ) cm on true
  left join lateral (
    select coalesce(sum(pay.amount), 0) as total from public.payments pay
    where pay.student_id = p.id and pay.period = v_period and pay.concept = 'mensualidad'
  ) pd on true
  where p.role = 'student'
    and (p_class_id is null or c.id = p_class_id)
    and (public.is_admin() or c.teacher_id = public.current_profile_id())
    and public.student_can_attend(p.id, c.id)
  order by c.id, p.first_name, p.last_name, p.id;
end;
$$;

revoke all on function public.class_roster(text) from public, anon;
grant execute on function public.class_roster(text) to authenticated;

commit;

-- Para revisar después de correrla (solo lectura): meses con pagos que no cubren la cuota.
-- Antes de la 015 la base solo aceptaba el pago exacto, así que debería salir vacío.
-- select m.student_id, m.period, m.price, sum(p.amount) as pagado
-- from public.memberships m
-- join public.payments p on p.membership_id = m.id and p.concept = 'mensualidad'
-- where m.status <> 'cancelled'
-- group by m.id having sum(p.amount) < m.price;
