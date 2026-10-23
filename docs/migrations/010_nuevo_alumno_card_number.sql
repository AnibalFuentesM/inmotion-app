-- Migración 010: «+ Nuevo alumno» fallaba siempre con
--   column reference "card_number" is ambiguous
-- La función devuelve una columna card_number y la consulta de carné duplicado no
-- calificaba la columna de la tabla. Única diferencia con la versión de 003: el alias c.
-- Ejecutar después de 009. No altera datos.

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
  v_current_period text;
begin
  -- 1. Exigir rol de administración
  if auth.uid() is null then
    raise exception 'No autenticado: se requiere inicio de sesión.' using errcode = '28000';
  end if;
  if not public.is_admin() then
    raise exception 'Permiso denegado: solo administración puede registrar nuevos alumnos.' using errcode = '42501';
  end if;

  -- 2. Validar carné no duplicado
  if exists (select 1 from public.cards c where c.card_number = p_card_number) then
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

  -- 5. Crear Membresía inicial con precio y período explícitos si se especificó plan
  if p_plan_name is not null then
    if p_plan_price is null or p_plan_price <= 0 then
      raise exception 'El precio del plan debe ser explícito y mayor que cero.' using errcode = '22003';
    end if;

    v_current_period := to_char(current_date, 'YYYY-MM');

    insert into public.memberships (student_id, plan_name, price, status, start_date, end_date, period)
    values (
      v_profile_id,
      p_plan_name,
      p_plan_price,
      'past_due'::public.membership_status,
      current_date,
      current_date + interval '1 month',
      v_current_period
    )
    returning id into v_membership_id;
  end if;

  return query select v_profile_id, v_card_id, p_card_number, v_membership_id;
end;
$$;

revoke all on function public.create_student_transactional(text, text, text, text, text, text, text, numeric) from public, anon;
grant execute on function public.create_student_transactional(text, text, text, text, text, text, text, numeric) to authenticated;
