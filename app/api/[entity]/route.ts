// Lista y creación para las entidades clínicas:
// specialties, treatments, labs, medications, allergies, appointments, timeline.
//
// GET  /api/{entity}  → listar mis registros
// POST /api/{entity}  → crear un registro (requiere consentimiento + perfil)

import { route, ok, dbError } from '@/lib/http';
import { requireUser, requireConsent, requirePatientId, auditRead, parseBody } from '@/lib/guard';
import { getEntity } from '@/lib/entities';

type Ctx = { params: Promise<{ entity: string }> };

export const GET = route<Ctx>(async (_req, ctx) => {
  const cfg = getEntity((await ctx.params).entity); // 404 si no es una entidad válida
  const { supabase } = await requireUser();

  await auditRead(supabase, cfg.table, null);

  // El RLS limita el resultado a las filas del propio usuario.
  const { data, error } = await supabase
    .from(cfg.table)
    .select('*')
    .order(cfg.orderBy, { ascending: false })
    .limit(200);
  if (error) throw dbError(error);
  return ok(data);
});

export const POST = route<Ctx>(async (req, ctx) => {
  const cfg = getEntity((await ctx.params).entity);
  const { supabase } = await requireUser();

  // Orden de las comprobaciones: consentimiento → perfil → datos del cuerpo.
  await requireConsent(supabase);
  const patientId = await requirePatientId(supabase);
  const body = await parseBody(req, cfg.create);

  // patient_id lo pone SIEMPRE el servidor; el cliente no puede enviarlo (esquema strict).
  const { data, error } = await supabase
    .from(cfg.table)
    .insert({ ...body, patient_id: patientId })
    .select()
    .single();
  if (error) throw dbError(error);
  return ok(data, 201);
});
