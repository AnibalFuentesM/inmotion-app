-- Migración 013: el maestro pasa lista desde la app con datos reales.
-- Ejecutar después de 012. Se puede correr más de una vez.
--
-- Hasta ahora la lista de una clase eran solo los alumnos con inscripción activa en ella,
-- pero esa inscripción solo existe si el alumno marcó «Elegir mis clases» (o si
-- administración le cargó la clase del Dancer/Weekend en «Completar datos»). Un alumno
-- con Night Pass, Full o Teens que no ha marcado sus clases no salía en ninguna lista y
-- el servidor no dejaba marcarlo presente.
--
-- 1. student_can_attend: un alumno con carné activo puede estar en la lista de una clase si está inscrito
--    en ella, o si su último plan cubre esa clase y (el plan no tiene límite de clases,
--    o todavía no eligió ninguna).
-- 2. class_roster: la lista de cada clase para el maestro asignado (o administración),
--    con carné, nombre, plan y si está inscrito. Solo carnés activos: quien tiene el plan
--    «Ya no viene» en Completar datos no sale.
-- 3. validate_attendance_record, sync_session_attendances y set_attendance usan la misma
--    regla de student_can_attend en vez de exigir inscripción.
-- 4. get_or_create_session: no deja pasar lista de una fecha futura, y el maestro solo
--    puede corregir listas de los últimos 14 días (administración, cualquier fecha).
--    Además una clase sin maestro asignado ya no la puede abrir cualquier maestro (antes
--    teacher_id null dejaba pasar a todos).
-- 4b. El maestro ya no escribe directo en class_sessions ni attendances (las políticas de
--    001 le daban escritura total y así se saltaba las reglas de fecha): solo lee, y guarda
--    por sync_session_attendances / set_attendance, que validan todo.
-- 4c. Toda sesión, aunque administración escriba directo en la tabla, cae en el día de su
--    clase y nunca en el futuro (trigger en class_sessions).
-- 5. song_requests: la Rockola deja de vivir en el navegador del alumno. El alumno pide
--    canciones para una clase de su lista; el maestro de esa clase las ve con
--    class_song_requests y las suma a su playlist con review_song_request.
-- 6. set_my_classes (009) toma el plan igual que student_can_attend: la última membresía
--    no cancelada, aunque su plan no esté en el catálogo.

begin;

-- 1. ¿Puede este alumno estar en la lista de esta clase? ------------------------------
create or replace function public.student_can_attend(p_student_id uuid, p_class_id text)
returns boolean
language sql
security definer
set search_path = public, pg_temp
stable
as $$
  -- Solo responde por uno mismo, o a maestros y administración (no sirve para espiar a otro alumno).
  select (public.is_admin() or public.is_teacher() or public.is_trusted_backend()
          or p_student_id = public.current_profile_id())
  and exists (
    select 1 from public.cards k where k.student_id = p_student_id and k.is_active is not false
  ) and (exists (
    select 1 from public.enrollments e
    where e.student_id = p_student_id and e.class_id = p_class_id and e.status = 'active'
  ) or exists (
    select 1
    from (
      select m.plan_name
      from public.memberships m
      where m.student_id = p_student_id and m.status <> 'cancelled'
      order by m.start_date desc, m.created_at desc
      limit 1
    ) last_plan
    join public.pass_plans pp on lower(pp.plan_name) = lower(trim(last_plan.plan_name))
    join public.pass_plan_classes ppc on ppc.plan_name = pp.plan_name and ppc.class_id = p_class_id
    where pp.max_tracks is null
       or not exists (
         select 1 from public.enrollments e2
         where e2.student_id = p_student_id and e2.status = 'active'
       )
  ));
$$;

revoke all on function public.student_can_attend(uuid, text) from public, anon;
grant execute on function public.student_can_attend(uuid, text) to authenticated;

