-- ==============================================================================
-- IN MOTION DANCE ACADEMY - SUPABASE SCHEMA (PostgreSQL)
-- Modelo de datos oficial según las reglas operativas de In Motion
-- ==============================================================================

-- 1. EXTENSIONES Y TIPOS
create extension if not exists "uuid-ossp";

do $$ begin
  create type user_role as enum ('student', 'teacher', 'admin', 'guardian');
exception when duplicate_object then null; end $$;

do $$ begin
  create type attendance_status as enum ('presente', 'sin_registro');
exception when duplicate_object then null; end $$;

do $$ begin
  create type attendance_method as enum ('qr_scan', 'manual_list');
exception when duplicate_object then null; end $$;

do $$ begin
  create type enrollment_status as enum ('active', 'paused', 'cancelled');
exception when duplicate_object then null; end $$;

do $$ begin
  create type membership_status as enum ('active', 'past_due', 'cancelled');
exception when duplicate_object then null; end $$;

-- ------------------------------------------------------------------------------
-- 2. TABLA: profiles (Usuarios del sistema vinculados o no a auth.users)
-- ------------------------------------------------------------------------------
create table if not exists public.profiles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  role user_role not null default 'student',
  first_name text not null,
  last_name text not null,
  email text,
  phone text,
  guardian_id uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ------------------------------------------------------------------------------
-- 3. TABLA: cards (Carné permanente y QR estático del alumno)
-- Regla: Carné estático permanente desacoplado del estado de pago
-- ------------------------------------------------------------------------------
create table if not exists public.cards (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.profiles(id) on delete cascade unique,
  card_number text not null unique,
  qr_code text not null unique,
  is_active boolean not null default true,
  issued_at timestamptz not null default now()
);

-- ------------------------------------------------------------------------------
-- 4. TABLA: classes (Disciplinas y horarios de la academia)
-- Regla: Un solo salón físico ('Salón')
-- ------------------------------------------------------------------------------
create table if not exists public.classes (
  id text primary key,
  name text not null,
  level text,
  room text not null default 'Salón',
  teacher_id uuid references public.profiles(id) on delete set null,
  teacher_name text,
  weekday smallint not null check (weekday between 0 and 6),
  time text not null,
  capacity integer not null default 20,
  created_at timestamptz not null default now()
);

-- ------------------------------------------------------------------------------
-- 5. TABLA: enrollments (Inscripción de alumnos en disciplinas específicas)
-- Previene registros cruzados entre clases
-- ------------------------------------------------------------------------------
create table if not exists public.enrollments (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.profiles(id) on delete cascade,
  class_id text not null references public.classes(id) on delete cascade,
  status enrollment_status not null default 'active',
  enrolled_at timestamptz not null default now(),
  unique (student_id, class_id)
);

-- ------------------------------------------------------------------------------
-- 6. TABLA: class_sessions (Sesión abierta en el dispositivo de la academia)
-- Regla: El contexto vive en el dispositivo del salón, no en el QR
-- ------------------------------------------------------------------------------
create table if not exists public.class_sessions (
  id uuid primary key default gen_random_uuid(),
  class_id text not null references public.classes(id) on delete cascade,
  session_date date not null default current_date,
  opened_by uuid references public.profiles(id) on delete set null,
  opened_at timestamptz not null default now(),
  closed_at timestamptz,
  unique (class_id, session_date)
);

-- ------------------------------------------------------------------------------
-- 7. TABLA: attendances (Registro minimalista de asistencia)
-- Regla: Solo 'presente' o 'sin_registro'. Sin tardanzas ni tolerancias.
-- ------------------------------------------------------------------------------
create table if not exists public.attendances (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.class_sessions(id) on delete cascade,
  student_id uuid not null references public.profiles(id) on delete cascade,
  status attendance_status not null default 'presente',
  method attendance_method not null default 'qr_scan',
  recorded_by uuid references public.profiles(id) on delete set null,
  recorded_at timestamptz not null default now(),
  unique (session_id, student_id)
);

