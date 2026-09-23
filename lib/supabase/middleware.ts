// Refresca la sesión de Supabase en cada petición: si el token de acceso está
// por vencer, se renueva y las cookies nuevas se devuelven al navegador.

import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';
import { env } from '@/lib/env';
import { sessionCookieOptions } from '@/lib/supabase/cookies';

export async function updateSession(request: NextRequest): Promise<NextResponse> {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(env.supabaseUrl(), env.supabaseAnonKey(), {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(list: { name: string; value: string; options: CookieOptions }[]) {
        for (const { name, value } of list) request.cookies.set(name, value);
        response = NextResponse.next({ request });
        for (const { name, value, options } of list) {
          response.cookies.set(name, value, sessionCookieOptions(options));
        }
      },
    },
  });

  // getUser() valida el token contra Supabase Auth (getSession() solo lo lee
  // de la cookie y no es confiable en el servidor).
  await supabase.auth.getUser();

  return response;
}
