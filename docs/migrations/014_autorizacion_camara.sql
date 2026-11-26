-- ==============================================================================
-- 014 · Autorización para registrar asistencia con la cámara (reconocimiento facial)
-- ==============================================================================
-- Primera parte de la asistencia con cámara: solo la autorización de cada alumno.
-- La base NO guarda fotos ni plantillas de rostro: eso vive en la computadora de la
-- academia que lee la cámara (fase 2). Aquí queda quién autorizó, con qué texto y cuándo.
--
-- 1. face_consents: historial de decisiones (aceptó / no aceptó / retiró). Nunca se
--    edita ni se borra una fila: la última de cada alumno es su estado vigente y las
--    anteriores son la prueba de lo que autorizó y cuándo.
-- 2. set_my_face_consent: el alumno registra su decisión. Si es menor de edad (por su
--    fecha de nacimiento, por el plan Teens In Motion o porque él mismo lo indica),
--    aceptar exige el nombre y el parentesco de quien autoriza.
-- 3. face_consent_status: administración ve el estado vigente de cada alumno activo.
--
-- Se puede correr más de una vez.
-- ==============================================================================

create table if not exists public.face_consents (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.profiles(id) on delete cascade,
  decision text not null check (decision in ('accepted', 'declined', 'revoked')),
  consent_version text not null check (length(consent_version) between 1 and 40),
  is_minor boolean not null default false,
  guardian_name text check (guardian_name is null or length(guardian_name) between 3 and 120),
  guardian_relationship text check (guardian_relationship is null or length(guardian_relationship) between 2 and 60),
  recorded_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  constraint face_consents_minor_needs_guardian check (
    decision <> 'accepted' or not is_minor or (guardian_name is not null and guardian_relationship is not null)
  )
);

create index if not exists idx_face_consents_student_created
  on public.face_consents(student_id, created_at desc);

alter table public.face_consents enable row level security;

-- Leer: el alumno su propio historial; administración todo. Nadie escribe directo:
-- solo por set_my_face_consent (security definer), así no se puede falsear el
-- texto aceptado, la fecha ni quién lo registró.
drop policy if exists "face_consents_select_own" on public.face_consents;
create policy "face_consents_select_own" on public.face_consents
  for select using (student_id = public.current_profile_id());

drop policy if exists "face_consents_select_admin" on public.face_consents;
create policy "face_consents_select_admin" on public.face_consents
  for select using (public.is_admin());

revoke all on public.face_consents from anon, authenticated;
grant select on public.face_consents to authenticated;

-- ------------------------------------------------------------------------------
-- Decisión del alumno
-- ------------------------------------------------------------------------------
create or replace function public.set_my_face_consent(
  p_accept boolean,
  p_version text,
  p_is_minor boolean default false,
  p_guardian_name text default null,
  p_guardian_relationship text default null
)
returns public.face_consents
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_profile_id uuid := public.current_profile_id();
  v_birth date;
  v_plan text;
  v_is_minor boolean;
  v_last text;
  v_decision text;
  v_guardian text := nullif(btrim(coalesce(p_guardian_name, '')), '');
  v_relationship text := nullif(btrim(coalesce(p_guardian_relationship, '')), '');
  v_row public.face_consents;
begin
  if v_profile_id is null then
    raise exception 'No hay una sesión activa.' using errcode = 'P0001';
  end if;
  if public.current_user_role() <> 'student' then
    raise exception 'Solo los alumnos registran esta autorización.' using errcode = 'P0001';
  end if;
  if p_accept is null then
    raise exception 'Indica si aceptas o no.' using errcode = 'P0001';
  end if;
  if nullif(btrim(coalesce(p_version, '')), '') is null then
    raise exception 'Falta la versión del texto de autorización.' using errcode = 'P0001';
  end if;

  select birth_date into v_birth from public.profiles where id = v_profile_id;
  select plan_name into v_plan
    from public.memberships
   where student_id = v_profile_id and status <> 'cancelled'
   order by start_date desc, created_at desc
   limit 1;

  -- Menor de edad si cualquiera de las tres señales lo dice: nunca se descarta lo que
  -- indicó el alumno porque su fecha de nacimiento falte o esté mal.
  v_is_minor := coalesce(p_is_minor, false)
    or (v_birth is not null and v_birth > (current_date - interval '18 years')::date)
    or coalesce(v_plan = 'Teens In Motion', false);

  select decision into v_last
    from public.face_consents
   where student_id = v_profile_id
   order by created_at desc
   limit 1;

  if p_accept then
    v_decision := 'accepted';
    if v_is_minor and (coalesce(length(v_guardian), 0) < 3 or coalesce(length(v_relationship), 0) < 2) then
      raise exception 'Como eres menor de edad, escribe el nombre y el parentesco de tu papá, mamá o encargado que autoriza.' using errcode = 'P0001';
    end if;
    -- Un adulto no lleva encargado: no se guarda lo que haya escrito.
    if not v_is_minor then
      v_guardian := null;
      v_relationship := null;
    end if;
  else
    -- Quien había aceptado y ahora dice que no, retira la autorización.
    v_decision := case when v_last = 'accepted' then 'revoked' else 'declined' end;
    v_guardian := null;
    v_relationship := null;
  end if;

  insert into public.face_consents (student_id, decision, consent_version, is_minor, guardian_name, guardian_relationship, recorded_by)
  values (v_profile_id, v_decision, btrim(p_version), v_is_minor, v_guardian, v_relationship, v_profile_id)
  returning * into v_row;

  return v_row;
end;
$$;

revoke all on function public.set_my_face_consent(boolean, text, boolean, text, text) from public, anon;
grant execute on function public.set_my_face_consent(boolean, text, boolean, text, text) to authenticated;

-- ------------------------------------------------------------------------------
-- Estado vigente por alumno (administración)
-- ------------------------------------------------------------------------------
create or replace function public.face_consent_status()
returns table (
  student_id uuid,
  card_number text,
  first_name text,
  last_name text,
  decision text,
  consent_version text,
  is_minor boolean,
  guardian_name text,
  guardian_relationship text,
  decided_at timestamptz
)
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
begin
  if not public.is_admin() then
    raise exception 'Solo administración puede ver las autorizaciones.' using errcode = 'P0001';
  end if;
  return query
    select p.id, c.card_number, p.first_name, p.last_name,
           f.decision, f.consent_version, f.is_minor, f.guardian_name, f.guardian_relationship, f.created_at
      from public.profiles p
      join public.cards c on c.student_id = p.id and c.is_active
      left join lateral (
        select fc.* from public.face_consents fc
         where fc.student_id = p.id
         order by fc.created_at desc
         limit 1
      ) f on true
     where p.role = 'student'
     order by p.first_name, p.last_name;
end;
$$;

revoke all on function public.face_consent_status() from public, anon;
grant execute on function public.face_consent_status() to authenticated;
