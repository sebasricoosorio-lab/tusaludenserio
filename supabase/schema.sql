-- =====================================================================
-- Portal del Paciente (tusaludenserio) — Esquema de base de datos, Fase 1
-- Postgres + Supabase Auth + Row Level Security (RLS)
--
-- Cómo aplicarlo: Supabase Dashboard → SQL Editor → pegar y ejecutar.
-- Regla de oro: NINGUNA tabla con datos personales o médicos queda sin RLS.
-- Ley 1581 de 2012 (Habeas Data): consentimiento, trazabilidad, ARCO.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. TEXTOS DE CONSENTIMIENTO (versionados)
--    Cada versión del texto legal se guarda aquí, inmutable. El paciente
--    acepta una versión concreta, así queda probado QUÉ aceptó.
-- ---------------------------------------------------------------------
create table public.consent_texts (
  version    text primary key,                 -- ej. 'v1', 'v2'
  body       text not null,                    -- texto completo mostrado al paciente
  created_at timestamptz not null default now()
);

-- ¡OJO!: este texto es un BORRADOR. Debe ser reemplazado por el texto
-- redactado/revisado por un abogado (autorización de tratamiento de datos
-- sensibles, finalidades, derechos ARCO, responsable del tratamiento).
insert into public.consent_texts (version, body) values (
  'v1',
  'BORRADOR — REEMPLAZAR POR TEXTO LEGAL REVISADO. Autorizo el tratamiento de mis datos personales y datos sensibles de salud para las finalidades del Portal del Paciente. Conozco mis derechos de acceso, rectificación, cancelación y oposición (Ley 1581 de 2012).'
);

-- Devuelve la versión vigente (la más reciente).
create or replace function public.current_consent_version()
returns text
language sql stable security definer set search_path = ''
as $$
  select version from public.consent_texts order by created_at desc limit 1;
$$;

-- ---------------------------------------------------------------------
-- 2. CONSENTIMIENTOS (solo se AGREGAN filas; nunca se editan)
--    El estado actual de un usuario = su fila MÁS RECIENTE.
--    Revocar = agregar una fila con action = 'revoked'.
-- ---------------------------------------------------------------------
create table public.consents (
  id            bigint generated always as identity primary key,
  owner_user_id uuid not null default auth.uid()
                  references auth.users (id) on delete cascade,
  version       text not null references public.consent_texts (version),
  action        text not null check (action in ('accepted', 'revoked')),
  created_at    timestamptz not null default now()
);
create index consents_owner_idx on public.consents (owner_user_id, id desc);

-- ¿El usuario autenticado tiene un consentimiento vigente y NO revocado?
create or replace function public.has_active_consent()
returns boolean
language sql stable security definer set search_path = ''
as $$
  select coalesce((
    select c.action = 'accepted' and c.version = public.current_consent_version()
    from public.consents c
    where c.owner_user_id = (select auth.uid())
    order by c.id desc
    limit 1
  ), false);
$$;

-- ---------------------------------------------------------------------
-- 3. PACIENTES  (regla de esta fase: una cuenta = un paciente)
-- ---------------------------------------------------------------------
create table public.patients (
  id                      uuid primary key default gen_random_uuid(),
  owner_user_id           uuid not null unique default auth.uid()
                            references auth.users (id) on delete cascade,
  full_name               text not null check (length(trim(full_name)) > 0),
  document_number         text not null check (length(trim(document_number)) > 0),
  birth_date              date not null,
  sex                     text check (sex in ('Femenino', 'Masculino', 'Otro')),
  blood_type              text check (blood_type in ('O+','O-','A+','A-','B+','B-','AB+','AB-')),
  phone                   text,
  contact_email           text,
  address                 text,
  emergency_contact_name  text,
  emergency_contact_phone text,
  insurance_eps           text not null check (length(trim(insurance_eps)) > 0),
  created_at              timestamptz not null default now(),
  updated_at              timestamptz not null default now(),
  -- Necesaria para la llave foránea compuesta de las tablas hijas:
  unique (id, owner_user_id)
);

-- ---------------------------------------------------------------------
-- 4. TABLAS HIJAS. Todas llevan patient_id + owner_user_id y una llave
--    foránea COMPUESTA (patient_id, owner_user_id) → patients(id, owner_user_id)
--    así una fila no puede apuntar a un paciente de otro dueño, ni
--    aunque se intente manipular el patient_id.
-- ---------------------------------------------------------------------

