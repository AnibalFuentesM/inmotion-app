-- Migración 012: el cobro mes a mes (revisión de producto del 16/11/2026).
-- Ejecutar después de 011. Se puede correr más de una vez.
--
-- 1. memberships.due_date: fecha de corte. Pasada esa fecha la app muestra «En mora».
-- 2. payments.concept: además de la mensualidad se registra la inscripción (Q150).
--    Un pago es único por alumno, mes y concepto. El membership anual (Q125) por ahora
--    no se cobra (Mariano, 16/11/2026); el concepto queda listo por si vuelve.
--    La mensualidad vence el día 5 de cada mes (Mariano, 16/11/2026).
-- 3. register_payment_idempotent: igual que en 004, pero solo mira las mensualidades
--    (la inscripción de un mes ya no choca con la mensualidad de ese mes).
-- 4. register_extra_payment: inscripción (y membership anual, si vuelve a cobrarse).
-- 5. open_month_memberships: «Abrir cobros del mes». Crea la mensualidad del mes a cada
--    alumno con carné activo, con su último plan y el precio de pass_plans. No toca a
--    quien ya la tiene. Antes la mensualidad solo existía si alguien la cargaba a mano.
-- 6. apply_new_student_promo: primer mes a Q250 para quien nunca ha pagado.

begin;

-- 1. Fecha de corte -----------------------------------------------------------------
alter table public.memberships add column if not exists due_date date;

-- 2. Concepto del pago --------------------------------------------------------------
alter table public.payments add column if not exists concept text not null default 'mensualidad';
alter table public.payments drop constraint if exists payments_concept_check;
alter table public.payments add constraint payments_concept_check
  check (concept in ('mensualidad', 'inscripcion', 'membership_anual'));
alter table public.payments drop constraint if exists payments_student_period_unique;
alter table public.payments drop constraint if exists payments_student_period_concept_unique;
alter table public.payments add constraint payments_student_period_concept_unique
  unique (student_id, period, concept);

-- 3. Mensualidad: misma función que 004, filtrando por concepto ----------------------
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
  v_new_id uuid;
  v_recorded_at timestamptz;
  v_expected_price numeric;
  v_membership_id uuid;
  v_effective_method text;
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
  if not exists (select 1 from public.profiles p where p.id = p_student_id) then
    raise exception 'Alumno no encontrado: %', p_student_id using errcode = 'P0002';
  end if;

  v_effective_method := coalesce(nullif(trim(p_payment_method), ''), 'transferencia');

  -- 6. Detección previa de conflicto por idempotency_key reutilizada
  -- Compara todos los datos relevantes: alumno, período, importe, método y referencia/notas
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
        return query select
          v_existing.id,
          v_existing.student_id,
          v_existing.period,
          v_existing.amount,
          v_existing.payment_method,
          v_existing.receipt_number,
          v_existing.notes,
          v_existing.recorded_at,
          true;
        return;
      else
        raise exception 'Conflicto de idempotencia: la clave % ya fue utilizada con datos de pago distintos.',
          p_idempotency_key using errcode = '23505';
      end if;
    end if;
  end if;

  -- 7. Detección previa de pago existente para el mismo alumno y período
  select p.id, p.student_id, p.period, p.amount, p.payment_method, p.receipt_number, p.notes, p.recorded_at
  into v_existing
  from public.payments p
  where p.student_id = p_student_id and p.period = p_period and p.concept = 'mensualidad'
  limit 1;

  if v_existing.id is not null then
    if v_existing.amount = p_amount
       and v_existing.payment_method = v_effective_method
       and coalesce(v_existing.notes, '') = coalesce(p_notes, '')
       and (p_receipt_number is null or coalesce(v_existing.receipt_number, '') = p_receipt_number) then
      return query select
        v_existing.id,
        v_existing.student_id,
        v_existing.period,
        v_existing.amount,
        v_existing.payment_method,
        v_existing.receipt_number,
        v_existing.notes,
        v_existing.recorded_at,
        true;
      return;
    else
      raise exception 'Conflicto: ya existe un pago registrado para este alumno en el período % con datos distintos.',
        p_period using errcode = '23505';
    end if;
  end if;

  -- Solo un pago NUEVO debe validar la cuota correspondiente al mes solicitado (no la última disponible, sin inventar importes)
  select m.id, m.price into v_membership_id, v_expected_price
  from public.memberships m
  where m.student_id = p_student_id
    and (
      m.period = p_period
      or (m.period is null and to_char(m.start_date, 'YYYY-MM') = p_period)
    )
    and m.status in ('active', 'past_due')
  order by m.created_at desc
  limit 1;

  if v_expected_price is null then
    raise exception 'No se encontró una cuota o membresía registrada para el período % y alumno %.',
      p_period, p_student_id
      using errcode = '22000';
  end if;

  -- Regla de pago completo: no aceptar importes distintos de la cuota exacta
  if p_amount <> v_expected_price then
    raise exception 'El monto Q % no coincide con la cuota exacta de Q % requerida para el período %.',
      p_amount, v_expected_price, p_period
      using errcode = '22003';
  end if;

  -- 8. Inserción atómica con resolución de concurrencia simultánea
  begin
    insert into public.payments (
      student_id,
      membership_id,
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
      v_membership_id,
      p_period,
      p_amount,
      v_effective_method,
      p_receipt_number,
      p_notes,
      p_idempotency_key,
      public.current_profile_id(),
      now()
    )
    returning public.payments.id, public.payments.recorded_at into v_new_id, v_recorded_at;

    -- Actualizar ÚNICAMENTE la obligación correspondiente a este período pagado
    if v_membership_id is not null then
      update public.memberships m
      set status = 'active'
      where m.id = v_membership_id
        and m.status = 'past_due';
    end if;

    return query select
      v_new_id,
      p_student_id,
      p_period,
      p_amount,
      v_effective_method,
      p_receipt_number,
      p_notes,
      v_recorded_at,
      false;
    return;
  exception when unique_violation then
    -- Ante inserciones exactamente simultáneas que colisionan con constraints de unicidad
    select p.id, p.student_id, p.period, p.amount, p.payment_method, p.receipt_number, p.notes, p.recorded_at
    into v_existing
    from public.payments p
    where (p_idempotency_key is not null and p.idempotency_key = p_idempotency_key)
       or (p.student_id = p_student_id and p.period = p_period and p.concept = 'mensualidad')
    limit 1;

    if v_existing.id is not null then
      if v_existing.student_id = p_student_id
         and v_existing.period = p_period
         and v_existing.amount = p_amount
         and v_existing.payment_method = v_effective_method
         and coalesce(v_existing.notes, '') = coalesce(p_notes, '')
         and (p_receipt_number is null or coalesce(v_existing.receipt_number, '') = p_receipt_number) then
        return query select
          v_existing.id,
          v_existing.student_id,
          v_existing.period,
          v_existing.amount,
          v_existing.payment_method,
          v_existing.receipt_number,
          v_existing.notes,
          v_existing.recorded_at,
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

