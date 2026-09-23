// Perfil del paciente (una cuenta = un paciente).
//
// GET   /api/patient  → ver mis datos personales (acceso)
// POST  /api/patient  → crear mi perfil (requiere consentimiento)
// PATCH /api/patient  → corregir mis datos (rectificación)
//
// La eliminación NO se hace aquí: se solicita en /api/deletion-request.

import { route, ok, ApiError, dbError } from '@/lib/http';
import { requireUser, requireConsent, requirePatientId, auditRead, parseBody } from '@/lib/guard';
import { patientCreate, patientUpdate } from '@/lib/schemas';

export const GET = route(async () => {
  const { supabase } = await requireUser();
  await auditRead(supabase, 'patients', null);

  // El RLS deja pasar solo la fila del propio usuario.
  const { data, error } = await supabase.from('patients').select('*').maybeSingle();
  if (error) throw dbError(error);
  return ok(data); // null si todavía no creó su perfil
});

export const POST = route(async (req) => {
  const { supabase } = await requireUser();
  await requireConsent(supabase);
  const body = await parseBody(req, patientCreate);

  // owner_user_id se completa solo (DEFAULT auth.uid()) y el RLS lo verifica.
  const { data, error } = await supabase.from('patients').insert(body).select().single();
  if (error) {
    if (error.code === '23505') {
      throw new ApiError(409, 'PROFILE_EXISTS', 'Ya tienes un perfil de paciente. Usa PATCH /api/patient para corregirlo.');
    }
    throw dbError(error);
  }
  return ok(data, 201);
});

export const PATCH = route(async (req) => {
  const { supabase } = await requireUser();
  await requireConsent(supabase);
  const patientId = await requirePatientId(supabase);
  const body = await parseBody(req, patientUpdate);

  const { data, error } = await supabase.from('patients').update(body).eq('id', patientId).select().maybeSingle();
  if (error) throw dbError(error);
  if (!data) throw new ApiError(404, 'NOT_FOUND', 'Registro no encontrado.');
  return ok(data);
});