-- Historia clínica por especialidad
create table public.specialties (
  id             uuid primary key default gen_random_uuid(),
  patient_id     uuid not null,
  owner_user_id  uuid not null default auth.uid(),
  specialty_name text not null check (length(trim(specialty_name)) > 0),
  doctor_name    text not null check (length(trim(doctor_name)) > 0),
  visit_date     date not null,
  diagnosis      text not null check (length(trim(diagnosis)) > 0),
  note           text,
  recommendation text,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  constraint specialties_patient_fk foreign key (patient_id, owner_user_id)
    references public.patients (id, owner_user_id) on delete cascade
);

create table public.treatments (
  id             uuid primary key default gen_random_uuid(),
  patient_id     uuid not null,
  owner_user_id  uuid not null default auth.uid(),
  name           text not null check (length(trim(name)) > 0),
  specialty_name text not null check (length(trim(specialty_name)) > 0),
  status         text not null check (status in ('En curso','Continuo','Por confirmar','Finalizado')),
  started_on     date not null,
  instructions   text,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  constraint treatments_patient_fk foreign key (patient_id, owner_user_id)
    references public.patients (id, owner_user_id) on delete cascade
);

create table public.labs (
  id              uuid primary key default gen_random_uuid(),
  patient_id      uuid not null,
  owner_user_id   uuid not null default auth.uid(),
  test_name       text not null check (length(trim(test_name)) > 0),
  performed_on    date not null,
  result          text not null check (length(trim(result)) > 0),
  reference_range text,
  status          text not null check (status in ('Normal','Alto','Bajo','Seguimiento')),
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  constraint labs_patient_fk foreign key (patient_id, owner_user_id)
    references public.patients (id, owner_user_id) on delete cascade
);

create table public.medications (
  id            uuid primary key default gen_random_uuid(),
  patient_id    uuid not null,
  owner_user_id uuid not null default auth.uid(),
  name          text not null check (length(trim(name)) > 0),
  dose          text not null check (length(trim(dose)) > 0),
  frequency     text not null check (length(trim(frequency)) > 0),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  constraint medications_patient_fk foreign key (patient_id, owner_user_id)
    references public.patients (id, owner_user_id) on delete cascade
);

create table public.allergies (
  id            uuid primary key default gen_random_uuid(),
  patient_id    uuid not null,
  owner_user_id uuid not null default auth.uid(),
  allergen      text not null check (length(trim(allergen)) > 0),
  reaction      text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  constraint allergies_patient_fk foreign key (patient_id, owner_user_id)
    references public.patients (id, owner_user_id) on delete cascade
);

create table public.appointments (
  id               uuid primary key default gen_random_uuid(),
  patient_id       uuid not null,
  owner_user_id    uuid not null default auth.uid(),
  appointment_date timestamptz not null,
  doctor_name      text not null check (length(trim(doctor_name)) > 0),
  specialty_name   text not null check (length(trim(specialty_name)) > 0),
  location         text not null check (length(trim(location)) > 0),
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  constraint appointments_patient_fk foreign key (patient_id, owner_user_id)
    references public.patients (id, owner_user_id) on delete cascade
);

create table public.timeline (
  id            uuid primary key default gen_random_uuid(),
  patient_id    uuid not null,
  owner_user_id uuid not null default auth.uid(),
  event_date    date not null,
  label         text not null check (length(trim(label)) > 0),
  event_type    text not null check (event_type in ('visita','tratamiento','examen')),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  constraint timeline_patient_fk foreign key (patient_id, owner_user_id)
    references public.patients (id, owner_user_id) on delete cascade
);

-- Índices para las consultas por paciente
create index specialties_patient_idx  on public.specialties  (patient_id);
create index treatments_patient_idx   on public.treatments   (patient_id);
create index labs_patient_idx         on public.labs         (patient_id);
create index medications_patient_idx  on public.medications  (patient_id);
create index allergies_patient_idx    on public.allergies    (patient_id);
create index appointments_patient_idx on public.appointments (patient_id);
create index timeline_patient_idx     on public.timeline     (patient_id);

