// GET /api/export — derecho de ACCESO (Ley 1581): descarga en JSON de TODOS
// los datos del titular: perfil, historia clínica, consentimientos, solicitudes
// de eliminación y el registro de quién accedió a sus datos.

import { NextResponse } from 'next/server';
import { route, dbError } from '@/lib/http';
import { requireUser, auditRead } from '@/lib/guard';
import { ENTITIES } from '@/lib/entities';

export const GET = route(async () => {
  const { supabase, user } = await requireUser();

  // Se audita la exportación antes de leer nada.
  await auditRead(supabase, 'all', null, 'export');

  // Todas las consultas pasan por RLS: solo devuelven filas del propio usuario.
  const leer = async (tabla: string, orden: string) => {
    const { data, error } = await supabase.from(tabla).select('*').order(orden, { ascending: false });
    if (error) throw dbError(error);
    return data ?? [];
  };

  const { data: paciente, error: ePac } = await supabase.from('patients').select('*').maybeSingle();
  if (ePac) throw dbError(ePac);

  const clinicas: Record<string, unknown[]> = {};
  for (const [nombre, cfg] of Object.entries(ENTITIES)) {
    clinicas[nombre] = await leer(cfg.table, cfg.orderBy);
  }

  const paquete = {
    exported_at: new Date().toISOString(),
    format_version: 1,
    account: { user_id: user.id, email: user.email ?? null },
    patient: paciente,
    ...clinicas,
    consents: await leer('consents', 'created_at'),
    deletion_requests: await leer('deletion_requests', 'requested_at'),
    access_log: await leer('audit_log', 'occurred_at'),
  };

  // Se entrega como archivo descargable y sin caché.
  return new NextResponse(JSON.stringify(paquete, null, 2), {
    status: 200,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Content-Disposition': 'attachment; filename="mis-datos-portal-paciente.json"',
      'Cache-Control': 'no-store',
    },
  });
});
