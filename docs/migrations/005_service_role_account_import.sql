-- Migración 005: permitir que la carga de cuentas (scripts/crear-cuentas.mjs) cree perfiles.
-- Ejecutar después de 004. No altera datos existentes.
-- La carga usa la clave service_role desde la computadora de administración, sin sesión de
-- usuario: auth.uid() es nulo, is_admin() da falso y los triggers rechazaban el perfil.
-- Se acepta además la consola SQL de Supabase (session_user postgres). Desde la app nada cambia.

create or replace function public.is_trusted_backend()
returns boolean
language sql
stable
set search_path = public, pg_temp
as $$
  select coalesce(auth.role() = 'service_role', false) or session_user = 'postgres';
$$;

revoke all on function public.is_trusted_backend() from public, anon;
grant execute on function public.is_trusted_backend() to authenticated, service_role;

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
  end if;
  new.updated_at = now();
  return new;
end;
$$;

create or replace function public.check_profile_creation()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if not public.is_admin() and not public.is_trusted_backend() then
    if new.user_id is distinct from auth.uid() or new.role <> 'student' then
      raise exception 'Permiso denegado: solo administración puede asignar roles especiales.';
    end if;
  end if;
  return new;
end;
$$;
