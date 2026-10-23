-- Migración 007: horario real de In Motion, octubre a diciembre 2026.
-- Fuente: inmotiongt.com/horarios-y-tarifas (imagen del horario, 23/10/2026).
-- Reemplaza las 6 clases de demostración del seed por las 15 clases reales.
-- Las clases demo no tienen alumnos reales inscritos; al borrarlas se van en
-- cascada solo sus inscripciones, sesiones y asistencias de prueba.
-- weekday sigue a Date.getDay(): 0 domingo, 1 lunes … 6 sábado.
-- Maestros sin asignar todavía (teacher_name null → «Staff In Motion» en la app).

begin;

delete from public.classes
where id in ('bachata-inter', 'salsa-basico', 'kpop-teens', 'latino', 'latino-kids', 'salsa-casino');

insert into public.classes (id, name, level, room, teacher_name, weekday, time, capacity)
values
  ('latin-lun',          'Latin Dance',                     'Nivel abierto',            'Salón', null, 1, '6:00 PM',  20),
  ('princ12-lun',        'Principiante 1/2 Salsa y Bachata', 'Principiante',             'Salón', null, 1, '7:00 PM',  20),
  ('princ34-lun',        'Principiante 3/4 Salsa y Bachata', 'Principiante',             'Salón', null, 1, '8:00 PM',  20),
  ('avanzado-mar',       'Avanzado Salsa y Bachata',         'Avanzado',                 'Salón', null, 2, '7:00 PM',  20),
  ('interm12-mar',       'Intermedio 1/2 Salsa y Bachata',   'Intermedio',               'Salón', null, 2, '8:00 PM',  20),
  ('latin-mie',          'Latin Dance',                     'Nivel abierto',            'Salón', null, 3, '6:00 PM',  20),
  ('princ12-mie',        'Principiante 1/2 Salsa y Bachata', 'Principiante',             'Salón', null, 3, '7:00 PM',  20),
  ('princ34-mie',        'Principiante 3/4 Salsa y Bachata', 'Principiante',             'Salón', null, 3, '8:00 PM',  20),
  ('avanzado-jue',       'Avanzado Salsa y Bachata',         'Avanzado',                 'Salón', null, 4, '7:00 PM',  20),
  ('interm12-jue',       'Intermedio 1/2 Salsa y Bachata',   'Intermedio',               'Salón', null, 4, '8:00 PM',  20),
  ('urbano-teens-sab',   'Urbano Teens',                    'Teens',                    'Salón', null, 6, '9:00 AM',  20),
  ('kpop-teens-sab',     'K-Pop Teens',                     'Teens',                    'Salón', null, 6, '10:00 AM', 20),
  ('latino-teens-sab',   'Latino Teens',                    'Teens',                    'Salón', null, 6, '11:00 AM', 20),
  ('salsa-cubana-sab',   'Salsa Cubana (Rueda de Casino)',  'Nivel abierto',            'Salón', null, 6, '4:00 PM',  20),
  ('kpop-dom',           'K-Pop',                           'Nivel abierto',            'Salón', null, 0, '10:00 AM', 20)
on conflict (id) do update set
  name = excluded.name, level = excluded.level, weekday = excluded.weekday, time = excluded.time;

commit;