-- 2. Lista de cada clase ---------------------------------------------------------------
-- p_class_id null = todas las clases que la persona puede ver (las suyas, o todas si es
-- administración). Una sola llamada al entrar a la app.
-- payment_status: la mensualidad del mes en curso, para que el maestro sepa a quién
-- recordarle en persona: 'al_dia', 'pendiente', 'en_mora' (pasó el día de corte) o
-- 'sin_cobro' (administración todavía no abrió los cobros del mes). Sin montos.
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
      when exists (
        select 1 from public.payments pay
        where pay.student_id = p.id and pay.period = v_period and pay.concept = 'mensualidad'
      ) then 'al_dia'
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
    select m.id, m.due_date from public.memberships m
    where m.student_id = p.id and m.status <> 'cancelled'
      and (m.period = v_period or (m.period is null and to_char(m.start_date, 'YYYY-MM') = v_period))
    order by m.created_at desc
    limit 1
  ) cm on true
  where p.role = 'student'
    and (p_class_id is null or c.id = p_class_id)
    and (public.is_admin() or c.teacher_id = public.current_profile_id())
    and public.student_can_attend(p.id, c.id)
  order by c.id, p.first_name, p.last_name;
end;
$$;

revoke all on function public.class_roster(text) from public, anon;
grant execute on function public.class_roster(text) to authenticated;

-- 3a. Validación de cada registro de asistencia ---------------------------------------
create or replace function public.validate_attendance_record()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
#variable_conflict use_column
declare
  v_class_id text;
  v_teacher_id uuid;
begin
  select class_id into v_class_id
  from public.class_sessions
  where id = new.session_id;

  if v_class_id is null then
    raise exception 'La sesión de clase especificada no existe.';
  end if;

  if not public.student_can_attend(new.student_id, v_class_id) then
    raise exception 'El alumno no está en la lista de esta clase (ni inscrito ni con un plan que la cubra).';
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