-- 4. Inscripción (y membership anual) -------------------------------------------------
create or replace function public.register_extra_payment(
  p_student_id uuid,
  p_concept text,
  p_period text,
  p_amount numeric,
  p_payment_method text default 'efectivo',
  p_receipt_number text default null,
  p_notes text default null,
  p_idempotency_key text default null
)
returns table (id uuid, concept text, period text, amount numeric, payment_method text, recorded_at timestamptz, is_duplicate boolean)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_existing record;
  v_method text := coalesce(nullif(trim(p_payment_method), ''), 'efectivo');
  v_id uuid;
  v_at timestamptz;
begin
  if auth.uid() is null then
    raise exception 'No autenticado: se requiere inicio de sesión.' using errcode = '28000';
  end if;
  if not public.is_admin() then
    raise exception 'Permiso denegado: solo administración puede registrar pagos.' using errcode = '42501';
  end if;
  if p_concept not in ('inscripcion', 'membership_anual') then
    raise exception 'Concepto no válido: %', p_concept using errcode = '22023';
  end if;
  if p_period !~ '^\d{4}-(0[1-9]|1[0-2])$' then
    raise exception 'Período no válido (debe ser formato AAAA-MM): %', p_period using errcode = '22007';
  end if;
  if p_amount is null or p_amount <= 0 then
    raise exception 'El monto del pago debe ser mayor que cero.' using errcode = '22003';
  end if;
  if not exists (select 1 from public.profiles pr where pr.id = p_student_id) then
    raise exception 'Alumno no encontrado: %', p_student_id using errcode = 'P0002';
  end if;

  select p.id, p.concept, p.period, p.amount, p.payment_method, p.recorded_at into v_existing
  from public.payments p
  where (p_idempotency_key is not null and p.idempotency_key = p_idempotency_key)
     or (p.student_id = p_student_id and p.concept = p_concept
         and (p.period = p_period or (p_concept = 'membership_anual' and left(p.period, 4) = left(p_period, 4))))
  limit 1;
  if v_existing.id is not null then
    return query select v_existing.id, v_existing.concept, v_existing.period, v_existing.amount, v_existing.payment_method, v_existing.recorded_at, true;
    return;
  end if;

  insert into public.payments (student_id, period, amount, payment_method, receipt_number, notes, idempotency_key, recorded_by, concept)
  values (p_student_id, p_period, p_amount, v_method, p_receipt_number, p_notes, p_idempotency_key, public.current_profile_id(), p_concept)
  returning public.payments.id, public.payments.recorded_at into v_id, v_at;

  return query select v_id, p_concept, p_period, p_amount, v_method, v_at, false;
