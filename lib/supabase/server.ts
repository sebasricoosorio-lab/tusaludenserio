// Cliente de Supabase para rutas de API (servidor).
// Usa la clave ANON + el JWT del usuario guardado en cookies. Por eso Postgres
// ve `auth.uid()` = el paciente logueado y el RLS filtra sus filas.
// NUNCA se usa la clave service_role aquí (esa se salta el RLS).

import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { env } from '@/lib/env';
import { sessionCookieOptions } from '@/lib/supabase/cookies';

export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient(env.supabaseUrl(), env.supabaseAnonKey(), {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(list: { name: string; value: string; options: CookieOptions }[]) {
        try {
          for (const { name, value, options } of list) {
            cookieStore.set(name, value, sessionCookieOptions(options));
          }
        } catch {
          // Puede fallar si se llama desde un contexto de solo lectura; el
          // middleware ya refresca la sesión en cada petición.
        }
      },
    },
  });
}