-- 3b. Apertura de la sesión: sin fechas futuras y, para el maestro, máximo 14 días atrás.
create or replace function public.get_or_create_session(
  p_class_id text,
  p_session_date date default current_date
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
#variable_conflict use_column
declare
  v_class record;
  v_session_id uuid;
  v_dow smallint;
  v_today date := (now() at time zone 'America/Guatemala')::date;
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

  -- coalesce: una clase sin maestro (teacher_id null) no la puede abrir ningún maestro.
  if not (public.is_admin() or coalesce(v_class.teacher_id = public.current_profile_id(), false)) then
    raise exception 'Permiso denegado: solo el maestro asignado o administración pueden abrir sesiones de esta clase.'
      using errcode = '42501';
  end if;

  if p_session_date is null then
    raise exception 'Falta la fecha de la clase.' using errcode = '22023';
  end if;

  v_dow := extract(dow from p_session_date)::smallint;
  if v_class.weekday <> v_dow then
    raise exception 'Esta clase no se da el %: revisa la fecha.', to_char(p_session_date, 'DD/MM/YYYY')
      using errcode = '22023';
  end if;

  if p_session_date > v_today then
    raise exception 'Todavía no se puede pasar lista de la clase del %.', to_char(p_session_date, 'DD/MM/YYYY')
      using errcode = '22023';
  end if;

  if not public.is_admin() and p_session_date < v_today - 14 then
    raise exception 'Solo puedes corregir listas de las últimas dos semanas. Pide a administración que corrija esa fecha.'
      using errcode = '22023';
  end if;

  insert into public.class_sessions (class_id, session_date, opened_by)
  values (p_class_id, p_session_date, public.current_profile_id())
  on conflict (class_id, session_date) do update
    set opened_at = class_sessions.opened_at
  returning id into v_session_id;

  if exists (select 1 from public.class_sessions where id = v_session_id and closed_at is not null) then
    raise exception 'La sesión de clase para la fecha % ya está cerrada.', p_session_date using errcode = '22000';
  end if;

  return v_session_id;
end;
$$;

revoke all on function public.get_or_create_session(text, date) from public, anon;
grant execute on function public.get_or_create_session(text, date) to authenticated;

-- 4b. Maestro: solo lectura directa de sesiones y asistencias de sus clases ------------
drop policy if exists "class_sessions_teacher_manage" on public.class_sessions;
drop policy if exists "class_sessions_select_teacher" on public.class_sessions;
create policy "class_sessions_select_teacher" on public.class_sessions
  for select using (
    public.is_teacher() and public.teacher_has_class(public.current_profile_id(), class_id)
  );

drop policy if exists "attendances_teacher_manage" on public.attendances;
drop policy if exists "attendances_select_teacher" on public.attendances;
create policy "attendances_select_teacher" on public.attendances
  for select using (
    public.is_teacher() and exists (
      select 1 from public.class_sessions s
      where s.id = attendances.session_id
        and public.teacher_has_class(public.current_profile_id(), s.class_id)
    )
  );

-- 4c. Las mismas reglas de fecha para cualquier escritura en class_sessions --------------
-- get_or_create_session ya las valida, pero administración tiene escritura directa en la
-- tabla (política class_sessions_admin_all) y por ahí podía crear sesiones futuras o en
-- otro día. Para todos: el día de la semana de la clase y nada futuro. Más de 14 días
-- atrás, solo administración o la consola (importaciones).
create or replace function public.validate_class_session_date()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_weekday smallint;
  v_today date := (now() at time zone 'America/Guatemala')::date;
begin
  select weekday into v_weekday from public.classes where id = new.class_id;
  if v_weekday is not null and v_weekday <> extract(dow from new.session_date)::smallint then
    raise exception 'Esta clase no se da el %: revisa la fecha.', to_char(new.session_date, 'DD/MM/YYYY')
      using errcode = '22023';
  end if;
  if new.session_date > v_today then
    raise exception 'Todavía no se puede pasar lista de la clase del %.', to_char(new.session_date, 'DD/MM/YYYY')
      using errcode = '22023';
  end if;
  if new.session_date < v_today - 14 and not (public.is_admin() or public.is_trusted_backend()) then
    raise exception 'Solo puedes corregir listas de las últimas dos semanas. Pide a administración que corrija esa fecha.'
      using errcode = '22023';
  end if;
  return new;
end;
$$;

revoke all on function public.validate_class_session_date() from public, anon, authenticated;

drop trigger if exists trg_validate_class_session_date on public.class_sessions;
create trigger trg_validate_class_session_date
  before insert or update of class_id, session_date on public.class_sessions
  for each row execute function public.validate_class_session_date();

-- 3c. Guardar la lista completa de una sesión ------------------------------------------
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
#variable_conflict use_column
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
    where not public.student_can_attend(s.id, p_class_id);

    if v_invalid_count > 0 then
      raise exception '% alumno(s) marcados no están en la lista de esta clase.', v_invalid_count
        using errcode = '23503';
    end if;

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
      delete from public.attendances a
      where a.session_id = v_session_id
        and a.student_id = any(p_scope_student_ids)
        and (p_present_student_ids is null or not (a.student_id = any(p_present_student_ids)))
      returning a.student_id
    )
    select count(*) into v_unmarked_count from deleted;
  end if;

  return query select 'synced'::text, v_session_id, v_present_count, v_unmarked_count;
end;
$$;

revoke all on function public.sync_session_attendances(text, date, uuid[], uuid[], text) from public, anon;
grant execute on function public.sync_session_attendances(text, date, uuid[], uuid[], text) to authenticated;

-- 3d. Marcar o desmarcar a un alumno ----------------------------------------------------
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
#variable_conflict use_column
declare
  v_session_id uuid;
  v_method attendance_method;