-- ------------------------------------------------------------------------------
-- 8. TABLA: memberships (Planes y estado de membresía)
-- Regla: Manejo administrativo de cuotas y fechas de corte
-- ------------------------------------------------------------------------------
create table if not exists public.memberships (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.profiles(id) on delete cascade,
  plan_name text not null,
  price numeric(10,2) not null,
  status membership_status not null default 'active',
  start_date date not null default current_date,
  end_date date not null default (current_date + interval '1 month'),
  created_at timestamptz not null default now()
);

-- ------------------------------------------------------------------------------
-- 9. TABLA: payments (Registro de pagos y mensualidades)
-- ------------------------------------------------------------------------------
create table if not exists public.payments (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.profiles(id) on delete cascade,
  membership_id uuid references public.memberships(id) on delete set null,
  amount numeric(10,2) not null,
  payment_method text not null default 'transferencia',
  receipt_number text,
  notes text,
  recorded_by uuid references public.profiles(id) on delete set null,
  recorded_at timestamptz not null default now()
);

-- ------------------------------------------------------------------------------
-- 10. ROW LEVEL SECURITY (RLS)
-- ------------------------------------------------------------------------------
alter table public.profiles enable row level security;
alter table public.cards enable row level security;
alter table public.classes enable row level security;
alter table public.enrollments enable row level security;
alter table public.class_sessions enable row level security;
alter table public.attendances enable row level security;
alter table public.memberships enable row level security;
alter table public.payments enable row level security;

-- Políticas públicas iniciales de lectura para prototipo/demostración
create policy "Lectura pública de clases" on public.classes for select using (true);
create policy "Lectura pública de perfiles" on public.profiles for select using (true);
create policy "Lectura pública de carnés" on public.cards for select using (true);
create policy "Lectura pública de inscripciones" on public.enrollments for select using (true);
create policy "Lectura pública de sesiones" on public.class_sessions for select using (true);
create policy "Lectura pública de asistencias" on public.attendances for select using (true);
create policy "Lectura pública de membresías" on public.memberships for select using (true);
create policy "Lectura pública de pagos" on public.payments for select using (true);

-- Políticas de escritura para inserciones y actualizaciones desde el cliente demo
create policy "Gestión de perfiles" on public.profiles for all using (true) with check (true);
create policy "Gestión de carnés" on public.cards for all using (true) with check (true);
create policy "Gestión de inscripciones" on public.enrollments for all using (true) with check (true);
create policy "Gestión de membresías" on public.memberships for all using (true) with check (true);
create policy "Gestión de clases" on public.classes for all using (true) with check (true);
create policy "Gestión de sesiones de clase" on public.class_sessions for all using (true) with check (true);
create policy "Gestión de asistencias" on public.attendances for all using (true) with check (true);
create policy "Gestión de pagos" on public.payments for all using (true) with check (true);

-- ------------------------------------------------------------------------------
-- 11. DATOS SEMILLA (Seed Data)
-- Clases iniciales del cronograma demo de In Motion
-- ------------------------------------------------------------------------------
insert into public.classes (id, name, level, room, teacher_name, weekday, time, capacity)
values
  ('bachata-inter', 'Bachata Intermedio', 'Nivel intermedio', 'Salón', 'Alex Aquino', 3, '6:00 PM', 18),
  ('salsa-basico', 'Salsa Principiantes', 'Nivel inicial', 'Salón', 'Luis Ramírez', 3, '7:15 PM', 20),
  ('kpop-teens', 'K-Pop Teens', '12 a 17 años', 'Salón', 'Majo Borrayo', 4, '5:00 PM', 18),
  ('latino', 'Baile Latino', 'Todos los niveles', 'Salón', 'Alex Aquino', 4, '7:00 PM', 20),
  ('latino-kids', 'Baile Latino Kids', '7 a 11 años', 'Salón', 'Sofía Castillo', 6, '10:00 AM', 12),
  ('salsa-casino', 'Salsa Casino', 'Nivel avanzado', 'Salón', 'Leo Méndez', 6, '11:30 AM', 14)
on conflict (id) do nothing;
