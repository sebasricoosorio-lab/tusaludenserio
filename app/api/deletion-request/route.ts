// Derecho de cancelación / supresión (Ley 1581).
//
// POST /api/deletion-request  { reason? } → registra la solicitud (queda "pending")
// GET  /api/deletion-request              → ver el estado de mis solicitudes
//
// A propósito NO borra nada de inmediato: un responsable verifica la identidad
// y decide (algunos datos podrían tener obligación legal de conservación).
// El procedimiento administrativo está documentado al final de supabase/schema.sql.

import { route, ok, ApiError, dbError } from '@/lib/http';
import { requireUser, parseBody } from '@/lib/guard';
import { deletionBody } from '@/lib/schemas';

export const GET = route(async () => {
  const { supabase } = await requireUser();
  const { data, error } = await supabase
    .from('deletion_requests')
    .select('id, status, requested_at, resolved_at')
    .order('requested_at', { ascending: false });
  if (error) throw dbError(error);
  return ok(data);
});

export const POST = route(async (req) => {
  const { supabase } = await requireUser();
  // Cuerpo vacío permitido: el motivo es opcional.
  const body = await parseBody(req, deletionBody).catch((e) => {
    if (e instanceof ApiError && e.code === 'INVALID_JSON') return { reason: null };
    throw e;
  });

  const { data, error } = await supabase
    .from('deletion_requests')
    .insert({ reason: body.reason ?? null })
    .select('id, status, requested_at')
    .single();
  if (error) {
    if (error.code === '23505') {
      throw new ApiError(409, 'REQUEST_PENDING', 'Ya tienes una solicitud de eliminación pendiente.');
    }
    throw dbError(error);
  }
  return ok(
    { ...data, message: 'Recibimos tu solicitud de eliminación. Verificaremos tu identidad y te responderemos.' },
    201,
  );
});
