// Guardias reutilizables: sesión, consentimiento, perfil de paciente y auditoría.

import type { NextRequest } from 'next/server';
import type { SupabaseClient, User } from '@supabase/supabase-js';
import type { ZodTypeAny, z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { ApiError, dbError, validationError } from '@/lib/http';

// 1) Exige sesión válida. getUser() confirma el token con Supabase Auth.
export async function requireUser(): Promise<{ supabase: SupabaseClient; user: User }> {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) {
    throw new ApiError(401, 'UNAUTHENTICATED', 'Debes iniciar sesión para continuar.');
  }
  return { supabase, user: data.user };
}

// 2) Exige consentimiento informado vigente (versión actual, no revocado).
//    Se pide antes de GUARDAR datos. Leer/exportar no lo exige: el titular
//    siempre puede acceder a lo que ya está almacenado (derecho de acceso).
export async function requireConsent(supabase: SupabaseClient): Promise<void> {
  const { data, error } = await supabase.rpc('has_active_consent');
  if (error) throw dbError(error);
  if (data !== true) {
    throw new ApiError(
      403,
      'CONSENT_REQUIRED',
      'Antes de guardar datos debes aceptar el consentimiento informado vigente para el tratamiento de tus datos (POST /api/consents).',
    );
  }
}

// 3) Devuelve el id del paciente del usuario; si no existe, rechaza pidiendo crearlo.
export async function requirePatientId(supabase: SupabaseClient): Promise<string> {
  // El RLS ya limita el resultado a la fila del propio usuario.
  const { data, error } = await supabase.from('patients').select('id').maybeSingle();
  if (error) throw dbError(error);
  if (!data) {
    throw new ApiError(
      409,
      'PROFILE_REQUIRED',
      'Primero debes completar tu perfil de paciente (nombre, documento, fecha de nacimiento y EPS) con POST /api/patient.',
    );
  }
  return data.id as string;
}

// 4) Auditoría de LECTURAS. Se registra ANTES de devolver los datos; si el
//    registro falla, la lectura se rechaza (la trazabilidad no es opcional).
export async function auditRead(
  supabase: SupabaseClient,
  table: string,
  recordId: string | null,
  action: 'select' | 'export' = 'select',
): Promise<void> {
  const { error } = await supabase.rpc('audit_read', {
    p_table: table,
    p_record_id: recordId,
    p_action: action,
  });
  if (error) throw new ApiError(500, 'AUDIT_FAILED', 'No se pudo registrar el acceso; la operación fue cancelada.');
}

// 5) Lee y valida el cuerpo JSON con un esquema zod.
export async function parseBody<S extends ZodTypeAny>(req: NextRequest, schema: S): Promise<z.infer<S>> {
  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    throw new ApiError(400, 'INVALID_JSON', 'El cuerpo de la petición debe ser JSON válido.');
  }
  const result = schema.safeParse(raw);
  if (!result.success) throw validationError(result.error);
  return result.data;
}
