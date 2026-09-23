// Consentimiento informado (Ley 1581 de 2012).
//
// GET  /api/consents  → texto vigente + si el usuario ya lo aceptó
// POST /api/consents  { action: 'accepted' | 'revoked', version }
//
// Los consentimientos son un historial de solo-agregar: revocar es agregar una
// fila 'revoked'. Así queda constancia de qué versión se aceptó y cuándo.

import { route, ok, ApiError, dbError } from '@/lib/http';
import { requireUser, parseBody } from '@/lib/guard';
import { consentBody } from '@/lib/schemas';

// Lee la versión vigente y su texto (público por diseño: es el texto legal).
async function textoVigente(supabase: Awaited<ReturnType<typeof requireUser>>['supabase']) {
  const { data, error } = await supabase
    .from('consent_texts')
    .select('version, body, created_at')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw dbError(error);
  if (!data) throw new ApiError(500, 'NO_CONSENT_TEXT', 'No hay un texto de consentimiento configurado.');
  return data;
}

export const GET = route(async () => {
  const { supabase } = await requireUser();
  const vigente = await textoVigente(supabase);

  const { data: activo, error } = await supabase.rpc('has_active_consent');
  if (error) throw dbError(error);

  // Historial propio (RLS: solo filas del usuario).
  const { data: historial, error: e2 } = await supabase
    .from('consents')
    .select('version, action, created_at')
    .order('id', { ascending: false });
  if (e2) throw dbError(e2);

  return ok({ current: vigente, hasActiveConsent: activo === true, history: historial });
});

export const POST = route(async (req) => {
  const { supabase } = await requireUser();
  const { action, version } = await parseBody(req, consentBody);

  // Solo se puede aceptar/revocar la versión vigente (evita aceptar textos viejos).
  const vigente = await textoVigente(supabase);
  if (version !== vigente.version) {
    throw new ApiError(
      409,
      'CONSENT_VERSION_MISMATCH',
      `La versión enviada no es la vigente. Muestra al paciente la versión "${vigente.version}" y vuelve a intentar.`,
    );
  }

  const { error } = await supabase.from('consents').insert({ version, action });
  if (error) throw dbError(error);

  return ok(
    { version, action, message: action === 'accepted' ? 'Consentimiento registrado.' : 'Consentimiento revocado.' },
    201,
  );
});
