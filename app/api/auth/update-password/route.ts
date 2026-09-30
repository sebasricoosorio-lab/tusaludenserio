// POST /api/auth/update-password  { password }
// Pone una contraseña nueva. Requiere sesión activa (la que quedó al abrir
// el enlace de /auth/reset).

import { route, ok, ApiError } from '@/lib/http';
import { requireUser, parseBody } from '@/lib/guard';
import { newPasswordBody } from '@/lib/schemas';

export const POST = route(async (req) => {
  const { supabase } = await requireUser();
  const { password } = await parseBody(req, newPasswordBody);

  const { error } = await supabase.auth.updateUser({ password });
  if (error) throw new ApiError(500, 'UPDATE_FAILED', 'No se pudo actualizar la contraseña. Intenta de nuevo.');

  return ok({ message: 'Contraseña actualizada.' });
});
