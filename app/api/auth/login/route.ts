// POST /api/auth/login  { email, password }
// Inicia sesión. Supabase devuelve el JWT y @supabase/ssr lo guarda en
// cookies httpOnly. La respuesta NO incluye el token: el frontend jamás lo ve.

import { route, ok, ApiError } from '@/lib/http';
import { parseBody } from '@/lib/guard';
import { loginBody } from '@/lib/schemas';
import { createClient } from '@/lib/supabase/server';

export const POST = route(async (req) => {
  const { email, password } = await parseBody(req, loginBody);
  const supabase = await createClient();

  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) {
    // Mensaje único: no distingue "correo inexistente" de "contraseña errónea".
    throw new ApiError(401, 'INVALID_CREDENTIALS', 'Correo o contraseña incorrectos, o el correo aún no está confirmado.');
  }
  return ok({ message: 'Sesión iniciada.' });
});
