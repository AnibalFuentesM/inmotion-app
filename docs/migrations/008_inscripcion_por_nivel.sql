-- Migración 008: inscribe a cada alumno en las clases de su nivel (profiles.level,
-- tomado del Excel «BASE DE DATOS IM 2026»). Ejecutar después de 007.
-- Equivalencia aprobada por Mariano el 23/10/2026:
--   Nivel 1 → Principiante 1/2 (lunes y miércoles 7:00 PM)
--   Nivel 2 → Principiante 3/4 (lunes y miércoles 8:00 PM)
--   Nivel 3 y Nivel 4 → Intermedio 1/2 (martes y jueves 8:00 PM)
--   Nivel 5 → Avanzado (martes y jueves 7:00 PM)
--   Sábados → Salsa Cubana (Rueda de Casino) (sábado 4:00 PM)
-- Un alumno con dos niveles («Nivel 1, Nivel 2») queda inscrito en ambos.
-- Se puede correr más de una vez: no duplica ni toca inscripciones existentes.

begin;

with equivalencia(nivel, class_id) as (
  values
    ('Nivel 1', 'princ12-lun'), ('Nivel 1', 'princ12-mie'),
    ('Nivel 2', 'princ34-lun'), ('Nivel 2', 'princ34-mie'),
    ('Nivel 3', 'interm12-mar'), ('Nivel 3', 'interm12-jue'),
    ('Nivel 4', 'interm12-mar'), ('Nivel 4', 'interm12-jue'),
    ('Nivel 5', 'avanzado-mar'), ('Nivel 5', 'avanzado-jue'),
    ('Sábados', 'salsa-cubana-sab')
)
insert into public.enrollments (student_id, class_id, status)
select distinct p.id, e.class_id, 'active'::public.enrollment_status
from public.profiles p
join equivalencia e
  on p.level ilike '%' || e.nivel || '%'
where p.role = 'student'
on conflict (student_id, class_id) do nothing;

commit;

-- Revisión: alumnos por clase después de correrla.
select c.name, c.weekday, c.time, count(en.id) as alumnos
from public.classes c
left join public.enrollments en on en.class_id = c.id and en.status = 'active'
group by c.id, c.name, c.weekday, c.time
order by c.weekday, c.time;