end;
$$;

revoke all on function public.register_extra_payment(uuid, text, text, numeric, text, text, text, text) from public, anon;
grant execute on function public.register_extra_payment(uuid, text, text, numeric, text, text, text, text) to authenticated;

-- 5. Abrir cobros del mes -----------------------------------------------------------
create or replace function public.open_month_memberships(p_period text, p_due_day int default 5)
returns int
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_start date;
  v_end date;
  v_due date;
  v_count int;
begin
  if auth.uid() is null then
    raise exception 'No autenticado: se requiere inicio de sesión.' using errcode = '28000';
  end if;
  if not public.is_admin() then
    raise exception 'Permiso denegado: solo administración puede abrir los cobros del mes.' using errcode = '42501';
  end if;
  if p_period !~ '^\d{4}-(0[1-9]|1[0-2])$' then
    raise exception 'Período no válido (debe ser formato AAAA-MM): %', p_period using errcode = '22007';
  end if;
  if p_due_day is null or p_due_day < 1 or p_due_day > 28 then
    raise exception 'El día de corte debe estar entre 1 y 28.' using errcode = '22023';
  end if;

  v_start := to_date(p_period || '-01', 'YYYY-MM-DD');
  v_end := (v_start + interval '1 month' - interval '1 day')::date;
  v_due := v_start + (p_due_day - 1);

  -- Ponerle fecha de corte a las mensualidades del mes que ya existían sin ella.
  update public.memberships m set due_date = v_due
  where m.period = p_period and m.due_date is null and m.status <> 'cancelled';

  with last_plan as (
    select distinct on (m.student_id) m.student_id, m.plan_name, m.price
    from public.memberships m
    join public.profiles pr on pr.id = m.student_id and pr.role = 'student'
    join public.cards c on c.student_id = m.student_id and c.is_active
    where m.status <> 'cancelled'
      and coalesce(m.period, to_char(m.start_date, 'YYYY-MM')) < p_period
    order by m.student_id, coalesce(m.period, to_char(m.start_date, 'YYYY-MM')) desc, m.created_at desc
  ), inserted as (
    insert into public.memberships (student_id, plan_name, price, status, start_date, end_date, period, due_date)
    select lp.student_id, lp.plan_name, coalesce(pp.price, lp.price), 'past_due', v_start, v_end, p_period, v_due
    from last_plan lp
    left join public.pass_plans pp on pp.plan_name = lp.plan_name
    where not exists (
      select 1 from public.memberships m2
      where m2.student_id = lp.student_id and m2.period = p_period and m2.status <> 'cancelled'
    )
    returning 1
  )
  select count(*) into v_count from inserted;

  return v_count;
end;
$$;

revoke all on function public.open_month_memberships(text, int) from public, anon;
grant execute on function public.open_month_memberships(text, int) to authenticated;

-- 6. Promoción de alumno nuevo ------------------------------------------------------
create or replace function public.apply_new_student_promo(p_student_id uuid, p_period text, p_price numeric default 250)
returns numeric
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_membership_id uuid;
begin
  if auth.uid() is null then
    raise exception 'No autenticado: se requiere inicio de sesión.' using errcode = '28000';
  end if;
  if not public.is_admin() then
    raise exception 'Permiso denegado: solo administración aplica promociones.' using errcode = '42501';
  end if;
  if exists (select 1 from public.payments p where p.student_id = p_student_id and p.concept = 'mensualidad') then
    raise exception 'La promoción de alumno nuevo es solo para quien no ha pagado mensualidades.' using errcode = '22023';
  end if;

  select m.id into v_membership_id
  from public.memberships m
  where m.student_id = p_student_id and m.period = p_period and m.status <> 'cancelled'
  order by m.created_at desc
  limit 1;
  if v_membership_id is null then
    raise exception 'No hay mensualidad de % para este alumno.', p_period using errcode = '22000';
  end if;

  update public.memberships set price = p_price where id = v_membership_id;
  return p_price;
end;
$$;

revoke all on function public.apply_new_student_promo(uuid, text, numeric) from public, anon;
grant execute on function public.apply_new_student_promo(uuid, text, numeric) to authenticated;

commit;
