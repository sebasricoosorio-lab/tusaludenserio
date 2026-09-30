// GET /auth/reset?code=...
// Destino del correo de "olvidé mi contraseña". Canjea el código de un solo
// uso por una sesión (igual que /auth/callback) y manda a escribir la
// contraseña nueva. Siempre redirige a SITE_URL (nunca a una URL recibida
// por parámetro).

import { NextResponse, type NextRequest } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { env } from '@/lib/env';

export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get('code');
  const destino = env.siteUrl();

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) return NextResponse.redirect(`${destino}/nueva-password`);
  }
  return NextResponse.redirect(`${destino}/?auth=error`);
}