-- ---------------------------------------------------------------------
-- 5. SOLICITUDES DE ELIMINACIÓN (derecho de cancelación / supresión)
--    El paciente solo puede CREAR y VER su solicitud. La ejecución la hace
--    un proceso administrativo con verificación (ver nota al final).
-- ---------------------------------------------------------------------
create table public.deletion_requests (
  id            uuid primary key default gen_random_uuid(),
  owner_user_id uuid not null default auth.uid()
                  references auth.users (id) on delete cascade,
  reason        text,
  status        text not null default 'pending'
                  check (status in ('pending', 'completed', 'rejected')),
  requested_at  timestamptz not null default now(),
  resolved_at   timestamptz
);
-- Solo una solicitud pendiente por usuario
create unique index deletion_requests_one_pending
  on public.deletion_requests (owner_user_id) where status = 'pending';

-- ---------------------------------------------------------------------
-- 6. AUDITORÍA (trazabilidad: quién, qué registro, cuándo)
--    NUNCA guarda el contenido médico: solo referencias (tabla + id).
--    Es de solo-inserción: no existen políticas de UPDATE ni DELETE.
-- ---------------------------------------------------------------------
create table public.audit_log (
  id            bigint generated always as identity primary key,
  occurred_at   timestamptz not null default now(),
  actor_user_id uuid,          -- quién hizo la acción (null = proceso interno)
  owner_user_id uuid,          -- dueño de los datos (sin FK: el log sobrevive a la eliminación)
  patient_id    uuid,
  action        text not null check (action in ('select','insert','update','delete','export')),
  table_name    text not null,
  record_id     uuid           -- null cuando es una lectura de lista completa
);
create index audit_log_owner_idx on public.audit_log (owner_user_id, occurred_at desc);

-- Registro de ESCRITURAS: lo dispara Postgres solo, no se puede omitir desde la API.
create or replace function public.audit_write()
returns trigger
language plpgsql security definer set search_path = ''
as $$
declare
  v_row     jsonb;
  v_patient uuid;
begin
  v_row := case when tg_op = 'DELETE' then to_jsonb(old) else to_jsonb(new) end;
  v_patient := case when tg_table_name = 'patients'
                    then (v_row ->> 'id')::uuid
                    else (v_row ->> 'patient_id')::uuid end;
  insert into public.audit_log (actor_user_id, owner_user_id, patient_id, action, table_name, record_id)
  values (auth.uid(), (v_row ->> 'owner_user_id')::uuid, v_patient,
          lower(tg_op), tg_table_name, (v_row ->> 'id')::uuid);
  return null;
end;
$$;

-- Registro de LECTURAS: Postgres no tiene triggers de SELECT, así que la API
-- llama a esta función ANTES de devolver datos. Si falla, la API no responde.
create or replace function public.audit_read(
  p_table     text,
  p_record_id uuid default null,
  p_action    text default 'select'
)
returns void
language plpgsql security definer set search_path = ''
as $$
declare
  v_uid     uuid := auth.uid();
  v_patient uuid;
begin
  if v_uid is null then
    raise exception 'No autenticado' using errcode = '28000';
  end if;
  if p_action not in ('select', 'export') then
    raise exception 'Acción de auditoría inválida';
  end if;
  if p_table not in ('patients','specialties','treatments','labs','medications',
                     'allergies','appointments','timeline','all') then
    raise exception 'Tabla de auditoría inválida';
  end if;
  select id into v_patient from public.patients where owner_user_id = v_uid;
  insert into public.audit_log (actor_user_id, owner_user_id, patient_id, action, table_name, record_id)
  values (v_uid, v_uid, v_patient, p_action, p_table, p_record_id);
end;
$$;

-- ---------------------------------------------------------------------
-- 7. updated_at automático
-- ---------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- ---------------------------------------------------------------------
-- 8. RLS EN TODAS LAS TABLAS DE DATOS
--    Lectura/borrado: solo filas con owner_user_id = auth.uid().
--    Inserción/edición: además exige consentimiento vigente (a nivel de
--    base de datos, no solo en la API). Así, aunque alguien saltara la API,
--    no se podrían escribir datos sin consentimiento.
--    (Sin FORCE: las funciones SECURITY DEFINER de auditoría/consentimiento
--    corren como dueño de la tabla y necesitan leerla; la API nunca conecta como dueño.)
-- ---------------------------------------------------------------------
do $$
declare
  t text;
