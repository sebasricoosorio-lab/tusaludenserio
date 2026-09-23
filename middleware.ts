// Middleware de Next.js: se ejecuta antes de cada ruta.
//  1) Fuerza HTTPS en producción (TLS obligatorio, sin excepciones).
//  2) Defensa CSRF: en métodos que modifican datos, si el navegador envía la
//     cabecera Origin, debe coincidir con SITE_URL.
//  3) Refresca la sesión de Supabase.

import { NextResponse, type NextRequest } from 'next/server';
import { updateSession } from '@/lib/supabase/middleware';
import { env, isProduction } from '@/lib/env';

const METODOS_SEGUROS = new Set(['GET', 'HEAD', 'OPTIONS']);

export async function middleware(request: NextRequest) {
  // 1) HTTPS obligatorio (detrás de un proxy, el protocolo real viene en x-forwarded-proto)
  if (isProduction && request.headers.get('x-forwarded-proto') === 'http') {
    const url = request.nextUrl.clone();
    url.protocol = 'https:';
    return NextResponse.redirect(url, 308);
  }

  // 2) CSRF por verificación de origen
  if (!METODOS_SEGUROS.has(request.method)) {
    const origin = request.headers.get('origin');
    if (origin && origin !== new URL(env.siteUrl()).origin) {
      return NextResponse.json(
        { error: { code: 'ORIGIN_NOT_ALLOWED', message: 'Origen de la petición no permitido.' } },
        { status: 403 },
      );
    }
  }

  // 3) Sesión
  return updateSession(request);
}

export const config = {
  // Todo menos archivos estáticos de Next
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
