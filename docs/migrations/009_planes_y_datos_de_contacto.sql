-- Migración 009: el plan (pase) de cada alumno manda sobre sus clases, y cada alumno
-- completa sus propios datos de contacto desde la app. Ejecutar después de 008.
-- Decidido por Mariano el 23/10/2026: el plan define qué clases puede tomar el alumno y
-- él marca en la app a cuáles va de verdad (función set_my_classes).
--
-- 1. classes.track: agrupa los dos días de una misma clase (Principiante 1/2 lunes y
--    miércoles es una sola «clase» para el Dancer Pass).
-- 2. pass_plans y pass_plan_classes: qué clases cubre cada pase y cuántas puede elegir.
-- 3. profiles: correo, cumpleaños y contacto de emergencia que llena el alumno.
-- 4. Candado: el alumno solo puede cambiar esos datos de contacto; nombre, teléfono
--    (es su usuario para entrar), nivel y notas los cambia administración.
-- 5. set_my_classes: el alumno guarda sus clases, validadas contra su plan.
-- Se puede correr más de una vez.

begin;

-- 1. Grupo de cada clase ------------------------------------------------------------
alter table public.classes add column if not exists track text;

update public.classes c set track = t.track
from (values
  ('latin-lun', 'latin'), ('latin-mie', 'latin'),
  ('princ12-lun', 'princ12'), ('princ12-mie', 'princ12'),
  ('princ34-lun', 'princ34'), ('princ34-mie', 'princ34'),
  ('avanzado-mar', 'avanzado'), ('avanzado-jue', 'avanzado'),
  ('interm12-mar', 'interm12'), ('interm12-jue', 'interm12'),
  ('urbano-teens-sab', 'urbano-teens'), ('kpop-teens-sab', 'kpop-teens'),
  ('latino-teens-sab', 'latino-teens'),
  ('salsa-cubana-sab', 'salsa-cubana'), ('kpop-dom', 'kpop')
) as t(class_id, track)
where c.id = t.class_id;

-- 2. Catálogo de pases ---------------------------------------------------------------
-- max_tracks: cuántas clases distintas puede elegir (null = sin límite dentro del pase).
create table if not exists public.pass_plans (
  plan_name text primary key,
  price numeric(10,2) not null,
  max_tracks int,
  description text
);

insert into public.pass_plans (plan_name, price, max_tracks, description) values
  ('Dancer Pass',     395, 1,    'Una clase entre semana (sus dos días).'),
  ('Night Pass',      595, null, 'Todas las clases de lunes a jueves en la noche.'),
  ('Weekend Pass',    300, 1,    'Una clase del sábado o del domingo.'),
  ('Teens In Motion', 495, null, 'Clases Teens del sábado: Urbano, K-Pop y Latino.'),
  ('Full In Motion',  750, null, 'Todos los horarios de la academia.')
on conflict (plan_name) do update set
  price = excluded.price, max_tracks = excluded.max_tracks, description = excluded.description;

create table if not exists public.pass_plan_classes (
  plan_name text not null references public.pass_plans(plan_name) on delete cascade,
  class_id text not null references public.classes(id) on delete cascade,
  primary key (plan_name, class_id)
);

insert into public.pass_plan_classes (plan_name, class_id)
select p.plan_name, c.id
from public.pass_plans p
join public.classes c on case p.plan_name
  when 'Dancer Pass'     then c.weekday between 1 and 4
  when 'Night Pass'      then c.weekday between 1 and 4
  when 'Weekend Pass'    then c.id in ('salsa-cubana-sab', 'kpop-dom')
  when 'Teens In Motion' then c.level = 'Teens'
  when 'Full In Motion'  then true
end
on conflict do nothing;

alter table public.pass_plans enable row level security;
alter table public.pass_plan_classes enable row level security;
drop policy if exists "pass_plans_select_auth" on public.pass_plans;
drop policy if exists "pass_plans_admin_all" on public.pass_plans;
drop policy if exists "pass_plan_classes_select_auth" on public.pass_plan_classes;
drop policy if exists "pass_plan_classes_admin_all" on public.pass_plan_classes;
create policy "pass_plans_select_auth" on public.pass_plans for select to authenticated using (true);
create policy "pass_plans_admin_all" on public.pass_plans for all using (public.is_admin()) with check (public.is_admin());
create policy "pass_plan_classes_select_auth" on public.pass_plan_classes for select to authenticated using (true);
create policy "pass_plan_classes_admin_all" on public.pass_plan_classes for all using (public.is_admin()) with check (public.is_admin());