begin
  foreach t in array array[
    'patients','specialties','treatments','labs',
    'medications','allergies','appointments','timeline'
  ] loop
    execute format('alter table public.%I enable row level security', t);

    execute format($p$create policy %I on public.%I for select to authenticated
      using (owner_user_id = (select auth.uid()))$p$, t || '_select_own', t);

    execute format($p$create policy %I on public.%I for insert to authenticated
      with check (owner_user_id = (select auth.uid()) and public.has_active_consent())$p$,
      t || '_insert_own', t);

    execute format($p$create policy %I on public.%I for update to authenticated
      using (owner_user_id = (select auth.uid()))
      with check (owner_user_id = (select auth.uid()) and public.has_active_consent())$p$,
      t || '_update_own', t);

    execute format($p$create policy %I on public.%I for delete to authenticated
      using (owner_user_id = (select auth.uid()))$p$, t || '_delete_own', t);

    execute format('create trigger %I after insert or update or delete on public.%I
      for each row execute function public.audit_write()', t || '_audit', t);

    execute format('create trigger %I before update on public.%I
      for each row execute function public.set_updated_at()', t || '_updated_at', t);
  end loop;
end
$$;

-- consent_texts: texto público de solo lectura (se muestra antes de aceptar).
alter table public.consent_texts enable row level security;
create policy consent_texts_read on public.consent_texts
  for select to anon, authenticated using (true);

-- consents: solo ver las propias y agregar filas propias de la versión vigente.
alter table public.consents enable row level security;
create policy consents_select_own on public.consents
  for select to authenticated using (owner_user_id = (select auth.uid()));
create policy consents_insert_own on public.consents
  for insert to authenticated
  with check (owner_user_id = (select auth.uid())
              and version = public.current_consent_version());

-- deletion_requests: ver y crear las propias (siempre en estado 'pending').
alter table public.deletion_requests enable row level security;
create policy deletion_requests_select_own on public.deletion_requests
  for select to authenticated using (owner_user_id = (select auth.uid()));
create policy deletion_requests_insert_own on public.deletion_requests
  for insert to authenticated
  with check (owner_user_id = (select auth.uid()) and status = 'pending');

-- audit_log: el paciente puede VER quién accedió a sus datos. Nadie escribe
-- directamente (solo las funciones SECURITY DEFINER de arriba).
alter table public.audit_log enable row level security;
create policy audit_log_select_own on public.audit_log
  for select to authenticated using (owner_user_id = (select auth.uid()));

-- ---------------------------------------------------------------------
-- 9. PRIVILEGIOS (defensa en profundidad además del RLS)
-- ---------------------------------------------------------------------
revoke all on all tables in schema public from anon;
grant select on public.consent_texts to anon;          -- texto legal público

revoke all on all tables in schema public from authenticated;
grant select, insert, update, delete on
  public.patients, public.specialties, public.treatments, public.labs,
  public.medications, public.allergies, public.appointments, public.timeline
  to authenticated;
grant select on public.consent_texts to authenticated;
grant select, insert on public.consents, public.deletion_requests to authenticated;
grant select on public.audit_log to authenticated;      -- solo lectura

revoke all on function public.audit_read(text, uuid, text) from public, anon;
grant execute on function public.audit_read(text, uuid, text) to authenticated;
revoke all on function public.has_active_consent() from public, anon;
grant execute on function public.has_active_consent() to authenticated;
revoke all on function public.current_consent_version() from public, anon;
grant execute on function public.current_consent_version() to authenticated, anon;
revoke all on function public.audit_write() from public, anon, authenticated;

-- ---------------------------------------------------------------------
-- NOTA — Proceso administrativo de eliminación (NO se expone por API):
-- Cuando un responsable verifique la identidad y resuelva una solicitud
-- (definir con asesoría legal si algún dato debe conservarse por norma):
--   1) Eliminar el usuario en Supabase Auth (Dashboard → Authentication → Users)
--      o con la Admin API usando service_role, SOLO desde un entorno seguro.
--      Por las llaves ON DELETE CASCADE se borran patients y todas sus hijas.
--   2) Marcar la solicitud: update public.deletion_requests
--        set status = 'completed', resolved_at = now() where id = '...';
--      (la fila se conserva si el usuario no se elimina; si se elimina el
--      usuario, la fila se borra por cascada — guardar la constancia en el
--      sistema de PQR de la empresa.)
--   El audit_log NO se borra: guarda solo referencias, sin datos médicos.
-- ---------------------------------------------------------------------
