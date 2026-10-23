-- Migración 006: columnas de profiles que la app usa y que la base real no tenía.
-- La carga de alumnos falló con «Could not find the 'level' column of 'profiles'».
-- Solo agrega columnas si faltan; no toca datos.

alter table public.profiles
  add column if not exists email text,
  add column if not exists phone text,
  add column if not exists level text,
  add column if not exists notes text;

-- Que la API vea las columnas nuevas sin esperar.
notify pgrst, 'reload schema';
