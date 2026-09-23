// POST /api/auth/register  { email, password }
// Crea la cuenta en Supabase Auth. Las contraseñas las maneja Supabase (nunca
// las guardamos ni las registramos). Requiere activar "Confirm email" en el
// panel de Supabase para que el correo se verifique antes del primer login.

import { route, ok, ApiError } from '@/lib/http';
import { parseBody } from '@/lib/guard';
import { registerBody } from '@/lib/schemas';
import { createClient } from '@/lib/supabase/server';
import { env } from '@/lib/env';

export const POST = route(async (req) => {
  const { email, password } = await parseBody(req, registerBody);
  const supabase = await createClient();

  // El enlace de confirmación vuelve a nuestro callback (SITE_URL fijo: no se
  // confía en cabeceras de la petición para evitar redirecciones maliciosas).
  const { error } = await supabase.auth.signUp({
    email,
    password,
    options: { emailRedirectTo: `${env.siteUrl()}/auth/callback` },
  });

  // Solo se informa el error de contraseña débil (es útil y no revela cuentas);
  // cualquier otro error recibe la misma respuesta genérica de abajo.
  if (error && error.code === 'weak_password') {
    throw new ApiError(422, 'WEAK_PASSWORD', 'La contraseña no cumple los requisitos de seguridad. Usa una más larga y variada.');
  }

  // Respuesta idéntica exista o no el correo (no revelar qué correos están registrados).
  return ok({
    message: 'Si el correo es válido, te enviamos un mensaje para confirmar tu cuenta.',
  });
});
