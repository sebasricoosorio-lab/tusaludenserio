// Opciones endurecidas para las cookies de sesión.
// Por defecto @supabase/ssr las deja legibles desde JavaScript (para su cliente
// de navegador). Aquí NO usamos cliente de navegador, así que las hacemos
// httpOnly: un script malicioso (XSS) no puede robar la sesión.

import type { CookieOptions } from '@supabase/ssr';
import { isProduction } from '@/lib/env';

export function sessionCookieOptions(options: CookieOptions): CookieOptions {
  return {
    ...options,
    httpOnly: true,
    secure: isProduction, // solo viaja por HTTPS en producción
    sameSite: 'lax',
    path: '/',
  };
}
