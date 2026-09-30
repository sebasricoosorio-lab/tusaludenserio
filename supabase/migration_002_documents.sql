-- =====================================================================
-- Migración 002 — Documentos clínicos (archivo adjunto, sin OCR)
-- Aplicar UNA vez en Supabase Dashboard → SQL Editor, DESPUÉS de schema.sql.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. TABLA: solo metadata. El archivo en sí vive en Supabase Storage,
--    bucket 'documentos-clinicos', bajo la carpeta '<auth.uid()>/...'.
-- ---------------------------------------------------------------------
create table public.documents (
  id            uuid primary key default gen_random_uuid(),
  patient_id    uuid not null,
  owner_user_id uuid not null default auth.uid(),
  file_path     text not null,                              -- ruta dentro del bucket
  file_name     text not null check (length(trim(file_name)) > 0),
  mime_type     text not null,
  size_bytes    bigint,
  uploaded_at   timestamptz not null default now(),
  constraint documents_patient_fk foreign key (patient_id, owner_user_id)
    references public.patients (id, owner_user_id) on delete cascade
);
create index documents_patient_idx on public.documents (patient_id);

alter table public.documents enable row level security;

create policy documents_select_own on public.documents
  for select to authenticated using (owner_user_id = (select auth.uid()));
create policy documents_insert_own on public.documents
  for insert to authenticated
  with check (owner_user_id = (select auth.uid()) and public.has_active_consent());
create policy documents_delete_own on public.documents
  for delete to authenticated using (owner_user_id = (select auth.uid()));

create trigger documents_audit after insert or update or delete on public.documents
  for each row execute function public.audit_write();

revoke all on public.documents from anon;
revoke all on public.documents from authenticated;
grant select, insert, delete on public.documents to authenticated;

-- Habilita 'documents' como tabla válida para la auditoría de lecturas.
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
                     'allergies','appointments','timeline','documents','all') then
    raise exception 'Tabla de auditoría inválida';
  end if;
  select id into v_patient from public.patients where owner_user_id = v_uid;
  insert into public.audit_log (actor_user_id, owner_user_id, patient_id, action, table_name, record_id)
  values (v_uid, v_uid, v_patient, p_action, p_table, p_record_id);
end;
$$;

-- ---------------------------------------------------------------------
-- 2. BUCKET DE STORAGE (privado) + POLÍTICAS
--    Cada usuario solo puede leer/escribir/borrar dentro de su propia
--    carpeta: el primer segmento de la ruta debe ser su propio auth.uid().
-- ---------------------------------------------------------------------
insert into storage.buckets (id, name, public)
values ('documentos-clinicos', 'documentos-clinicos', false)
on conflict (id) do nothing;

create policy documentos_storage_select_own on storage.objects
  for select to authenticated
  using (bucket_id = 'documentos-clinicos'
    and (select auth.uid())::text = (storage.foldername(name))[1]);

create policy documentos_storage_insert_own on storage.objects
  for insert to authenticated
  with check (bucket_id = 'documentos-clinicos'
    and (select auth.uid())::text = (storage.foldername(name))[1]);

create policy documentos_storage_delete_own on storage.objects
  for delete to authenticated
  using (bucket_id = 'documentos-clinicos'
    and (select auth.uid())::text = (storage.foldername(name))[1]);