begin
  v_session_id := public.get_or_create_session(p_class_id, p_session_date);

  if p_method = 'manual' or p_method = 'manual_list' then
    v_method := 'manual_list'::attendance_method;
  else
    v_method := 'qr_scan'::attendance_method;
  end if;

  if p_present then
    if not public.student_can_attend(p_student_id, p_class_id) then
      raise exception 'El alumno no está en la lista de esta clase (ni inscrito ni con un plan que la cubra).'
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
    delete from public.attendances a
    where a.session_id = v_session_id
      and a.student_id = p_student_id;

    return query select 'unmarked'::text, v_session_id, p_student_id, 'sin_registro'::text;
  end if;
end;
$$;

revoke all on function public.set_attendance(text, date, uuid, boolean, text) from public, anon;
grant execute on function public.set_attendance(text, date, uuid, boolean, text) to authenticated;

-- 5. Canciones pedidas por los alumnos (Rockola) ---------------------------------------
create table if not exists public.song_requests (
  id uuid primary key default gen_random_uuid(),
  class_id text not null references public.classes(id) on delete cascade,
  student_id uuid not null references public.profiles(id) on delete cascade,
  song text not null default '' check (char_length(song) <= 120),
  artist text not null default '' check (char_length(artist) <= 120),
  mood_id text not null default 'sed' check (char_length(mood_id) <= 30),
  status text not null default 'pending' check (status in ('pending', 'accepted')),
  liked boolean not null default false,
  created_at timestamptz not null default now(),
  reviewed_at timestamptz,
  check (char_length(trim(song)) > 0 or char_length(trim(artist)) > 0)
);
create index if not exists idx_song_requests_class on public.song_requests (class_id, created_at desc);

alter table public.song_requests enable row level security;
drop policy if exists "song_requests_admin_all" on public.song_requests;
drop policy if exists "song_requests_select_own" on public.song_requests;
drop policy if exists "song_requests_insert_own" on public.song_requests;
drop policy if exists "song_requests_delete_own_pending" on public.song_requests;
create policy "song_requests_admin_all" on public.song_requests
  for all using (public.is_admin()) with check (public.is_admin());
create policy "song_requests_select_own" on public.song_requests
  for select using (student_id = public.current_profile_id());
-- El alumno solo pide para clases de su lista, y la canción entra pendiente.
create policy "song_requests_insert_own" on public.song_requests
  for insert with check (
    student_id = public.current_profile_id()
    and status = 'pending' and liked = false and reviewed_at is null
    and public.student_can_attend(student_id, class_id)
  );
create policy "song_requests_delete_own_pending" on public.song_requests
  for delete using (student_id = public.current_profile_id() and status = 'pending');

-- Máximo 5 canciones pendientes por alumno, para que nadie llene la lista del maestro.
create or replace function public.limit_song_requests()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if (select count(*) from public.song_requests
      where student_id = new.student_id and status = 'pending') >= 5 then
    raise exception 'Ya tienes 5 canciones esperando. Espera a que tu maestro las revise.';
  end if;
  return new;
end;
$$;
drop trigger if exists trg_limit_song_requests on public.song_requests;
create trigger trg_limit_song_requests before insert on public.song_requests
  for each row execute function public.limit_song_requests();

-- El maestro ve las canciones de sus clases con el nombre de quien la pidió (no puede
-- leer el perfil de un alumno que no está inscrito, por eso va por función).
create or replace function public.class_song_requests()
returns table (
  id uuid,
  class_id text,
  card_number text,
  student_name text,
  song text,
  artist text,
  mood_id text,
  status text,
  liked boolean,
  created_at timestamptz
)
language plpgsql
security definer
set search_path = public, pg_temp
stable
as $$
#variable_conflict use_column
begin
  if not (public.is_admin() or public.is_teacher()) then
    raise exception 'Permiso denegado: solo maestros y administración ven las canciones pedidas.'
      using errcode = '42501';
  end if;
  return query
  select r.id, r.class_id,
    (select k.card_number from public.cards k where k.student_id = r.student_id order by k.card_number limit 1),
    trim(coalesce(p.first_name, '') || ' ' || coalesce(p.last_name, '')),
    r.song, r.artist, r.mood_id, r.status, r.liked, r.created_at
  from public.song_requests r
  join public.classes c on c.id = r.class_id
  join public.profiles p on p.id = r.student_id
  where public.is_admin() or c.teacher_id = public.current_profile_id()
  order by r.created_at desc
  limit 300;
