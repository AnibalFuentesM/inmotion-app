-- Migración 011: administración reinicia la contraseña de un alumno desde su ficha.
-- Pedido por Mariano el 29/10/2026. Los alumnos entran con su teléfono y no tienen un
-- correo que reciba un enlace de recuperación, así que la reinicia recepción.
--
-- admin_reset_password(p_profile_id):
--   1. Solo administración. No reinicia cuentas de administración.
--   2. Pone una contraseña temporal de 8 caracteres (sin 0/O ni 1/l/I) y la devuelve
--      para dictarla. No queda guardada en ninguna tabla.
--   3. Borra user_metadata.password_changed_at: al entrar, la app pide crear una nueva.
--   4. Cierra las sesiones abiertas de esa cuenta.
-- Ejecutar después de 010. No altera datos hasta que alguien usa el botón.

create or replace function public.admin_reset_password(p_profile_id uuid)
returns text
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  v_user_id uuid;
  v_role public.user_role;
  v_alphabet constant text := 'abcdefghjkmnpqrstuvwxyz23456789';
  v_bytes bytea := extensions.gen_random_bytes(8);
  v_password text := '';
begin
  if auth.uid() is null then
    raise exception 'No autenticado: se requiere inicio de sesión.' using errcode = '28000';
  end if;
  if not public.is_admin() then
    raise exception 'Permiso denegado: solo administración puede reiniciar contraseñas.' using errcode = '42501';
  end if;

  select p.user_id, p.role into v_user_id, v_role from public.profiles p where p.id = p_profile_id;
  if not found then
    raise exception 'No se encontró el perfil.' using errcode = 'P0002';
  end if;
  if v_user_id is null then
    raise exception 'Esta persona todavía no tiene cuenta para entrar a la app.' using errcode = 'P0002';
  end if;
  if v_role = 'admin' then
    raise exception 'Las cuentas de administración no se reinician desde aquí.' using errcode = '42501';
  end if;

  for i in 0..7 loop
    v_password := v_password || substr(v_alphabet, 1 + get_byte(v_bytes, i) % length(v_alphabet), 1);
  end loop;

  update auth.users
     set encrypted_password = extensions.crypt(v_password, extensions.gen_salt('bf')),
         raw_user_meta_data = coalesce(raw_user_meta_data, '{}'::jsonb) - 'password_changed_at',
         updated_at = now()
   where id = v_user_id;

  delete from auth.sessions where user_id = v_user_id;

  return v_password;
end;
$$;

revoke all on function public.admin_reset_password(uuid) from public, anon;
grant execute on function public.admin_reset_password(uuid) to authenticated;
