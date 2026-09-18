-- Migración 004: recuperar pagos confirmados antes de validar cuotas modificables.
-- Ejecutar después de 003. No cambia la firma ni altera datos existentes.
-- Mantiene autenticación y comparación del contenido antes de devolver el original.

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
  where p.student_id = p_student_id and p.period = p_period
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
       or (p.student_id = p_student_id and p.period = p_period)
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