end;
$$;
revoke all on function public.class_song_requests() from public, anon;
grant execute on function public.class_song_requests() to authenticated;

-- Sumar a la playlist / quitar, y el «me gusta» del maestro.
drop function if exists public.review_song_request(uuid, text, boolean);
create or replace function public.review_song_request(p_id uuid, p_status text, p_liked boolean)
returns boolean
language plpgsql
security definer
set search_path = public, pg_temp
as $$
#variable_conflict use_column
begin
  if p_status not in ('pending', 'accepted') then
    raise exception 'Estado no válido: %', p_status;
  end if;
  update public.song_requests r
  set status = p_status, liked = coalesce(p_liked, r.liked), reviewed_at = now()
  where r.id = p_id
    and (public.is_admin() or exists (
      select 1 from public.classes c
      where c.id = r.class_id and c.teacher_id = public.current_profile_id()
    ));
  if not found then
    raise exception 'Permiso denegado: esa canción no es de una de tus clases.' using errcode = '42501';
  end if;
  return true;
end;
$$;
revoke all on function public.review_song_request(uuid, text, boolean) from public, anon;
grant execute on function public.review_song_request(uuid, text, boolean) to authenticated;

grant select, insert, delete on public.song_requests to authenticated;

-- 6. Elegir mis clases con el mismo plan que usa la lista -------------------------------
-- Antes (009) set_my_classes buscaba la última membresía cuyo plan estuviera en el
-- catálogo: si la última tenía un plan viejo y había un Night Pass anterior, dejaba
-- inscribirse con el Night Pass mientras la lista (student_can_attend) no le daba clases.
-- Ahora las dos miran la última membresía no cancelada.
create or replace function public.set_my_classes(p_class_ids text[])
returns setof text
language plpgsql
security definer
set search_path = public, pg_temp
as $$
#variable_conflict use_column
declare
  v_student uuid := public.current_profile_id();
  v_plan_name text;
  v_plan public.pass_plans%rowtype;
  v_ids text[] := coalesce(array(select distinct unnest(p_class_ids)), '{}');
  v_outside text;
  v_tracks int;
begin
  if v_student is null or public.current_user_role() <> 'student' then
    raise exception 'Solo un alumno puede elegir sus clases.';
  end if;

  select m.plan_name into v_plan_name
  from public.memberships m
  where m.student_id = v_student and m.status <> 'cancelled'
  order by m.start_date desc, m.created_at desc
  limit 1;

  if v_plan_name is null or trim(v_plan_name) = '' then
    raise exception 'La academia todavía no ha registrado tu plan. Pregunta en recepción.';
  end if;

  select pp.* into v_plan
  from public.pass_plans pp
  where lower(pp.plan_name) = lower(trim(v_plan_name));

  if v_plan.plan_name is null then
    raise exception 'Tu plan (%) no tiene clases asignadas en la app. Pregunta en recepción.', trim(v_plan_name);
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

-- Revisión: cuántos alumnos tiene la lista de cada clase y quién es su maestro.
select c.id, c.name, coalesce(c.teacher_name, 'Sin maestro') as maestro,
  count(*) filter (where public.student_can_attend(p.id, c.id)) as en_lista
from public.classes c
cross join public.profiles p
join public.cards k on k.student_id = p.id and k.is_active is not false
where p.role = 'student'
group by c.id, c.name, c.teacher_name, c.weekday, c.time
order by c.weekday, c.time;
