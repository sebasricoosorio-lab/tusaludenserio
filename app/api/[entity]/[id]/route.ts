// Un registro puntual de una entidad clínica.
//
// GET    /api/{entity}/{id}  → ver un registro
// PATCH  /api/{entity}/{id}  → corregirlo (rectificación)
// DELETE /api/{entity}/{id}  → borrar ese registro puntual

import { z } from 'zod';
import { route, ok, ApiError, dbError } from '@/lib/http';
import { requireUser, requireConsent, auditRead, parseBody } from '@/lib/guard';
import { getEntity } from '@/lib/entities';
import { paraCorreccion } from '@/lib/schemas';

type Ctx = { params: Promise<{ entity: string; id: string }> };

const uuid = z.string().uuid();

// Valida entidad e id. Un id mal formado se trata como "no encontrado".
async function resolver(ctx: Ctx) {
  const { entity, id } = await ctx.params;
  const cfg = getEntity(entity);
  if (!uuid.safeParse(id).success) throw new ApiError(404, 'NOT_FOUND', 'Registro no encontrado.');
  return { cfg, id };
}

export const GET = route<Ctx>(async (_req, ctx) => {
  const { cfg, id } = await resolver(ctx);
  const { supabase } = await requireUser();
  await auditRead(supabase, cfg.table, id);

  const { data, error } = await supabase.from(cfg.table).select('*').eq('id', id).maybeSingle();
  if (error) throw dbError(error);
  if (!data) throw new ApiError(404, 'NOT_FOUND', 'Registro no encontrado.');
  return ok(data);
});

export const PATCH = route<Ctx>(async (req, ctx) => {
  const { cfg, id } = await resolver(ctx);
  const { supabase } = await requireUser();
  await requireConsent(supabase);
  const body = await parseBody(req, paraCorreccion(cfg.create));

  const { data, error } = await supabase
    .from(cfg.table)
    .update(body)
    .eq('id', id)
    .select()
    .maybeSingle();
  if (error) throw dbError(error);
  if (!data) throw new ApiError(404, 'NOT_FOUND', 'Registro no encontrado.');
  return ok(data);
});

export const DELETE = route<Ctx>(async (_req, ctx) => {
  const { cfg, id } = await resolver(ctx);
  const { supabase } = await requireUser();

  const { data, error } = await supabase.from(cfg.table).delete().eq('id', id).select('id').maybeSingle();
  if (error) throw dbError(error);
  if (!data) throw new ApiError(404, 'NOT_FOUND', 'Registro no encontrado.');
  return ok({ id: data.id, deleted: true });
});
