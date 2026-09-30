// POST /api/auth/reset-password  { email }
// Envía un correo con un enlace de un solo uso para poner una contraseña
// nueva. El enlace vuelve a /auth/reset, que canjea el código por una
// sesión y redirige a /nueva-password para escribir la contraseña.

import { route, ok } from '@/lib/http';
import { parseBody } from '@/lib/guard';
import { resetPasswordBody } from '@/lib/schemas';
import { createClient } from '@/lib/supabase/server';
import { env } from '@/lib/env';

export const POST = route(async (req) => {
  const { email } = await parseBody(req, resetPasswordBody);
  const supabase = await createClient();

  await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${env.siteUrl()}/auth/reset`,
  });

  // Respuesta igual haya o no error/cuenta: no revela si el correo existe.
  return ok({ message: 'Si el correo tiene una cuenta, te enviamos un enlace para poner una contraseña nueva.' });
});