-- 3. Datos de contacto del alumno ----------------------------------------------------
alter table public.profiles
  add column if not exists birth_date date,
  add column if not exists emergency_contact_name text,
  add column if not exists emergency_contact_phone text,
  add column if not exists contact_updated_at timestamptz;

-- 4. Candado de campos ---------------------------------------------------------------
create or replace function public.protect_profile_role()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if not public.is_admin() and not public.is_trusted_backend() then
    if new.role is distinct from old.role then
      raise exception 'Permiso denegado: no se puede alterar el rol de usuario.';
    end if;
    if new.user_id is distinct from old.user_id then
      raise exception 'Permiso denegado: no se puede reasignar el usuario vinculado.';
    end if;
    if new.guardian_id is distinct from old.guardian_id then
      raise exception 'Permiso denegado: no se puede modificar el tutor vinculado.';
    end if;
    if new.first_name is distinct from old.first_name
      or new.last_name is distinct from old.last_name
      or new.phone is distinct from old.phone
      or new.level is distinct from old.level
      or new.notes is distinct from old.notes then
      raise exception 'Permiso denegado: nombre, teléfono, nivel y notas los cambia administración.';
    end if;
    if new.email is distinct from old.email
      or new.birth_date is distinct from old.birth_date
      or new.emergency_contact_name is distinct from old.emergency_contact_name
      or new.emergency_contact_phone is distinct from old.emergency_contact_phone then
      new.contact_updated_at = now();
    end if;
  end if;
  new.updated_at = now();
  return new;
end;
$$;

-- 5. El alumno elige sus clases dentro de su plan ------------------------------------
-- Toma el plan de su membresía más reciente. Las clases que deja de marcar quedan
-- 'cancelled' (no se borran, para no perder su historial de asistencia).
create or replace function public.set_my_classes(p_class_ids text[])
returns setof text
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_student uuid := public.current_profile_id();
  v_plan public.pass_plans%rowtype;
  v_ids text[] := coalesce(array(select distinct unnest(p_class_ids)), '{}');
  v_outside text;
  v_tracks int;
begin
  if v_student is null or public.current_user_role() <> 'student' then
    raise exception 'Solo un alumno puede elegir sus clases.';
  end if;

  select pp.* into v_plan
  from public.memberships m
  join public.pass_plans pp on lower(pp.plan_name) = lower(trim(m.plan_name))
  where m.student_id = v_student and m.status <> 'cancelled'
  order by m.start_date desc, m.created_at desc
  limit 1;

  if v_plan.plan_name is null then
    raise exception 'La academia todavía no ha registrado tu plan. Pregunta en recepción.';
  end if;

  select string_agg(c.name, ', ') into v_outside
  from public.classes c
  where c.id = any(v_ids)
    and not exists (select 1 from public.pass_plan_classes ppc
                    where ppc.plan_name = v_plan.plan_name and ppc.class_id = c.id);
  if v_outside is not null then
    raise exception 'Tu % no incluye: %.', v_plan.plan_name, v_outside;
  end if;
  if exists (select 1 from unnest(v_ids) i where not exists (select 1 from public.classes c where c.id = i)) then
    raise exception 'Una de las clases ya no existe en el horario.';
  end if;

  select count(distinct coalesce(c.track, c.id)) into v_tracks
  from public.classes c where c.id = any(v_ids);
  if v_plan.max_tracks is not null and v_tracks > v_plan.max_tracks then
    raise exception 'Tu % incluye % clase%. Elige solo esa.', v_plan.plan_name, v_plan.max_tracks,
      case when v_plan.max_tracks = 1 then '' else 's' end;
  end if;

  update public.enrollments
  set status = 'cancelled'
  where student_id = v_student and status <> 'cancelled' and not (class_id = any(v_ids));

  insert into public.enrollments (student_id, class_id, status)
  select v_student, i, 'active'::public.enrollment_status from unnest(v_ids) i
  on conflict (student_id, class_id) do update set status = 'active';

  return query select e.class_id from public.enrollments e
    where e.student_id = v_student and e.status = 'active';
end;
$$;

revoke all on function public.set_my_classes(text[]) from public, anon;
grant execute on function public.set_my_classes(text[]) to authenticated;

commit;

notify pgrst, 'reload schema';

-- Revisión: clases que cubre cada pase.
select pp.plan_name, pp.max_tracks, count(ppc.class_id) as clases
from public.pass_plans pp
left join public.pass_plan_classes ppc on ppc.plan_name = pp.plan_name
group by pp.plan_name, pp.max_tracks
order by pp.price;
