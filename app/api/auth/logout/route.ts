// POST /api/auth/logout — cierra la sesión y borra las cookies.

import { route, ok } from '@/lib/http';
import { createClient } from '@/lib/supabase/server';

export const POST = route(async () => {
  const supabase = await createClient();
  await supabase.auth.signOut();
  return ok({ message: 'Sesión cerrada.' });
});
