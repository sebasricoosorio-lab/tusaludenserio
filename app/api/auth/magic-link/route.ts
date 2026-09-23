// POST /api/auth/magic-link  { email }
// Envía un enlace de acceso de un solo uso al correo (sin contraseña).
// El enlace vuelve a /auth/callback, que canjea el código por una sesión.

import { route, ok } from '@/lib/http';
import { parseBody } from '@/lib/guard';
import { magicLinkBody } from '@/lib/schemas';
import { createClient } from '@/lib/supabase/server';
import { env } from '@/lib/env';

export const POST = route(async (req) => {
  const { email } = await parseBody(req, magicLinkBody);
  const supabase = await createClient();

  await supabase.auth.signInWithOtp({
    email,
    options: {
      emailRedirectTo: `${env.siteUrl()}/auth/callback`,
      shouldCreateUser: true, // permite registrarse solo con el enlace
    },
  });

  // Respuesta igual haya o no error/cuenta: no revela si el correo existe.
  return ok({ message: 'Si el correo es válido, te enviamos un enlace de acceso.' });
});
