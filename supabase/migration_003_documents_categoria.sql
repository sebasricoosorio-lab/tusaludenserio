-- =====================================================================
-- Migración 003 — Categoría de los documentos clínicos
-- Aplicar UNA vez en Supabase Dashboard → SQL Editor, DESPUÉS de
-- migration_002_documents.sql.
--
-- Agrega especialidad y una descripción corta, opcionales, para poder
-- agrupar los documentos en la interfaz en vez de mostrarlos todos en
-- una sola lista plana.
-- =====================================================================

alter table public.documents
  add column specialty_name text,
  add column description text check (description is null or length(trim(description)) <= 300);
